"""
In-memory workflow step progress tracker.

Tracks LLM call progress within each phase of Step 2 and Step 4.
Single uvicorn worker + asyncio single-threaded event loop = no race conditions.
"""

from typing import Dict, List, Optional

_store: Dict[str, dict] = {}
_completed_store: Dict[str, Dict[int, dict]] = {}  # {task_id: {step_index: progress}}
_phase_history: Dict[str, List[dict]] = {}  # {task_id: [phase_snapshot, ...]}
_streaming_store: Dict[str, str] = {}  # {task_id: accumulated_text}


def set_phase(task_id: str, phase: int, phase_name: str, total: int, step_index: int = None) -> None:
    # Snapshot current phase to history before overwriting
    old = _store.get(task_id)
    if old is not None:
        snapshot = {k: v for k, v in old.items() if k != "step_index"}
        _phase_history.setdefault(task_id, []).append(snapshot)
    _store[task_id] = {
        "phase": phase,
        "phase_name": phase_name,
        "total": total,
        "completed": 0,
        "step_index": step_index,
    }


def mark_done(task_id: str) -> None:
    entry = _store.get(task_id)
    if entry:
        entry["completed"] += 1


def get_progress(task_id: str) -> Optional[dict]:
    entry = _store.get(task_id)
    if entry is None:
        return None
    result = dict(entry)
    result.pop("step_index", None)
    return result


def get_all_phases(task_id: str) -> Optional[List[dict]]:
    """Return all phases (history + current) for a running task."""
    phases = list(_phase_history.get(task_id, []))
    current = _store.get(task_id)
    if current:
        phases.append({k: v for k, v in current.items() if k != "step_index"})
    return phases if phases else None


def get_completed_progress(task_id: str, step_index: int) -> Optional[dict]:
    return _completed_store.get(task_id, {}).get(step_index)


def clear(task_id: str) -> None:
    entry = _store.pop(task_id, None)
    if entry and entry.get("step_index") is not None:
        # Append last phase to history
        history = list(_phase_history.get(task_id, []))
        history.append({k: v for k, v in entry.items() if k != "step_index"})
        # Store full phase list for completed display
        _completed_store.setdefault(task_id, {})[entry["step_index"]] = {
            "phases": history,
        }
    _phase_history.pop(task_id, None)
    _streaming_store.pop(task_id, None)


def set_streaming_text(task_id: str, text: str) -> None:
    _streaming_store[task_id] = text


def get_streaming_text(task_id: str) -> Optional[str]:
    return _streaming_store.get(task_id)
