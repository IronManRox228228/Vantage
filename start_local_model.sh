#!/bin/bash

# ============================================
#   HMI Analyser - Launcher (macOS)
# ============================================
#
# SETUP: Before first run, make this file executable:
#   chmod +x start_local_model.sh
# ============================================

HMI_DIR="$(cd "$(dirname "$0")" && pwd)"

echo ""
echo "============================================"
echo "  HMI Analyser - Server Launcher"
echo "============================================"
echo ""

echo "Starting HTTP file server on port 3000..."
cd "$HMI_DIR" || { echo "ERROR: Cannot find HMI analyser directory"; exit 1; }
node serve.js &
SERVE_PID=$!

cleanup() {
    echo ""
    echo "[Shutdown] Stopping server..."
    kill $SERVE_PID 2>/dev/null
    wait $SERVE_PID 2>/dev/null
    echo "[Shutdown] Done."
    exit 0
}
trap cleanup SIGINT SIGTERM

echo ""
echo "============================================"
echo "  Server is launching!"
echo ""
echo "  Open: http://localhost:3000"
echo ""
echo "  Opening browser in 5 seconds..."
echo "============================================"
echo ""

sleep 5
open "http://localhost:3000" 2>/dev/null

echo "Press Ctrl+C to stop the server."
echo ""

wait
