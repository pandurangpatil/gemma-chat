#!/bin/bash

# Gemma Chat Application - Ubuntu Setup Script
# This script sets up the full-stack Gemma chat application on Ubuntu

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

# Check if running on Ubuntu/Debian
if ! grep -q "ubuntu\|debian" /etc/os-release 2>/dev/null; then
    print_warning "This script is optimized for Ubuntu/Debian. It may work on other Linux distributions."
fi

print_header "Gemma Chat Application - Ubuntu Setup"

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

# Check if running as root
if [ "$EUID" -eq 0 ]; then
    print_error "Please don't run this script as root. It will use sudo when needed."
    exit 1
fi

print_header "Updating System Packages"

# Update package lists
sudo apt update

# Install basic dependencies
sudo apt install -y curl wget gnupg lsb-release software-properties-common apt-transport-https ca-certificates

print_header "Installing Docker"

# Install Docker if not present
if ! command_exists docker; then
    print_status "Installing Docker..."
    
    # Add Docker GPG key
    curl -fsSL https://download.docker.com/linux/ubuntu/gpg | sudo gpg --dearmor -o /usr/share/keyrings/docker-archive-keyring.gpg
    
    # Add Docker repository
    echo "deb [arch=$(dpkg --print-architecture) signed-by=/usr/share/keyrings/docker-archive-keyring.gpg] https://download.docker.com/linux/ubuntu $(lsb_release -cs) stable" | sudo tee /etc/apt/sources.list.d/docker.list > /dev/null
    
    # Install Docker
    sudo apt update
    sudo apt install -y docker-ce docker-ce-cli containerd.io docker-compose-plugin
    
    # Add user to docker group
    sudo usermod -aG docker $USER
    
    print_status "Docker installed successfully"
    print_warning "You may need to log out and log back in for docker group changes to take effect"
    print_warning "Or run: newgrp docker"
else
    print_status "Docker is already installed"
fi

# Start Docker service
sudo systemctl enable docker
sudo systemctl start docker

# Check if Docker is running
if ! docker info >/dev/null 2>&1; then
    # Try to fix common Docker issues
    print_warning "Docker is not responding. Attempting to fix..."
    sudo systemctl restart docker
    sleep 5
    
    if ! docker info >/dev/null 2>&1; then
        print_error "Docker is not running properly. Please check: sudo systemctl status docker"
        exit 1
    fi
fi

print_header "Installing Node.js"

# Install Node.js 20 if not present or version is too old
if command_exists node; then
    NODE_VERSION=$(node --version | sed 's/v//')
    if ! check_version "$NODE_VERSION" "18.0.0" "Node.js"; then
        print_warning "Node.js version is too old. Installing Node.js 20..."
        # Remove old nodejs if installed via apt
        sudo apt remove -y nodejs npm 2>/dev/null || true
    else
        print_status "Node.js version is adequate"
        NODE_OK=true
    fi
fi

if [ "$NODE_OK" != "true" ]; then
    # Install Node.js 20 via NodeSource repository
    curl -fsSL https://deb.nodesource.com/setup_20.x | sudo -E bash -
    sudo apt install -y nodejs
    print_status "Node.js 20 installed successfully"
fi

print_header "Installing Python"

# Install Python 3.9+ if not present
if command_exists python3; then
    PYTHON_VERSION=$(python3 --version | cut -d' ' -f2)
    if ! check_version "$PYTHON_VERSION" "3.9.0" "Python"; then
        print_warning "Python version is too old. Installing Python 3.11..."
        sudo apt install -y python3.11 python3.11-venv python3.11-pip
        # Make python3.11 the default python3
        sudo update-alternatives --install /usr/bin/python3 python3 /usr/bin/python3.11 1
    fi
else
    print_warning "Python3 not found. Installing Python 3.11..."
    sudo apt install -y python3.11 python3.11-venv python3.11-pip
fi

# Install pip if not present
if ! command_exists pip3; then
    sudo apt install -y python3-pip
fi

print_header "Installing Additional Dependencies"

# Install other useful tools
sudo apt install -y git build-essential curl jq

print_header "Setting up Environment"

