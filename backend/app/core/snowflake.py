from __future__ import annotations

import threading
import time


class SnowflakeGenerator:
    """64-bit Snowflake ID generator.

    Layout:
    - 41 bits timestamp in milliseconds since custom epoch
    - 10 bits node id
    - 12 bits sequence
    """

    def __init__(self, node_id: int = 1, epoch_ms: int = 1_767_225_600_000):
        if node_id < 0 or node_id > 1023:
            raise ValueError("node_id must be between 0 and 1023")
        self.node_id = node_id
        self.epoch_ms = epoch_ms
        self.sequence = 0
        self.last_ms = -1
        self.lock = threading.Lock()

    def next_id(self) -> int:
        with self.lock:
            now_ms = int(time.time() * 1000)
            if now_ms < self.last_ms:
                now_ms = self.last_ms

            if now_ms == self.last_ms:
                self.sequence = (self.sequence + 1) & 0xFFF
                if self.sequence == 0:
                    while now_ms <= self.last_ms:
                        now_ms = int(time.time() * 1000)
            else:
                self.sequence = 0

            self.last_ms = now_ms
            return ((now_ms - self.epoch_ms) << 22) | (self.node_id << 12) | self.sequence


_generator: SnowflakeGenerator | None = None


def configure_snowflake(node_id: int) -> None:
    global _generator
    _generator = SnowflakeGenerator(node_id=node_id)


def next_id() -> int:
    global _generator
    if _generator is None:
        _generator = SnowflakeGenerator()
    return _generator.next_id()
