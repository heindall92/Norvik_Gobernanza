@echo off
setlocal
cd /d "%~dp0"
echo Compilando ambas variantes de Norvik...
echo.
call build_production.bat
if errorlevel 1 exit /b 1
echo.
call build_demo.bat
if errorlevel 1 exit /b 1
echo.
python scripts\write_build_profile.py production
echo.
echo === LISTO ===
echo   Produccion: dist\Norvik\Norvik.exe
echo   Demo:       dist\Norvik-Demo\Norvik-Demo.exe
endlocal
