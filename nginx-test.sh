#!/bin/bash

# Nginx Configuration Test Script
# Helps test and switch between different nginx configurations

set -e

echo "🔧 Nginx Configuration Test Script"
echo "=================================="

# Function to test nginx configuration
test_nginx_config() {
    local config_file="$1"
    echo "🧪 Testing nginx configuration: $config_file"
    
    if [ ! -f "$config_file" ]; then
        echo "❌ Configuration file not found: $config_file"
        return 1
    fi
    
    # Test the configuration
    if sudo nginx -t -c "$(pwd)/$config_file" 2>/dev/null; then
        echo "✅ Configuration test passed"
        return 0
    else
        echo "❌ Configuration test failed"
        echo "📋 Error details:"
        sudo nginx -t -c "$(pwd)/$config_file" 2>&1 | head -10
        return 1
    fi
}

# Function to check if nginx-rtmp module is installed
check_rtmp_module() {
    echo "🔍 Checking nginx-rtmp module..."
    
    if nginx -V 2>&1 | grep -q "rtmp"; then
        echo "✅ nginx-rtmp module is installed"
        return 0
    else
        echo "❌ nginx-rtmp module not found"
        echo "📋 To install on Ubuntu/Debian:"
        echo "   sudo apt-get install libnginx-mod-rtmp"
        echo "📋 Or build nginx with --add-module=nginx-rtmp-module"
        return 1
    fi
}

# Function to backup current nginx config
backup_current_config() {
    echo "💾 Backing up current nginx configuration..."
    if [ -f "/etc/nginx/nginx.conf" ]; then
        sudo cp /etc/nginx/nginx.conf /etc/nginx/nginx.conf.backup.$(date +%Y%m%d_%H%M%S)
        echo "✅ Backup created"
    else
        echo "⚠️  No existing nginx configuration found"
    fi
}

# Function to apply configuration
apply_config() {
    local config_file="$1"
    echo "⚙️  Applying configuration: $config_file"
    
    backup_current_config
    
    sudo cp "$config_file" /etc/nginx/nginx.conf
    
    if sudo nginx -t; then
        echo "✅ Configuration applied successfully"
        echo "🔄 Restarting nginx..."
        sudo systemctl reload nginx || sudo systemctl restart nginx
        echo "✅ Nginx restarted"
    else
        echo "❌ Configuration failed, restoring backup"
        sudo cp /etc/nginx/nginx.conf.backup.* /etc/nginx/nginx.conf 2>/dev/null || true
    fi
}

# Function to create directories
create_directories() {
    echo "📁 Creating required directories..."
    sudo mkdir -p /tmp/hls /tmp/recordings
    sudo chmod 755 /tmp/hls /tmp/recordings
    echo "✅ Directories created"
}

# Main function
main() {
    case "${1:-test}" in
        "test")
            echo "🧪 Testing all available configurations..."
            echo ""
            
            check_rtmp_module
            echo ""
            
            if [ -f "nginx-minimal.conf" ]; then
                echo "Testing minimal configuration..."
                test_nginx_config "nginx-minimal.conf"
                echo ""
            fi
            
            if [ -f "nginx.conf" ]; then
                echo "Testing full configuration..."
                test_nginx_config "nginx.conf"
                echo ""
            fi
            ;;
        "minimal")
            echo "🔧 Applying minimal nginx configuration..."
            create_directories
            apply_config "nginx-minimal.conf"
            ;;
        "full")
            echo "🔧 Applying full nginx configuration..."
            create_directories
            apply_config "nginx.conf"
            ;;
        "check")
            check_rtmp_module
            ;;
        "backup")
            backup_current_config
            ;;
        "dirs")
            create_directories
            ;;
        *)
            echo "Usage: $0 [test|minimal|full|check|backup|dirs]"
            echo ""
            echo "Commands:"
            echo "  test     - Test all nginx configurations"
            echo "  minimal  - Apply minimal nginx configuration"
            echo "  full     - Apply full nginx configuration"
            echo "  check    - Check if nginx-rtmp module is installed"
            echo "  backup   - Backup current nginx configuration"
            echo "  dirs     - Create required directories"
            echo ""
            echo "Files:"
            echo "  nginx-minimal.conf - Basic configuration (most compatible)"
            echo "  nginx.conf         - Full configuration (may need newer nginx-rtmp)"
            exit 1
            ;;
    esac
}

# Run main function
main "$@"