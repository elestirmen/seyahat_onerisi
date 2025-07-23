# -*- coding: utf-8 -*-
"""
POI Database Migration System
Handles automatic schema validation and migration for PostgreSQL
"""

import os
import sys
import json
import logging
from dataclasses import dataclass
from typing import Dict, List, Optional, Any, Tuple
from datetime import datetime

try:
    import psycopg2
    from psycopg2.extras import RealDictCursor, Json
    POSTGRES_AVAILABLE = True
except ImportError:
    POSTGRES_AVAILABLE = False

logger = logging.getLogger(__name__)

@dataclass
class MigrationStatus:
    """Status of database schema validation"""
    schema_valid: bool
    missing_tables: List[str]
    missing_columns: Dict[str, List[str]]
    missing_indexes: List[str]
    needs_data_import: bool
    postgis_available: bool = False

@dataclass
class MigrationResult:
    """Result of migration execution"""
    success: bool
    tables_created: List[str]
    columns_added: Dict[str, List[str]]
    indexes_created: List[str]
    records_imported: int
    errors: List[str]
    duration: float
    
class MigrationError(Exception):
    """Custom exception for migration errors"""
    def __init__(self, message: str, error_type: str, recoverable: bool = True):
        self.message = message
        self.error_type = error_type
        self.recoverable = recoverable
        super().__init__(message)

