@echo off
setlocal
cd /d "%~dp0"
echo === Norvik DEMO (datos ficticios precargados) ===
python scripts\write_build_profile.py demo
if errorlevel 1 exit /b 1
set NORVIK_BUILD=demo
pyinstaller norvik.spec --noconfirm --clean
if errorlevel 1 exit /b 1
echo.
echo OK: dist\Norvik-Demo\Norvik-Demo.exe
echo Datos: %%APPDATA%%\Norvik-Demo\
endlocal