# Create .env file in backend if it doesn't exist
if [ ! -f "backend/.env" ]; then
    print_status "Creating backend/.env file..."
    cp backend/.env.example backend/.env
    print_status "Backend environment file created. You can modify backend/.env if needed."
else
    print_status "Backend .env file already exists"
fi

print_header "Setting up Docker Compose"

# Check Docker Compose version (should be included with Docker)
if docker compose version >/dev/null 2>&1; then
    print_status "Docker Compose (plugin) is available"
elif command_exists docker-compose; then
    print_status "Docker Compose (standalone) is available"
else
    print_warning "Installing Docker Compose..."
    sudo apt install -y docker-compose
fi

print_header "Starting Application with Docker"

# Build and start the application
print_status "Building and starting Docker containers..."

# Use newgrp if user was just added to docker group
if ! docker info >/dev/null 2>&1; then
    print_status "Running with newgrp docker to use new group membership..."
    newgrp docker <<EONG
        docker compose down --remove-orphans 2>/dev/null || true
        docker compose up --build -d
EONG
else
    docker compose down --remove-orphans 2>/dev/null || true
    docker compose up --build -d
fi

print_status "Waiting for services to be ready..."
sleep 15

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
print_status "Pulling Gemma 2B model (this may take several minutes)..."
if docker compose exec ollama ollama pull gemma:2b; then
    print_status "Gemma model successfully installed"
else
    print_error "Failed to pull Gemma model. Trying again..."
    sleep 5
    docker compose exec ollama ollama pull gemma:2b || {
        print_error "Failed to pull Gemma model. You may need to pull it manually later."
        print_status "To install the model later, run:"
        echo "  docker compose exec ollama ollama pull gemma:2b"
    }
fi

print_header "Configuring Firewall (if needed)"

# Check if ufw is active and configure if needed
if command_exists ufw && sudo ufw status | grep -q "Status: active"; then
    print_status "Configuring UFW firewall for application ports..."
    sudo ufw allow 5173/tcp comment "Gemma Chat Frontend"
    sudo ufw allow 8000/tcp comment "Gemma Chat Backend"
    sudo ufw allow 11434/tcp comment "Ollama API"
    print_status "Firewall rules added"
fi

print_header "Setup Complete!"

# Display access information
print_status "Application URLs:"
echo "  • Frontend: http://localhost:5173"
echo "  • Backend API: http://localhost:8000/docs"
echo "  • Ollama API: http://localhost:11434"

if ! command_exists docker || ! docker info >/dev/null 2>&1; then
    print_warning "If Docker commands don't work, you may need to:"
    echo "  1. Log out and log back in"
    echo "  2. Or run: newgrp docker"
    echo "  3. Then restart the application: docker compose up -d"
fi

print_status "To stop the application:"
echo "  docker compose down"

print_status "To start the application later:"
echo "  docker compose up -d"

print_status "To view logs:"
echo "  docker compose logs -f"

print_status "To rebuild after code changes:"
echo "  docker compose up --build -d"

print_warning "If you encounter issues:"
echo "  1. Check Docker is running: sudo systemctl status docker"
echo "  2. Check container logs: docker compose logs"
echo "  3. Restart Docker: sudo systemctl restart docker"
echo "  4. Check the troubleshooting section in README.md"

print_header "Enjoy your Gemma Chat Application!"

# Optional: Create a systemd service for auto-start
read -p "Do you want to create a systemd service to auto-start the application on boot? (y/N): " -n 1 -r
echo
if [[ $REPLY =~ ^[Yy]$ ]]; then
    print_status "Creating systemd service..."
    
    sudo tee /etc/systemd/system/gemma-chat.service > /dev/null <<EOF
[Unit]
Description=Gemma Chat Application
Requires=docker.service
After=docker.service

[Service]
Type=oneshot
RemainAfterExit=true
WorkingDirectory=$(pwd)
ExecStart=/usr/bin/docker compose up -d
ExecStop=/usr/bin/docker compose down
TimeoutStartSec=0
User=$USER

[Install]
WantedBy=multi-user.target
EOF

    sudo systemctl daemon-reload
    sudo systemctl enable gemma-chat.service
    print_status "Systemd service created and enabled. The application will start automatically on boot."
fi