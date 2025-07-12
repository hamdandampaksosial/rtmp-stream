#!/bin/bash

# RTMP Connection Test Script
# Tests and troubleshoots RTMP streaming setup

set -e

echo "🔧 RTMP Connection Test Script"
echo "============================="

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# Function to print colored output
print_status() {
    local status=$1
    local message=$2
    case $status in
        "ok")
            echo -e "${GREEN}✅ $message${NC}"
            ;;
        "error")
            echo -e "${RED}❌ $message${NC}"
            ;;
        "warning")
            echo -e "${YELLOW}⚠️  $message${NC}"
            ;;
        "info")
            echo -e "${BLUE}ℹ️  $message${NC}"
            ;;
    esac
}

# Test if command exists
command_exists() {
    command -v "$1" >/dev/null 2>&1
}

# Test nginx installation and configuration
test_nginx() {
    echo ""
    echo "🔍 Testing nginx installation..."
    
    if command_exists nginx; then
        print_status "ok" "nginx is installed"
        
        # Check nginx version and modules
        if nginx -V 2>&1 | grep -q "rtmp"; then
            print_status "ok" "nginx-rtmp module is available"
        else
            print_status "error" "nginx-rtmp module not found"
            echo "   Install with: sudo apt-get install libnginx-mod-rtmp"
            return 1
        fi
        
        # Test nginx configuration
        if nginx -t 2>/dev/null; then
            print_status "ok" "nginx configuration is valid"
        else
            print_status "error" "nginx configuration has errors"
            nginx -t
            return 1
        fi
        
        # Check if nginx is running
        if systemctl is-active --quiet nginx 2>/dev/null; then
            print_status "ok" "nginx service is running"
        else
            print_status "warning" "nginx service is not running"
            echo "   Start with: sudo systemctl start nginx"
        fi
        
    else
        print_status "error" "nginx is not installed"
        echo "   Install with: sudo apt-get install nginx"
        return 1
    fi
}

# Test RTMP port availability
test_rtmp_port() {
    echo ""
    echo "🔍 Testing RTMP port (1935)..."
    
    if command_exists netstat; then
        if netstat -tuln | grep -q ":1935 "; then
            print_status "ok" "Port 1935 is listening"
        else
            print_status "error" "Port 1935 is not listening"
            echo "   nginx-rtmp server may not be running"
            return 1
        fi
    elif command_exists ss; then
        if ss -tuln | grep -q ":1935 "; then
            print_status "ok" "Port 1935 is listening"
        else
            print_status "error" "Port 1935 is not listening"
            echo "   nginx-rtmp server may not be running"
            return 1
        fi
    else
        print_status "warning" "Cannot check port status (netstat/ss not available)"
    fi
}

# Test HLS output
test_hls() {
    echo ""
    echo "🔍 Testing HLS output (port 8080)..."
    
    if command_exists curl; then
        if curl -s -f "http://localhost:8080/health" >/dev/null 2>&1; then
            print_status "ok" "HLS server is responding"
        else
            print_status "error" "HLS server not responding on port 8080"
            echo "   Check nginx configuration for HTTP server"
            return 1
        fi
    else
        print_status "warning" "curl not available for testing"
    fi
}

# Test FFmpeg installation
test_ffmpeg() {
    echo ""
    echo "🔍 Testing FFmpeg installation..."
    
    if command_exists ffmpeg; then
        print_status "ok" "FFmpeg is installed"
        
        # Check FFmpeg version
        local version=$(ffmpeg -version 2>/dev/null | head -n1 | cut -d' ' -f3)
        print_status "info" "FFmpeg version: $version"
        
        # Test FFmpeg can handle RTMP
        if ffmpeg -protocols 2>/dev/null | grep -q "rtmp"; then
            print_status "ok" "FFmpeg supports RTMP protocol"
        else
            print_status "error" "FFmpeg does not support RTMP protocol"
            return 1
        fi
        
    else
        print_status "error" "FFmpeg is not installed"
        echo "   Install with: sudo apt-get install ffmpeg"
        return 1
    fi
}

# Test RTMP connection
test_rtmp_connection() {
    echo ""
    echo "🔍 Testing RTMP connection..."
    
    local rtmp_url="rtmp://localhost:1935/live/stream"
    
    if command_exists ffmpeg; then
        print_status "info" "Testing connection to $rtmp_url"
        
        # Test with timeout
        if timeout 5 ffmpeg -f lavfi -i testsrc=duration=1:size=320x240:rate=30 -f null - -rtmp_live live -rtmp_app live -rtmp_playpath stream 2>/dev/null; then
            print_status "ok" "RTMP connection test successful"
        else
            print_status "error" "RTMP connection test failed"
            echo "   Possible issues:"
            echo "   • nginx-rtmp server not running"
            echo "   • Port 1935 blocked by firewall"
            echo "   • nginx configuration incorrect"
            return 1
        fi
    else
        print_status "error" "Cannot test RTMP connection (FFmpeg not available)"
        return 1
    fi
}

