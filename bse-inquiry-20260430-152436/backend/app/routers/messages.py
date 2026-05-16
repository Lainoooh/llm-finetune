"""
Message router.
"""

from fastapi import APIRouter, HTTPException, Depends
from app.models.conversation import MessageRepo, ConversationMemberRepo
from app.schemas.common import MessageCreateRequest, MessageResponse
from app.middleware.auth import get_current_user

router = APIRouter()


@router.post("/conversations/{conv_id}/messages", response_model=dict)
def send_message(
    conv_id: str,
    req: MessageCreateRequest,
    user: dict = Depends(get_current_user),
):
    """Send a message in a conversation."""
    # Check access
    role = ConversationMemberRepo.get_user_role(conv_id, user["id"])
    if not role:
        raise HTTPException(status_code=403, detail="Access denied")
    if role == "viewer":
        raise HTTPException(status_code=403, detail="Viewers cannot send messages")

    msg_id = MessageRepo.create(
        conversation_id=conv_id,
        user_id=user["id"],
        role=req.role or "user",
        content=req.content,
        message_type=req.type or "text",
        task_id=req.task_id,
        metadata=req.metadata,
    )

    # Return the full message object
    msg = MessageRepo.get_by_id(msg_id)
    return msg


@router.get("/conversations/{conv_id}/messages", response_model=list)
def list_messages(
    conv_id: str,
    skip: int = 0,
    limit: int = 100,
    user: dict = Depends(get_current_user),
):
    """List messages in a conversation."""
    # Check access
    role = ConversationMemberRepo.get_user_role(conv_id, user["id"])
    if not role:
        raise HTTPException(status_code=403, detail="Access denied")

    return MessageRepo.list_by_conversation(conv_id, skip, limit)
