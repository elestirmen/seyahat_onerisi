#!/usr/bin/env python3
"""
Route Media Database Migration (robust)
- route_media tablosu (konum opsiyonel; 'photo' için zorunlu)
- routes.preview_image kolonu
- routes meta kolonları (total_distance, difficulty_level, estimated_duration, updated_at)
- Trigram indeksleri (varsa name/description)
- Yardımcı fonksiyonlar + tetikleyiciler
- Görünümler (mevcut kolonlara göre dinamik)
- schema_migrations güvenli loglama
"""

import os
import sys
from datetime import datetime
import psycopg2


def get_db_connection():
    # Unified connection string first (e.g., postgres://user:pass@host:5432/db)
    connection_string = os.getenv('POI_DB_CONNECTION')
    if connection_string:
        try:
            return psycopg2.connect(connection_string)
        except Exception as e:
            print(f"❌ Connection string failed: {e}")

    # Fallback to discrete env vars
    db_config = {
        'host': os.getenv('POI_DB_HOST', 'localhost'),
        'port': os.getenv('POI_DB_PORT', '5432'),
        'database': os.getenv('POI_DB_NAME', 'poi_db'),
        'user': os.getenv('POI_DB_USER', 'poi_user'),
        'password': os.getenv('POI_DB_PASSWORD', 'poi_password'),
    }
    try:
        return psycopg2.connect(**db_config)
    except Exception as e:
        print(f"❌ Database connection failed: {e}")
        sys.exit(1)


def check_table_exists(cursor, table_name):
    cursor.execute("""
        SELECT EXISTS (
            SELECT FROM information_schema.tables
            WHERE table_schema = 'public' AND table_name = %s
        );
    """, (table_name,))
    return cursor.fetchone()[0]


def check_column_exists(cursor, table_name, column_name):
    cursor.execute("""
        SELECT EXISTS (
            SELECT FROM information_schema.columns
            WHERE table_schema = 'public'
              AND table_name = %s
              AND column_name = %s
        );
    """, (table_name, column_name))
    return cursor.fetchone()[0]


def check_extension_exists(cursor, extension_name):
    cursor.execute("SELECT EXISTS (SELECT FROM pg_extension WHERE extname = %s);", (extension_name,))
    return cursor.fetchone()[0]


def ensure_schema_migrations_table(cursor):
    cursor.execute("""
        CREATE TABLE IF NOT EXISTS schema_migrations (
            migration_name TEXT PRIMARY KEY,
            migration_version TEXT,
            description TEXT,
            executed_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
            execution_time_ms INTEGER,
            success BOOLEAN,
            error_message TEXT
        );
    """)


def create_route_media_table(cursor):
    print("📊 Creating/ensuring route_media table...")

    cursor.execute("""
        CREATE TABLE IF NOT EXISTS route_media (
            id              SERIAL PRIMARY KEY,
            route_id        INTEGER NOT NULL REFERENCES routes(id) ON DELETE CASCADE,
            file_path       VARCHAR(255) NOT NULL,        -- dosya yolu
            thumbnail_path  VARCHAR(255),                 -- küçük önizleme
            preview_path    VARCHAR(255),                 -- büyük önizleme
            lat             DOUBLE PRECISION,             -- opsiyonel enlem
            lng             DOUBLE PRECISION,             -- opsiyonel boylam
            caption         TEXT,
            is_primary      BOOLEAN DEFAULT FALSE,        -- ana görsel
            media_type      VARCHAR(20) DEFAULT 'image',  -- 'image','video','audio','model_3d'
            uploaded_at     TIMESTAMP DEFAULT CURRENT_TIMESTAMP,

            -- Geçerlilik kontrolleri
            CONSTRAINT valid_media_type CHECK (
                media_type IN ('image','video','audio','model_3d')
            ),
            -- lat ve lng birlikte NULL ya da birlikte dolu olmalı
            CONSTRAINT both_or_none CHECK ((lat IS NULL) = (lng IS NULL)),
            -- Konum zorunlu değil, opsiyonel
            CONSTRAINT lat_range_if_present CHECK (lat IS NULL OR (lat BETWEEN -90 AND 90)),
            CONSTRAINT lng_range_if_present CHECK (lng IS NULL OR (lng BETWEEN -180 AND 180))
        );
    """)

    # İndeksler
    cursor.execute("CREATE INDEX IF NOT EXISTS idx_route_media_route_id ON route_media(route_id);")
    cursor.execute("""
        CREATE INDEX IF NOT EXISTS idx_route_media_location
        ON route_media(lat, lng) WHERE lat IS NOT NULL AND lng IS NOT NULL;
    """)
    cursor.execute("CREATE INDEX IF NOT EXISTS idx_route_media_uploaded_at ON route_media(uploaded_at);")
    cursor.execute("CREATE INDEX IF NOT EXISTS idx_route_media_type ON route_media(media_type);")

    # Bir rota için yalnızca bir primary
    cursor.execute("""
        CREATE UNIQUE INDEX IF NOT EXISTS idx_route_media_one_primary
        ON route_media(route_id) WHERE is_primary IS TRUE;
    """)

    print("✅ route_media ready")