class DatabaseMigration:
    """Core database migration logic"""
    
    # Expected database schema
    EXPECTED_TABLES = {
        'pois': {
            'columns': {
                'id': 'SERIAL PRIMARY KEY',
                'name': 'VARCHAR(255) NOT NULL',
                'category': 'VARCHAR(50) NOT NULL',
                'location': 'GEOGRAPHY(POINT, 4326) NOT NULL',
                'altitude': 'FLOAT',
                'description': 'TEXT',
                'short_description': 'VARCHAR(500)',
                'created_at': 'TIMESTAMP DEFAULT CURRENT_TIMESTAMP',
                'updated_at': 'TIMESTAMP DEFAULT CURRENT_TIMESTAMP',
                'is_active': 'BOOLEAN DEFAULT true',
                'attributes': 'JSONB'
            },
            'indexes': [
                'CREATE INDEX IF NOT EXISTS idx_poi_location ON pois USING GIST(location)',
                'CREATE INDEX IF NOT EXISTS idx_poi_category ON pois(category)',
                'CREATE INDEX IF NOT EXISTS idx_poi_active ON pois(is_active)',
                'CREATE INDEX IF NOT EXISTS idx_poi_attributes ON pois USING GIN(attributes)'
            ]
        },
        'categories': {
            'columns': {
                'id': 'SERIAL PRIMARY KEY',
                'name': 'VARCHAR(50) UNIQUE NOT NULL',
                'display_name': 'VARCHAR(100)',
                'color': 'VARCHAR(7)',
                'icon': 'VARCHAR(50)',
                'description': 'TEXT'
            },
            'indexes': []
        },
        'poi_ratings': {
            'columns': {
                'poi_id': 'INTEGER REFERENCES pois(id) ON DELETE CASCADE',
                'category': 'TEXT',
                'rating': 'INTEGER CHECK (rating BETWEEN 0 AND 100)'
            },
            'constraints': [
                'PRIMARY KEY (poi_id, category)'
            ],
            'indexes': [
                'CREATE INDEX IF NOT EXISTS idx_poi_ratings_poi_id ON poi_ratings(poi_id)',
                'CREATE INDEX IF NOT EXISTS idx_poi_ratings_category ON poi_ratings(category)'
            ]
        },
        'poi_images': {
            'columns': {
                'id': 'SERIAL PRIMARY KEY',
                'poi_id': 'INTEGER REFERENCES pois(id) ON DELETE CASCADE',
                'image_data': 'BYTEA',
                'thumbnail_url': 'VARCHAR(500)',
                'caption': 'VARCHAR(255)',
                'is_primary': 'BOOLEAN DEFAULT false',
                'upload_date': 'TIMESTAMP DEFAULT CURRENT_TIMESTAMP'
            },
            'indexes': []
        },
        'poi_3d_models': {
            'columns': {
                'id': 'SERIAL PRIMARY KEY',
                'poi_id': 'INTEGER REFERENCES pois(id) ON DELETE CASCADE',
                'model_format': 'VARCHAR(50)',
                'model_url': 'VARCHAR(500)',
                'model_data': 'BYTEA',
                'preview_image_url': 'VARCHAR(500)',
                'scale': 'JSONB',
                'rotation': 'JSONB',
                'position_offset': 'JSONB',
                'created_at': 'TIMESTAMP DEFAULT CURRENT_TIMESTAMP'
            },
            'indexes': []
        }
    }
    
    def __init__(self, connection_string: str):
        """Initialize migration with database connection"""
        if not POSTGRES_AVAILABLE:
            raise ImportError("psycopg2 not available. Install with: pip install psycopg2-binary")
        
        self.connection_string = connection_string
        self.conn = None
        
    def connect(self):
        """Connect to PostgreSQL database"""
        try:
            self.conn = psycopg2.connect(self.connection_string)
            logger.info("Connected to PostgreSQL database")
        except Exception as e:
            logger.error(f"Failed to connect to database: {e}")
            raise MigrationError(f"Database connection failed: {e}", "CONNECTION_ERROR")
    
    def disconnect(self):
        """Disconnect from database"""
        if self.conn:
            self.conn.close()
            logger.info("Disconnected from database")
    
    def validate_schema(self) -> MigrationStatus:
        """Validate current database schema against expected schema"""
        if not self.conn:
            self.connect()
        
        missing_tables = []
        missing_columns = {}
        missing_indexes = []
        postgis_available = False
        
        try:
            with self.conn.cursor(cursor_factory=RealDictCursor) as cur:
                # Check PostGIS extension
                cur.execute("SELECT EXISTS(SELECT 1 FROM pg_extension WHERE extname = 'postgis')")
                postgis_available = cur.fetchone()['exists']
                
                # Check each expected table
                for table_name, table_def in self.EXPECTED_TABLES.items():
                    # Check if table exists
                    cur.execute("""
                        SELECT EXISTS (
                            SELECT FROM information_schema.tables 
                            WHERE table_schema = 'public' 
                            AND table_name = %s
                        )
                    """, (table_name,))
                    
                    table_exists = cur.fetchone()['exists']
                    
                    if not table_exists:
                        missing_tables.append(table_name)
                        continue
                    
                    # Check columns for existing table
                    cur.execute("""
                        SELECT column_name, data_type, is_nullable, column_default
                        FROM information_schema.columns
                        WHERE table_schema = 'public' AND table_name = %s
                    """, (table_name,))
                    
                    existing_columns = {row['column_name']: row for row in cur.fetchall()}
                    
                    # Find missing columns
                    table_missing_columns = []
                    for col_name in table_def['columns']:
                        if col_name not in existing_columns:
                            table_missing_columns.append(col_name)
                    
                    if table_missing_columns:
                        missing_columns[table_name] = table_missing_columns
                
                # Check if we need data import (empty pois table)
                needs_data_import = False
                if 'pois' not in missing_tables:
                    cur.execute("SELECT COUNT(*) as count FROM pois")
                    poi_count = cur.fetchone()['count']
                    needs_data_import = poi_count == 0
        
        except Exception as e:
            logger.error(f"Schema validation failed: {e}")
            raise MigrationError(f"Schema validation error: {e}", "VALIDATION_ERROR")
        
        schema_valid = (
            len(missing_tables) == 0 and 
            len(missing_columns) == 0 and 
            postgis_available
        )
        
        return MigrationStatus(
            schema_valid=schema_valid,
            missing_tables=missing_tables,
            missing_columns=missing_columns,
            missing_indexes=missing_indexes,
            needs_data_import=needs_data_import,
            postgis_available=postgis_available
        )
    
    def create_missing_tables(self, missing_tables: List[str]) -> List[str]:
        """Create missing tables"""
        created_tables = []
        
        if not self.conn:
            self.connect()
        
        try:
            with self.conn.cursor() as cur:
                # Enable PostGIS if not available
                cur.execute("CREATE EXTENSION IF NOT EXISTS postgis")
                
                for table_name in missing_tables:
                    if table_name not in self.EXPECTED_TABLES:
                        continue
                    
                    table_def = self.EXPECTED_TABLES[table_name]
                    
                    # Build CREATE TABLE statement
                    columns_sql = []
                    for col_name, col_def in table_def['columns'].items():
                        columns_sql.append(f"{col_name} {col_def}")
                    
                    # Add constraints if any
                    if 'constraints' in table_def:
                        columns_sql.extend(table_def['constraints'])
                    
                    create_sql = f"CREATE TABLE {table_name} ({', '.join(columns_sql)})"
                    
                    logger.info(f"Creating table: {table_name}")
                    cur.execute(create_sql)
                    created_tables.append(table_name)
                
                self.conn.commit()
                logger.info(f"Created tables: {created_tables}")
        
        except Exception as e:
            self.conn.rollback()
            logger.error(f"Failed to create tables: {e}")
            raise MigrationError(f"Table creation failed: {e}", "TABLE_CREATION_ERROR")
        
        return created_tables
    
    def add_missing_columns(self, missing_columns: Dict[str, List[str]]) -> Dict[str, List[str]]:
        """Add missing columns to existing tables"""
        added_columns = {}
        
        if not self.conn:
            self.connect()
        
        try:
            with self.conn.cursor() as cur:
                for table_name, columns in missing_columns.items():
                    if table_name not in self.EXPECTED_TABLES:
                        continue
                    
                    table_def = self.EXPECTED_TABLES[table_name]
                    table_added_columns = []
                    
                    for col_name in columns:
                        if col_name not in table_def['columns']:
                            continue
                        
                        col_def = table_def['columns'][col_name]
                        alter_sql = f"ALTER TABLE {table_name} ADD COLUMN {col_name} {col_def}"
                        
                        logger.info(f"Adding column {col_name} to table {table_name}")
                        cur.execute(alter_sql)
                        table_added_columns.append(col_name)
                    
                    if table_added_columns:
                        added_columns[table_name] = table_added_columns
                
                self.conn.commit()
                logger.info(f"Added columns: {added_columns}")
        
        except Exception as e:
            self.conn.rollback()
            logger.error(f"Failed to add columns: {e}")
            raise MigrationError(f"Column addition failed: {e}", "COLUMN_ADDITION_ERROR")
        
        return added_columns
    
    def create_indexes(self) -> List[str]:
        """Create missing indexes"""
        created_indexes = []
        
        if not self.conn:
            self.connect()
        
        try:
            with self.conn.cursor() as cur:
                for table_name, table_def in self.EXPECTED_TABLES.items():
                    if 'indexes' not in table_def:
                        continue
                    
                    for index_sql in table_def['indexes']:
                        try:
                            logger.info(f"Creating index: {index_sql}")
                            cur.execute(index_sql)
                            created_indexes.append(index_sql)
                        except Exception as e:
                            logger.warning(f"Index creation failed (may already exist): {e}")
                
                self.conn.commit()
                logger.info(f"Created indexes: {len(created_indexes)}")
        
        except Exception as e:
            self.conn.rollback()
            logger.error(f"Failed to create indexes: {e}")
            raise MigrationError(f"Index creation failed: {e}", "INDEX_CREATION_ERROR")
        
        return created_indexes
    
    def run_migration(self) -> MigrationResult:
        """Execute complete migration process"""
        start_time = datetime.now()
        result = MigrationResult(
            success=False,
            tables_created=[],
            columns_added={},
            indexes_created=[],
            records_imported=0,
            errors=[],
            duration=0.0
        )
        
        try:
            # Validate current schema
            logger.info("Starting database migration...")
            status = self.validate_schema()
            
            if status.schema_valid:
                logger.info("Database schema is already valid")
                result.success = True
                return result
            
            # Create missing tables
            if status.missing_tables:
                logger.info(f"Creating missing tables: {status.missing_tables}")
                result.tables_created = self.create_missing_tables(status.missing_tables)
            
            # Add missing columns
            if status.missing_columns:
                logger.info(f"Adding missing columns: {status.missing_columns}")
                result.columns_added = self.add_missing_columns(status.missing_columns)
            
            # Create indexes
            logger.info("Creating indexes...")
            result.indexes_created = self.create_indexes()
            
            # Insert default categories
            self._insert_default_categories()
            
            result.success = True
            logger.info("Database migration completed successfully")
        
        except MigrationError as e:
            result.errors.append(f"{e.error_type}: {e.message}")
            logger.error(f"Migration failed: {e}")
        except Exception as e:
            result.errors.append(f"UNEXPECTED_ERROR: {e}")
            logger.error(f"Unexpected migration error: {e}")
        
        finally:
            result.duration = (datetime.now() - start_time).total_seconds()
        
        return result
    
    def _insert_default_categories(self):
        """Insert default POI categories"""
        categories = [
            ("gastronomik", "🍽️ Gastronomik", "#e74c3c", "utensils", "Restoranlar, kafeler ve lezzet noktaları"),
            ("kulturel", "🏛️ Kültürel", "#3498db", "landmark", "Müzeler, tarihi yerler ve kültürel mekanlar"),
            ("sanatsal", "🎨 Sanatsal", "#2ecc71", "palette", "Sanat galerileri, atölyeler ve yaratıcı mekanlar"),
            ("doga_macera", "🌿 Doğa & Macera", "#f39c12", "hiking", "Doğal güzellikler ve macera aktiviteleri"),
            ("konaklama", "🏨 Konaklama", "#9b59b6", "bed", "Oteller, pansiyonlar ve konaklama tesisleri")
        ]
        
        try:
            with self.conn.cursor() as cur:
                for name, display_name, color, icon, description in categories:
                    cur.execute("""
                        INSERT INTO categories (name, display_name, color, icon, description)
                        VALUES (%s, %s, %s, %s, %s)
                        ON CONFLICT (name) DO NOTHING
                    """, (name, display_name, color, icon, description))
                
                self.conn.commit()
                logger.info("Default categories inserted")
        
        except Exception as e:
            logger.warning(f"Failed to insert default categories: {e}")


