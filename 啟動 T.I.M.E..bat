@echo off
setlocal
powershell.exe -NoLogo -NoProfile -ExecutionPolicy Bypass -File "%~dp0scripts\start-time.ps1"
set "TIME_EXIT_CODE=%ERRORLEVEL%"
if not "%TIME_EXIT_CODE%"=="0" pause
exit /b %TIME_EXIT_CODE%