def add_preview_image_to_routes(cursor):
    print("📊 Ensuring routes.preview_image...")
    if not check_column_exists(cursor, 'routes', 'preview_image'):
        cursor.execute("ALTER TABLE routes ADD COLUMN preview_image VARCHAR(255);")
        cursor.execute("""
            COMMENT ON COLUMN routes.preview_image IS
            'Primary image path for quick display; can mirror route_media.is_primary.';
        """)
        print("  ✅ Added routes.preview_image")
    else:
        print("  ℹ️ routes.preview_image already exists")


def ensure_routes_metadata_columns(cursor):
    print("📊 Ensuring routes meta columns...")

    # updated_at, triggers/fonksiyonlar için gerekli
    if not check_column_exists(cursor, 'routes', 'updated_at'):
        cursor.execute("ALTER TABLE routes ADD COLUMN updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP;")
        print("  ✅ Added routes.updated_at")

    if not check_column_exists(cursor, 'routes', 'total_distance'):
        cursor.execute("ALTER TABLE routes ADD COLUMN total_distance DOUBLE PRECISION;")
        print("  ✅ Added routes.total_distance")

    if not check_column_exists(cursor, 'routes', 'difficulty_level'):
        cursor.execute("""
            ALTER TABLE routes
            ADD COLUMN difficulty_level INTEGER DEFAULT 1;
        """)
        cursor.execute("""
            ALTER TABLE routes
            ADD CONSTRAINT routes_difficulty_ck CHECK (difficulty_level BETWEEN 1 AND 5);
        """)
        print("  ✅ Added routes.difficulty_level (+check)")

    if not check_column_exists(cursor, 'routes', 'estimated_duration'):
        cursor.execute("ALTER TABLE routes ADD COLUMN estimated_duration INTEGER;")
        print("  ✅ Added routes.estimated_duration")

    # Faydalı indeksler (opsiyonel)
    cursor.execute("CREATE INDEX IF NOT EXISTS idx_routes_distance ON routes(total_distance);")
    cursor.execute("CREATE INDEX IF NOT EXISTS idx_routes_difficulty ON routes(difficulty_level);")
    cursor.execute("CREATE INDEX IF NOT EXISTS idx_routes_duration ON routes(estimated_duration);")

    print("✅ routes meta ready")


def create_trigram_search_index(cursor):
    print("📊 Creating trigram indexes (if possible)...")
    if not check_extension_exists(cursor, 'pg_trgm'):
        try:
            cursor.execute("CREATE EXTENSION IF NOT EXISTS pg_trgm;")
            print("  ✅ pg_trgm enabled")
        except Exception as e:
            print(f"  ⚠️ Cannot enable pg_trgm (need superuser?): {e}")
            return
    else:
        print("  ℹ️ pg_trgm already enabled")

    # name varsa trigram
    if check_column_exists(cursor, 'routes', 'name'):
        cursor.execute("""
            CREATE INDEX IF NOT EXISTS idx_routes_name_trgm
            ON routes USING GIN (name gin_trgm_ops);
        """)
        print("  ✅ idx_routes_name_trgm created")
    else:
        print("  ⚠️ routes.name not found; skipping name trigram")

    # description varsa trigram
    if check_column_exists(cursor, 'routes', 'description'):
        cursor.execute("""
            CREATE INDEX IF NOT EXISTS idx_routes_description_trgm
            ON routes USING GIN (description gin_trgm_ops);
        """)
        print("  ✅ idx_routes_description_trgm created")
    else:
        print("  ℹ️ routes.description not found; skipping description trigram")


