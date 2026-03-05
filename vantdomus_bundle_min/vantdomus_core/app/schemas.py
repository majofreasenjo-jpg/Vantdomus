from pydantic import BaseModel
from typing import Literal

UUID = str

class RegisterRequest(BaseModel):
    email: str
    password: str

class LoginRequest(BaseModel):
    email: str
    password: str

class HouseholdCreate(BaseModel):
    name: str

class PersonCreate(BaseModel):
    household_id: UUID
    display_name: str
    relation: str | None = None

class CheckinRequest(BaseModel):
    household_id: UUID
    person_id: UUID
    med_name: str
    status: Literal["taken","missed"]

class AdherenceSetRequest(BaseModel):
    household_id: UUID
    person_id: UUID
    med_name: str
    reminder_times: list[str]
    verification_mode: Literal["none","tap","voice"] = "none"
