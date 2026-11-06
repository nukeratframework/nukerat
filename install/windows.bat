@echo off
setlocal EnableExtensions

REM Copyright (C) 2026 Gustavo Henrique T.
REM SPDX-License-Identifier: GPL-3.0-or-later
REM See LICENSE in the repository root.

REM ======================================================================================
REM MAIN ENTRYPOINT
REM ======================================================================================

if "%~1"=="server" goto server_mode
if "%~1"=="client" goto client_mode
if "%~1"=="all" goto all_mode

echo Usage: windows.bat ^<mode^>
echo.
echo MODES:
echo   server    Install server
echo   client    Install client
echo   all       Install server and client
echo.
echo EXAMPLES:
echo   windows.bat server
echo   windows.bat client
echo   windows.bat all
exit /b 1

:server_mode
echo Server installation is not supported on Windows. 1>&2
exit /b 1

:all_mode
echo Server installation is not supported on Windows. Only the client will be installed. 1>&2

:client_mode

REM ======================================================================================
REM VALIDATIONS
REM ======================================================================================

net session >nul 2>&1
if errorlevel 1 (
  echo Please run as administrator.
  exit /b 1
)

set "GUI_DIR=%~dp0..\client\gui"

REM ======================================================================================
REM CLIENT INSTALLATION
REM ======================================================================================

REM NodeJS install. OpenJS.NodeJS.LTS includes npm.

call :refresh_path
where node >nul 2>&1
if errorlevel 1 goto install_node
where npm >nul 2>&1
if errorlevel 1 goto install_node
goto build_client

:install_node
where winget >nul 2>&1
if errorlevel 1 (
  echo winget was not found. Install Node.js and npm manually.
  exit /b 1
)
winget source update --disable-interactivity
if errorlevel 1 exit /b 1
winget install --id OpenJS.NodeJS.LTS --exact --scope machine --accept-package-agreements --accept-source-agreements --disable-interactivity
if errorlevel 1 exit /b 1
call :refresh_path
where node >nul 2>&1
if errorlevel 1 (
  echo Node.js was installed but is not on PATH. Open a new terminal and run this script again.
  exit /b 1
)
where npm >nul 2>&1
if errorlevel 1 (
  echo npm was not found after installing Node.js.
  exit /b 1
)

REM npm packages install

:build_client
cd /d "%GUI_DIR%"
if errorlevel 1 exit /b 1
call npm install --silent
if errorlevel 1 exit /b 1
call npm run dist
if errorlevel 1 exit /b 1
exit /b 0

:refresh_path
set "SYS_PATH="
set "USER_PATH="
for /f "tokens=2*" %%A in ('reg query "HKLM\SYSTEM\CurrentControlSet\Control\Session Manager\Environment" /v Path 2^>nul') do set "SYS_PATH=%%B"
for /f "tokens=2*" %%A in ('reg query "HKCU\Environment" /v Path 2^>nul') do set "USER_PATH=%%B"
set "PATH=%SYS_PATH%;%USER_PATH%;%ProgramFiles%\nodejs"
exit /b 0