def ensure_route_media_columns(cursor):
    """Ensure all required columns exist in route_media table"""
    print("📊 Ensuring route_media columns...")
    
    # Add preview_path column if it doesn't exist
    if not check_column_exists(cursor, 'route_media', 'preview_path'):
        cursor.execute("ALTER TABLE route_media ADD COLUMN preview_path VARCHAR(255);")
        print("  ✅ Added route_media.preview_path")
    else:
        print("  ℹ️ route_media.preview_path already exists")
    
    # Update media_type constraint if needed
    try:
        cursor.execute("""
            ALTER TABLE route_media 
            DROP CONSTRAINT IF EXISTS valid_media_type;
        """)
        cursor.execute("""
            ALTER TABLE route_media 
            ADD CONSTRAINT valid_media_type 
            CHECK (media_type IN ('image','video','audio','model_3d'));
        """)
        print("  ✅ Updated media_type constraint")
    except Exception as e:
        print(f"  ⚠️ Could not update media_type constraint: {e}")


def create_helper_functions(cursor):
    print("📊 Creating helper functions...")

    # Bir rotanın ana görseli (deterministik sıralama)
    cursor.execute("""
        CREATE OR REPLACE FUNCTION get_route_primary_image(route_id_param INTEGER)
        RETURNS VARCHAR(255) AS $$
        DECLARE
            primary_image VARCHAR(255);
        BEGIN
            SELECT file_path INTO primary_image
            FROM route_media
            WHERE route_id = route_id_param AND is_primary = TRUE
            ORDER BY uploaded_at DESC, id DESC
            LIMIT 1;

            RETURN primary_image;
        END;
        $$ LANGUAGE plpgsql;
    """)

    # routes.preview_image güncelle
    cursor.execute("""
        CREATE OR REPLACE FUNCTION sync_route_preview_image(route_id_param INTEGER)
        RETURNS VOID AS $$
        DECLARE
            primary_image VARCHAR(255);
        BEGIN
            SELECT file_path INTO primary_image
            FROM route_media
            WHERE route_id = route_id_param AND is_primary = TRUE
            ORDER BY uploaded_at DESC, id DESC
            LIMIT 1;

            UPDATE routes
            SET preview_image = primary_image,
                updated_at = CURRENT_TIMESTAMP
            WHERE id = route_id_param;
        END;
        $$ LANGUAGE plpgsql;
    """)

    # Aynı rotada tek primary
    cursor.execute("""
        CREATE OR REPLACE FUNCTION ensure_single_primary_image()
        RETURNS TRIGGER AS $$
        BEGIN
            IF NEW.is_primary = TRUE THEN
                UPDATE route_media
                SET is_primary = FALSE
                WHERE route_id = NEW.route_id
                  AND id <> NEW.id
                  AND is_primary = TRUE;

                PERFORM sync_route_preview_image(NEW.route_id);
            END IF;
            RETURN NEW;
        END;
        $$ LANGUAGE plpgsql;
    """)

    # route_media değişince routes.updated_at güncelle
    cursor.execute("""
        CREATE OR REPLACE FUNCTION update_route_on_media_change()
        RETURNS TRIGGER AS $$
        BEGIN
            UPDATE routes
            SET updated_at = CURRENT_TIMESTAMP
            WHERE id = COALESCE(NEW.route_id, OLD.route_id);
            RETURN COALESCE(NEW, OLD);
        END;
        $$ LANGUAGE plpgsql;
    """)

    print("✅ helper functions ready")


def create_triggers(cursor):
    print("📊 Creating triggers...")

    cursor.execute("DROP TRIGGER IF EXISTS trigger_ensure_single_primary_image ON route_media;")
    cursor.execute("""
        CREATE TRIGGER trigger_ensure_single_primary_image
        BEFORE INSERT OR UPDATE ON route_media
        FOR EACH ROW
        EXECUTE FUNCTION ensure_single_primary_image();
    """)

    cursor.execute("DROP TRIGGER IF EXISTS trigger_update_route_on_media_change ON route_media;")
    cursor.execute("""
        CREATE TRIGGER trigger_update_route_on_media_change
        AFTER INSERT OR UPDATE OR DELETE ON route_media
        FOR EACH ROW
        EXECUTE FUNCTION update_route_on_media_change();
    """)

    print("✅ triggers ready")


