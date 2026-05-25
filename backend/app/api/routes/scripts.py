from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session

from app.db.session import get_db
from app.schemas import ExecutionOut, ScriptCreateIn, ScriptDetailOut, ScriptOut, ScriptRenderIn, ScriptRenderOut, ScriptStatusIn, ScriptTestRunIn
from app.services.script_service import (
    create_script,
    create_script_version,
    create_test_run,
    get_active_script,
    get_script,
    list_script_runs,
    list_scripts,
    render_script,
    update_script_status,
)

router = APIRouter(prefix="/scripts", tags=["scripts"])


@router.get("", response_model=list[ScriptOut])
def get_scripts(db: Session = Depends(get_db)):
    return [
        ScriptOut(
            key=item.key,
            name=item.name,
            category=item.category,
            version=item.version,
            status=item.status,
            riskLevel=item.risk_level,
            timeoutMs=item.timeout_ms,
        )
        for item in list_scripts(db)
    ]


def script_detail(item) -> ScriptDetailOut:
    import json

    try:
        schema = json.loads(item.param_schema_json or "{}")
    except Exception:
        schema = {}
    return ScriptDetailOut(
        key=item.key,
        name=item.name,
        category=item.category,
        version=item.version,
        status=item.status,
        riskLevel=item.risk_level,
        timeoutMs=item.timeout_ms,
        description=item.description,
        shell=item.shell,
        template=item.template,
        paramSchema=schema,
        outputType=item.output_type,
        parserType=item.parser_type,
        allowParallel=item.allow_parallel,
    )


def execution_to_out(run) -> ExecutionOut:
    return ExecutionOut(
        runCode=run.run_code,
        status=run.status,
        runType=run.run_type,
        targetType=run.target_type,
        scriptKey=run.script_key,
        stdout=run.stdout,
        stderr=run.stderr,
        errorMessage=run.error_message,
        createdAt=run.created_at.isoformat() if run.created_at else None,
        startedAt=run.started_at.isoformat() if run.started_at else None,
        finishedAt=run.finished_at.isoformat() if run.finished_at else None,
    )


@router.post("", response_model=ScriptDetailOut)
def post_script(payload: ScriptCreateIn, db: Session = Depends(get_db)):
    try:
        return script_detail(create_script(db, payload))
    except ValueError as exc:
        raise HTTPException(status_code=409, detail=str(exc)) from exc


@router.get("/{script_key}", response_model=ScriptDetailOut)
def get_script_detail(script_key: str, db: Session = Depends(get_db)):
    try:
        return script_detail(get_script(db, script_key))
    except KeyError as exc:
        raise HTTPException(status_code=404, detail=str(exc)) from exc


@router.post("/{script_key}/versions", response_model=ScriptDetailOut)
def post_script_version(script_key: str, payload: ScriptCreateIn, db: Session = Depends(get_db)):
    try:
        return script_detail(create_script_version(db, script_key, payload))
    except KeyError as exc:
        raise HTTPException(status_code=404, detail=str(exc)) from exc


@router.post("/{script_key}/render", response_model=ScriptRenderOut)
def render(script_key: str, payload: ScriptRenderIn, db: Session = Depends(get_db)):
    try:
        script = get_active_script(db, script_key)
        return ScriptRenderOut(key=script.key, rendered=render_script(script, payload.params))
    except Exception as exc:
        raise HTTPException(status_code=400, detail=str(exc)) from exc


@router.patch("/{script_key}/status", response_model=ScriptDetailOut)
def patch_script_status(script_key: str, payload: ScriptStatusIn, db: Session = Depends(get_db)):
    try:
        return script_detail(update_script_status(db, script_key, payload.status))
    except KeyError as exc:
        raise HTTPException(status_code=404, detail=str(exc)) from exc


@router.post("/{script_key}/test-run", response_model=ExecutionOut)
def test_script(script_key: str, payload: ScriptTestRunIn, db: Session = Depends(get_db)):
    try:
        script = get_active_script(db, script_key)
        rendered = render_script(script, payload.params)
        return execution_to_out(create_test_run(db, script, rendered))
    except KeyError as exc:
        raise HTTPException(status_code=404, detail=str(exc)) from exc
    except Exception as exc:
        raise HTTPException(status_code=400, detail=str(exc)) from exc


@router.get("/{script_key}/runs", response_model=list[ExecutionOut])
def script_runs(script_key: str, db: Session = Depends(get_db)):
    return [execution_to_out(run) for run in list_script_runs(db, script_key)]
