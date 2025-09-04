from datetime import datetime
from typing import List, Optional
from pydantic import BaseModel

# Schemas for Messages
class MessageCreate(BaseModel):
    content: str

class MessageRead(BaseModel):
    id: str
    thread_id: str
    role: str
    content: str
    tokens: Optional[int]
    created_at: datetime

# Schemas for Threads
class ThreadBase(BaseModel):
    title: str = "Untitled"
    summary: Optional[str] = None

class ThreadCreate(ThreadBase):
    pass

class ThreadRead(ThreadBase):
    id: str
    created_at: datetime
    updated_at: datetime

class ThreadReadWithMessages(ThreadRead):
    messages: List[MessageRead] = []

class ThreadUpdate(BaseModel):
    title: Optional[str] = None
    summary: Optional[str] = None
