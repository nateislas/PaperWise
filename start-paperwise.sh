#!/bin/bash

echo "🚀 Starting PaperWise - AI Research Paper Analysis"
echo "=================================================="

# Check if uv is installed
if ! command -v uv &> /dev/null; then
    echo "❌ uv is not installed. Please install it first:"
    echo "curl -LsSf https://astral.sh/uv/install.sh | sh"
    exit 1
fi

# Check if .env file exists and has the API key
if [ ! -f "backend/.env" ]; then
    echo "❌ backend/.env file not found. Please create it with your Llama API key."
    exit 1
fi

if ! grep -q "LLAMA_API_KEY=LLM|" backend/.env; then
    echo "⚠️  Please update backend/.env with your actual Llama API key"
    echo "Replace 'your_llama_api_key_here' with your actual API key"
    exit 1
fi

echo "✅ Environment looks good!"

# Function to start backend
start_backend() {
    echo "📦 Starting backend server..."
    cd backend
    source .venv/bin/activate
    uvicorn app.main:app --reload --host 0.0.0.0 --port 8000
}

# Function to start frontend
start_frontend() {
    echo "📦 Starting frontend server..."
    cd frontend
    npm start
}

# Start both services in parallel
echo "🎯 Starting both services..."
echo "Backend will be available at: http://localhost:8000"
echo "Frontend will be available at: http://localhost:3000"
echo ""
echo "Press Ctrl+C to stop both services"
echo ""

# Start backend in background
start_backend &
BACKEND_PID=$!

# Start frontend in background
start_frontend &
FRONTEND_PID=$!

# Wait for both processes
wait $BACKEND_PID $FRONTEND_PID
