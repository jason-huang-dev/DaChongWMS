# Caching and Redis

Redis is the shared cache/async substrate for DaChongWMS. This guide outlines how to adopt it safely.

## Use Cases

1. **Low-Latency Reads**: Cache read-heavy reference data (SKU metadata, warehouse lookups). Keep TTLs short and provide cache-busting hooks when records change.
2. **API Throttling / Rate Limits**: Store counters keyed by user or device to protect expensive endpoints.
3. **Background Job Coordination**: Use Redis queues or pub/sub to trigger downstream work (see `background-jobs.md`).
4. **Session Storage (optional)**: Django sessions can move to Redis once multiple app servers exist.

## Configuration

- Add `REDIS_URL` (e.g., `redis://localhost:6379/0`) to environment variables.
- Extend `CACHES` in `settings.py` when the first cache-backed feature ships. Example snippet:

```python
CACHES = {
    "default": {
        "BACKEND": "django.core.cache.backends.redis.RedisCache",
        "LOCATION": os.getenv("REDIS_URL"),
        "OPTIONS": {"client_class": "django_redis.client.DefaultClient"},
    }
}
```

- For task queues (Celery/RQ) use a dedicated Redis DB or key prefix to prevent eviction collisions with cache data.

## Cache Patterns

- Wrap cache interactions in helper modules per domain (e.g., `inventory/cache.py`).
- Cache keys should include the environment and resource identifier (`dachongwms:dev:sku:{id}`).
- Use optimistic caching—fall back to DB when cache misses occur.
- Log cache failures at WARN to help ops tune Redis sizing.

## Invalidation

- Hook cache clears into model signals or service functions so updates propagate immediately.
- For bulk imports, prefer `cache.delete_many` or prefix-based invalidation scripts to avoid thundering herds.

## Monitoring

- Track Redis memory usage, evictions, and latency.
- Enable `redis-cli monitor`/Telemetry dashboards in staging to catch misuse early.
