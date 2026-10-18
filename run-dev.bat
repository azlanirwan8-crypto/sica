@echo off
title SICA Academic Cloud - Development Server
cd /d "%~dp0"

echo ========================================================
echo   SICA Academic Cloud - Local Development Launcher
echo ========================================================
echo.

set "PATH=%~dp0.tools\node;%PATH%"

echo [1/3] Memeriksa Node.js dan pnpm portable...
node -v
call pnpm -v
if %ERRORLEVEL% NEQ 0 (
    echo [ERROR] Node.js portable tidak ditemukan di .tools\node
    pause
    exit /b 1
)

echo.
echo [2/3] Memeriksa dependensi monorepo...
if not exist "node_modules" (
    echo Mengunduh dependensi awal (pnpm install)...
    call pnpm install
)

echo.
echo [3/3] Menjalankan Next.js Web Dev Server...
echo.
echo ========================================================
echo   Aplikasi Web siap diakses di: http://localhost:3000
echo   Halaman Login:     http://localhost:3000/login
echo   Halaman Dashboard: http://localhost:3000/dashboard
echo ========================================================
echo.

call pnpm --filter @sica/web dev
pause
