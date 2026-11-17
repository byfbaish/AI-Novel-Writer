@echo off
powershell -NoProfile -ExecutionPolicy Bypass -File "%~dp0arm-probe.ps1" %*
