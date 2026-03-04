@echo off
setlocal

cd /d "%~dp0"

echo ==========================================
echo   NG-ESM STRATEGIC ANALYSIS CONSOLE
echo ==========================================

echo Checking Python 3.11...
py -3.11 --version || (echo Python 3.11 not found & pause & exit /b 1)

if not exist ".venv\Scripts\python.exe" (
  echo Creating venv...
  py -3.11 -m venv .venv || (echo Failed to create venv & pause & exit /b 1)
)

echo Activating venv...
call ".venv\Scripts\activate.bat" || (echo Failed to activate venv & pause & exit /b 1)

echo Installing requirements...
python -m pip install --upgrade pip
python -m pip install -r requirements.txt || (echo pip install failed & pause & exit /b 1)

echo Starting server on http://127.0.0.1:8000
python -m uvicorn backend.server:app --reload --host 127.0.0.1 --port 8000

pause
endlocal
