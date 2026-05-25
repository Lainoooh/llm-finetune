from __future__ import annotations

from dataclasses import dataclass


@dataclass
class RemoteExecutionResult:
    stdout: str
    stderr: str = ""
    raw_output: str = ""
    generation: int = 0


class RemoteExecutionError(RuntimeError):
    def __init__(self, message: str, code: str = "REMOTE_EXECUTION_ERROR"):
        super().__init__(message)
        self.code = code
