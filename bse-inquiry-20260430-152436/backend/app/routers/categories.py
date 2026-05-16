"""
RDU Categories CRUD router.
"""

from fastapi import APIRouter, HTTPException, Depends, Query
from typing import Optional
from app.models.category import RDUCategoryRepo
from app.middleware.auth import require_role

router = APIRouter()


@router.get("/", response_model=list)
def list_categories(
    level: Optional[int] = Query(None, description="Filter by level: 0=theme, 1=category"),
    parent_id: Optional[int] = Query(None, description="Filter by parent_id"),
    tree: bool = Query(False, description="Return as nested tree with counts"),
):
    """List categories, optionally filtered or as a tree."""
    if tree:
        return RDUCategoryRepo.get_tree()
    if parent_id is not None:
        return RDUCategoryRepo.list_children(parent_id)
    if level is not None:
        return RDUCategoryRepo.list_by_level(level)
    return RDUCategoryRepo.list_all()


@router.get("/{category_id}", response_model=dict)
def get_category(category_id: int):
    """Get a single category by ID."""
    cat = RDUCategoryRepo.get_by_id(category_id)
    if not cat:
        raise HTTPException(status_code=404, detail="Category not found")
    return cat


@router.post("/", response_model=dict)
def create_category(req: dict, user: dict = Depends(require_role("admin"))):
    """Create a new category."""
    name = req.get("name")
    level = req.get("level", 1)
    parent_id = req.get("parent_id")
    sort_order = req.get("sort_order", 0)
    code = req.get("code")
    description = req.get("description")

    if not name:
        raise HTTPException(status_code=400, detail="name is required")
    if level == 1 and parent_id is None:
        raise HTTPException(status_code=400, detail="parent_id is required for level=1 categories")

    cat_id = RDUCategoryRepo.create(
        name=name, level=level, parent_id=parent_id,
        sort_order=sort_order, code=code, description=description
    )
    return {"id": cat_id, "message": "Category created"}


@router.put("/{category_id}", response_model=dict)
def update_category(category_id: int, req: dict, user: dict = Depends(require_role("admin"))):
    """Update a category."""
    existing = RDUCategoryRepo.get_by_id(category_id)
    if not existing:
        raise HTTPException(status_code=404, detail="Category not found")

    update_fields = {}
    for field in ("name", "code", "sort_order", "description"):
        if field in req:
            update_fields[field] = req[field]

    if not update_fields:
        raise HTTPException(status_code=400, detail="No fields to update")

    RDUCategoryRepo.update(category_id, **update_fields)
    return {"message": "Category updated"}


@router.delete("/{category_id}", response_model=dict)
def delete_category(category_id: int, user: dict = Depends(require_role("admin"))):
    """Delete a category (only if no associated data)."""
    existing = RDUCategoryRepo.get_by_id(category_id)
    if not existing:
        raise HTTPException(status_code=404, detail="Category not found")

    assoc = RDUCategoryRepo.has_associated_data(category_id)
    if assoc["metrics_count"] > 0 or assoc["signals_count"] > 0 or assoc["children_count"] > 0:
        raise HTTPException(
            status_code=400,
            detail=f"Cannot delete: {assoc['metrics_count']} metrics, "
                   f"{assoc['signals_count']} signals, {assoc['children_count']} child categories"
        )

    RDUCategoryRepo.delete(category_id)
    return {"message": "Category deleted"}
