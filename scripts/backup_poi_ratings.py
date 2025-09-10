#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
Backup poi_ratings table to JSON under reports/ with timestamped filename.
Reads connection string from .env (POI_DB_CONNECTION).
"""
import os
import json
import datetime as dt

try:
    import psycopg2
    from psycopg2.extras import RealDictCursor
except ImportError:
    raise SystemExit("psycopg2 not installed. pip install psycopg2-binary")


def load_connection_string() -> str:
    path = os.path.join(os.getcwd(), '.env')
    if not os.path.isfile(path):
        raise SystemExit(".env not found; cannot read POI_DB_CONNECTION")
    with open(path, 'r', encoding='utf-8') as f:
        for line in f:
            if line.startswith('POI_DB_CONNECTION='):
                return line.strip().split('=', 1)[1].strip().strip('"')
    raise SystemExit("POI_DB_CONNECTION not found in .env")


def main():
    conn_str = load_connection_string()
    conn = psycopg2.connect(conn_str)
    cur = conn.cursor(cursor_factory=RealDictCursor)
    cur.execute("SELECT COUNT(*) AS c FROM poi_ratings")
    count = cur.fetchone()['c']
    cur.execute("SELECT poi_id, category, rating FROM poi_ratings ORDER BY poi_id, category")
    rows = [dict(r) for r in cur.fetchall()]
    cur.close(); conn.close()

    os.makedirs('reports', exist_ok=True)
    out_path = os.path.join('reports', f"poi_ratings_backup_{dt.datetime.now().strftime('%Y%m%d_%H%M%S')}.json")
    with open(out_path, 'w', encoding='utf-8') as f:
        json.dump({"count": count, "rows": rows}, f, ensure_ascii=False, indent=2)
    print(f"Backed up {count} rows to {out_path}")


if __name__ == '__main__':
    main()

