@echo off
REM ============================================================
REM  WorkBuddy "debug mode" launcher (CDP attach, real profile)
REM
REM  Unlike Doubao this does NOT use a separate --user-data-dir:
REM  the whole point is to reuse the user's logged-in desktop
REM  session (login state + credits + existing conversations), so
REM  we start the normal app and only add a DevTools port.
REM
REM  The switch is env-var driven, not a CLI flag - the main process
REM  reads WORKBUDDY_REMOTE_DEBUGGING_PORT during startup and calls
REM  app.commandLine.appendSwitch('remote-debugging-port', <port>).
REM  That is why a bare --remote-debugging-port argument is ignored.
REM
REM  Every path goes through %LOCALAPPDATA% because this file is
REM  checked in and must stay pure ASCII (the real path has
REM  non-ASCII characters in it).
REM
REM  Quit WorkBuddy first (tray -> Quit): the single-instance guard
REM  makes a second process exit before it can open a DevTools port.
REM ============================================================
if not defined WORKBUDDY_REMOTE_DEBUGGING_PORT set WORKBUDDY_REMOTE_DEBUGGING_PORT=9333
start "" "%LOCALAPPDATA%\Programs\WorkBuddy\WorkBuddy.exe"
exit
