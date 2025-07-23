# Design Document

## Overview

This design implements a robust database migration system for the POI API that automatically validates and creates the required PostgreSQL schema. The system will detect missing schema elements, perform migrations safely, and provide tools for data import from JSON fallback mode.

## Architecture

The migration system follows a layered architecture:

1. **Migration Engine**: Core logic for schema validation and migration
2. **Schema Validator**: Checks current database state against expected schema
3. **Data Migrator**: Handles data import from JSON to PostgreSQL
4. **Migration Runner**: Orchestrates the migration process
5. **Error Handler**: Manages migration failures and rollbacks

```mermaid
graph TD
    A[Application Start] --> B[Migration Runner]
    B --> C[Schema Validator]
    C --> D{Schema Valid?}
    D -->|No| E[Migration Engine]
    D -->|Yes| F[Continue Application]
    E --> G[Create Tables]
    E --> H[Add Missing Columns]
    E --> I[Create Indexes]
    G --> J[Data Migrator]
    H --> J
    I --> J
    J --> K{JSON Data Exists?}
    K -->|Yes| L[Import JSON Data]
    K -->|No| F
    L --> F
```

## Components and Interfaces

### 1. Migration Engine (`database_migration.py`)

**Purpose**: Core migration logic and schema management

**Key Methods**:
- `validate_schema()`: Check if current schema matches expected
- `create_missing_tables()`: Create tables that don't exist
- `add_missing_columns()`: Add columns to existing tables
- `create_indexes()`: Ensure all required indexes exist
- `run_migration()`: Execute complete migration process

**Interface**:
```python
class DatabaseMigration:
    def __init__(self, connection_string: str)
    def validate_schema() -> MigrationStatus
    def run_migration() -> MigrationResult
    def rollback_migration() -> bool
```

### 2. Schema Validator (`schema_validator.py`)

**Purpose**: Validate current database schema against expected structure

**Key Methods**:
- `check_table_exists()`: Verify table existence
- `check_column_exists()`: Verify column existence and type
- `check_indexes_exist()`: Verify index existence
- `get_missing_elements()`: Return list of missing schema elements

### 3. Data Migrator (`data_migrator.py`)

**Purpose**: Import existing JSON data into PostgreSQL

**Key Methods**:
- `import_json_data()`: Import POI data from JSON file
- `validate_poi_data()`: Validate POI records before import
- `convert_coordinates()`: Handle coordinate format conversion
- `import_ratings()`: Import rating data to new ratings table

### 4. Migration Runner (`migration_runner.py`)

**Purpose**: Orchestrate the complete migration process

**Key Methods**:
- `run_startup_migration()`: Run migration during application startup
- `run_standalone_migration()`: Run migration as standalone script
- `generate_migration_report()`: Create detailed migration report

## Data Models

### Expected Database Schema

The migration system will ensure these tables exist with proper structure:

```sql
-- Main POI table
CREATE TABLE pois (
    id SERIAL PRIMARY KEY,
    name VARCHAR(255) NOT NULL,
    category VARCHAR(50) NOT NULL,
    location GEOGRAPHY(POINT, 4326) NOT NULL,
    altitude FLOAT,
    description TEXT,
    short_description VARCHAR(500),
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    is_active BOOLEAN DEFAULT true,
    attributes JSONB
);

-- Categories table
CREATE TABLE categories (
    id SERIAL PRIMARY KEY,
    name VARCHAR(50) UNIQUE NOT NULL,
    display_name VARCHAR(100),
    color VARCHAR(7),
    icon VARCHAR(50),
    description TEXT
);

-- Ratings table (new)
CREATE TABLE poi_ratings (
    poi_id INTEGER REFERENCES pois(id) ON DELETE CASCADE,
    category TEXT,
    rating INTEGER CHECK (rating BETWEEN 0 AND 100),
    PRIMARY KEY (poi_id, category)
);

-- Images table
CREATE TABLE poi_images (
    id SERIAL PRIMARY KEY,
    poi_id INTEGER REFERENCES pois(id) ON DELETE CASCADE,
    image_data BYTEA,
    thumbnail_url VARCHAR(500),
    caption VARCHAR(255),
    is_primary BOOLEAN DEFAULT false,
    upload_date TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);
```

