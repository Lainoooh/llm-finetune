import asyncio
import re

import pytest

from app.executors.session_pool import SessionEntry, SessionPool
from app.executors.transport import RemoteFrame


class FakeTransport:
    def __init__(self, key="fake:test"):
        self.key = key
        self.is_connected = False
        self.closed = False
        self.sent = []
        self.frames = []

    async def connect(self):
        self.is_connected = True

    async def send(self, payload):
        self.sent.append(payload)
        done = re.search(r"__LLMFT_DONE_[a-f0-9]+_\d+__", payload)
        if done:
            self.frames.append(RemoteFrame(kind="stdout", content=f"output\n{done.group(0)}:0\n"))

    async def recv(self):
        while not self.frames:
            await asyncio.sleep(0.01)
        return self.frames.pop(0)

    async def close(self):
        self.closed = True
        self.is_connected = False


def make_transport_factory(key="fake:test"):
    return lambda: FakeTransport(key=key)


@pytest.mark.asyncio
async def test_pool_warmup_creates_min_sessions():
    pool = SessionPool(transport_factory=make_transport_factory(), min_size=3, max_size=10)
    await pool.warmup()
    try:
        assert len(pool._idle) == 3
        assert pool.total == 3
    finally:
        await pool.shutdown()


@pytest.mark.asyncio
async def test_pool_acquire_and_release():
    pool = SessionPool(transport_factory=make_transport_factory(), min_size=2, max_size=5)
    await pool.warmup()
    try:
        entry = await pool.acquire()
        assert entry is not None
        assert pool.total == 2
        assert len(pool._in_use) == 1
        assert len(pool._idle) == 1

        await pool.release(entry)
        assert len(pool._in_use) == 0
        assert len(pool._idle) == 2
    finally:
        await pool.shutdown()


@pytest.mark.asyncio
async def test_pool_execute_returns_result():
    pool = SessionPool(transport_factory=make_transport_factory(), min_size=2, max_size=5)
    await pool.warmup()
    try:
        result = await pool.execute('echo "hello"', timeout_ms=5000)
        assert "output" in result.stdout
    finally:
        await pool.shutdown()


@pytest.mark.asyncio
async def test_pool_concurrent_acquire_respects_max():
    pool = SessionPool(
        transport_factory=make_transport_factory(),
        min_size=2,
        max_size=3,
        queue_timeout_s=2,
    )
    await pool.warmup()
    try:
        entries = await asyncio.gather(*[pool.acquire() for _ in range(3)])
        assert len(entries) == 3
        assert pool.total == 3
        assert len(pool._in_use) == 3

        for entry in entries:
            await pool.release(entry)
        assert len(pool._idle) == 3
    finally:
        await pool.shutdown()


@pytest.mark.asyncio
async def test_pool_blocks_when_max_reached():
    pool = SessionPool(
        transport_factory=make_transport_factory(),
        min_size=1,
        max_size=1,
        queue_timeout_s=1,
    )
    await pool.warmup()
    try:
        entry = await pool.acquire()
        assert pool.total == 1

        with pytest.raises(RuntimeError, match="queue timeout"):
            await pool.acquire()

        await pool.release(entry)
    finally:
        await pool.shutdown()


@pytest.mark.asyncio
async def test_pool_waiter_gets_released_session():
    pool = SessionPool(
        transport_factory=make_transport_factory(),
        min_size=1,
        max_size=1,
        queue_timeout_s=5,
    )
    await pool.warmup()
    try:
        entry = await pool.acquire()

        async def wait_and_acquire():
            return await pool.acquire()

        task = asyncio.create_task(wait_and_acquire())
        await asyncio.sleep(0.1)

        await pool.release(entry)

        waiter_entry = await task
        assert waiter_entry is not None
        assert pool.total == 1

        await pool.release(waiter_entry)
    finally:
        await pool.shutdown()


@pytest.mark.asyncio
async def test_pool_expands_beyond_min():
    pool = SessionPool(transport_factory=make_transport_factory(), min_size=1, max_size=5)
    await pool.warmup()
    try:
        assert pool.total == 1

        e1 = await pool.acquire()
        e2 = await pool.acquire()
        assert pool.total == 2

        await pool.release(e1)
        await pool.release(e2)
        assert pool.total == 2
    finally:
        await pool.shutdown()


@pytest.mark.asyncio
async def test_pool_unhealthy_session_replaced():
    factory = make_transport_factory()
    pool = SessionPool(transport_factory=factory, min_size=2, max_size=5)
    await pool.warmup()
    try:
        entry = await pool.acquire()
        await entry.session.transport.close()

        await pool.release(entry)

        assert pool.total >= 2
        assert entry not in pool._in_use
    finally:
        await pool.shutdown()


@pytest.mark.asyncio
async def test_pool_shutdown_destroys_all():
    pool = SessionPool(transport_factory=make_transport_factory(), min_size=3, max_size=5)
    await pool.warmup()

    assert pool.total == 3
    await pool.shutdown()
    assert pool.total == 0
    assert len(pool._idle) == 0
    assert len(pool._in_use) == 0


@pytest.mark.asyncio
async def test_session_entry_tracks_usage_time():
    pool = SessionPool(transport_factory=make_transport_factory(), min_size=1, max_size=2)
    await pool.warmup()
    try:
        entry = await pool.acquire()
        t1 = entry.last_used_at

        await asyncio.sleep(0.05)
        await pool.release(entry)

        assert entry.last_used_at >= t1
    finally:
        await pool.shutdown()
