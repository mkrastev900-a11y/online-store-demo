@echo off
setlocal
cd /d "%~dp0"
title Reset Online Store SQLite Demo
echo This will delete ONLY the local demo database: prisma\demo.db
echo Products/settings will be re-seeded afterwards.
set /p CONFIRM=Type RESET to continue: 
if /I not "%CONFIRM%"=="RESET" exit /b 0
if exist "prisma\demo.db" del /f /q "prisma\demo.db"
if exist "prisma\demo.db-journal" del /f /q "prisma\demo.db-journal"
call npx prisma generate || goto :error
call npx prisma db push || goto :error
call npm run db:seed || goto :error
echo Reset complete. Login: admin / admin
pause
exit /b 0
:error
echo Reset failed.
pause
exit /b 1
