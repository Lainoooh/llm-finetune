"""
Conversation management router.
"""

import uuid
from fastapi import APIRouter, HTTPException, Depends
from app.models.conversation import ConversationRepo, ConversationMemberRepo
from app.schemas.common import ConversationCreateRequest, ConversationResponse
from app.middleware.auth import get_current_user

router = APIRouter()


@router.post("/", response_model=dict)
def create_conversation(req: ConversationCreateRequest, user: dict = Depends(get_current_user)):
    """Create a new conversation."""
    conv_id = ConversationRepo.create(owner_id=user["id"], title=req.title)
    return {"id": conv_id, "message": "Conversation created"}


@router.get("/", response_model=list)
def list_conversations(skip: int = 0, limit: int = 50, user: dict = Depends(get_current_user)):
    """List user's conversations."""
    return ConversationRepo.list_by_user(user["id"], skip, limit)


@router.get("/{conv_id}", response_model=dict)
def get_conversation(conv_id: str, user: dict = Depends(get_current_user)):
    """Get conversation details."""
    conv = ConversationRepo.get_by_id(conv_id)
    if not conv:
        raise HTTPException(status_code=404, detail="Conversation not found")

    # Check access
    role = ConversationMemberRepo.get_user_role(conv_id, user["id"])
    if not role and not conv["is_shared"]:
        raise HTTPException(status_code=403, detail="Access denied")

    conv["tasks"] = []  # Will be populated by tasks router
    return conv


@router.delete("/{conv_id}", response_model=dict, include_in_schema=True)
@router.delete("/{conv_id}/", response_model=dict, include_in_schema=False)
def delete_conversation(conv_id: str, user: dict = Depends(get_current_user)):
    """Delete a conversation (owner only)."""
    conv = ConversationRepo.get_by_id(conv_id)
    if not conv:
        raise HTTPException(status_code=404, detail="Conversation not found")
    if conv["owner_id"] != user["id"]:
        raise HTTPException(status_code=403, detail="Only owner can delete")

    ConversationRepo.delete(conv_id)
    return {"message": "Conversation deleted"}


@router.post("/{conv_id}/share", response_model=dict)
def share_conversation(conv_id: str, user: dict = Depends(get_current_user)):
    """Share a conversation (generate share token)."""
    conv = ConversationRepo.get_by_id(conv_id)
    if not conv:
        raise HTTPException(status_code=404, detail="Conversation not found")
    if conv["owner_id"] != user["id"]:
        raise HTTPException(status_code=403, detail="Only owner can share")

    share_token = str(uuid.uuid4())
    ConversationRepo.update(conv_id, is_shared=True, share_token=share_token)
    return {"share_token": share_token, "share_url": f"/share/{share_token}"}


@router.get("/share/{token}", response_model=dict)
def get_shared_conversation(token: str):
    """Access a shared conversation via token."""
    conv = ConversationRepo.get_by_share_token(token)
    if not conv:
        raise HTTPException(status_code=404, detail="Shared conversation not found or expired")
    return conv
