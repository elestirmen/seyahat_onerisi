#!/usr/bin/env python3
"""
Database Schema Migration for Admin Panel UI Improvement
Adds support for route file imports and POI-Route associations

This migration script:
1. Creates route_imports table for tracking file import operations
2. Creates route_poi_associations table for POI-Route relationships
3. Adds import-related fields to existing routes table
4. Creates necessary indexes for performance

Requirements: 2.4, 3.4, 6.4
"""

import os
import sys
import psycopg2
from psycopg2.extras import RealDictCursor
from datetime import datetime
import json

def get_db_connection():
    """Get database connection using environment variables"""
    db_config = {
        'host': os.getenv('POI_DB_HOST', 'localhost'),
        'port': os.getenv('POI_DB_PORT', '5432'),
        'database': os.getenv('POI_DB_NAME', 'poi_db'),
        'user': os.getenv('POI_DB_USER', 'poi_user'),
        'password': os.getenv('POI_DB_PASSWORD', 'poi_password')
    }
    
    try:
        conn = psycopg2.connect(**db_config)
        return conn
    except Exception as e:
        print(f"❌ Database connection failed: {e}")
        sys.exit(1)

def check_table_exists(cursor, table_name):
    """Check if a table exists in the database"""
    cursor.execute("""
        SELECT EXISTS (
            SELECT FROM information_schema.tables 
            WHERE table_schema = 'public' 
            AND table_name = %s
        );
    """, (table_name,))
    return cursor.fetchone()[0]

def check_column_exists(cursor, table_name, column_name):
    """Check if a column exists in a table"""
    cursor.execute("""
        SELECT EXISTS (
            SELECT FROM information_schema.columns 
            WHERE table_schema = 'public' 
            AND table_name = %s 
            AND column_name = %s
        );
    """, (table_name, column_name))
    return cursor.fetchone()[0]

def create_route_imports_table(cursor):
    """Create route_imports table for tracking file import operations"""
    print("📊 Creating route_imports table...")
    
    cursor.execute("""
        CREATE TABLE IF NOT EXISTS route_imports (
            id SERIAL PRIMARY KEY,
            filename VARCHAR(255) NOT NULL,
            original_filename VARCHAR(255) NOT NULL,
            file_type VARCHAR(10) NOT NULL CHECK (file_type IN ('gpx', 'kml', 'kmz')),
            file_size INTEGER NOT NULL,
            file_hash VARCHAR(64), -- SHA-256 hash for duplicate detection
            import_status VARCHAR(20) DEFAULT 'pending' CHECK (
                import_status IN ('pending', 'processing', 'completed', 'failed', 'cancelled')
            ),
            error_message TEXT,
            error_details JSONB,
            imported_route_id INTEGER REFERENCES routes(id) ON DELETE SET NULL,
            import_metadata JSONB, -- Parsed metadata from file
            processing_log JSONB, -- Processing steps and timing
            created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
            updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
            completed_at TIMESTAMP,
            created_by VARCHAR(100), -- User who initiated import
            
            -- Constraints
            CONSTRAINT valid_file_size CHECK (file_size > 0 AND file_size <= 52428800), -- Max 50MB
            CONSTRAINT completed_status_has_timestamp CHECK (
                (import_status = 'completed' AND completed_at IS NOT NULL) OR 
                (import_status != 'completed')
            )
        );
    """)
    
    # Create indexes for route_imports
    cursor.execute("CREATE INDEX IF NOT EXISTS idx_route_imports_status ON route_imports(import_status);")
    cursor.execute("CREATE INDEX IF NOT EXISTS idx_route_imports_file_type ON route_imports(file_type);")
    cursor.execute("CREATE INDEX IF NOT EXISTS idx_route_imports_created_at ON route_imports(created_at);")
    cursor.execute("CREATE INDEX IF NOT EXISTS idx_route_imports_file_hash ON route_imports(file_hash);")
    cursor.execute("CREATE INDEX IF NOT EXISTS idx_route_imports_route_id ON route_imports(imported_route_id);")
    cursor.execute("CREATE INDEX IF NOT EXISTS idx_route_imports_created_by ON route_imports(created_by);")
    
    print("✅ route_imports table created successfully")

