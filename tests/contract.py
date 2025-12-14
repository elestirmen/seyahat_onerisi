#!/usr/bin/env python3
"""
OpenAPI contract checks (best-effort).

This script is intentionally lightweight:
- If PyYAML isn't installed, it prints a warning and exits 0.
- If available, it validates basic OpenAPI structure and presence of core paths.
"""

from __future__ import annotations

import sys
from pathlib import Path


def main() -> int:
    try:
        import yaml  # type: ignore
    except Exception:
        print("⚠️  PyYAML not installed; skipping OpenAPI contract checks.")
        return 0

    spec_path = Path("openapi.yaml")
    if not spec_path.exists():
        print("❌ openapi.yaml not found")
        return 1

    spec = yaml.safe_load(spec_path.read_text(encoding="utf-8"))
    if not isinstance(spec, dict):
        print("❌ openapi.yaml did not parse to an object")
        return 1

    if "openapi" not in spec or "info" not in spec or "paths" not in spec:
        print("❌ openapi.yaml missing required top-level keys (openapi/info/paths)")
        return 1

    paths = spec.get("paths") or {}
    if not isinstance(paths, dict):
        print("❌ openapi.yaml paths must be an object")
        return 1

    # Only validate core endpoints we guarantee in the modular app.
    required_paths = [
        "/health",
        "/auth/login",
        "/auth/logout",
        "/auth/status",
        "/auth/csrf-token",
        "/api/pois",
        "/api/poi/{poi_id}",
        "/api/search",
        "/api/routes",
    ]

    missing = [p for p in required_paths if p not in paths]
    if missing:
        print(f"❌ openapi.yaml missing required paths: {', '.join(missing)}")
        return 1

    print("✅ OpenAPI contract basic checks passed")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())