# Test controller API
test_controller_api() {
    echo ""
    echo "🔍 Testing controller API..."
    
    if command_exists curl; then
        if curl -s -f "http://localhost:3000/api/status" >/dev/null 2>&1; then
            print_status "ok" "Controller API is responding"
            
            # Test RTMP status endpoint
            local rtmp_status=$(curl -s "http://localhost:3000/api/rtmp-status" 2>/dev/null)
            if echo "$rtmp_status" | grep -q '"status":"available"'; then
                print_status "ok" "Controller reports RTMP input available"
            else
                print_status "error" "Controller reports RTMP input unavailable"
                echo "   Check the controller logs for details"
            fi
            
        else
            print_status "error" "Controller API not responding on port 3000"
            echo "   Make sure the Node.js server is running"
            return 1
        fi
    else
        print_status "warning" "curl not available for API testing"
    fi
}

# Generate test stream (requires OBS or similar)
generate_test_stream() {
    echo ""
    echo "🔍 Generating test RTMP stream..."
    
    if command_exists ffmpeg; then
        print_status "info" "Starting test stream for 10 seconds..."
        
        # Generate a test pattern and send to RTMP
        ffmpeg -f lavfi -i testsrc=duration=10:size=1280x720:rate=30 \
               -f lavfi -i sine=frequency=1000:duration=10 \
               -c:v libx264 -preset ultrafast -tune zerolatency \
               -c:a aac -strict experimental \
               -f flv rtmp://localhost:1935/live/stream \
               >/dev/null 2>&1 &
        
        local ffmpeg_pid=$!
        sleep 2
        
        if kill -0 $ffmpeg_pid 2>/dev/null; then
            print_status "ok" "Test stream is running"
            echo "   Check the web interface for preview"
            wait $ffmpeg_pid
            print_status "info" "Test stream completed"
        else
            print_status "error" "Test stream failed to start"
            return 1
        fi
    else
        print_status "error" "Cannot generate test stream (FFmpeg not available)"
        return 1
    fi
}

# Print troubleshooting tips
print_troubleshooting_tips() {
    echo ""
    echo "🔧 Troubleshooting Tips:"
    echo "======================="
    echo ""
    echo "1. If nginx-rtmp module is missing:"
    echo "   sudo apt-get install libnginx-mod-rtmp"
    echo ""
    echo "2. If nginx won't start:"
    echo "   sudo nginx -t  # Check configuration"
    echo "   sudo systemctl status nginx  # Check service status"
    echo ""
    echo "3. If RTMP port is not listening:"
    echo "   sudo systemctl restart nginx"
    echo "   sudo ufw allow 1935  # If using UFW firewall"
    echo ""
    echo "4. If FFmpeg connection fails:"
    echo "   Check nginx error logs: sudo tail -f /var/log/nginx/error.log"
    echo ""
    echo "5. For OBS setup:"
    echo "   Server: rtmp://localhost:1935/live"
    echo "   Stream Key: stream"
    echo ""
    echo "6. Check web interface at:"
    echo "   http://localhost:3000"
    echo ""
}

# Main test function
main() {
    local test_type="${1:-all}"
    local failed_tests=0
    
    case $test_type in
        "nginx")
            test_nginx || ((failed_tests++))
            ;;
        "ffmpeg")
            test_ffmpeg || ((failed_tests++))
            ;;
        "rtmp")
            test_rtmp_connection || ((failed_tests++))
            ;;
        "api")
            test_controller_api || ((failed_tests++))
            ;;
        "stream")
            generate_test_stream || ((failed_tests++))
            ;;
        "all")
            test_nginx || ((failed_tests++))
            test_rtmp_port || ((failed_tests++))
            test_hls || ((failed_tests++))
            test_ffmpeg || ((failed_tests++))
            test_controller_api || ((failed_tests++))
            ;;
        *)
            echo "Usage: $0 [nginx|ffmpeg|rtmp|api|stream|all]"
            echo ""
            echo "Test options:"
            echo "  nginx   - Test nginx and nginx-rtmp installation"
            echo "  ffmpeg  - Test FFmpeg installation"
            echo "  rtmp    - Test RTMP connection"
            echo "  api     - Test controller API"
            echo "  stream  - Generate test RTMP stream"
            echo "  all     - Run all tests (default)"
            exit 1
            ;;
    esac
    
    echo ""
    echo "========================================="
    if [ $failed_tests -eq 0 ]; then
        print_status "ok" "All tests passed! ✨"
        echo ""
        echo "Your RTMP setup appears to be working correctly."
        echo "You can now:"
        echo "1. Start streaming from OBS to rtmp://localhost:1935/live/stream"
        echo "2. Configure YouTube settings in the web interface"
        echo "3. Start streaming to YouTube"
    else
        print_status "error" "$failed_tests test(s) failed"
        print_troubleshooting_tips
    fi
    echo "========================================="
}

# Run main function with arguments
main "$@"