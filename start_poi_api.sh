#!/bin/bash
# POI API Startup Script
# Sets environment variables and starts the API with database connection

echo "🚀 Starting POI API with PostgreSQL database..."

# Keep externally supplied deployment values intact. The defaults are only for
# a local development database.
export POI_DB_TYPE="${POI_DB_TYPE:-postgresql}"
export POI_DB_CONNECTION="${POI_DB_CONNECTION:-postgresql://poi_user:poi_password@localhost/poi_db}"
export POI_DB_NAME="${POI_DB_NAME:-poi_db}"

echo "✅ Environment variables set:"
echo "   POI_DB_TYPE: $POI_DB_TYPE"
echo "   POI_DB_CONNECTION: configured"
echo "   POI_DB_NAME: $POI_DB_NAME"

# Activate virtual environment
echo "🔧 Activating virtual environment..."
if [ -f "venv/bin/activate" ]; then
    source venv/bin/activate
elif [ -f "poi_env/bin/activate" ]; then
    # Backward compatibility (legacy venv name)
    source poi_env/bin/activate
else
    echo "❌ Virtual environment not found. Run ./install.sh or create one with: python3 -m venv venv"
    exit 1
fi

# Test database connection first
echo "🔍 Testing database connection..."
python3 <<'PY'
import os
from database_migration import DatabaseMigration
try:
    migration = DatabaseMigration(os.environ['POI_DB_CONNECTION'])
    status = migration.validate_schema()
    if status.schema_valid:
        print('✅ Database schema is valid')
    else:
        print('⚠️  Database schema needs migration')
        print('Running migration...')
        result = migration.run_migration()
        if result.success:
            print('✅ Migration completed successfully')
        else:
            print('❌ Migration failed:', result.errors)
    migration.disconnect()
except Exception as e:
    print('❌ Database connection failed:', e)
    exit(1)
PY

if [ $? -eq 0 ]; then
    echo "🌐 Starting POI API server..."
    python3 poi_api.py
else
    echo "❌ Database setup failed. Please check your PostgreSQL configuration."
    exit 1
fi
