from fastapi import FastAPI

app = FastAPI(title="Chat-with-Gemma")


@app.get("/")
def read_root():
    return {"status": "ok"}
