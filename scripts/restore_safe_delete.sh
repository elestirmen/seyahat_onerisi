#!/bin/bash
# SAFE_DELETE Restore Script for POI Travel Recommendation API
# Usage: bash scripts/restore_safe_delete.sh [--dry-run] [--specific-file FILE] [--category CATEGORY]

set -e

SAFE_DELETE_DIR="SAFE_DELETE"
PROJECT_ROOT="."
TIMESTAMP=$(date +%Y%m%d_%H%M%S)
LOG_FILE="scripts/restore_${TIMESTAMP}.log"

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# Initialize log
mkdir -p scripts
echo "SAFE_DELETE Restore Log - $(date)" > "$LOG_FILE"

print_header() {
    echo -e "${BLUE}=================================================${NC}"
    echo -e "${BLUE}      SAFE_DELETE RESTORE SCRIPT${NC}"
    echo -e "${BLUE}=================================================${NC}"
    echo -e "${YELLOW}Log file: $LOG_FILE${NC}"
    echo ""
}

log_action() {
    local message="$1"
    echo "$message" | tee -a "$LOG_FILE"
}

print_usage() {
    echo "Usage: $0 [OPTIONS]"
    echo ""
    echo "Options:"
    echo "  --dry-run              Show what would be restored without actually doing it"
    echo "  --specific-file FILE   Restore only the specified file"
    echo "  --category CATEGORY    Restore files from specific category (test_files, debug_html)"
    echo "  --list                 List all files in SAFE_DELETE"
    echo "  --help                 Show this help message"
    echo ""
    echo "Examples:"
    echo "  $0 --dry-run"
    echo "  $0 --specific-file test_api_core.py"
    echo "  $0 --category test_files"
    echo "  $0 --list"
}

list_safe_delete_files() {
    echo -e "${BLUE}Files in SAFE_DELETE:${NC}"
    echo "===================="
    
    if [ ! -d "$SAFE_DELETE_DIR" ]; then
        echo -e "${RED}SAFE_DELETE directory not found!${NC}"
        return 1
    fi
    
    find "$SAFE_DELETE_DIR" -type f | while read -r file; do
        local relative_path="${file#$SAFE_DELETE_DIR/}"
        local size=$(stat -f%z "$file" 2>/dev/null || stat -c%s "$file" 2>/dev/null || echo "unknown")
        local date=$(stat -f%Sm -t "%Y-%m-%d %H:%M" "$file" 2>/dev/null || stat -c%y "$file" 2>/dev/null || echo "unknown")
        
        echo "  📄 $relative_path (${size} bytes, modified: $date)"
    done
    
    echo ""
    echo "Total files: $(find "$SAFE_DELETE_DIR" -type f | wc -l)"
}

restore_file() {
    local source_file="$1"
    local target_file="$2"
    local dry_run="$3"
    
    if [ "$dry_run" = "true" ]; then
        echo -e "${YELLOW}[DRY-RUN] Would restore: $source_file -> $target_file${NC}"
        log_action "[DRY-RUN] Would restore: $source_file -> $target_file"
        return 0
    fi
    
    # Check if target already exists
    if [ -f "$target_file" ]; then
        echo -e "${RED}⚠️  Target file already exists: $target_file${NC}"
        echo -n "Overwrite? (y/N): "
        read -r response
        if [ "$response" != "y" ] && [ "$response" != "Y" ]; then
            echo -e "${YELLOW}Skipped: $target_file${NC}"
            log_action "Skipped: $target_file (user chose not to overwrite)"
            return 0
        fi
    fi
    
    # Create target directory if needed
    local target_dir=$(dirname "$target_file")
    if [ ! -d "$target_dir" ]; then
        mkdir -p "$target_dir"
        log_action "Created directory: $target_dir"
    fi
    
    # Copy the file
    if cp "$source_file" "$target_file"; then
        echo -e "${GREEN}✅ Restored: $target_file${NC}"
        log_action "Successfully restored: $source_file -> $target_file"
        
        # Ask if user wants to remove from SAFE_DELETE
        echo -n "Remove from SAFE_DELETE? (y/N): "
        read -r remove_response
        if [ "$remove_response" = "y" ] || [ "$remove_response" = "Y" ]; then
            rm "$source_file"
            echo -e "${GREEN}🗑️  Removed from SAFE_DELETE: $source_file${NC}"
            log_action "Removed from SAFE_DELETE: $source_file"
        fi
    else
        echo -e "${RED}❌ Failed to restore: $target_file${NC}"
        log_action "Failed to restore: $source_file -> $target_file"
        return 1
    fi
}

