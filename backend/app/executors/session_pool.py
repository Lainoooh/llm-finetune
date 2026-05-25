from __future__ import annotations

import asyncio
import logging
import time
from dataclasses import dataclass, field

from app.executors.base import RemoteExecutionResult
from app.executors.queued_session import QueuedRemoteSession

logger = logging.getLogger(__name__)


@dataclass(eq=False)
class SessionEntry:
    session: QueuedRemoteSession
    last_used_at: float = field(default_factory=time.monotonic)
    created_at: float = field(default_factory=time.monotonic)
    is_healthy: bool = True

    def __hash__(self):
        return id(self)


class SessionPool:
    def __init__(
        self,
        transport_factory,
        min_size: int = 5,
        max_size: int = 20,
        health_check_interval_s: int = 60,
        idle_timeout_s: int = 1800,
        queue_timeout_s: int = 300,
    ):
        self._transport_factory = transport_factory
        self._min_size = min_size
        self._max_size = max_size
        self._health_check_interval_s = health_check_interval_s
        self._idle_timeout_s = idle_timeout_s
        self._queue_timeout_s = queue_timeout_s

        self._idle: list[SessionEntry] = []
        self._in_use: set[SessionEntry] = set()
        self._waiters: asyncio.Queue[asyncio.Event] = asyncio.Queue()
        self._lock = asyncio.Lock()
        self._closed = False
        self._health_task: asyncio.Task | None = None
        self._shrink_task: asyncio.Task | None = None

    @property
    def total(self) -> int:
        return len(self._idle) + len(self._in_use)

    async def warmup(self) -> None:
        tasks = [self._create_entry() for _ in range(self._min_size)]
        entries = await asyncio.gather(*tasks, return_exceptions=True)
        success = 0
        for entry in entries:
            if isinstance(entry, Exception):
                logger.warning("Warmup session failed: %s", entry)
            else:
                self._idle.append(entry)
                success += 1
        logger.info("Pool warmup: %d/%d sessions ready", success, self._min_size)
        self._health_task = asyncio.create_task(self._health_loop())
        self._shrink_task = asyncio.create_task(self._shrink_loop())

    async def execute(self, script: str, timeout_ms: int | None = None) -> RemoteExecutionResult:
        entry = await self.acquire()
        try:
            return await entry.session.run_script(script, timeout_ms=timeout_ms)
        finally:
            await self.release(entry)

    async def acquire(self) -> SessionEntry:
        async with self._lock:
            while self._idle:
                entry = self._idle.pop(0)
                if entry.is_healthy and entry.session.transport.is_connected:
                    entry.last_used_at = time.monotonic()
                    self._in_use.add(entry)
                    return entry
                await self._destroy_entry_unlocked(entry)

            if self.total < self._max_size:
                entry = await self._create_entry()
                entry.last_used_at = time.monotonic()
                self._in_use.add(entry)
                return entry

        waiter = asyncio.Event()
        await self._waiters.put(waiter)
        try:
            await asyncio.wait_for(waiter.wait(), timeout=self._queue_timeout_s)
        except asyncio.TimeoutError:
            raise RuntimeError(f"Session pool queue timeout ({self._queue_timeout_s}s)")

        async with self._lock:
            if self._idle:
                entry = self._idle.pop(0)
                entry.last_used_at = time.monotonic()
                self._in_use.add(entry)
                return entry
            raise RuntimeError("Session pool: waiter signaled but no session available")

    async def release(self, entry: SessionEntry) -> None:
        async with self._lock:
            self._in_use.discard(entry)
            entry.last_used_at = time.monotonic()

            if entry.session.transport.is_connected:
                while not self._waiters.empty():
                    try:
                        waiter = self._waiters.get_nowait()
                        waiter.set()
                        self._idle.append(entry)
                        return
                    except asyncio.QueueEmpty:
                        break
                self._idle.append(entry)
            else:
                await self._destroy_entry_unlocked(entry)
                if self.total < self._min_size:
                    try:
                        new_entry = await self._create_entry()
                        self._idle.append(new_entry)
                    except Exception as exc:
                        logger.warning("Failed to replenish session: %s", exc)

    async def _create_entry(self) -> SessionEntry:
        transport = self._transport_factory()
        session = QueuedRemoteSession(transport)
        await session.ensure_connected()
        return SessionEntry(session=session)

    async def _destroy_entry_unlocked(self, entry: SessionEntry) -> None:
        entry.is_healthy = False
        try:
            await entry.session.reset()
        except Exception:
            pass

    async def _health_loop(self) -> None:
        while not self._closed:
            await asyncio.sleep(self._health_check_interval_s)
            if self._closed:
                break
            for entry in list(self._idle):
                if self._closed:
                    break
                try:
                    await entry.session.run_script('echo "ping"', timeout_ms=5000)
                    entry.is_healthy = True
                except Exception:
                    entry.is_healthy = False
                    async with self._lock:
                        if entry in self._idle:
                            self._idle.remove(entry)
                            await self._destroy_entry_unlocked(entry)
                    async with self._lock:
                        if self.total < self._min_size:
                            try:
                                new_entry = await self._create_entry()
                                self._idle.append(new_entry)
                            except Exception as exc:
                                logger.warning("Health check replenish failed: %s", exc)

    async def _shrink_loop(self) -> None:
        while not self._closed:
            await asyncio.sleep(self._health_check_interval_s)
            if self._closed:
                break
            now = time.monotonic()
            async with self._lock:
                to_remove = []
                for entry in sorted(self._idle, key=lambda e: e.last_used_at):
                    if self.total - len(to_remove) <= self._min_size:
                        break
                    if now - entry.last_used_at > self._idle_timeout_s:
                        to_remove.append(entry)
                for entry in to_remove:
                    self._idle.remove(entry)
                    await self._destroy_entry_unlocked(entry)
                    logger.info("Pool shrunk idle session (total=%d)", self.total)

    async def shutdown(self) -> None:
        self._closed = True
        if self._health_task:
            self._health_task.cancel()
        if self._shrink_task:
            self._shrink_task.cancel()
        async with self._lock:
            for entry in list(self._idle) + list(self._in_use):
                await self._destroy_entry_unlocked(entry)
            self._idle.clear()
            self._in_use.clear()


