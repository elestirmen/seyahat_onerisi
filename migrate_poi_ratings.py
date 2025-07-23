import argparse
import psycopg2
from psycopg2.extras import RealDictCursor


def migrate(connection_string: str, remove_from_attributes: bool = True):
    conn = psycopg2.connect(connection_string)
    cur = conn.cursor(cursor_factory=RealDictCursor)

    cur.execute("SELECT id, attributes->'ratings' AS ratings FROM pois WHERE attributes ? 'ratings'")
    rows = cur.fetchall()
    insert_query = """
        INSERT INTO poi_ratings (poi_id, category, rating)
        VALUES (%s, %s, %s)
        ON CONFLICT (poi_id, category) DO UPDATE SET rating = EXCLUDED.rating
    """
    for row in rows:
        ratings = row['ratings'] or {}
        for category, rating in ratings.items():
            try:
                rating_int = int(rating)
            except (TypeError, ValueError):
                rating_int = 0
            cur.execute(insert_query, (row['id'], category, rating_int))
        if remove_from_attributes:
            cur.execute("UPDATE pois SET attributes = attributes - 'ratings' WHERE id = %s", (row['id'],))

    conn.commit()
    cur.close()
    conn.close()


if __name__ == '__main__':
    parser = argparse.ArgumentParser(description='Move ratings from attributes JSONB to poi_ratings table')
    parser.add_argument('connection_string', help='PostgreSQL connection string')
    parser.add_argument('--keep-jsonb', action='store_true', help='Keep ratings data in attributes JSONB')
    args = parser.parse_args()
    migrate(args.connection_string, remove_from_attributes=not args.keep_jsonb)
    print('Migration completed.')
