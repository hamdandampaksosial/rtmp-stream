#!/bin/bash

# RTMP YouTube Stream Controller Setup Script
# This script helps set up the streaming controller on Ubuntu/Debian systems

set -e

echo "🚀 Setting up RTMP YouTube Stream Controller..."
echo "================================================"

# Check if running as root
if [ "$EUID" -eq 0 ]; then
    echo "⚠️  Please don't run this script as root for security reasons."
    exit 1
fi

# Function to check if command exists
command_exists() {
    command -v "$1" >/dev/null 2>&1
}

# Function to install package if not exists
install_if_missing() {
    if ! command_exists "$1"; then
        echo "📦 Installing $1..."
        sudo apt-get update
        sudo apt-get install -y "$2"
    else
        echo "✅ $1 is already installed"
    fi
}

# Update system
echo "🔄 Updating system packages..."
sudo apt-get update

# Install Node.js if not present
if ! command_exists node; then
    echo "📦 Installing Node.js..."
    curl -fsSL https://deb.nodesource.com/setup_18.x | sudo -E bash -
    sudo apt-get install -y nodejs
else
    echo "✅ Node.js is already installed"
fi

# Install required packages
install_if_missing "ffmpeg" "ffmpeg"
install_if_missing "nginx" "nginx"
install_if_missing "git" "git"
install_if_missing "curl" "curl"

# Install nginx-rtmp module
echo "📦 Installing nginx-rtmp module..."
sudo apt-get install -y libnginx-mod-rtmp

# Create required directories
echo "📁 Creating required directories..."
sudo mkdir -p /tmp/hls /tmp/recordings
sudo chmod 755 /tmp/hls /tmp/recordings

# Install npm dependencies
echo "📦 Installing npm dependencies..."
if [ -f "package.json" ]; then
    npm install
else
    echo "⚠️  package.json not found. Make sure you're in the correct directory."
    exit 1
fi

# Backup original nginx config
if [ -f "/etc/nginx/nginx.conf" ]; then
    echo "💾 Backing up original nginx configuration..."
    sudo cp /etc/nginx/nginx.conf /etc/nginx/nginx.conf.backup
fi

# Copy nginx configuration
echo "⚙️  Configuring nginx..."
sudo cp nginx.conf /etc/nginx/nginx.conf

# Test nginx configuration
echo "🔍 Testing nginx configuration..."
sudo nginx -t

# Create systemd service file
echo "⚙️  Creating systemd service..."
sudo tee /etc/systemd/system/rtmp-controller.service > /dev/null << EOF
[Unit]
Description=RTMP YouTube Stream Controller
After=network.target

[Service]
Type=simple
User=$USER
WorkingDirectory=$(pwd)
ExecStart=/usr/bin/node server.js
Restart=always
RestartSec=10
Environment=NODE_ENV=production
Environment=PORT=3000

[Install]
WantedBy=multi-user.target
EOF

# Reload systemd
sudo systemctl daemon-reload

# Start and enable services
echo "🚀 Starting services..."
sudo systemctl restart nginx
sudo systemctl enable nginx

sudo systemctl enable rtmp-controller
sudo systemctl start rtmp-controller

# Create startup script
echo "📝 Creating startup script..."
cat > start.sh << 'EOF'
#!/bin/bash
echo "Starting RTMP YouTube Stream Controller..."
sudo systemctl start nginx
sudo systemctl start rtmp-controller
echo "✅ Services started!"
echo "📱 Web interface: http://localhost:3000"
echo "📺 RTMP endpoint: rtmp://localhost:1935/live/stream"
EOF

chmod +x start.sh

# Create stop script
cat > stop.sh << 'EOF'
#!/bin/bash
echo "Stopping RTMP YouTube Stream Controller..."
sudo systemctl stop rtmp-controller
sudo systemctl stop nginx
echo "✅ Services stopped!"
EOF

chmod +x stop.sh

# Display status
echo ""
echo "🎉 Setup completed successfully!"
echo "================================"
echo ""
echo "📱 Web Interface: http://localhost:3000"
echo "📺 RTMP Endpoint: rtmp://localhost:1935/live/stream"
echo "🔧 HLS Preview: http://localhost:8080/live/stream/index.m3u8"
echo ""
echo "📋 Quick Commands:"
echo "  Start services: ./start.sh"
echo "  Stop services: ./stop.sh"
echo "  View logs: journalctl -u rtmp-controller -f"
echo "  View nginx logs: sudo tail -f /var/log/nginx/error.log"
echo ""
echo "🚀 Next Steps:"
echo "1. Open http://localhost:3000 in your browser"
echo "2. Configure your YouTube RTMP URL and stream key"
echo "3. Start streaming from OBS to rtmp://localhost:1935/live/stream"
echo ""
echo "For troubleshooting, check the README.md file."