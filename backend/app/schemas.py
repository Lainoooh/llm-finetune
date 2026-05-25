from __future__ import annotations

from typing import Any, Optional

from pydantic import BaseModel, Field


class ServerOut(BaseModel):
    id: str
    name: str
    accessType: str = "jupyter"
    host: str
    user: str = ""
    password: str = ""
    sshPort: int = 22
    sshKey: str = ""
    jupyterBaseUrl: str = ""
    token: str = ""
    status: str
    gpu: str
    gpuIds: str = ""
    cuda: str
    torch: str
    accelerator: str = "-"
    acceleratorVendor: str = "unknown"
    acceleratorRuntime: str = "-"
    acceleratorIds: str = ""
    acceleratorCount: int = 0
    aiFramework: str = "-"
    finetuneToolName: str = "LLaMA-Factory"
    finetuneToolContainerName: str = ""
    finetuneTools: dict[str, str] = Field(default_factory=dict)
    workDir: str
    disk: str
    diskUsed: Optional[float] = None
    diskTotal: Optional[float] = None
    lastError: str = ""
    gpuInfo: dict[str, Any] = Field(default_factory=dict)
    hardwareInfo: dict[str, Any] = Field(default_factory=dict)
    finetuneEnvInfo: dict[str, Any] = Field(default_factory=dict)


class ServersListOut(BaseModel):
    items: list[ServerOut]
    total: Optional[int] = None


class ProbeDraftIn(BaseModel):
    name: str = "临时服务器"
    accessType: str = "jupyter"
    host: str = ""
    user: str = ""
    password: str = ""
    sshPort: int = 22
    sshKey: str = ""
    workDir: str = "/home/jovyan/work"
    gpuIds: str = ""
    finetuneToolName: str = "LLaMA-Factory"
    finetuneToolContainerName: str = ""
    jupyterBaseUrl: Optional[str] = None
    token: Optional[str] = None


class ProbeOut(BaseModel):
    server: ServerOut
    raw: dict[str, Any] = Field(default_factory=dict)
    runCode: Optional[str] = None


class ProbeItemOut(BaseModel):
    status: str = "queued"
    data: dict[str, Any] = Field(default_factory=dict)
    raw: dict[str, Any] = Field(default_factory=dict)
    error: str = ""


class ProbeTaskOut(BaseModel):
    probeCode: str
    status: str
    server: Optional[ServerOut] = None
    items: dict[str, ProbeItemOut] = Field(default_factory=dict)


class ScriptOut(BaseModel):
    key: str
    name: str
    category: str
    version: int
    status: str
    riskLevel: str
    timeoutMs: int


class ScriptRenderIn(BaseModel):
    params: dict[str, Any] = Field(default_factory=dict)


class ScriptRenderOut(BaseModel):
    key: str
    rendered: str


class DebugRemoteRunIn(BaseModel):
    cmd: str
    timeoutMs: Optional[int] = None

class DebugRemoteRunOut(BaseModel):
    stdout: str
    stderr: str = ""
    generation: int


class ServerCreateIn(BaseModel):
    name: str
    accessType: str = "jupyter"
    host: str = ""
    user: str = ""
    password: str = ""
    sshPort: int = 22
    sshKey: str = ""
    workDir: str = "/home/jovyan/work"
    gpuIds: str = ""
    finetuneToolName: str = "LLaMA-Factory"
    finetuneToolContainerName: str = ""
    jupyterBaseUrl: Optional[str] = None
    token: Optional[str] = None
    probeCode: Optional[str] = None


class ServerUpdateIn(BaseModel):
    name: Optional[str] = None
    accessType: Optional[str] = None
    host: Optional[str] = None
    user: Optional[str] = None
    password: Optional[str] = None
    sshPort: Optional[int] = None
    sshKey: Optional[str] = None
    workDir: Optional[str] = None
    gpuIds: Optional[str] = None
    finetuneToolName: Optional[str] = None
    finetuneToolContainerName: Optional[str] = None
    jupyterBaseUrl: Optional[str] = None
    token: Optional[str] = None
    status: Optional[str] = None


class DashboardSummaryOut(BaseModel):
    serversTotal: int
    serversOnline: int
    serversOffline: int
    tasksTotal: int
    subtasksTotal: int
    runningSubtasks: int
    failedSubtasks: int


