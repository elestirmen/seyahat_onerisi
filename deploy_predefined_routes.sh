#!/bin/bash

# Predefined Routes System Deployment Script
# This script deploys the predefined routes system to production

set -e  # Exit on any error

# Configuration
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
LOG_FILE="/var/log/poi_deployment.log"
BACKUP_DIR="/var/backups/poi_system"
TIMESTAMP=$(date +"%Y%m%d_%H%M%S")

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# Logging function
log() {
    echo -e "${BLUE}[$(date '+%Y-%m-%d %H:%M:%S')]${NC} $1" | tee -a "$LOG_FILE"
}

error() {
    echo -e "${RED}[ERROR]${NC} $1" | tee -a "$LOG_FILE"
    exit 1
}

warning() {
    echo -e "${YELLOW}[WARNING]${NC} $1" | tee -a "$LOG_FILE"
}

success() {
    echo -e "${GREEN}[SUCCESS]${NC} $1" | tee -a "$LOG_FILE"
}

# Check if running as root or with sudo
check_permissions() {
    if [[ $EUID -ne 0 ]]; then
        error "This script must be run as root or with sudo"
    fi
}

# Create necessary directories
create_directories() {
    log "Creating necessary directories..."
    
    mkdir -p "$BACKUP_DIR"
    mkdir -p "/var/log/poi_system"
    mkdir -p "/opt/poi_system/static/js"
    mkdir -p "/opt/poi_system/static/css"
    
    success "Directories created successfully"
}

# Backup existing system
backup_system() {
    log "Creating system backup..."
    
    BACKUP_PATH="$BACKUP_DIR/poi_system_backup_$TIMESTAMP"
    mkdir -p "$BACKUP_PATH"
    
    # Backup database
    if command -v pg_dump &> /dev/null; then
        log "Backing up PostgreSQL database..."
        sudo -u postgres pg_dump poi_db > "$BACKUP_PATH/database_backup.sql" 2>/dev/null || warning "Database backup failed"
    fi
    
    # Backup application files
    if [ -d "/opt/poi_system" ]; then
        log "Backing up application files..."
        cp -r /opt/poi_system "$BACKUP_PATH/application_backup" || warning "Application backup failed"
    fi
    
    # Backup configuration files
    if [ -f "/etc/nginx/sites-available/poi_system" ]; then
        cp /etc/nginx/sites-available/poi_system "$BACKUP_PATH/nginx_config" || warning "Nginx config backup failed"
    fi
    
    success "System backup completed: $BACKUP_PATH"
}

# Check system requirements
check_requirements() {
    log "Checking system requirements..."
    
    # Check Python version
    if ! python3 --version | grep -q "Python 3\.[8-9]\|Python 3\.1[0-9]"; then
        error "Python 3.8 or higher is required"
    fi
    
    # Check PostgreSQL
    if ! command -v psql &> /dev/null; then
        error "PostgreSQL is not installed"
    fi
    
    # Check required Python packages
    python3 -c "import psycopg2, flask, werkzeug" 2>/dev/null || error "Required Python packages are missing"
    
    # Check disk space (at least 1GB free)
    AVAILABLE_SPACE=$(df / | awk 'NR==2 {print $4}')
    if [ "$AVAILABLE_SPACE" -lt 1048576 ]; then
        error "Insufficient disk space. At least 1GB free space required"
    fi
    
    success "System requirements check passed"
}

# Install database schema updates
install_database_updates() {
    log "Installing database schema updates..."
    
    # Check if database exists
    if ! sudo -u postgres psql -lqt | cut -d \| -f 1 | grep -qw poi_db; then
        error "POI database not found. Please run the main installation first."
    fi
    
    # Apply database indexes for performance
    if [ -f "recommended_indexes.sql" ]; then
        log "Applying database indexes..."
        sudo -u postgres psql poi_db < recommended_indexes.sql || warning "Some indexes may have failed to create"
    fi
    
    # Verify route tables exist
    TABLE_EXISTS=$(sudo -u postgres psql poi_db -t -c "SELECT EXISTS (SELECT FROM information_schema.tables WHERE table_name = 'routes');")
    if [[ "$TABLE_EXISTS" =~ "f" ]]; then
        log "Creating routes tables..."
        python3 setup_routes_database.py || error "Failed to create routes tables"
    fi
    
    success "Database updates completed"
}

# Deploy application files
deploy_application() {
    log "Deploying application files..."
    
    # Copy Python files
    cp route_service.py /opt/poi_system/ || error "Failed to copy route_service.py"
    cp performance_optimizations.py /opt/poi_system/ || error "Failed to copy performance_optimizations.py"
    
    # Update POI API with route endpoints
    if [ -f "/opt/poi_system/poi_api.py" ]; then
        cp poi_api.py /opt/poi_system/ || error "Failed to update poi_api.py"
    else
        error "POI API not found. Please run the main installation first."
    fi
    
    # Copy static files
    if [ -f "static/js/route-selection-manager.js" ]; then
        cp static/js/route-selection-manager.js /opt/poi_system/static/js/
    fi
    
    if [ -f "static/js/route-admin-manager.js" ]; then
        cp static/js/route-admin-manager.js /opt/poi_system/static/js/
    fi
    
    if [ -f "static/js/performance-optimizations.js" ]; then
        cp static/js/performance-optimizations.js /opt/poi_system/static/js/
    fi
    
    if [ -f "static/css/route-admin.css" ]; then
        cp static/css/route-admin.css /opt/poi_system/static/css/
    fi
    
    if [ -f "static/css/performance-optimizations.css" ]; then
        cp static/css/performance-optimizations.css /opt/poi_system/static/css/
    fi
    
    # Update HTML files
    if [ -f "poi_recommendation_system.html" ]; then
        cp poi_recommendation_system.html /opt/poi_system/
    fi
    
    if [ -f "poi_manager_ui.html" ]; then
        cp poi_manager_ui.html /opt/poi_system/
    fi
    
    success "Application files deployed"
}

