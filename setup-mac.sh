#!/bin/bash

# Gemma Chat Application - macOS Setup Script
# This script sets up the full-stack Gemma chat application on macOS

set -e  # Exit on any error

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

# Function to print colored output
print_status() {
    echo -e "${GREEN}[INFO]${NC} $1"
}

print_warning() {
    echo -e "${YELLOW}[WARNING]${NC} $1"
}

print_error() {
    echo -e "${RED}[ERROR]${NC} $1"
}

print_header() {
    echo -e "\n${GREEN}========================================${NC}"
    echo -e "${GREEN}  $1${NC}"
    echo -e "${GREEN}========================================${NC}\n"
}

# Check if running on macOS
if [[ "$OSTYPE" != "darwin"* ]]; then
    print_error "This script is for macOS only. Use setup-ubuntu.sh for Ubuntu."
    exit 1
fi

print_header "Gemma Chat Application - macOS Setup"

# Function to check if command exists
command_exists() {
    command -v "$1" >/dev/null 2>&1
}

# Function to check minimum version
check_version() {
    local current_version=$1
    local required_version=$2
    local name=$3
    
    if [ "$(printf '%s\n' "$required_version" "$current_version" | sort -V | head -n1)" = "$required_version" ]; then
        print_status "$name version $current_version meets requirement (>= $required_version)"
        return 0
    else
        print_error "$name version $current_version is too old (required >= $required_version)"
        return 1
    fi
}

# Check for required dependencies
print_header "Checking System Dependencies"

# Check for Homebrew
if ! command_exists brew; then
    print_warning "Homebrew not found. Installing Homebrew..."
    /bin/bash -c "$(curl -fsSL https://raw.githubusercontent.com/Homebrew/install/HEAD/install.sh)"
    
    # Add Homebrew to PATH for this session
    if [[ -f "/opt/homebrew/bin/brew" ]]; then
        eval "$(/opt/homebrew/bin/brew shellenv)"
    elif [[ -f "/usr/local/bin/brew" ]]; then
        eval "$(/usr/local/bin/brew shellenv)"
    fi
else
    print_status "Homebrew found"
    brew update
fi

# Check for Docker
if ! command_exists docker; then
    print_warning "Docker not found. Please install Docker Desktop from https://www.docker.com/products/docker-desktop"
    print_warning "After installing Docker Desktop, please run this script again."
    exit 1
else
    print_status "Docker found"
    if ! docker info >/dev/null 2>&1; then
        print_error "Docker is installed but not running. Please start Docker Desktop and run this script again."
        exit 1
    fi
fi

# Check for Docker Compose
if ! command_exists docker-compose && ! docker compose version >/dev/null 2>&1; then
    print_warning "Docker Compose not found. Installing via Homebrew..."
    brew install docker-compose
else
    print_status "Docker Compose found"
fi

# Check Node.js version
if command_exists node; then
    NODE_VERSION=$(node --version | sed 's/v//')
    if ! check_version "$NODE_VERSION" "18.0.0" "Node.js"; then
        print_warning "Node.js version is too old. Installing Node.js 20 via Homebrew..."
        brew install node@20
        export PATH="/opt/homebrew/opt/node@20/bin:$PATH"
    fi
else
    print_warning "Node.js not found. Installing Node.js 20 via Homebrew..."
    brew install node@20
    export PATH="/opt/homebrew/opt/node@20/bin:$PATH"
fi

# Check Python version
if command_exists python3; then
    PYTHON_VERSION=$(python3 --version | cut -d' ' -f2)
    if ! check_version "$PYTHON_VERSION" "3.9.0" "Python"; then
        print_warning "Python version is too old. Installing Python 3.12 via Homebrew..."
        brew install python@3.12
        export PATH="/opt/homebrew/opt/python@3.12/bin:$PATH"
    fi
else
    print_warning "Python3 not found. Installing Python 3.12 via Homebrew..."
    brew install python@3.12
    export PATH="/opt/homebrew/opt/python@3.12/bin:$PATH"
fi

# Check for Git
if ! command_exists git; then
    print_warning "Git not found. Installing via Homebrew..."
    brew install git
else
    print_status "Git found"
fi

print_header "Setting up Environment"

# Create .env file in backend if it doesn't exist
if [ ! -f "backend/.env" ]; then
    print_status "Creating backend/.env file..."
    cp backend/.env.example backend/.env
    print_status "Backend environment file created. You can modify backend/.env if needed."
else
    print_status "Backend .env file already exists"
fi

print_header "Starting Application with Docker"

# Build and start the application
print_status "Building and starting Docker containers..."
docker compose down --remove-orphans 2>/dev/null || true
docker compose up --build -d

print_status "Waiting for services to be ready..."
sleep 10

# Check if services are running
print_status "Checking service health..."
for i in {1..30}; do
    if docker compose ps --filter "status=running" | grep -q "chat_backend\|chat_frontend\|ollama"; then
        print_status "Services are starting up..."
        break
    fi
    if [ $i -eq 30 ]; then
        print_error "Services failed to start. Check docker compose logs for details."
        docker compose logs
        exit 1
    fi
    sleep 2
done

print_header "Installing Ollama Model"

# Pull the Gemma model
print_status "Pulling Gemma 2B model (this may take a few minutes)..."
if docker compose exec ollama ollama pull gemma:2b; then
    print_status "Gemma model successfully installed"
else
    print_error "Failed to pull Gemma model. Trying again..."
    sleep 5
    docker compose exec ollama ollama pull gemma:2b || {
        print_error "Failed to pull Gemma model. You may need to pull it manually later."
    }
fi

print_header "Setup Complete!"

# Display access information
print_status "Application URLs:"
echo "  • Frontend: http://localhost:5173"
echo "  • Backend API: http://localhost:8000/docs"
echo "  • Ollama API: http://localhost:11434"

print_status "To stop the application:"
echo "  docker compose down"

print_status "To start the application later:"
echo "  docker compose up -d"

print_status "To view logs:"
echo "  docker compose logs -f"

print_status "To rebuild after code changes:"
echo "  docker compose up --build -d"

print_warning "If you encounter issues:"
echo "  1. Check Docker Desktop is running"
echo "  2. Run: docker compose logs"
echo "  3. Check the troubleshooting section in README.md"

print_header "Enjoy your Gemma Chat Application!"