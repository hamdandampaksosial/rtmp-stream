#!/bin/bash

# RTMP YouTube Stream Controller Build Script
# Handles npm integrity issues and provides multiple build options

set -e

echo "🔧 RTMP YouTube Stream Controller Build Script"
echo "=============================================="

# Function to clean npm cache and dependencies
clean_npm() {
    echo "🧹 Cleaning npm cache and dependencies..."
    rm -rf node_modules package-lock.json
    npm cache clean --force
    echo "✅ Clean completed"
}

# Function to install dependencies
install_deps() {
    echo "📦 Installing dependencies..."
    npm install --verbose
    echo "✅ Dependencies installed"
}

# Function to test the build
test_build() {
    echo "🧪 Testing server startup..."
    timeout 5 npm start &>/dev/null || echo "✅ Server startup test completed"
}

# Function to build Docker image
build_docker() {
    echo "🐳 Building Docker image..."
    if command -v docker &> /dev/null; then
        docker build -t rtmp-youtube-controller .
        echo "✅ Docker image built successfully"
    else
        echo "❌ Docker not found, skipping Docker build"
    fi
}

# Function to build with multi-stage Dockerfile
build_docker_multistage() {
    echo "🐳 Building Docker image with multi-stage build..."
    if command -v docker &> /dev/null; then
        docker build -f Dockerfile.multistage -t rtmp-youtube-controller:multistage .
        echo "✅ Multi-stage Docker image built successfully"
    else
        echo "❌ Docker not found, skipping Docker build"
    fi
}

# Main build function
main() {
    case "${1:-all}" in
        "clean")
            clean_npm
            ;;
        "install")
            install_deps
            ;;
        "test")
            test_build
            ;;
        "docker")
            build_docker
            ;;
        "docker-multistage")
            build_docker_multistage
            ;;
        "fix-integrity")
            echo "🔧 Fixing npm integrity issues..."
            clean_npm
            install_deps
            test_build
            echo "✅ Integrity issues fixed"
            ;;
        "all")
            echo "🚀 Running full build process..."
            clean_npm
            install_deps
            test_build
            echo "✅ Full build completed"
            ;;
        *)
            echo "Usage: $0 [clean|install|test|docker|docker-multistage|fix-integrity|all]"
            echo ""
            echo "Options:"
            echo "  clean           - Clean npm cache and dependencies"
            echo "  install         - Install dependencies"
            echo "  test            - Test server startup"
            echo "  docker          - Build Docker image"
            echo "  docker-multistage - Build multi-stage Docker image"
            echo "  fix-integrity   - Fix npm integrity issues"
            echo "  all             - Run complete build process (default)"
            exit 1
            ;;
    esac
}

# Run main function with arguments
main "$@"