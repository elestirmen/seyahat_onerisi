#!/bin/bash
# POI API Startup Script
# Sets environment variables and starts the API with database connection

echo "🚀 Starting POI API with PostgreSQL database..."

# Set environment variables for database connection
export POI_DB_TYPE=postgresql
export POI_DB_CONNECTION=postgresql://poi_user:poi_password@localhost/poi_db
export POI_DB_NAME=poi_db

echo "✅ Environment variables set:"
echo "   POI_DB_TYPE: $POI_DB_TYPE"
echo "   POI_DB_CONNECTION: $POI_DB_CONNECTION"
echo "   POI_DB_NAME: $POI_DB_NAME"

# Activate virtual environment
echo "🔧 Activating virtual environment..."
source poi_env/bin/activate

# Test database connection first
echo "🔍 Testing database connection..."
python3 -c "
from database_migration import DatabaseMigration
try:
    migration = DatabaseMigration('$POI_DB_CONNECTION')
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
"

if [ $? -eq 0 ]; then
    echo "🌐 Starting POI API server..."
    python3 poi_api.py
else
    echo "❌ Database setup failed. Please check your PostgreSQL configuration."
    exit 1
fi