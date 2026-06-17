#!/bin/bash

echo "🚀 Starting PaperWise - AI Research Paper Analysis"
echo "=================================================="

# Check if uv is installed
if ! command -v uv &> /dev/null; then
    echo "❌ uv is not installed. Please install it first:"
    echo "curl -LsSf https://astral.sh/uv/install.sh | sh"
    exit 1
fi

# Check if .env file exists and has the API key (allow fallback to environment variables)
if [ ! -f "backend/.env" ] && [ -z "$GEMINI_API_KEY" ] && [ -z "$GEMINI_API_KEY" ]; then
    echo "❌ backend/.env file not found and no environment key present. Please create it with your API key."
    exit 1
fi

# Load variables from env if present
if [ -f "backend/.env" ]; then
    export $(grep -v '^#' backend/.env | xargs)
fi

# Override REDIS_URL for local host execution (bypass docker containers setup)
export REDIS_URL=redis://localhost:6379/0

if [ -z "$GEMINI_API_KEY" ] && [ -z "$GEMINI_API_KEY" ]; then
    echo "⚠️  Please configure GEMINI_API_KEY or GEMINI_API_KEY in backend/.env or your shell environment"
    exit 1
fi

echo "✅ Environment looks good!"

# Function to start backend
start_backend() {
    echo "📦 Starting backend server..."
    cd backend
    source .venv/bin/activate
    uvicorn app.main:app --reload --host 0.0.0.0 --port 8080
}

# Function to start celery
start_celery() {
    echo "📦 Starting celery worker..."
    cd backend
    source .venv/bin/activate
    celery -A app.worker.celery_app worker --loglevel=info --concurrency=1
}

# Function to start frontend
start_frontend() {
    echo "📦 Starting frontend server..."
    cd frontend
    PORT=3001 npm start
}

# Cleanup child processes on exit/Ctrl+C
cleanup() {
    echo ""
    echo "🛑 Stopping all services..."
    kill $BACKEND_PID $CELERY_PID $FRONTEND_PID 2>/dev/null
    exit 0
}
trap cleanup SIGINT SIGTERM EXIT

# Start services in parallel
echo "🎯 Starting services..."
echo "Backend will be available at: http://localhost:8080"
echo "Celery worker starting..."
echo "Frontend will be available at: http://localhost:3001"
echo ""
echo "Press Ctrl+C to stop all services"
echo ""

# Start backend in background
start_backend &
BACKEND_PID=$!

# Start celery in background
start_celery &
CELERY_PID=$!

# Start frontend in background
start_frontend &
FRONTEND_PID=$!

# Wait for all processes
wait $BACKEND_PID $CELERY_PID $FRONTEND_PID