def main():
    """Standalone migration script"""
    import argparse
    
    parser = argparse.ArgumentParser(description="POI Database Migration Tool")
    parser.add_argument("connection_string", help="PostgreSQL connection string")
    parser.add_argument("--dry-run", action="store_true", help="Show what would be done without executing")
    
    args = parser.parse_args()
    
    # Setup logging
    logging.basicConfig(
        level=logging.INFO,
        format='%(asctime)s - %(levelname)s - %(message)s'
    )
    
    try:
        migration = DatabaseMigration(args.connection_string)
        
        if args.dry_run:
            print("🔍 Dry run mode - checking schema...")
            status = migration.validate_schema()
            print(f"Schema valid: {status.schema_valid}")
            print(f"Missing tables: {status.missing_tables}")
            print(f"Missing columns: {status.missing_columns}")
            print(f"PostGIS available: {status.postgis_available}")
        else:
            print("🚀 Running database migration...")
            result = migration.run_migration()
            
            if result.success:
                print("✅ Migration completed successfully!")
                print(f"Tables created: {result.tables_created}")
                print(f"Columns added: {result.columns_added}")
                print(f"Indexes created: {len(result.indexes_created)}")
                print(f"Duration: {result.duration:.2f} seconds")
            else:
                print("❌ Migration failed!")
                for error in result.errors:
                    print(f"Error: {error}")
                sys.exit(1)
    
    except Exception as e:
        print(f"❌ Migration error: {e}")
        sys.exit(1)
    
    finally:
        if 'migration' in locals():
            migration.disconnect()


if __name__ == "__main__":
    main()