def create_route_poi_associations_table(cursor):
    """Create route_poi_associations table for POI-Route relationships"""
    print("📊 Creating route_poi_associations table...")
    
    cursor.execute("""
        CREATE TABLE IF NOT EXISTS route_poi_associations (
            id SERIAL PRIMARY KEY,
            route_id INTEGER REFERENCES routes(id) ON DELETE CASCADE,
            poi_id INTEGER REFERENCES pois(id) ON DELETE CASCADE,
            sequence_order INTEGER NOT NULL,
            distance_from_route DECIMAL(10,2), -- Distance in meters
            is_waypoint BOOLEAN DEFAULT FALSE,
            is_mandatory BOOLEAN DEFAULT TRUE,
            estimated_time_at_poi INTEGER DEFAULT 15, -- Minutes
            association_type VARCHAR(20) DEFAULT 'suggested' CHECK (
                association_type IN ('suggested', 'manual', 'imported', 'auto_generated')
            ),
            association_score DECIMAL(5,2), -- Relevance score 0-100
            notes TEXT,
            metadata JSONB, -- Additional association metadata
            created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
            updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
            created_by VARCHAR(100),
            
            -- Constraints
            UNIQUE(route_id, poi_id),
            CONSTRAINT valid_sequence_order CHECK (sequence_order > 0),
            CONSTRAINT valid_distance CHECK (distance_from_route >= 0),
            CONSTRAINT valid_time CHECK (estimated_time_at_poi > 0),
            CONSTRAINT valid_score CHECK (association_score >= 0 AND association_score <= 100)
        );
    """)
    
    # Create indexes for route_poi_associations
    cursor.execute("CREATE INDEX IF NOT EXISTS idx_route_poi_assoc_route_id ON route_poi_associations(route_id);")
    cursor.execute("CREATE INDEX IF NOT EXISTS idx_route_poi_assoc_poi_id ON route_poi_associations(poi_id);")
    cursor.execute("CREATE INDEX IF NOT EXISTS idx_route_poi_assoc_sequence ON route_poi_associations(route_id, sequence_order);")
    cursor.execute("CREATE INDEX IF NOT EXISTS idx_route_poi_assoc_type ON route_poi_associations(association_type);")
    cursor.execute("CREATE INDEX IF NOT EXISTS idx_route_poi_assoc_waypoint ON route_poi_associations(is_waypoint);")
    cursor.execute("CREATE INDEX IF NOT EXISTS idx_route_poi_assoc_distance ON route_poi_associations(distance_from_route);")
    
    print("✅ route_poi_associations table created successfully")

def add_import_fields_to_routes(cursor):
    """Add import-related fields to existing routes table"""
    print("📊 Adding import fields to routes table...")
    
    # Check which columns already exist
    import_fields = [
        ('import_source', 'VARCHAR(50)'),
        ('original_filename', 'VARCHAR(255)'),
        ('import_metadata', 'JSONB'),
        ('file_waypoints', 'JSONB'),
        ('import_date', 'TIMESTAMP'),
        ('imported_by', 'VARCHAR(100)')
    ]
    
    for field_name, field_type in import_fields:
        if not check_column_exists(cursor, 'routes', field_name):
            cursor.execute(f"""
                ALTER TABLE routes 
                ADD COLUMN {field_name} {field_type};
            """)
            print(f"  ✅ Added column: {field_name}")
        else:
            print(f"  ⚠️  Column already exists: {field_name}")
    
    # Add indexes for new fields
    cursor.execute("CREATE INDEX IF NOT EXISTS idx_routes_import_source ON routes(import_source);")
    cursor.execute("CREATE INDEX IF NOT EXISTS idx_routes_import_date ON routes(import_date);")
    cursor.execute("CREATE INDEX IF NOT EXISTS idx_routes_imported_by ON routes(imported_by);")
    
    print("✅ Import fields added to routes table")

def create_migration_log_table(cursor):
    """Create migration log table to track schema changes"""
    print("📊 Creating migration log table...")
    
    cursor.execute("""
        CREATE TABLE IF NOT EXISTS schema_migrations (
            id SERIAL PRIMARY KEY,
            migration_name VARCHAR(255) NOT NULL UNIQUE,
            migration_version VARCHAR(50) NOT NULL,
            description TEXT,
            executed_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
            execution_time_ms INTEGER,
            success BOOLEAN DEFAULT TRUE,
            error_message TEXT
        );
    """)
    
    print("✅ Migration log table created")

def log_migration(cursor, migration_name, version, description, execution_time_ms, success=True, error_message=None):
    """Log migration execution"""
    cursor.execute("""
        INSERT INTO schema_migrations 
        (migration_name, migration_version, description, execution_time_ms, success, error_message)
        VALUES (%s, %s, %s, %s, %s, %s)
        ON CONFLICT (migration_name) DO UPDATE SET
            executed_at = CURRENT_TIMESTAMP,
            execution_time_ms = EXCLUDED.execution_time_ms,
            success = EXCLUDED.success,
            error_message = EXCLUDED.error_message;
    """, (migration_name, version, description, execution_time_ms, success, error_message))

