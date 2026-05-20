"""Gunicorn production config for poi_api.

Read by:  gunicorn -c gunicorn.conf.py poi_api:app
Env overrides: HOST, PORT, GUNICORN_WORKERS, GUNICORN_THREADS, GUNICORN_TIMEOUT
"""

import multiprocessing
import os


def _env_int(name: str, default: int) -> int:
    try:
        return int(os.environ.get(name, default))
    except (TypeError, ValueError):
        return default


_host = os.environ.get("HOST", "0.0.0.0")
_port = _env_int("PORT", 5560)

bind = f"{_host}:{_port}"

workers = _env_int("GUNICORN_WORKERS", max(2, multiprocessing.cpu_count()))
worker_class = os.environ.get("GUNICORN_WORKER_CLASS", "gthread")
threads = _env_int("GUNICORN_THREADS", 4)

timeout = _env_int("GUNICORN_TIMEOUT", 60)
graceful_timeout = _env_int("GUNICORN_GRACEFUL_TIMEOUT", 30)
keepalive = _env_int("GUNICORN_KEEPALIVE", 2)

max_requests = _env_int("GUNICORN_MAX_REQUESTS", 1000)
max_requests_jitter = _env_int("GUNICORN_MAX_REQUESTS_JITTER", 100)

accesslog = "-"
errorlog = "-"
loglevel = os.environ.get("GUNICORN_LOG_LEVEL", "info")
access_log_format = '%(h)s %({x-forwarded-for}i)s "%(r)s" %(s)s %(b)s %(L)ss "%(f)s" "%(a)s"'

forwarded_allow_ips = os.environ.get("GUNICORN_FORWARDED_ALLOW_IPS", "*")
proxy_allow_ips = forwarded_allow_ips
