#!/bin/bash

echo "🚀 Starting PaperWise in Development Mode (with Hot-Reloading)"
echo "==========================================================="

# Check if Docker is running
if ! docker info > /dev/null 2>&1; then
  echo "❌ Error: Docker is not running. Please start Docker and try again."
  exit 1
fi

# Clean up existing containers (optional, but ensures a clean state)
# echo "🧹 Cleaning up old containers..."
# docker compose -f docker-compose.yml -f docker-compose.dev.yml down

echo "📦 Building and starting services..."
docker compose -f docker-compose.yml -f docker-compose.dev.yml up -d --build

echo ""
echo "✅ PaperWise is running in Development Mode!"
echo "--------------------------------------------"
echo "🖥️  Frontend: http://localhost:3002 (Hot-reloading active)"
echo "⚙️  Backend:  http://localhost:8081 (Auto-reloading active)"
echo "📊 Redis:    localhost:6380"
echo "--------------------------------------------"
echo "To view logs, run: docker compose -f docker-compose.yml -f docker-compose.dev.yml logs -f"
echo "To stop, run:      docker compose -f docker-compose.yml -f docker-compose.dev.yml down"