def create_helper_functions(cursor):
    """Create database helper functions for import operations"""
    print("📊 Creating helper functions...")
    
    # Function to calculate POI-route distance
    cursor.execute("""
        CREATE OR REPLACE FUNCTION calculate_poi_route_distance(
            poi_location GEOGRAPHY,
            route_geometry GEOGRAPHY
        ) RETURNS DOUBLE PRECISION AS $$
        BEGIN
            RETURN ST_Distance(poi_location, route_geometry);
        END;
        $$ LANGUAGE plpgsql;
    """)
    
    # Function to find POIs near route
    cursor.execute("""
        CREATE OR REPLACE FUNCTION find_pois_near_route(
            route_geom GEOGRAPHY,
            max_distance_meters INTEGER DEFAULT 1000,
            limit_count INTEGER DEFAULT 50
        ) RETURNS TABLE(
            poi_id INTEGER,
            poi_name VARCHAR(255),
            poi_category VARCHAR(50),
            distance_meters DOUBLE PRECISION
        ) AS $$
        BEGIN
            RETURN QUERY
            SELECT 
                p.id,
                p.name,
                p.category,
                ST_Distance(p.location, route_geom) as distance_meters
            FROM pois p
            WHERE ST_DWithin(p.location, route_geom, max_distance_meters)
            AND p.is_active = true
            ORDER BY distance_meters ASC
            LIMIT limit_count;
        END;
        $$ LANGUAGE plpgsql;
    """)
    
    # Function to update route-poi association scores
    cursor.execute("""
        CREATE OR REPLACE FUNCTION update_association_scores(route_id_param INTEGER)
        RETURNS VOID AS $$
        DECLARE
            route_geom GEOGRAPHY;
        BEGIN
            -- Get route geometry
            SELECT route_geometry INTO route_geom 
            FROM routes WHERE id = route_id_param;
            
            -- Update association scores based on distance and POI category
            UPDATE route_poi_associations rpa
            SET association_score = CASE
                WHEN rpa.distance_from_route <= 100 THEN 100
                WHEN rpa.distance_from_route <= 500 THEN 80
                WHEN rpa.distance_from_route <= 1000 THEN 60
                ELSE 40
            END
            WHERE rpa.route_id = route_id_param;
        END;
        $$ LANGUAGE plpgsql;
    """)
    
    print("✅ Helper functions created")

def create_triggers(cursor):
    """Create database triggers for automatic updates"""
    print("📊 Creating database triggers...")
    
    # Trigger to update updated_at timestamp
    cursor.execute("""
        CREATE OR REPLACE FUNCTION update_updated_at_column()
        RETURNS TRIGGER AS $$
        BEGIN
            NEW.updated_at = CURRENT_TIMESTAMP;
            RETURN NEW;
        END;
        $$ LANGUAGE plpgsql;
    """)
    
    # Apply trigger to relevant tables
    tables_with_updated_at = ['route_imports', 'route_poi_associations']
    
    for table in tables_with_updated_at:
        cursor.execute(f"""
            DROP TRIGGER IF EXISTS update_{table}_updated_at ON {table};
            CREATE TRIGGER update_{table}_updated_at
                BEFORE UPDATE ON {table}
                FOR EACH ROW
                EXECUTE FUNCTION update_updated_at_column();
        """)
    
    print("✅ Database triggers created")

def verify_migration(cursor):
    """Verify that all migration steps completed successfully"""
    print("🔍 Verifying migration...")
    
    # Check tables exist
    required_tables = ['route_imports', 'route_poi_associations', 'schema_migrations']
    for table in required_tables:
        if not check_table_exists(cursor, table):
            raise Exception(f"Required table {table} was not created")
    
    # Check routes table has new columns
    required_columns = ['import_source', 'original_filename', 'import_metadata']
    for column in required_columns:
        if not check_column_exists(cursor, 'routes', column):
            raise Exception(f"Required column {column} was not added to routes table")
    
    # Check functions exist
    cursor.execute("""
        SELECT COUNT(*) FROM information_schema.routines 
        WHERE routine_schema = 'public' 
        AND routine_name IN ('calculate_poi_route_distance', 'find_pois_near_route', 'update_association_scores');
    """)
    
    function_count = cursor.fetchone()[0]
    if function_count < 3:
        raise Exception("Not all required functions were created")
    
    print("✅ Migration verification completed successfully")

