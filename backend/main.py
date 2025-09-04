from typing import List, AsyncGenerator, Dict, Any
from contextlib import asynccontextmanager
from datetime import datetime

from fastapi import Depends, FastAPI, HTTPException, status
from fastapi.responses import StreamingResponse
from sqlmodel import Session, select

from database import get_session, engine, create_db_and_tables
from llm import stream_ollama_response, build_prompt, generate_title, generate_summary
from models import Message, Thread
from schemas import MessageCreate, ThreadCreate, ThreadRead, ThreadReadWithMessages, ThreadUpdate


app = FastAPI()


# --- Threads Endpoints ---

@app.post("/api/threads", response_model=ThreadRead, status_code=status.HTTP_201_CREATED)
def create_thread(thread_in: ThreadCreate, db: Session = Depends(get_session)):
    """
    Create a new thread.
    """
    thread = Thread.model_validate(thread_in)
    db.add(thread)
    db.commit()
    db.refresh(thread)
    return thread


from typing import Optional

@app.get("/api/threads", response_model=List[ThreadRead])
def list_threads(q: Optional[str] = None, skip: int = 0, limit: int = 100, db: Session = Depends(get_session)):
    """
    List all threads, sorted by updated_at descending.
    Optionally filters threads by a search query `q` on the title.
    """
    query = select(Thread).order_by(Thread.updated_at.desc())
    if q:
        query = query.where(Thread.title.ilike(f"%{q}%"))

    threads = db.exec(query.offset(skip).limit(limit)).all()
    return threads


@app.get("/api/threads/{thread_id}", response_model=ThreadReadWithMessages)
def get_thread(thread_id: str, db: Session = Depends(get_session)):
    """
    Get a single thread by its ID, including its messages.
    """
    thread = db.get(Thread, thread_id)
    if not thread:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Thread not found")
    return thread


@app.patch("/api/threads/{thread_id}", response_model=ThreadRead)
def update_thread(thread_id: str, thread_in: ThreadUpdate, db: Session = Depends(get_session)):
    """
    Update a thread's title or summary.
    """
    thread = db.get(Thread, thread_id)
    if not thread:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Thread not found")

    if thread_in.title is not None:
        thread.title = thread_in.title
    if thread_in.summary is not None:
        thread.summary = thread_in.summary

    thread.updated_at = datetime.utcnow()
    db.add(thread)
    db.commit()
    db.refresh(thread)
    return thread


@app.delete("/api/threads/{thread_id}", status_code=status.HTTP_204_NO_CONTENT)
def delete_thread(thread_id: str, db: Session = Depends(get_session)):
    """
    Delete a thread and its messages.
    """
    thread = db.get(Thread, thread_id)
    if not thread:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Thread not found")

    db.delete(thread)
    db.commit()
    return None


# --- Messages Endpoints ---

@app.post("/api/threads/{thread_id}/messages")
async def create_message_and_stream_response(
    thread_id: str,
    message_in: MessageCreate,
    db: Session = Depends(get_session),
) -> StreamingResponse:
    """
    Create a new message in a thread and stream the assistant's response.
    """
    thread = db.get(Thread, thread_id)
    if not thread:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Thread not found")

    # 1. Save the user's message
    user_message = Message(
        thread_id=thread_id,
        role="user",
        content=message_in.content,
        created_at=datetime.utcnow(),
    )
    db.add(user_message)
    db.commit()
    db.refresh(thread) # Refresh thread to get the new message in the relationship

    # 2. Prepare the prompt for the LLM
    # Use the full, refreshed thread history
    history = [{"role": msg.role, "content": msg.content} for msg in thread.messages]
    prompt_messages = build_prompt(history, thread.summary)

    # 3. Stream the response
    async def response_generator() -> AsyncGenerator[str, None]:
        full_response = ""
        try:
            # The stream_ollama_response function yields response chunks
            async for chunk in stream_ollama_response(prompt_messages):
                full_response += chunk
                yield chunk

            # 4. After streaming, save the full assistant response in a new session
            with Session(engine) as session:
                assistant_message = Message(
                    thread_id=thread_id,
                    role="assistant",
                    content=full_response,
                    created_at=datetime.utcnow(),
                )
                session.add(assistant_message)

                thread_to_update = session.get(Thread, thread_id)
                if thread_to_update:
                    # Auto-generate title if it's the first exchange
                    if len(thread_to_update.messages) <= 1: # This is the first assistant message
                        conversation_for_title = (
                            f"User: {user_message.content}\n"
                            f"Assistant: {full_response}"
                        )
                        new_title = await generate_title(conversation_for_title)
                        thread_to_update.title = new_title

                    # Update summary periodically (e.g., every 5 exchanges)
                    # The number of messages will be user message + previous messages
                    if len(thread_to_update.messages) % 10 == 0:
                        history_for_summary = "\n".join(
                            [f"{msg.role}: {msg.content}" for msg in thread_to_update.messages]
                        )
                        new_summary = await generate_summary(history_for_summary)
                        thread_to_update.summary = new_summary

                    # Update thread's updated_at timestamp
                    thread_to_update.updated_at = datetime.utcnow()
                    session.add(thread_to_update)

                session.commit()

        except Exception as e:
            print(f"Error during response generation: {e}")
            # You might want to yield an error message to the client here
            yield "Error: Could not process response."


    return StreamingResponse(response_generator(), media_type="text/plain")


@app.post("/api/threads/{thread_id}/summarize", status_code=status.HTTP_202_ACCEPTED)
async def summarize_thread_endpoint(thread_id: str, db: Session = Depends(get_session)):
    """
    Placeholder for a background task to summarize a thread.
    """
    # In a real app, this would trigger a background task (e.g., with Celery or ARQ).
    # For now, we'll just log it.
    print(f"Summarization task requested for thread {thread_id}")
    # Here you would call a summarization function similar to generate_title
    return {"message": "Summarization task started."}


# --- Root Endpoint ---

@app.get("/")
def read_root():
    return {"status": "ok"}
