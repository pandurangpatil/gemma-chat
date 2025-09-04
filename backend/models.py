import uuid
from datetime import datetime
from typing import List, Optional

from sqlmodel import Field, Relationship, SQLModel


class Thread(SQLModel, table=True):
    id: str = Field(default_factory=lambda: str(uuid.uuid4()), primary_key=True)
    title: str = Field(default="Untitled", index=True)
    summary: Optional[str] = Field(default=None)
    created_at: datetime = Field(default_factory=datetime.utcnow, nullable=False)
    updated_at: datetime = Field(default_factory=datetime.utcnow, nullable=False)

    messages: List["Message"] = Relationship(back_populates="thread", sa_relationship_kwargs={"cascade": "all, delete-orphan"})


class Message(SQLModel, table=True):
    id: str = Field(default_factory=lambda: str(uuid.uuid4()), primary_key=True)
    thread_id: str = Field(foreign_key="thread.id", nullable=False)
    role: str # 'system', 'user', or 'assistant'
    content: str
    tokens: Optional[int] = Field(default=None)
    created_at: datetime = Field(default_factory=datetime.utcnow, nullable=False)

    thread: Optional[Thread] = Relationship(back_populates="messages")
