#!/bin/bash
# Local development startup script
# Starts Turso dev server, initializes database, and runs the app

set -e

echo "🔧 SuperCrew Kanban - Local Development Setup"
echo "=============================================="
echo ""

# Colors
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m'

# Check if Turso is installed
if ! command -v turso &> /dev/null; then
    echo "❌ Turso CLI not found"
    echo "   Install with: brew install turso"
    exit 1
fi

# Check if pnpm is installed
if ! command -v pnpm &> /dev/null; then
    echo "❌ pnpm not found"
    echo "   Install with: npm install -g pnpm"
    exit 1
fi

# Kill any existing processes on our ports
echo "🧹 Cleaning up existing processes..."
lsof -ti:8080 | xargs kill -9 2>/dev/null || true
lsof -ti:3001 | xargs kill -9 2>/dev/null || true
lsof -ti:5173 | xargs kill -9 2>/dev/null || true
echo -e "${GREEN}✓ Cleanup complete${NC}"
echo ""

# Start Turso dev server
echo "🗄️  Starting Turso database server..."
turso dev --port 8080 > /tmp/turso-dev.log 2>&1 &
TURSO_PID=$!
echo -e "${GREEN}✓ Turso running on port 8080 (PID: $TURSO_PID)${NC}"

# Wait for Turso to be ready
echo "⏳ Waiting for database to be ready..."
sleep 2

# Initialize database schema
echo "📝 Initializing database schema..."
cd backend
bun run init-db.ts
cd ..
echo -e "${GREEN}✓ Database initialized${NC}"
echo ""

# Create a trap to cleanup on exit
cleanup() {
    echo ""
    echo "🛑 Shutting down services..."
    kill $TURSO_PID 2>/dev/null || true
    lsof -ti:3001 | xargs kill -9 2>/dev/null || true
    lsof -ti:5173 | xargs kill -9 2>/dev/null || true
    echo "👋 Goodbye!"
}
trap cleanup EXIT INT TERM

# Start the application
echo "🚀 Starting backend and frontend..."
echo ""
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo "  Backend:  http://localhost:3001"
echo "  Frontend: http://localhost:5173"
echo "  Database: http://127.0.0.1:8080"
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo ""
echo "Press Ctrl+C to stop all services"
echo ""

pnpm dev
