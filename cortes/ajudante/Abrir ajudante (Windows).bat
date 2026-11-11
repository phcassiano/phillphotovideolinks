@echo off
title Ajudante do Cortes
cd /d "%~dp0"
where py >nul 2>nul
if %errorlevel%==0 (
  py -3 cortes-ajudante.py
) else (
  python cortes-ajudante.py
)
if errorlevel 1 (
  echo.
  echo Nao encontrei o Python. Instale em https://www.python.org/downloads/
  echo e marque a opcao "Add python.exe to PATH" na instalacao.
  pause
)
