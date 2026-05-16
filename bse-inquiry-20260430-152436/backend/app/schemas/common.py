"""
Pydantic schemas for request/response validation.
"""

from pydantic import BaseModel, Field
from typing import Optional
from datetime import datetime


# ============================================================
# Auth Schemas
# ============================================================

class RegisterRequest(BaseModel):
    username: str = Field(..., min_length=3, max_length=50)
    password: str = Field(..., min_length=6, max_length=128)
    email: Optional[str] = None
    display_name: Optional[str] = None


class LoginRequest(BaseModel):
    username: str
    password: str


class AuthResponse(BaseModel):
    token: str
    user: dict


# ============================================================
# Model Management Schemas
# ============================================================

class ModelCreateRequest(BaseModel):
    vendor: str
    model_type: str
    model_name: str
    api_name: str
    api_key: str
    endpoint_url: str
    max_input_tokens: int = 32768
    max_output_tokens: int = 8192
    is_active: bool = True
    is_default: bool = False
    config: Optional[dict] = None
    purpose: Optional[str] = None
    parent_model_id: Optional[int] = None
    display_name: Optional[str] = None
    concurrency: int = 1


class ModelUpdateRequest(BaseModel):
    vendor: Optional[str] = None
    model_type: Optional[str] = None
    api_name: Optional[str] = None
    api_key: Optional[str] = None
    endpoint_url: Optional[str] = None
    max_input_tokens: Optional[int] = None
    max_output_tokens: Optional[int] = None
    is_active: Optional[bool] = None
    is_default: Optional[bool] = None
    config: Optional[dict] = None
    purpose: Optional[str] = None
    parent_model_id: Optional[int] = None
    display_name: Optional[str] = None
    concurrency: Optional[int] = None


# ============================================================
# Conversation Schemas
# ============================================================

class ConversationCreateRequest(BaseModel):
    title: Optional[str] = "新对话"


class ConversationResponse(BaseModel):
    id: str
    title: str
    owner_id: int
    is_shared: bool
    share_token: Optional[str] = None
    created_at: str
    updated_at: str


# ============================================================
# Message Schemas
# ============================================================

class MessageCreateRequest(BaseModel):
    role: Optional[str] = "user"
    content: str
    type: Optional[str] = "text"
    task_id: Optional[str] = None
    metadata: Optional[dict] = None


class MessageResponse(BaseModel):
    id: str
    conversation_id: str
    user_id: int
    role: str
    content: str
    message_type: str
    task_id: Optional[str] = None
    created_at: str


# ============================================================
# Task Schemas
# ============================================================

class TaskCreateRequest(BaseModel):
    company_name: str
    report_year: int
    model_id: Optional[int] = None
    metrics_json: Optional[list] = None


class TaskResponse(BaseModel):
    id: str
    conversation_id: str
    company_name: str
    report_year: int
    model_name: Optional[str] = None
    status: str
    current_step: int
    created_at: str
    updated_at: str


# ============================================================
# Workflow Schemas
# ============================================================

class WorkflowStepResponse(BaseModel):
    step_index: int
    step_name: str
    step_type: str
    status: str
    logs: Optional[str] = None
    started_at: Optional[str] = None
    completed_at: Optional[str] = None
    error_message: Optional[str] = None


class WorkflowStatusResponse(BaseModel):
    current_step: int
    status: str
    steps: list[WorkflowStepResponse]


class WorkflowResumeRequest(BaseModel):
    step_index: int
    decision: str = "confirm"
    confirmed_ids: list[str] = Field(default_factory=list)
    rejected_ids: Optional[list[str]] = None
    modified_data: Optional[dict] = None


# ============================================================
# Risk Signal Schemas
# ============================================================

class RiskSignalResponse(BaseModel):
    id: str
    task_id: str
    signal_code: str
    name: str
    indicators: str
    logic: str
    risk: str
    inquiry_logic: Optional[str] = None
    inquiry_item: Optional[str] = None
    is_triggered: bool
    status: str
    created_at: str


class RiskSignalUpdateRequest(BaseModel):
    is_triggered: bool


# ============================================================
# RDU Risk Definition Schemas (Legacy - deprecated)
# ============================================================

class RDURiskDefinitionCreateRequest(BaseModel):
    signal_code: str
    name: str
    category: Optional[str] = None
    description: str
    indicator_names: list[str] = Field(default_factory=list)
    rule_expression: Optional[str] = None
    severity: str = "medium"
    is_active: bool = True


class RDURiskDefinitionResponse(BaseModel):
    id: int
    signal_code: str
    name: str
    category: Optional[str] = None
    description: str
    indicator_names: list[str]
    rule_expression: Optional[str] = None
    severity: str
    is_active: bool


# ============================================================
# RDU Standard Metrics Schemas (Simplified)
# ============================================================

class RDUMetricResponse(BaseModel):
    id: int
    category_id: int
    metric_name: str
    metric_code: str


class MetricCreateRequest(BaseModel):
    category_id: int
    metric_name: str = Field(..., min_length=1, max_length=200)
    metric_code: str = Field(..., min_length=1, max_length=50)


class MetricUpdateRequest(BaseModel):
    category_id: Optional[int] = None
    metric_name: Optional[str] = None
    metric_code: Optional[str] = None


class RDURiskSignalResponse(BaseModel):
    id: int
    category_id: int
    risk_signal: str
    metric_codes: list[str]


class RiskSignalCreateRequest(BaseModel):
    category_id: int
    risk_signal: str = Field(..., min_length=1, max_length=500)
    metric_codes: list[str] = Field(default_factory=list)


class RDURiskSignalUpdateRequest(BaseModel):
    category_id: Optional[int] = None
    risk_signal: Optional[str] = None
    metric_codes: Optional[list[str]] = None


# ============================================================
# Category Schemas
# ============================================================

class CategoryCreateRequest(BaseModel):
    name: str = Field(..., min_length=1, max_length=100)
    level: int = Field(..., ge=0, le=1)
    parent_id: Optional[int] = None
    sort_order: int = 0


class CategoryUpdateRequest(BaseModel):
    name: Optional[str] = None
    sort_order: Optional[int] = None


# ============================================================
# Indicator Schemas
# ============================================================

class IndicatorDefinitionResponse(BaseModel):
    id: int
    category: str
    indicator_name: str
    indicator_code: str
    description: Optional[str] = None
    formula: Optional[str] = None
    data_type: str
    unit: Optional[str] = None


class IndicatorValueResponse(BaseModel):
    id: int
    task_id: str
    indicator_code: str
    indicator_name: str
    category: str
    period: Optional[str] = None
    value: str
    raw_value: Optional[str] = None
    source_page: Optional[int] = None


# ============================================================
# Inquiry Letter Schemas
# ============================================================

class InquiryLetterResponse(BaseModel):
    id: int
    task_id: str
    content: str
    version: int
    created_at: str
