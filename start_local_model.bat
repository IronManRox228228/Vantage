@echo off
title HMI Analyser - Launcher
color 0A
echo.
echo ============================================
echo   HMI Analyser - Local Model Launcher
echo ============================================
echo.

echo [1/2] Starting Gemma-4 vision model on port 8080...
echo       (This opens in a separate window)
echo.
start "Gemma-4 Model Server (port 8080)" cmd /k "cd /d "C:\Users\Ashman Das\Documents\turboquant-llama-cpp" & echo Loading Gemma-4 model... & .\llama-server.exe -m "C:\Users\Ashman Das\Documents\turboquant-llama-cpp\models\lmstudio-community\gemma-4-E4B-it-GGUF\gemma-4-E4B-it-Q4_K_M.gguf" --mmproj "C:\Users\Ashman Das\Documents\turboquant-llama-cpp\models\lmstudio-community\gemma-4-E4B-it-GGUF\mmproj-gemma-4-E4B-it-BF16.gguf" -ngl 999 --mlock --no-mmap --cache-type-k turbo4 --cache-type-v turbo3 -fa on -c 16384 --port 8080 --host 127.0.0.1 --no-warmup"

echo [2/2] Starting HTTP file server on port 3000...
echo       (This opens in a separate window)
echo.
start "HMI File Server (port 3000)" cmd /k "cd /d "C:\Users\Ashman Das\Documents\HMI analyser" & node serve.js"

echo ============================================
echo   Both servers are launching!
echo.
echo   Wait for BOTH windows to show "listening"
echo   then open: http://localhost:3000
echo.
echo   Opening browser in 10 seconds...
echo ============================================
echo.

timeout /t 10
start http://localhost:3000

echo.
echo You can close this launcher window now.
echo The two server windows will keep running.
echo.
pause