### Migration Status Model

```python
@dataclass
class MigrationStatus:
    schema_valid: bool
    missing_tables: List[str]
    missing_columns: Dict[str, List[str]]
    missing_indexes: List[str]
    needs_data_import: bool
```

### Migration Result Model

```python
@dataclass
class MigrationResult:
    success: bool
    tables_created: List[str]
    columns_added: Dict[str, List[str]]
    indexes_created: List[str]
    records_imported: int
    errors: List[str]
    duration: float
```

## Error Handling

### Migration Errors

1. **Connection Errors**: Handle database connection failures
2. **Permission Errors**: Handle insufficient database privileges
3. **Schema Conflicts**: Handle existing tables with different structure
4. **Data Import Errors**: Handle invalid JSON data during import

### Error Recovery Strategy

1. **Rollback Support**: Ability to rollback failed migrations
2. **Partial Migration**: Continue with successful parts if some fail
3. **Detailed Logging**: Comprehensive error logging for debugging
4. **Graceful Degradation**: Fall back to JSON mode if migration fails

### Error Handling Implementation

```python
class MigrationError(Exception):
    def __init__(self, message: str, error_type: str, recoverable: bool = True):
        self.message = message
        self.error_type = error_type
        self.recoverable = recoverable
        super().__init__(message)

class MigrationErrorHandler:
    def handle_error(self, error: MigrationError) -> MigrationAction
    def log_error(self, error: MigrationError) -> None
    def attempt_recovery(self, error: MigrationError) -> bool
```

## Testing Strategy

### Unit Tests

1. **Schema Validation Tests**: Test schema checking logic
2. **Migration Logic Tests**: Test table/column creation
3. **Data Import Tests**: Test JSON to PostgreSQL conversion
4. **Error Handling Tests**: Test error scenarios and recovery

### Integration Tests

1. **End-to-End Migration**: Test complete migration process
2. **Database State Tests**: Verify database state after migration
3. **Application Integration**: Test POI API functionality after migration
4. **Performance Tests**: Test migration performance with large datasets

### Test Database Setup

```python
class MigrationTestCase:
    def setUp(self):
        # Create test database
        # Set up test data
        pass
    
    def tearDown(self):
        # Clean up test database
        pass
    
    def test_schema_validation(self):
        # Test schema validation logic
        pass
    
    def test_migration_execution(self):
        # Test migration execution
        pass
```

## Implementation Details

### Startup Integration

The migration system will be integrated into the POI API startup process:

```python
# In poi_api.py
def initialize_database():
    try:
        migration_runner = MigrationRunner(connection_string)
        result = migration_runner.run_startup_migration()
        
        if result.success:
            logger.info(f"Database migration completed: {result}")
            return get_db()  # Return database connection
        else:
            logger.warning(f"Migration failed, using JSON fallback: {result.errors}")
            return None
    except Exception as e:
        logger.error(f"Migration error: {e}")
        return None
```

### Standalone Script

A standalone migration script will be available:

```bash
python database_migration.py --connection-string "postgresql://user:pass@localhost/poi_db" --import-json test_data.json
```

### Configuration

Migration behavior will be configurable through environment variables:

```python
MIGRATION_CONFIG = {
    'auto_migrate': os.getenv('POI_AUTO_MIGRATE', 'true').lower() == 'true',
    'import_json': os.getenv('POI_IMPORT_JSON', 'true').lower() == 'true',
    'backup_before_migration': os.getenv('POI_BACKUP_BEFORE_MIGRATION', 'false').lower() == 'true',
    'max_migration_time': int(os.getenv('POI_MAX_MIGRATION_TIME', '300'))  # 5 minutes
}
```

## Security Considerations

1. **SQL Injection Prevention**: Use parameterized queries for all database operations
2. **Connection Security**: Ensure secure database connections
3. **Permission Validation**: Verify database user has required permissions
4. **Data Validation**: Validate all imported data before insertion

## Performance Considerations

1. **Batch Operations**: Use batch inserts for large data imports
2. **Index Creation**: Create indexes after data import for better performance
3. **Connection Pooling**: Use connection pooling for multiple operations
4. **Progress Reporting**: Provide progress updates for long-running migrations