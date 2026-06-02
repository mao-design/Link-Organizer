@echo off
echo === Killing Electron ===
taskkill /F /IM electron.exe 2>nul
taskkill /F /IM "Link Organizer.exe" 2>nul
timeout /t 2 /nobreak >nul
echo === Cleaning ===
rmdir /s /q build-out release release2 2>nul
timeout /t 1 /nobreak >nul
echo === Packaging ===
set ELECTRON_MIRROR=https://npmmirror.com/mirrors/electron/
set ELECTRON_BUILDER_BINARIES_MIRROR=https://npmmirror.com/mirrors/electron-builder-binaries/
call npx electron-builder build --win --publish=never
echo.
echo === Done ===
dir build-out\*.exe /s 2>nul
pause
