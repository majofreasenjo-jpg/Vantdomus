from pydantic import BaseModel, Field
from typing import List, Optional


class ChatMessage(BaseModel):
    role: str = Field(..., pattern="^(system|user|assistant)$")
    content: str


class ChatRequest(BaseModel):
    household_id: str
    messages: List[ChatMessage]
    model: Optional[str] = None
    temperature: float = 0.2