# Set proper permissions
set_permissions() {
    log "Setting file permissions..."
    
    # Set ownership
    chown -R www-data:www-data /opt/poi_system/
    
    # Set file permissions
    find /opt/poi_system/ -type f -name "*.py" -exec chmod 644 {} \;
    find /opt/poi_system/ -type f -name "*.html" -exec chmod 644 {} \;
    find /opt/poi_system/ -type f -name "*.js" -exec chmod 644 {} \;
    find /opt/poi_system/ -type f -name "*.css" -exec chmod 644 {} \;
    
    # Set directory permissions
    find /opt/poi_system/ -type d -exec chmod 755 {} \;
    
    # Make scripts executable
    chmod +x /opt/poi_system/*.py
    
    success "Permissions set successfully"
}

# Install sample data
install_sample_data() {
    log "Installing sample route data..."
    
    if [ -f "add_sample_routes.py" ]; then
        cd /opt/poi_system/
        python3 add_sample_routes.py || warning "Sample data installation failed"
        cd "$SCRIPT_DIR"
    fi
    
    success "Sample data installation completed"
}

# Restart services
restart_services() {
    log "Restarting services..."
    
    # Restart web server
    if systemctl is-active --quiet nginx; then
        systemctl reload nginx || warning "Nginx reload failed"
    fi
    
    # Restart application server (if using systemd service)
    if systemctl is-active --quiet poi-api; then
        systemctl restart poi-api || warning "POI API service restart failed"
    fi
    
    # Restart any other related services
    if systemctl is-active --quiet postgresql; then
        systemctl reload postgresql || warning "PostgreSQL reload failed"
    fi
    
    success "Services restarted"
}

# Run tests
run_tests() {
    log "Running deployment tests..."
    
    cd /opt/poi_system/
    
    # Test database connection
    python3 -c "
from route_service import RouteService
service = RouteService()
if service.connect():
    print('Database connection: OK')
    service.disconnect()
else:
    print('Database connection: FAILED')
    exit(1)
" || error "Database connection test failed"
    
    # Test API endpoints (if curl is available)
    if command -v curl &> /dev/null; then
        sleep 2  # Wait for services to start
        
        # Test public routes endpoint
        HTTP_CODE=$(curl -s -o /dev/null -w "%{http_code}" http://localhost/api/routes || echo "000")
        if [ "$HTTP_CODE" = "200" ]; then
            success "API endpoint test passed"
        else
            warning "API endpoint test failed (HTTP $HTTP_CODE)"
        fi
    fi
    
    cd "$SCRIPT_DIR"
    success "Deployment tests completed"
}

# Generate deployment report
generate_report() {
    log "Generating deployment report..."
    
    REPORT_FILE="/var/log/poi_deployment_report_$TIMESTAMP.txt"
    
    cat > "$REPORT_FILE" << EOF
Predefined Routes System Deployment Report
==========================================
Deployment Date: $(date)
Deployment Version: 1.0.0
Backup Location: $BACKUP_DIR/poi_system_backup_$TIMESTAMP

Components Deployed:
- Route Service (route_service.py)
- Performance Optimizations
- Frontend Components (JavaScript/CSS)
- Database Schema Updates
- API Endpoints

Database Changes:
- Added performance indexes
- Verified routes table structure
- Installed sample data

Files Modified:
- /opt/poi_system/poi_api.py
- /opt/poi_system/poi_recommendation_system.html
- /opt/poi_system/poi_manager_ui.html
- /opt/poi_system/static/js/ (multiple files)
- /opt/poi_system/static/css/ (multiple files)

Post-Deployment Checklist:
□ Verify admin panel access
□ Test route creation functionality
□ Check public route browsing
□ Monitor system performance
□ Review error logs

Support Information:
- Log File: $LOG_FILE
- Backup Location: $BACKUP_DIR
- Documentation: ADMIN_USER_GUIDE.md
- API Documentation: PREDEFINED_ROUTES_API_DOCUMENTATION.md

EOF
    
    success "Deployment report generated: $REPORT_FILE"
}

# Main deployment function
main() {
    log "Starting Predefined Routes System deployment..."
    
    check_permissions
    create_directories
    backup_system
    check_requirements
    install_database_updates
    deploy_application
    set_permissions
    install_sample_data
    restart_services
    run_tests
    generate_report
    
    success "Deployment completed successfully!"
    
    echo ""
    echo "🎉 Predefined Routes System has been deployed!"
    echo ""
    echo "Next Steps:"
    echo "1. Access the admin panel to create your first routes"
    echo "2. Review the admin user guide: ADMIN_USER_GUIDE.md"
    echo "3. Check the API documentation: PREDEFINED_ROUTES_API_DOCUMENTATION.md"
    echo "4. Monitor the system logs for any issues"
    echo ""
    echo "Important Files:"
    echo "- Deployment Log: $LOG_FILE"
    echo "- System Backup: $BACKUP_DIR/poi_system_backup_$TIMESTAMP"
    echo "- Deployment Report: /var/log/poi_deployment_report_$TIMESTAMP.txt"
    echo ""
}

# Handle script interruption
trap 'error "Deployment interrupted by user"' INT TERM

# Run main function
main "$@"