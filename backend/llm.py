import httpx
import json
from typing import AsyncGenerator, List, Dict

OLLAMA_API_URL = "http://localhost:11434/api/generate"
MODEL_NAME = "gemma:2b" # This will be configurable later

async def stream_ollama_response(messages: List[Dict]) -> AsyncGenerator[str, None]:
    """
    Streams the response from the Ollama API.
    """
    # Simple prompt construction for now. This will be improved later.
    prompt = "\n".join([f"{msg['role']}: {msg['content']}" for msg in messages])

    payload = {
        "model": MODEL_NAME,
        "prompt": prompt,
        "stream": True,
    }

    async with httpx.AsyncClient(timeout=None) as client:
        async with client.stream("POST", OLLAMA_API_URL, json=payload) as response:
            if response.status_code != 200:
                response.raise_for_status()

            async for line in response.aiter_lines():
                if line:
                    try:
                        chunk = json.loads(line)
                        if "response" in chunk:
                            yield chunk["response"]
                        if chunk.get("done"):
                            break
                    except json.JSONDecodeError:
                        print(f"Failed to decode JSON line: {line}")
                        continue
