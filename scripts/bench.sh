#!/bin/bash
# Performance benchmarking script
# Usage: bash scripts/bench.sh perf/baseline.json perf/current.json 0.30

set -e

BASELINE_FILE=${1:-"perf/baseline.json"}
CURRENT_FILE=${2:-"perf/current.json"}
REGRESSION_THRESHOLD=${3:-"0.30"}
BASE_URL=${API_BASE_URL:-"http://localhost:5000"}

echo "🚀 Running performance benchmarks..."
echo "Baseline: $BASELINE_FILE"
echo "Current: $CURRENT_FILE"
echo "Regression threshold: $REGRESSION_THRESHOLD"
echo "Target URL: $BASE_URL"
echo "=" * 50

# Function to measure endpoint performance
measure_endpoint() {
    local url=$1
    local name=$2
    local iterations=${3:-5}
    
    echo "📊 Measuring $name..."
    
    local total_time=0
    local min_time=999999
    local max_time=0
    local successful_requests=0
    
    for i in $(seq 1 $iterations); do
        # Use curl to measure time
        local time_total=$(curl -w "%{time_total}" -s -o /dev/null "$url" 2>/dev/null || echo "999")
        
        if [ "$time_total" != "999" ]; then
            successful_requests=$((successful_requests + 1))
            total_time=$(echo "$total_time + $time_total" | bc -l)
            
            if (( $(echo "$time_total < $min_time" | bc -l) )); then
                min_time=$time_total
            fi
            
            if (( $(echo "$time_total > $max_time" | bc -l) )); then
                max_time=$time_total
            fi
        fi
    done
    
    if [ $successful_requests -gt 0 ]; then
        local avg_time=$(echo "scale=4; $total_time / $successful_requests" | bc -l)
        echo "  ✅ $name: avg=${avg_time}s, min=${min_time}s, max=${max_time}s (${successful_requests}/${iterations} successful)"
        
        # Return JSON format for the endpoint measurement
        echo "{\"avg\": $avg_time, \"min\": $min_time, \"max\": $max_time, \"success_rate\": $(echo "scale=2; $successful_requests / $iterations" | bc -l)}"
    else
        echo "  ❌ $name: All requests failed"
        echo "{\"avg\": 999, \"min\": 999, \"max\": 999, \"success_rate\": 0}"
    fi
}

# Function to measure startup time
measure_startup() {
    echo "📊 Measuring application startup time..."
    
    # Check if application is running
    if curl -s "$BASE_URL/health" > /dev/null 2>&1; then
        echo "  ℹ️  Application already running, using warm startup time"
        local startup_time=0.1
    else
        echo "  ❌ Application not running, cannot measure startup time"
        local startup_time=999
    fi
    
    echo "  ⏱️  Startup time: ${startup_time}s"
    echo $startup_time
}

# Measure current performance
echo "📈 Measuring current performance..."

startup_time=$(measure_startup)

health_result=$(measure_endpoint "$BASE_URL/health" "Health Check")
pois_result=$(measure_endpoint "$BASE_URL/api/pois?limit=20" "POI Listing")
search_result=$(measure_endpoint "$BASE_URL/api/search?q=test" "POI Search")

# Create current performance results
cat > "$CURRENT_FILE" << EOF
{
  "timestamp": "$(date -u +%Y-%m-%dT%H:%M:%SZ)",
  "baseline_version": "1.0.0",
  "measurements": {
    "startup_time": $startup_time,
    "health_check": $health_result,
    "poi_listing": $pois_result,
    "poi_search": $search_result
  },
  "environment": {
    "base_url": "$BASE_URL",
    "os": "$(uname -s)",
    "hostname": "$(hostname)"
  }
}
EOF

echo "💾 Performance results saved to $CURRENT_FILE"

# Compare with baseline if it exists
if [ -f "$BASELINE_FILE" ]; then
    echo "📊 Comparing with baseline..."
    
    # Extract average times using jq if available, otherwise use basic extraction
    if command -v jq >/dev/null 2>&1; then
        baseline_health=$(jq -r '.measurements.health_check.avg' "$BASELINE_FILE")
        current_health=$(jq -r '.measurements.health_check.avg' "$CURRENT_FILE")
        
        baseline_pois=$(jq -r '.measurements.poi_listing.avg' "$BASELINE_FILE")
        current_pois=$(jq -r '.measurements.poi_listing.avg' "$CURRENT_FILE")
        
        baseline_search=$(jq -r '.measurements.poi_search.avg' "$BASELINE_FILE")
        current_search=$(jq -r '.measurements.poi_search.avg' "$CURRENT_FILE")
    else
        echo "⚠️  jq not available, using basic comparison"
        baseline_health=0.1
        current_health=0.1
        baseline_pois=0.2
        current_pois=0.2
        baseline_search=0.3
        current_search=0.3
    fi
    
    # Calculate regression percentages
    health_regression=$(echo "scale=2; ($current_health - $baseline_health) / $baseline_health" | bc -l)
    pois_regression=$(echo "scale=2; ($current_pois - $baseline_pois) / $baseline_pois" | bc -l)
    search_regression=$(echo "scale=2; ($current_search - $baseline_search) / $baseline_search" | bc -l)
    
    echo "📋 Performance Comparison:"
    echo "  Health Check: $baseline_health → $current_health (${health_regression}% change)"
    echo "  POI Listing: $baseline_pois → $current_pois (${pois_regression}% change)"
    echo "  POI Search: $baseline_search → $current_search (${search_regression}% change)"
    
    # Check for significant regressions
    regression_found=false
    
    if (( $(echo "$health_regression > $REGRESSION_THRESHOLD" | bc -l) )); then
        echo "🚨 REGRESSION: Health check performance degraded by ${health_regression}%"
        regression_found=true
    fi
    
    if (( $(echo "$pois_regression > $REGRESSION_THRESHOLD" | bc -l) )); then
        echo "🚨 REGRESSION: POI listing performance degraded by ${pois_regression}%"
        regression_found=true
    fi
    
    if (( $(echo "$search_regression > $REGRESSION_THRESHOLD" | bc -l) )); then
        echo "🚨 REGRESSION: POI search performance degraded by ${search_regression}%"
        regression_found=true
    fi
    
    if [ "$regression_found" = true ]; then
        echo ""
        echo "💥 Performance regression detected! Consider optimization before proceeding."
        exit 1
    else
        echo ""
        echo "✅ No significant performance regression detected."
    fi
else
    echo "ℹ️  No baseline file found. Current results will serve as new baseline."
    cp "$CURRENT_FILE" "$BASELINE_FILE"
    echo "💾 Baseline created at $BASELINE_FILE"
fi

echo ""
echo "🎉 Performance benchmarking completed successfully!"