restore_category() {
    local category="$1"
    local dry_run="$2"
    
    local category_dir="$SAFE_DELETE_DIR/$category"
    
    if [ ! -d "$category_dir" ]; then
        echo -e "${RED}Category directory not found: $category_dir${NC}"
        return 1
    fi
    
    echo -e "${BLUE}Restoring category: $category${NC}"
    echo "================================"
    
    find "$category_dir" -type f | while read -r source_file; do
        local filename=$(basename "$source_file")
        local target_file="$PROJECT_ROOT/$filename"
        
        restore_file "$source_file" "$target_file" "$dry_run"
    done
}

restore_specific_file() {
    local filename="$1"
    local dry_run="$2"
    
    # Find the file in SAFE_DELETE
    local source_file=$(find "$SAFE_DELETE_DIR" -name "$filename" -type f | head -1)
    
    if [ -z "$source_file" ]; then
        echo -e "${RED}File not found in SAFE_DELETE: $filename${NC}"
        return 1
    fi
    
    local target_file="$PROJECT_ROOT/$filename"
    restore_file "$source_file" "$target_file" "$dry_run"
}

restore_all_files() {
    local dry_run="$1"
    
    echo -e "${BLUE}Restoring all files from SAFE_DELETE${NC}"
    echo "====================================="
    
    # Restore test files
    if [ -d "$SAFE_DELETE_DIR/test_files" ]; then
        echo -e "${YELLOW}Restoring test files...${NC}"
        restore_category "test_files" "$dry_run"
        echo ""
    fi
    
    # Restore debug HTML files
    if [ -d "$SAFE_DELETE_DIR/debug_html" ]; then
        echo -e "${YELLOW}Restoring debug HTML files...${NC}"
        restore_category "debug_html" "$dry_run"
        echo ""
    fi
    
    # Restore individual files in root of SAFE_DELETE
    find "$SAFE_DELETE_DIR" -maxdepth 1 -type f | while read -r source_file; do
        local filename=$(basename "$source_file")
        local target_file="$PROJECT_ROOT/$filename"
        restore_file "$source_file" "$target_file" "$dry_run"
    done
}

# Main script logic
main() {
    print_header
    
    if [ ! -d "$SAFE_DELETE_DIR" ]; then
        echo -e "${RED}SAFE_DELETE directory not found!${NC}"
        echo "Nothing to restore."
        exit 1
    fi
    
    local dry_run="false"
    local specific_file=""
    local category=""
    local list_only="false"
    
    # Parse arguments
    while [[ $# -gt 0 ]]; do
        case $1 in
            --dry-run)
                dry_run="true"
                shift
                ;;
            --specific-file)
                specific_file="$2"
                shift 2
                ;;
            --category)
                category="$2"
                shift 2
                ;;
            --list)
                list_only="true"
                shift
                ;;
            --help)
                print_usage
                exit 0
                ;;
            *)
                echo -e "${RED}Unknown option: $1${NC}"
                print_usage
                exit 1
                ;;
        esac
    done
    
    # Execute based on options
    if [ "$list_only" = "true" ]; then
        list_safe_delete_files
        exit 0
    fi
    
    if [ -n "$specific_file" ]; then
        restore_specific_file "$specific_file" "$dry_run"
    elif [ -n "$category" ]; then
        restore_category "$category" "$dry_run"
    else
        restore_all_files "$dry_run"
    fi
    
    echo ""
    echo -e "${GREEN}Restore operation completed.${NC}"
    echo -e "${BLUE}Log saved to: $LOG_FILE${NC}"
}

# Run main function with all arguments
main "$@"
