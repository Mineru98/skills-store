@echo off
setlocal EnableDelayedExpansion

:: Skills Store Installer for Windows
:: Installs skills, agents, and commands to %USERPROFILE%\.claude

set "SCRIPT_DIR=%~dp0"
set "SOURCE_DIR=%SCRIPT_DIR%.claude"
set "TARGET_DIR=%USERPROFILE%\.claude"

echo ========================================
echo     Skills Store Installer (Windows)
echo ========================================
echo.

:: Check if source .claude directory exists
if not exist "%SOURCE_DIR%" (
    echo [ERROR] .claude directory not found in %SCRIPT_DIR%
    exit /b 1
)

:: Create target directories if they don't exist
echo Creating target directories...
if not exist "%TARGET_DIR%\skills" mkdir "%TARGET_DIR%\skills"
if not exist "%TARGET_DIR%\agents" mkdir "%TARGET_DIR%\agents"
if not exist "%TARGET_DIR%\commands" mkdir "%TARGET_DIR%\commands"

:: Install Skills
echo.
echo Installing Skills...
if exist "%SOURCE_DIR%\skills" (
    for /d %%D in ("%SOURCE_DIR%\skills\*") do (
        set "ITEM_NAME=%%~nxD"
        if exist "%TARGET_DIR%\skills\!ITEM_NAME!" (
            echo   [UPDATE] !ITEM_NAME!
        ) else (
            echo   [NEW] !ITEM_NAME!
        )
        xcopy /E /I /Y /Q "%%D" "%TARGET_DIR%\skills\!ITEM_NAME!" >nul 2>&1
    )
    :: Also copy any files directly in skills folder
    for %%F in ("%SOURCE_DIR%\skills\*.*") do (
        set "ITEM_NAME=%%~nxF"
        if exist "%TARGET_DIR%\skills\!ITEM_NAME!" (
            echo   [UPDATE] !ITEM_NAME!
        ) else (
            echo   [NEW] !ITEM_NAME!
        )
        copy /Y "%%F" "%TARGET_DIR%\skills\" >nul 2>&1
    )
    echo [OK] Skills installed
) else (
    echo [SKIP] No skills found in source
)

:: Install Agents
echo.
echo Installing Agents...
if exist "%SOURCE_DIR%\agents" (
    for /d %%D in ("%SOURCE_DIR%\agents\*") do (
        set "ITEM_NAME=%%~nxD"
        if exist "%TARGET_DIR%\agents\!ITEM_NAME!" (
            echo   [UPDATE] !ITEM_NAME!
        ) else (
            echo   [NEW] !ITEM_NAME!
        )
        xcopy /E /I /Y /Q "%%D" "%TARGET_DIR%\agents\!ITEM_NAME!" >nul 2>&1
    )
    :: Also copy any files directly in agents folder
    for %%F in ("%SOURCE_DIR%\agents\*.*") do (
        set "ITEM_NAME=%%~nxF"
        if exist "%TARGET_DIR%\agents\!ITEM_NAME!" (
            echo   [UPDATE] !ITEM_NAME!
        ) else (
            echo   [NEW] !ITEM_NAME!
        )
        copy /Y "%%F" "%TARGET_DIR%\agents\" >nul 2>&1
    )
    echo [OK] Agents installed
) else (
    echo [SKIP] No agents found in source
)

:: Install Commands
echo.
echo Installing Commands...
if exist "%SOURCE_DIR%\commands" (
    for /d %%D in ("%SOURCE_DIR%\commands\*") do (
        set "ITEM_NAME=%%~nxD"
        if exist "%TARGET_DIR%\commands\!ITEM_NAME!" (
            echo   [UPDATE] !ITEM_NAME!
        ) else (
            echo   [NEW] !ITEM_NAME!
        )
        xcopy /E /I /Y /Q "%%D" "%TARGET_DIR%\commands\!ITEM_NAME!" >nul 2>&1
    )
    :: Also copy any files directly in commands folder
    for %%F in ("%SOURCE_DIR%\commands\*.*") do (
        set "ITEM_NAME=%%~nxF"
        if exist "%TARGET_DIR%\commands\!ITEM_NAME!" (
            echo   [UPDATE] !ITEM_NAME!
        ) else (
            echo   [NEW] !ITEM_NAME!
        )
        copy /Y "%%F" "%TARGET_DIR%\commands\" >nul 2>&1
    )
    echo [OK] Commands installed
) else (
    echo [SKIP] No commands found in source
)

:: Count installed items
set "SKILLS_COUNT=0"
set "AGENTS_COUNT=0"
set "COMMANDS_COUNT=0"

if exist "%TARGET_DIR%\skills" (
    for /d %%D in ("%TARGET_DIR%\skills\*") do set /a SKILLS_COUNT+=1
)
if exist "%TARGET_DIR%\agents" (
    for /d %%D in ("%TARGET_DIR%\agents\*") do set /a AGENTS_COUNT+=1
)
if exist "%TARGET_DIR%\commands" (
    for /d %%D in ("%TARGET_DIR%\commands\*") do set /a COMMANDS_COUNT+=1
    for %%F in ("%TARGET_DIR%\commands\*.*") do set /a COMMANDS_COUNT+=1
)

echo.
echo ========================================
echo     Installation Complete!
echo ========================================
echo.
echo Installed to: %TARGET_DIR%
echo.
echo Installed components:
echo   - Skills:   !SKILLS_COUNT! items
echo   - Agents:   !AGENTS_COUNT! items
echo   - Commands: !COMMANDS_COUNT! items
echo.

endlocal
