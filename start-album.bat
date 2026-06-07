@echo off
cd /d "%~dp0"

if not exist node_modules (
  echo Installing project dependencies...
  npm.cmd install --cache .npm-cache
  if errorlevel 1 (
    echo.
    echo Install failed. Please check the messages above.
    pause
    exit /b 1
  )
)

echo Starting My Senior High School Memory Album...
echo.
echo Keep this window open while viewing the album.
echo.

npm.cmd run open

pause