class SessionPoolManager:
    def __init__(self):
        self._pools: dict[str, SessionPool] = {}
        self._lock = asyncio.Lock()

    async def run_for_server(self, server, script, timeout_ms=None) -> RemoteExecutionResult:
        from app.executors.factory import _config_for_server, _key_for_config, _transport_factory_for_config

        config = _config_for_server(server)
        key = _key_for_config(config)
        pool = await self._get_or_create_pool(key, _transport_factory_for_config(config))
        return await pool.execute(script, timeout_ms=timeout_ms)

    async def run_for_draft(self, config, script, timeout_ms=None) -> RemoteExecutionResult:
        from app.executors.factory import _key_for_config, _transport_factory_for_config

        key = _key_for_config(config)
        pool = await self._get_or_create_pool(key, _transport_factory_for_config(config))
        return await pool.execute(script, timeout_ms=timeout_ms)

    async def _get_or_create_pool(self, key: str, transport_factory) -> SessionPool:
        if key in self._pools:
            return self._pools[key]
        async with self._lock:
            if key in self._pools:
                return self._pools[key]
            from app.core.config import get_settings

            s = get_settings()
            pool = SessionPool(
                transport_factory=transport_factory,
                min_size=s.pool_min_size,
                max_size=s.pool_max_size,
                health_check_interval_s=s.pool_health_check_interval_s,
                idle_timeout_s=s.pool_idle_timeout_s,
                queue_timeout_s=s.pool_queue_timeout_s,
            )
            await pool.warmup()
            self._pools[key] = pool
            return pool

    async def remove_pool(self, key: str) -> None:
        async with self._lock:
            pool = self._pools.pop(key, None)
            if pool:
                await pool.shutdown()

    async def shutdown_all(self) -> None:
        async with self._lock:
            for pool in self._pools.values():
                await pool.shutdown()
            self._pools.clear()

    def get_pool_stats(self) -> dict[str, dict]:
        return {
            key: {
                "idle": len(pool._idle),
                "in_use": len(pool._in_use),
                "total": pool.total,
                "waiters": pool._waiters.qsize(),
            }
            for key, pool in self._pools.items()
        }
