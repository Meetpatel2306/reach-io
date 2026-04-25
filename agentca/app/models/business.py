"""Business and Contact schemas."""

from __future__ import annotations
from enum import Enum
from pydantic import BaseModel


class BusinessType(str, Enum):
    REGULAR = "regular"
    COMPOSITION = "composition"
    UNREGISTERED = "unregistered"


class Plan(str, Enum):
    FREE = "free"
    LITE = "lite"
    PRO = "pro"
    BUSINESS = "business"


class OnboardingStep(int, Enum):
    NEW = 0
    ASKED_NAME = 1
    ASKED_BUSINESS_NAME = 2
    ASKED_GSTIN = 3
    ASKED_LANGUAGE = 4
    ASKED_UPI = 5
    COMPLETE = 6


class ConversationState(str, Enum):
    NEW = "new"
    ONBOARDING_NAME = "onboarding:name"
    ONBOARDING_BUSINESS = "onboarding:business_name"
    ONBOARDING_GSTIN = "onboarding:gstin"
    ONBOARDING_LANGUAGE = "onboarding:language"
    ONBOARDING_UPI = "onboarding:upi"
    ACTIVE_IDLE = "active:idle"
    ACTIVE_CONFIRMING_INVOICE = "active:confirming_invoice"
    ACTIVE_CONFIRMING_TRANSACTION = "active:confirming_transaction"
    ACTIVE_CREATING_INVOICE = "active:creating_invoice"
    ACTIVE_PROCESSING = "active:processing"


class BusinessCreate(BaseModel):
    phone: str
    owner_name: str = ""
    business_name: str = ""
    gstin: str | None = None
    pan: str | None = None
    business_type: str = "regular"
    address: str | None = None
    state_code: str | None = None
    language: str = "hi"
    upi_id: str | None = None
    plan: str = "free"
    onboarding_step: int = 0
    conversation_state: str = "new"


class BusinessResponse(BaseModel):
    id: str
    phone: str
    owner_name: str
    business_name: str
    gstin: str | None = None
    state_code: str | None = None
    language: str
    plan: str
    onboarding_step: int
    conversation_state: str
    total_invoices: int = 0
    total_transactions: int = 0
    is_deleted: bool = False
    created_at: str | None = None


class ContactCreate(BaseModel):
    business_id: str
    name: str
    gstin: str | None = None
    phone: str | None = None
    type: str = "customer"
    address: str | None = None
    state_code: str | None = None