def create_views(cursor):
    print("📊 Creating views...")

    has_desc = check_column_exists(cursor, 'routes', 'description')
    has_type = check_column_exists(cursor, 'routes', 'route_type')
    has_active = check_column_exists(cursor, 'routes', 'is_active')

    # routes_with_primary_image: her zaman oluşturulabilir
    cursor.execute("""
        CREATE OR REPLACE VIEW routes_with_primary_image AS
        SELECT
            r.*,
            rm.file_path      AS primary_image_path,
            rm.thumbnail_path AS primary_thumbnail_path,
            rm.caption        AS primary_image_caption
        FROM routes r
        LEFT JOIN LATERAL (
            SELECT file_path, thumbnail_path, caption
            FROM route_media
            WHERE route_id = r.id AND is_primary = TRUE
            ORDER BY uploaded_at DESC, id DESC
            LIMIT 1
        ) rm ON TRUE;
    """)

    # route_media_with_route_info: mevcut kolonlara göre dinamik alan listesi ve filtre
    cols = ["rm.*", "r.name AS route_name", "r.difficulty_level"]
    if has_desc:
        cols.insert(2, "r.description AS route_description")
    if has_type:
        cols.append("r.route_type")

    base = f"""
        CREATE OR REPLACE VIEW route_media_with_route_info AS
        SELECT {", ".join(cols)}
        FROM route_media rm
        JOIN routes r ON rm.route_id = r.id
    """
    where_clause = " WHERE r.is_active = TRUE" if has_active else ""
    cursor.execute(base + where_clause + ";")

    print("✅ views ready")


def log_migration(cursor, migration_name, version, description, execution_time_ms, success=True, error_message=None):
    ensure_schema_migrations_table(cursor)
    cursor.execute("""
        INSERT INTO schema_migrations
        (migration_name, migration_version, description, executed_at, execution_time_ms, success, error_message)
        VALUES (%s, %s, %s, CURRENT_TIMESTAMP, %s, %s, %s)
        ON CONFLICT (migration_name) DO UPDATE SET
            executed_at = EXCLUDED.executed_at,
            execution_time_ms = EXCLUDED.execution_time_ms,
            success = EXCLUDED.success,
            error_message = EXCLUDED.error_message,
            migration_version = EXCLUDED.migration_version,
            description = EXCLUDED.description;
    """, (migration_name, version, description, execution_time_ms, success, error_message))


def verify_migration(cursor):
    print("🔍 Verifying migration...")

    if not check_table_exists(cursor, 'route_media'):
        raise Exception("route_media table was not created")

    for col in ('preview_image', 'total_distance', 'difficulty_level', 'estimated_duration', 'updated_at'):
        if not check_column_exists(cursor, 'routes', col):
            raise Exception(f"routes.{col} missing")

    # Functions exist?
    cursor.execute("""
        SELECT COUNT(*) FROM information_schema.routines
        WHERE routine_schema='public'
          AND routine_name IN (
              'get_route_primary_image',
              'sync_route_preview_image',
              'ensure_single_primary_image',
              'update_route_on_media_change'
          );
    """)
    fn_count = cursor.fetchone()[0]
    if fn_count < 4:
        raise Exception("Not all helper functions were created")

    # Views exist?
    cursor.execute("""
        SELECT COUNT(*) FROM information_schema.views
        WHERE table_schema='public'
          AND table_name IN ('routes_with_primary_image','route_media_with_route_info');
    """)
    view_count = cursor.fetchone()[0]
    if view_count < 2:
        raise Exception("Views missing")

    # Unique index for single primary
    cursor.execute("""
        SELECT COUNT(*) FROM pg_indexes
        WHERE schemaname='public' AND indexname='idx_route_media_one_primary';
    """)
    if cursor.fetchone()[0] == 0:
        raise Exception("idx_route_media_one_primary index missing")

    print("✅ Verification OK")


