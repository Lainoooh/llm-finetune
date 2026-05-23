from __future__ import annotations

import json
from dataclasses import dataclass

import httpx
import websockets

from app.core.config import get_settings
from app.executors.transport import RemoteFrame


@dataclass
class JupyterEndpoint:
    base_url: str
    token: str

    @property
    def key(self) -> str:
        return f"jupyter:{self.base_url.rstrip('/')}"


class JupyterTransport:
    def __init__(self, endpoint: JupyterEndpoint):
        self.endpoint = endpoint
        self.settings = get_settings()
        self.terminal_name: str | None = None
        self.websocket = None

    @property
    def key(self) -> str:
        return self.endpoint.key

    @property
    def is_connected(self) -> bool:
        return bool(self.websocket and self.terminal_name)

    async def connect(self) -> None:
        base_url = self.endpoint.base_url.rstrip("/")
        async with httpx.AsyncClient(timeout=20) as client:
            response = await client.post(
                f"{base_url}/api/terminals",
                headers={"Authorization": f"token {self.endpoint.token}", "Accept": "application/json"},
            )
            response.raise_for_status()
            terminal = response.json()
        self.terminal_name = terminal["name"]
        self.websocket = await websockets.connect(
            self._ws_url(base_url, self.terminal_name),
            open_timeout=self.settings.jupyter_session_ready_timeout_ms / 1000,
        )

    async def send(self, payload: str) -> None:
        await self.websocket.send(json.dumps(["stdin", payload]))

    async def recv(self) -> RemoteFrame:
        while True:
            raw = await self.websocket.recv()
            frame = json.loads(raw)
            if isinstance(frame, list) and len(frame) >= 2 and frame[0] in {"stdout", "stderr"}:
                return RemoteFrame(kind=frame[0], content=str(frame[1] or ""))

    async def close(self) -> None:
        old_ws = self.websocket
        old_terminal = self.terminal_name
        self.websocket = None
        self.terminal_name = None
        if old_ws:
            try:
                await old_ws.close()
            except Exception:
                pass
        if old_terminal:
            try:
                async with httpx.AsyncClient(timeout=10) as client:
                    await client.delete(
                        f"{self.endpoint.base_url.rstrip('/')}/api/terminals/{old_terminal}",
                        headers={"Authorization": f"token {self.endpoint.token}"},
                    )
            except Exception:
                pass

    def _ws_url(self, base_url: str, terminal_name: str) -> str:
        if base_url.startswith("https://"):
            prefix = "wss://" + base_url[len("https://") :]
        else:
            prefix = "ws://" + base_url[len("http://") :]
        return f"{prefix}/terminals/websocket/{terminal_name}?token={self.endpoint.token}"
