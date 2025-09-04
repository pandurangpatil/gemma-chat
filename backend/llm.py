import os
import ollama
from typing import AsyncGenerator, List, Dict, Any

# Load configuration from environment variables
OLLAMA_HOST = os.getenv("OLLAMA_HOST", "http://localhost:11434")
MODEL_NAME = os.getenv("MODEL_NAME", "gemma:2b")
MAX_TOKENS = int(os.getenv("MAX_TOKENS", 2048))
TEMPERATURE = float(os.getenv("TEMPERATURE", 0.7))
TOP_P = float(os.getenv("TOP_P", 1.0))
SEED = int(os.getenv("SEED", 42))
SYSTEM_PROMPT = os.getenv("SYSTEM_PROMPT")
CONTEXT_TOKEN_BUDGET = int(os.getenv("CONTEXT_TOKEN_BUDGET", 4096))


# Initialize the Ollama client
# Note: The 'ollama' library automatically handles the OLLAMA_HOST environment variable.
client = ollama.AsyncClient()


def build_prompt(
    messages: List[Dict[str, Any]],
    thread_summary: str | None = None
) -> List[Dict[str, Any]]:
    """
    Builds the prompt for the LLM, including the system prompt,
    thread summary (if any), and recent messages, respecting the token budget.
    """
    # This is a placeholder for a proper token counting function.
    # A real implementation would use a tokenizer like tiktoken.
    # For now, we'll use a simple character count heuristic.
    def estimate_tokens(text: str) -> int:
        return len(text) // 4  # Rough estimate

    prompt_messages = []
    current_token_count = 0

    # 1. Add the system prompt
    if SYSTEM_PROMPT:
        system_message = {"role": "system", "content": SYSTEM_PROMPT}
        prompt_messages.append(system_message)
        current_token_count += estimate_tokens(SYSTEM_PROMPT)

    # 2. Add the thread summary
    if thread_summary:
        summary_message = {
            "role": "system",
            "content": f"Here is a summary of the conversation so far:\n{thread_summary}",
        }
        # Only add summary if it fits
        summary_tokens = estimate_tokens(summary_message["content"])
        if current_token_count + summary_tokens <= CONTEXT_TOKEN_BUDGET:
            prompt_messages.append(summary_message)
            current_token_count += summary_tokens

    # 3. Add recent messages, starting from the most recent
    history_messages = []
    for message in reversed(messages):
        msg_content = message["content"]
        msg_tokens = estimate_tokens(msg_content)

        print(f"Checking message: {msg_content[:10]}... | Current tokens: {current_token_count} | Message tokens: {msg_tokens} | Budget: {CONTEXT_TOKEN_BUDGET}")
        if current_token_count + msg_tokens <= CONTEXT_TOKEN_BUDGET:
            history_messages.insert(0, message)  # Prepend to maintain order
            current_token_count += msg_tokens
            print(" -> Added.")
        else:
            # Stop adding messages if we exceed the budget
            print(" -> Skipped (over budget).")
            break

    prompt_messages.extend(history_messages)
    return prompt_messages


async def stream_ollama_response(
    messages: List[Dict[str, Any]]
) -> AsyncGenerator[str, None]:
    """
    Streams the response from the Ollama API using the official client.
    """
    response_stream = await client.chat(
        model=MODEL_NAME,
        messages=messages,
        stream=True,
        options={
            "num_predict": MAX_TOKENS,
            "temperature": TEMPERATURE,
            "top_p": TOP_P,
            "seed": SEED,
        },
    )

    async for chunk in response_stream:
        if "message" in chunk:
            content = chunk["message"]["content"]
            yield content
        if chunk.get("done"):
            break

async def generate_title(conversation: str) -> str:
    """
    Generates a concise title for a conversation.
    """
    prompt = f"""
    Propose a concise title that best describes this conversation using exactly 1-3 words maximum.
    Output only the title, no punctuation at the end.

    Conversation:
    {conversation}
    """
    response = await client.generate(
        model=MODEL_NAME,
        prompt=prompt,
        stream=False,
        options={"temperature": 0.2} # Low temp for deterministic title
    )
    return response.get("response", "Untitled Chat").strip()


async def generate_summary(conversation: str) -> str:
    """
    Generates a summary for a conversation.
    """
    prompt = f"""
    Summarize this conversation so far for future continuation.
    Capture objectives, decisions, constraints, and pending tasks in <= 10 bullet points.
    Do not restate code verbatim. The summary should be concise and under 500 tokens.

    Conversation:
    {conversation}
    """
    response = await client.generate(
        model=MODEL_NAME,
        prompt=prompt,
        stream=False,
        options={"temperature": 0.5}
    )
    return response.get("response", "").strip()
