from typing import List, AsyncGenerator

from fastapi import Depends, FastAPI, HTTPException, status
from fastapi.responses import StreamingResponse
from sqlmodel import Session, select

from database import get_session
from llm import stream_ollama_response
from models import Message, Thread
from schemas import MessageCreate, ThreadCreate, ThreadRead, ThreadReadWithMessages


app = FastAPI()

@app.post("/api/threads", response_model=ThreadRead, status_code=status.HTTP_201_CREATED)
def create_thread(thread_in: ThreadCreate, db: Session = Depends(get_session)):
    """
    Create a new thread.
    """
    thread = Thread.from_orm(thread_in)
    db.add(thread)
    db.commit()
    db.refresh(thread)
    return thread

@app.get("/api/threads", response_model=List[ThreadRead])
def list_threads(skip: int = 0, limit: int = 100, db: Session = Depends(get_session)):
    """
    List all threads.
    """
    threads = db.exec(select(Thread).offset(skip).limit(limit)).all()
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

@app.delete("/api/threads/{thread_id}", status_code=status.HTTP_204_NO_CONTENT)
def delete_thread(thread_id: str, db: Session = Depends(get_session)):
    """
    Delete a thread.
    """
    thread = db.get(Thread, thread_id)
    if not thread:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Thread not found")

    db.delete(thread)
    db.commit()
    return None

# Add a root endpoint for basic health checks
@app.get("/")
def read_root():
    return {"status": "ok"}

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

    # Save the user's message
    user_message = Message(
        thread_id=thread_id,
        role="user",
        content=message_in.content,
    )
    db.add(user_message)
    db.commit()
    db.refresh(user_message)

    # Prepare the history for the prompt
    history = [{"role": msg.role, "content": msg.content} for msg in thread.messages]

    async def response_generator():
        full_response = ""
        # The stream_ollama_response function yields response chunks
        async for chunk in stream_ollama_response(history):
            full_response += chunk
            yield chunk

        # After streaming, save the full assistant response
        assistant_message = Message(
            thread_id=thread_id,
            role="assistant",
            content=full_response,
        )
        db.add(assistant_message)
        db.commit()

    return StreamingResponse(response_generator(), media_type="text/plain")
