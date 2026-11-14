@echo off
setlocal
set "GLASS_REACH_NODE=%USERPROFILE%\.cache\codex-runtimes\codex-primary-runtime\dependencies\node\bin\node.exe"
if not exist "%GLASS_REACH_NODE%" set "GLASS_REACH_NODE=node.exe"
"%GLASS_REACH_NODE%" "%~dp0dashboard\launch.mjs" --demo
if errorlevel 1 pause
