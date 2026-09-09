#!/usr/bin/env bash
set -e

DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
cd "$DIR"

echo "=================================================="
echo "    Starting RealTea Studio Platform              "
echo "=================================================="

# Check venv
if [ -d ".venv" ]; then
    source .venv/bin/activate
else
    echo "Creating Python virtual environment..."
    python3 -m venv .venv
    source .venv/bin/activate
    pip install -r requirements.txt
fi

# Build frontend if dist missing
if [ ! -d "frontend/dist" ]; then
    echo "Building frontend..."
    cd frontend && npm install && npm run build && cd ..
fi

PORT="${PORT:-8080}"
echo "Launching RealTea Studio server on http://localhost:${PORT}"
exec python3 -m uvicorn backend.server:app --host 0.0.0.0 --port "${PORT}"
