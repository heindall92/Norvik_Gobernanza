@echo off
setlocal
cd /d "%~dp0"
echo === Norvik PRODUCCION (sin datos demo) ===
python scripts\write_build_profile.py production
if errorlevel 1 exit /b 1
set NORVIK_BUILD=production
pyinstaller norvik.spec --noconfirm --clean
if errorlevel 1 exit /b 1
echo.
echo OK: dist\Norvik\Norvik.exe
echo Datos: %%APPDATA%%\Norvik\
endlocal
