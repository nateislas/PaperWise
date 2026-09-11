#!/usr/bin/env bash

# Ensure common docker paths are included in PATH
export PATH="/usr/local/bin:/opt/homebrew/bin:$PATH"

# Resolve docker compose command
if docker compose version &> /dev/null; then
    DOCKER_COMPOSE="docker compose"
elif command -v docker-compose &> /dev/null; then
    DOCKER_COMPOSE="docker-compose"
else
    echo "❌ Error: Neither 'docker compose' nor 'docker-compose' found."
    echo "Please ensure Docker Desktop is installed and running."
    exit 1
fi

# Compose files and env file configuration
COMPOSE_FILES="-f docker-compose.yml -f docker-compose.dev.yml"
if [ -f "backend/.env" ]; then
    ENV_FLAG="--env-file backend/.env"
else
    ENV_FLAG=""
fi

check_docker() {
    if ! docker info > /dev/null 2>&1; then
        echo "❌ Error: Docker daemon is not running."
        echo "Please start Docker Desktop and try again."
        exit 1
    fi
}

print_header() {
    echo "==========================================================="
    echo "🚀 PaperWise Deploy Manager"
    echo "==========================================================="
}

print_endpoints() {
    echo ""
    echo "✅ PaperWise is up and running!"
    echo "-----------------------------------------------------------"
    echo "🖥️  Frontend UI:  http://localhost:3002 (Hot-reload active)"
    echo "⚙️  Backend API:  http://localhost:8081 (Auto-reload active)"
    echo "📖 API Docs:     http://localhost:8081/docs"
    echo "📊 Redis:        localhost:6380"
    echo "-----------------------------------------------------------"
    echo "Useful commands:"
    echo "  ./deploy.sh logs       # View live streaming logs"
    echo "  ./deploy.sh restart    # Restart all containers with rebuild"
    echo "  ./deploy.sh stop       # Stop all containers"
    echo "  ./deploy.sh status     # Check health status of containers"
    echo "==========================================================="
}

start_services() {
    print_header
    check_docker
    echo "📦 Building and starting PaperWise services in background..."
    $DOCKER_COMPOSE $ENV_FLAG $COMPOSE_FILES up -d --build
    print_endpoints
}

stop_services() {
    print_header
    check_docker
    echo "🛑 Stopping PaperWise services..."
    $DOCKER_COMPOSE $ENV_FLAG $COMPOSE_FILES down
    echo "✅ All PaperWise services stopped."
}

restart_services() {
    print_header
    check_docker
    echo "🔄 Restarting PaperWise services..."
    $DOCKER_COMPOSE $ENV_FLAG $COMPOSE_FILES down
    $DOCKER_COMPOSE $ENV_FLAG $COMPOSE_FILES up -d --build
    print_endpoints
}

view_logs() {
    check_docker
    $DOCKER_COMPOSE $ENV_FLAG $COMPOSE_FILES logs -f
}

view_status() {
    check_docker
    $DOCKER_COMPOSE $ENV_FLAG $COMPOSE_FILES ps
}

ACTION="${1:-up}"

case "$ACTION" in
    up|start|"")
        start_services
        ;;
    restart)
        restart_services
        ;;
    down|stop)
        stop_services
        ;;
    logs)
        view_logs
        ;;
    status|ps)
        view_status
        ;;
    *)
        echo "Usage: $0 [up|restart|stop|down|logs|status]"
        exit 1
        ;;
esac