def run_migration():
    start_time = datetime.now()
    print("🚀 Starting Route Media Migration")
    print(f"📅 Start: {start_time}")
    print("=" * 60)

    conn = get_db_connection()
    cursor = conn.cursor()
    try:
        ensure_schema_migrations_table(cursor)

        create_route_media_table(cursor)
        ensure_route_media_columns(cursor)
        add_preview_image_to_routes(cursor)
        ensure_routes_metadata_columns(cursor)
        create_trigram_search_index(cursor)
        create_helper_functions(cursor)
        create_triggers(cursor)
        create_views(cursor)

        verify_migration(cursor)
        conn.commit()

        end_time = datetime.now()
        execution_time_ms = int((end_time - start_time).total_seconds() * 1000)

        log_migration(
            cursor,
            'route_media_enhancement_v1',
            '1.1.0',
            'route_media + constraints + unique primary + views + trigram',
            execution_time_ms,
            success=True
        )
        conn.commit()

        print("=" * 60)
        print("✅ Migration completed successfully!")
        print(f"⏱️  Total: {execution_time_ms} ms")
        print(f"📅 End:   {end_time}")

    except Exception as e:
        print(f"❌ Migration failed: {e}")
        try:
            end_time = datetime.now()
            execution_time_ms = int((end_time - start_time).total_seconds() * 1000)
            log_migration(
                cursor,
                'route_media_enhancement_v1',
                '1.1.0',
                'Failed route_media migration',
                execution_time_ms,
                success=False,
                error_message=str(e)
            )
            conn.commit()
        except Exception:
            pass
        conn.rollback()
        sys.exit(1)
    finally:
        try:
            cursor.close()
            conn.close()
        except Exception:
            pass


def rollback_migration():
    print("🔄 Rolling back Route Media Migration")

    conn = get_db_connection()
    cursor = conn.cursor()
    try:
        # Views
        print("📉 Dropping views...")
        cursor.execute("DROP VIEW IF EXISTS routes_with_primary_image CASCADE;")
        cursor.execute("DROP VIEW IF EXISTS route_media_with_route_info CASCADE;")

        # Triggers
        print("🔧 Dropping triggers...")
        cursor.execute("DROP TRIGGER IF EXISTS trigger_ensure_single_primary_image ON route_media;")
        cursor.execute("DROP TRIGGER IF EXISTS trigger_update_route_on_media_change ON route_media;")

        # Functions
        print("🧩 Dropping functions...")
        cursor.execute("DROP FUNCTION IF EXISTS get_route_primary_image(INTEGER);")
        cursor.execute("DROP FUNCTION IF EXISTS sync_route_preview_image(INTEGER);")
        cursor.execute("DROP FUNCTION IF EXISTS ensure_single_primary_image();")
        cursor.execute("DROP FUNCTION IF EXISTS update_route_on_media_change();")

        # Indexes
        print("🏷️ Dropping indexes...")
        cursor.execute("DROP INDEX IF EXISTS idx_routes_name_trgm;")
        cursor.execute("DROP INDEX IF EXISTS idx_routes_description_trgm;")
        cursor.execute("DROP INDEX IF EXISTS idx_route_media_one_primary;")
        cursor.execute("DROP INDEX IF EXISTS idx_route_media_route_id;")
        cursor.execute("DROP INDEX IF EXISTS idx_route_media_location;")
        cursor.execute("DROP INDEX IF EXISTS idx_route_media_uploaded_at;")
        cursor.execute("DROP INDEX IF EXISTS idx_route_media_type;")

        # Table
        print("🗑️ Dropping route_media table...")
        cursor.execute("DROP TABLE IF EXISTS route_media CASCADE;")

        # Columns
        print("🧹 Removing routes.preview_image (keeps meta cols)...")
        cursor.execute("ALTER TABLE routes DROP COLUMN IF EXISTS preview_image;")
        print("🧹 Removing route_media.preview_path...")
        cursor.execute("ALTER TABLE route_media DROP COLUMN IF EXISTS preview_path;")

        # Log
        ensure_schema_migrations_table(cursor)
        cursor.execute("DELETE FROM schema_migrations WHERE migration_name='route_media_enhancement_v1';")

        conn.commit()
        print("✅ Rollback completed")

    except Exception as e:
        print(f"❌ Rollback failed: {e}")
        conn.rollback()
        sys.exit(1)
    finally:
        try:
            cursor.close()
            conn.close()
        except Exception:
            pass


if __name__ == "__main__":
    import argparse

    parser = argparse.ArgumentParser(description='Route Media Enhancement Database Migration')
    parser.add_argument('--rollback', action='store_true', help='Rollback the migration')
    parser.add_argument('--verify', action='store_true', help='Only verify migration without running')
    args = parser.parse_args()

    if args.rollback:
        rollback_migration()
    elif args.verify:
        conn = get_db_connection()
        cur = conn.cursor()
        try:
            verify_migration(cur)
            print("✅ Migration verification passed")
        except Exception as e:
            print(f"❌ Migration verification failed: {e}")
            sys.exit(1)
        finally:
            cur.close()
            conn.close()
    else:
        run_migration()
