@echo off
REM ============================================================
REM  Doubao automation instance launcher (independent profile)
REM
REM  Why every path goes through %LOCALAPPDATA%:
REM    1. this file is checked in and must stay pure ASCII;
REM    2. the real install path contains non-ASCII characters.
REM
REM  Why the inner exe and not Application\Doubao.exe:
REM    Application\Doubao.exe is "Doubao Launcher" (2.34.6) and it
REM    SWALLOWS unknown switches - the renderer never sees
REM    --remote-debugging-port. The inner app\Doubao.exe accepts it.
REM
REM  Why a separate --user-data-dir:
REM    the normal profile is locked by the single-instance guard, so
REM    a second process on the same directory starts and then exits.
REM ============================================================
start "" "%LOCALAPPDATA%\Doubao\Application\app\Doubao.exe" --remote-debugging-port=9331 --user-data-dir="%LOCALAPPDATA%\DoubaoAgent\profile"
exit