def run_migration():
    """Run the complete database migration"""
    start_time = datetime.now()
    
    print("🚀 Starting Admin Panel UI Improvement Database Migration")
    print(f"📅 Migration started at: {start_time}")
    print("=" * 60)
    
    conn = get_db_connection()
    
    try:
        cursor = conn.cursor()
        
        # Create migration log table first
        create_migration_log_table(cursor)
        
        # Run migration steps
        create_route_imports_table(cursor)
        create_route_poi_associations_table(cursor)
        add_import_fields_to_routes(cursor)
        create_helper_functions(cursor)
        create_triggers(cursor)
        
        # Verify migration
        verify_migration(cursor)
        
        # Commit all changes
        conn.commit()
        
        # Calculate execution time
        end_time = datetime.now()
        execution_time = (end_time - start_time).total_seconds() * 1000
        
        # Log successful migration
        log_migration(
            cursor,
            'admin_panel_ui_improvement_v1',
            '1.0.0',
            'Added route imports, POI associations, and import fields to routes table',
            int(execution_time),
            success=True
        )
        
        conn.commit()
        
        print("=" * 60)
        print("✅ Migration completed successfully!")
        print(f"⏱️  Total execution time: {execution_time:.2f}ms")
        print(f"📅 Migration completed at: {end_time}")
        
        # Print summary
        print("\n📋 Migration Summary:")
        print("  ✅ route_imports table created")
        print("  ✅ route_poi_associations table created") 
        print("  ✅ Import fields added to routes table")
        print("  ✅ Helper functions created")
        print("  ✅ Database triggers created")
        print("  ✅ Migration logged")
        
        cursor.close()
        conn.close()
        
    except Exception as e:
        # Log failed migration
        try:
            end_time = datetime.now()
            execution_time = (end_time - start_time).total_seconds() * 1000
            
            log_migration(
                cursor,
                'admin_panel_ui_improvement_v1',
                '1.0.0',
                'Failed: Added route imports, POI associations, and import fields to routes table',
                int(execution_time),
                success=False,
                error_message=str(e)
            )
            conn.commit()
        except:
            pass
        
        print(f"❌ Migration failed: {e}")
        conn.rollback()
        cursor.close()
        conn.close()
        sys.exit(1)

def rollback_migration():
    """Rollback the migration (for development/testing)"""
    print("🔄 Rolling back Admin Panel UI Improvement Migration")
    
    conn = get_db_connection()
    
    try:
        cursor = conn.cursor()
        
        # Drop tables in reverse order
        print("📊 Dropping created tables...")
        cursor.execute("DROP TABLE IF EXISTS route_poi_associations CASCADE;")
        cursor.execute("DROP TABLE IF EXISTS route_imports CASCADE;")
        
        # Remove added columns from routes table
        print("📊 Removing added columns from routes table...")
        import_fields = ['import_source', 'original_filename', 'import_metadata', 
                        'file_waypoints', 'import_date', 'imported_by']
        
        for field in import_fields:
            try:
                cursor.execute(f"ALTER TABLE routes DROP COLUMN IF EXISTS {field};")
            except:
                pass
        
        # Drop functions
        print("📊 Dropping helper functions...")
        cursor.execute("DROP FUNCTION IF EXISTS calculate_poi_route_distance(GEOGRAPHY, GEOGRAPHY);")
        cursor.execute("DROP FUNCTION IF EXISTS find_pois_near_route(GEOGRAPHY, INTEGER, INTEGER);")
        cursor.execute("DROP FUNCTION IF EXISTS update_association_scores(INTEGER);")
        cursor.execute("DROP FUNCTION IF EXISTS update_updated_at_column();")
        
        # Remove migration log entry
        cursor.execute("DELETE FROM schema_migrations WHERE migration_name = 'admin_panel_ui_improvement_v1';")
        
        conn.commit()
        
        print("✅ Migration rollback completed successfully!")
        
        cursor.close()
        conn.close()
        
    except Exception as e:
        print(f"❌ Rollback failed: {e}")
        conn.rollback()
        cursor.close()
        conn.close()
        sys.exit(1)

if __name__ == "__main__":
    import argparse
    
    parser = argparse.ArgumentParser(description='Admin Panel UI Improvement Database Migration')
    parser.add_argument('--rollback', action='store_true', help='Rollback the migration')
    parser.add_argument('--verify', action='store_true', help='Only verify migration without running')
    
    args = parser.parse_args()
    
    if args.rollback:
        rollback_migration()
    elif args.verify:
        conn = get_db_connection()
        cursor = conn.cursor()
        try:
            verify_migration(cursor)
            print("✅ Migration verification passed")
        except Exception as e:
            print(f"❌ Migration verification failed: {e}")
        finally:
            cursor.close()
            conn.close()
    else:
        run_migration()