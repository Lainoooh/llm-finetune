from app.core.snowflake import next_id


def public_code(prefix: str) -> str:
    return f"{prefix}-{next_id()}"
