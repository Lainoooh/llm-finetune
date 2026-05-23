from __future__ import annotations

from dataclasses import dataclass
from typing import Protocol


@dataclass
class RemoteFrame:
    kind: str
    content: str


class RemoteTransport(Protocol):
    @property
    def key(self) -> str:
        ...

    @property
    def is_connected(self) -> bool:
        ...

    async def connect(self) -> None:
        ...

    async def send(self, payload: str) -> None:
        ...

    async def recv(self) -> RemoteFrame:
        ...

    async def close(self) -> None:
        ...
