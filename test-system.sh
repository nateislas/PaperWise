#!/bin/bash

echo "🧪 Testing PaperWise System"
echo "==========================="

# Test backend health
echo "Testing backend health..."
if curl -s --max-time 5 http://localhost:8000/health > /dev/null; then
    echo "✅ Backend is healthy"
else
    echo "❌ Backend is not responding"
    exit 1
fi

# Test frontend (check both ports)
echo "Testing frontend..."
if curl -s --max-time 5 http://localhost:3000 > /dev/null; then
    echo "✅ Frontend is responding on port 3000"
elif curl -s --max-time 5 http://localhost:3001 > /dev/null; then
    echo "✅ Frontend is responding on port 3001"
else
    echo "❌ Frontend is not responding on ports 3000 or 3001"
    exit 1
fi

# Test analysis endpoint
echo "Testing analysis endpoint..."
if curl -s --max-time 5 http://localhost:8000/api/v1/health > /dev/null; then
    echo "✅ Analysis service is healthy"
else
    echo "❌ Analysis service is not responding"
    exit 1
fi

echo ""
echo "🎉 All systems are working!"
echo ""
echo "You can now:"
echo "1. Open http://localhost:3000 or http://localhost:3001 in your browser"
echo "2. Upload a research paper PDF"
echo "3. Ask questions about the paper"
echo "4. Get comprehensive AI analysis!"
echo ""
echo "Press Ctrl+C in the terminal where you ran ./start-paperwise.sh to stop the services"