class TaskOut(BaseModel):
    id: str
    taskCode: str
    name: str
    description: str = ""
    status: str
    subtaskCount: int = 0
    runningCount: int = 0
    succeededCount: int = 0
    failedCount: int = 0
    draftCount: int = 0


class TasksListOut(BaseModel):
    items: list[TaskOut]
    total: int


class TaskCreateIn(BaseModel):
    name: str
    description: str = ""
    status: str = "draft"


class TaskUpdateIn(BaseModel):
    name: Optional[str] = None
    description: Optional[str] = None
    status: Optional[str] = None


class TaskCloneIn(BaseModel):
    copySubtasks: bool = True
    name: Optional[str] = None


class SubtaskOut(BaseModel):
    id: str
    subtaskCode: str
    taskCode: str
    name: str
    serverId: Optional[str] = None
    serverName: str = "-"
    status: str
    baseModel: str = ""
    gpu: str = ""
    learningRate: str = "5e-5"
    epoch: int = 3
    batchSize: int = 2
    step: int = 500
    loss: Optional[float] = None
    score: Optional[float] = None
    outputDir: str = ""
    trainYaml: str = ""
    evalYaml: str = ""
    datasetInfo: str = "{}"
    logs: list[str] = Field(default_factory=list)
    directoryLines: list[str] = Field(default_factory=list)
    lastRunCode: str = ""


class SubtasksListOut(BaseModel):
    items: list[SubtaskOut]
    total: int


class SubtaskCreateIn(BaseModel):
    name: str
    baseModel: str
    serverId: Optional[str] = None
    gpu: str = ""
    learningRate: str = "5e-5"
    epoch: int = 3
    batchSize: int = 2
    step: int = 500
    trainYaml: str = ""
    evalYaml: str = ""
    datasetInfo: str = "{}"


class SubtaskUpdateIn(BaseModel):
    name: Optional[str] = None
    serverId: Optional[str] = None
    status: Optional[str] = None
    baseModel: Optional[str] = None
    gpu: Optional[str] = None
    learningRate: Optional[str] = None
    epoch: Optional[int] = None
    batchSize: Optional[int] = None
    step: Optional[int] = None
    loss: Optional[float] = None
    score: Optional[float] = None
    trainYaml: Optional[str] = None
    evalYaml: Optional[str] = None
    datasetInfo: Optional[str] = None


class LogsOut(BaseModel):
    lines: list[str]
    offset: int
    nextOffset: int
    total: int


class RemoteFilesOut(BaseModel):
    lines: list[str]


class LossPoint(BaseModel):
    step: int
    values: dict[str, float]


class LossMetricsOut(BaseModel):
    series: list[LossPoint]


class CompareReadinessOut(BaseModel):
    ready: bool
    blockers: list[str] = Field(default_factory=list)


class CompareEvalOut(BaseModel):
    items: list[dict[str, Any]]


class CompareRunOut(BaseModel):
    compareCode: str
    status: str


class ExecutionCreateIn(BaseModel):
    serverId: str
    scriptKey: Optional[str] = None
    params: dict[str, Any] = Field(default_factory=dict)
    command: Optional[str] = None
    timeoutMs: Optional[int] = None


class ExecutionOut(BaseModel):
    runCode: str
    status: str
    runType: str
    targetType: str
    scriptKey: str = ""
    stdout: str = ""
    stderr: str = ""
    errorMessage: str = ""
    createdAt: Optional[str] = None
    startedAt: Optional[str] = None
    finishedAt: Optional[str] = None


class ScriptCreateIn(BaseModel):
    key: str
    name: str
    category: str = "custom"
    description: str = ""
    shell: str = "bash"
    template: str
    paramSchema: dict[str, Any] = Field(default_factory=dict)
    outputType: str = "text"
    parserType: str = "text"
    timeoutMs: int = 120_000
    allowParallel: bool = False
    riskLevel: str = "medium"


class ScriptDetailOut(ScriptOut):
    description: str = ""
    shell: str = "bash"
    template: str
    paramSchema: dict[str, Any] = Field(default_factory=dict)
    outputType: str = "text"
    parserType: str = "text"
    allowParallel: bool = False


class ScriptStatusIn(BaseModel):
    status: str


class ScriptTestRunIn(BaseModel):
    serverId: str
    params: dict[str, Any] = Field(default_factory=dict)
