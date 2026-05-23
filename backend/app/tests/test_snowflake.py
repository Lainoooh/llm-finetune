from app.core.snowflake import SnowflakeGenerator


def test_snowflake_ids_are_increasing_ints():
    generator = SnowflakeGenerator(node_id=1)
    first = generator.next_id()
    second = generator.next_id()
    assert isinstance(first, int)
    assert isinstance(second, int)
    assert second > first

