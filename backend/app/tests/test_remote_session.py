import re

import pytest

from app.executors.base import RemoteExecutionError
from app.executors.queued_session import QueuedRemoteSession
from app.executors.transport import RemoteFrame


class FakeTransport:
    def __init__(self, exit_code=0, drop_done=False):
        self.key = "fake:test"
        self.exit_code = exit_code
        self.drop_done = drop_done
        self.is_connected = False
        self.closed = False
        self.sent = []
        self.frames = []

    async def connect(self):
        self.is_connected = True

    async def send(self, payload):
        self.sent.append(payload)
        init = re.search(r"__LLMFT_INIT_[a-f0-9]+__", payload)
        if init:
            self.frames.append(RemoteFrame(kind="stdout", content=f"{init.group(0)}\n"))
            return
        done = re.search(r"__LLMFT_DONE_[a-f0-9]+_\d+__", payload)
        if done and not self.drop_done:
            self.frames.append(RemoteFrame(kind="stdout", content=f"script output\n{done.group(0)}:{self.exit_code}\n"))

    async def recv(self):
        while not self.frames:
            import asyncio

            await asyncio.sleep(0.01)
        return self.frames.pop(0)

    async def close(self):
        self.closed = True
        self.is_connected = False


@pytest.mark.asyncio
async def test_queued_session_wraps_marker_and_returns_exit_code():
    transport = FakeTransport(exit_code=7)
    session = QueuedRemoteSession(transport)

    result = await session.run_script("exit 7", timeout_ms=1000)

    assert result.exit_code == 7
    assert "script output" in result.stdout
    assert result.generation == 1
    assert len(transport.sent) == 2


@pytest.mark.asyncio
async def test_queued_session_timeout_resets_transport():
    transport = FakeTransport(drop_done=True)
    session = QueuedRemoteSession(transport)

    with pytest.raises(RemoteExecutionError):
        await session.run_script("sleep 10", timeout_ms=10)

    assert transport.closed is True
