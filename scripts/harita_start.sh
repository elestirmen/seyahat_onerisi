#!/usr/bin/env bash
set -euo pipefail

APP_DIR="/opt/rehber/seyahat_onerisi"
PID_FILE="$APP_DIR/gunicorn.pid"
LOG_FILE="$APP_DIR/gunicorn.log"

cd "$APP_DIR"

if [ -f "$PID_FILE" ]; then
  pid="$(cat "$PID_FILE" || true)"
  if [ -n "${pid:-}" ] && kill -0 "$pid" 2>/dev/null; then
    exit 0
  fi
fi

nohup env FLASK_ENV="${FLASK_ENV:-development}" \
  "$APP_DIR/venv/bin/gunicorn" --config "$APP_DIR/gunicorn.conf.py" poi_api:app \
  >>"$LOG_FILE" 2>&1 &

echo "$!" >"$PID_FILE"
