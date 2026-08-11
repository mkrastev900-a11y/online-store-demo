@echo off
setlocal
cd /d "%~dp0"
title Online Store Demo - SQLite
echo ============================================================
echo   ONLINE STORE - LOCAL SQLITE DEMO
echo   No Docker. No PostgreSQL. No Neon.
echo ============================================================
echo.
if not exist node_modules (
  echo [1/4] Installing packages...
  call npm install || goto :error
) else (
  echo [1/4] Packages already installed.
)
echo [2/4] Generating Prisma Client...
call npx prisma generate || goto :error
echo [3/4] Preparing local SQLite database and demo data...
call npx prisma db push --accept-data-loss || goto :error
call npm run db:seed || goto :error
echo [4/4] Clearing stale Next.js cache and starting Online Store...
if exist .next rmdir /s /q .next
echo.
echo Login: admin / admin
echo Database: prisma\demo.db
echo Demo customer data TTL: 30 minutes
echo.
start "Online Store Demo Cleanup" /min cmd /c "node --env-file-if-exists=.env.local --env-file-if-exists=.env scripts\demo-cleanup-scheduler.mjs"
call npm run dev
goto :eof
:error
echo.
echo [ERROR] Demo startup failed. See the message above.
pause
exit /b 1
