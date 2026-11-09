@echo off
setlocal EnableExtensions

REM Copyright (C) 2026 Gustavo Henrique T.
REM SPDX-License-Identifier: GPL-3.0-or-later
REM See LICENSE in the repository root.

REM ======================================================================================
REM MAIN ENTRYPOINT
REM ======================================================================================

if "%~1"=="client" goto client_mode

echo Usage: windows.bat client
exit /b 1

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
echo Checking Node.js...
where node >nul 2>&1
if errorlevel 1 goto install_node
where npm >nul 2>&1
if errorlevel 1 goto install_node
echo Node.js found.
goto ensure_python

:install_node
echo Installing Node.js...
winget --version >nul 2>&1
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
echo Node.js installed.

:ensure_python
echo Checking Python 3.13.5...
call :python313_ready
if not errorlevel 1 (
  echo Python 3.13.5 found.
  goto build_client
)

set "PY_ARCH=%PROCESSOR_ARCHITECTURE%"
if defined PROCESSOR_ARCHITEW6432 set "PY_ARCH=%PROCESSOR_ARCHITEW6432%"
set "PY_VER=3.13.5"
if /I "%PY_ARCH%"=="AMD64" (
  set "PY_NAME=python-%PY_VER%-amd64.exe"
  set "PY_SHA=C1CB40978B28F696B111C36034A1BDEDA17D25E35C74A08EF5E5FF405A63FC20"
) else if /I "%PY_ARCH%"=="x86" (
  set "PY_NAME=python-%PY_VER%.exe"
  set "PY_SHA=A288ADA6F394CC934C2E279B7B0CD5A51C0A4E69134D3CFC79839EDC6BF27A7F"
) else (
  echo No Python %PY_VER% installer for %PY_ARCH%. 1>&2
  exit /b 1
)
set "PY_URL=https://www.python.org/ftp/python/%PY_VER%/%PY_NAME%"
set "PY_EXE=%TEMP%\%PY_NAME%"
echo Downloading Python %PY_VER%...
curl.exe -fL -o "%PY_EXE%" "%PY_URL%"
if errorlevel 1 (
  echo Could not download Python %PY_VER% from python.org. 1>&2
  exit /b 1
)
echo Verifying Python installer...
certutil -hashfile "%PY_EXE%" SHA256 > "%TEMP%\py-sha.txt"
type "%TEMP%\py-sha.txt"
set "PY_GOT="
for /f "skip=1 delims=" %%H in ('type "%TEMP%\py-sha.txt"') do (
  if not defined PY_GOT set "PY_GOT=%%H"
)
del /f /q "%TEMP%\py-sha.txt" >nul 2>&1
set "PY_GOT=%PY_GOT: =%"
if /I not "%PY_GOT%"=="%PY_SHA%" (
  echo Python installer checksum failed. 1>&2
  del /f /q "%PY_EXE%" >nul 2>&1
  exit /b 1
)
echo Installing Python %PY_VER%...
"%PY_EXE%" /passive InstallAllUsers=1 PrependPath=1 Include_pip=1 Include_launcher=1 Include_test=0 TargetDir="%ProgramFiles%\Python313"
set "PY_RC=%ERRORLEVEL%"
del /f /q "%PY_EXE%" >nul 2>&1
if not "%PY_RC%"=="0" if not "%PY_RC%"=="3010" (
  echo Python %PY_VER% installer failed. 1>&2
  exit /b 1
)
call :refresh_path
call :python313_ready
if not errorlevel 1 (
  echo Python %PY_VER% installed.
  goto build_client
)
echo Python 3.13 was installed but is not on PATH. Open a new terminal and run this script again.
exit /b 1

:python313_ready
if not exist "%ProgramFiles%\Python313\python.exe" exit /b 1
"%ProgramFiles%\Python313\python.exe" -c "import sys; raise SystemExit(0 if sys.version.split()[0]=='3.13.5' else 1)" >nul 2>&1
if errorlevel 1 exit /b 1
exit /b 0

REM npm packages install

:build_client
cd /d "%GUI_DIR%"
if errorlevel 1 exit /b 1
echo Installing npm packages...
call npm install --no-audit
if errorlevel 1 exit /b 1
echo Building the client...
call npm run dist
if errorlevel 1 exit /b 1
echo Creating the Start Menu shortcut...
call :electron_files_setup
if errorlevel 1 exit /b 1
echo Done.
exit /b 0

:electron_files_setup
set "APP_EXE=%GUI_DIR%\dist\win-unpacked\nukerat.exe"
if not exist "%APP_EXE%" (
  echo No Windows build in "%GUI_DIR%\dist". 1>&2
  exit /b 1
)
set "ICO=%GUI_DIR%\public\icon.ico"
set "SHORTCUT=%APPDATA%\Microsoft\Windows\Start Menu\Programs\nukerat.lnk"
set "NUKERAT_APP_EXE=%APP_EXE%"
set "NUKERAT_ICO=%ICO%"
set "NUKERAT_SHORTCUT=%SHORTCUT%"
set "NUKERAT_WORKDIR=%GUI_DIR%\dist\win-unpacked"
powershell -NoProfile -Command "$s = (New-Object -ComObject WScript.Shell).CreateShortcut($env:NUKERAT_SHORTCUT); $s.TargetPath = $env:NUKERAT_APP_EXE; $s.WorkingDirectory = $env:NUKERAT_WORKDIR; if (Test-Path -LiteralPath $env:NUKERAT_ICO) { $s.IconLocation = $env:NUKERAT_ICO }; $s.Description = 'nukerat'; $s.Save()"
if errorlevel 1 exit /b 1
exit /b 0

:refresh_path
set "SYS_PATH="
set "USER_PATH="
set "ORIG_PATH=%PATH%"
for /f "tokens=2*" %%A in ('reg query "HKLM\SYSTEM\CurrentControlSet\Control\Session Manager\Environment" /v Path 2^>nul') do set "SYS_PATH=%%B"
for /f "tokens=2*" %%A in ('reg query "HKCU\Environment" /v Path 2^>nul') do set "USER_PATH=%%B"
call set "PATH=%ProgramFiles%\Python313;%ProgramFiles%\Python313\Scripts;%SYS_PATH%;%USER_PATH%;%ProgramFiles%\nodejs;%LOCALAPPDATA%\Microsoft\WindowsApps;%ORIG_PATH%"
exit /b 0
