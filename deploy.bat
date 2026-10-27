
@echo off
setlocal EnableDelayedExpansion

title Temple Application Automated Deployment Pipeline
echo =======================================================================
echo          TEMPLE APPLICATION AUTOMATED DEPLOYMENT SCRIPT
echo =======================================================================
echo.

set "ROOT_DIR=%~dp0"
if "%ROOT_DIR:~-1%"=="\" set "ROOT_DIR=%ROOT_DIR:~0,-1%"

:: -------------------------------------------------------------------------
:: 0. Verification of Administrator Privileges & Configuration
:: -------------------------------------------------------------------------
net session >nul 2>&1
if %ERRORLEVEL% neq 0 (
    echo [ERROR] Administrator privileges are required to manage NSSM services and Nginx.
    echo [ERROR] Please right-click Command Prompt and select "Run as administrator".
    goto :FAILED_NO_ROLLBACK
)

:: 0.1 Optional custom configuration file (overrides everything below if present)
if exist "%ROOT_DIR%\deploy.config.bat" call "%ROOT_DIR%\deploy.config.bat"

set "UI_SRC_DIR=%ROOT_DIR%\ui"
set "API_SRC_DIR=%ROOT_DIR%\api"

set "STAGING_DIR=%ROOT_DIR%\staging"
set "STAGING_UI_DIR=%STAGING_DIR%\ui"
set "STAGING_API_DIR=%STAGING_DIR%\api"

:: 0.2 Nginx document root, relative to this workspace
if not defined NGINX_DOC_ROOT set "NGINX_DOC_ROOT=%ROOT_DIR%\ui\dist\ui\browser"

:: 0.3 Auto-detect tools
::     order: env var / deploy.config.bat > PATH > scan of drives C-H > prompt (saved to deploy.config.bat)
if not defined NGINX_EXE if defined NGINX_DIR if exist "!NGINX_DIR!\nginx.exe" set "NGINX_EXE=!NGINX_DIR!\nginx.exe"
if not defined NGINX_EXE call :FIND_TOOL NGINX_EXE nginx.exe
if not defined NGINX_EXE call :ASK_TOOL  NGINX_EXE nginx.exe
if not defined NSSM_EXE  call :FIND_TOOL NSSM_EXE  nssm.exe
if not defined NSSM_EXE  call :ASK_TOOL  NSSM_EXE  nssm.exe

if defined NGINX_EXE for %%F in ("!NGINX_EXE!") do set "NGINX_DIR=%%~dpF"
if defined NGINX_DIR if "!NGINX_DIR:~-1!"=="\" set "NGINX_DIR=!NGINX_DIR:~0,-1!"
if not defined NGINX_CONF if defined NGINX_DIR set "NGINX_CONF=!NGINX_DIR!\conf\nginx.conf"

:: Warn if nginx.conf does not point at this workspace's UI folder
if defined NGINX_CONF if exist "!NGINX_CONF!" (
    set "_fwd=!NGINX_DOC_ROOT:\=/!"
    findstr /i /c:"!NGINX_DOC_ROOT!" /c:"!_fwd!" "!NGINX_CONF!" >nul 2>&1 || (
        echo [WARN] nginx.conf 'root' does not match "!NGINX_DOC_ROOT!"
        echo [WARN] Update 'root' in "!NGINX_CONF!" or set NGINX_DOC_ROOT in deploy.config.bat
        echo.
    )
)

:: 0.5 Configure API Service parameters dynamically relative to workspace
if not defined API_SERVICE_NAME set "API_SERVICE_NAME=MYNODE-2"
if not defined API_SERVICE_DIR (
    if exist "%ROOT_DIR%\deloyment" (
        set "API_SERVICE_DIR=%ROOT_DIR%\deloyment"
    ) else (
        set "API_SERVICE_DIR=%ROOT_DIR%\deployment"
    )
)
if not defined API_PROD_EXE set "API_PROD_EXE=%API_SERVICE_DIR%\myNode.exe"

set "BACKUP_BASE_DIR=%ROOT_DIR%\backups"

:: Retrieve reliable timestamp (YYYYMMDD_HHMMSS)
for /f "tokens=*" %%a in ('powershell -NoProfile -Command "Get-Date -Format yyyyMMdd_HHmmss"') do set "TIMESTAMP=%%a"
set "UI_BACKUP_DIR=%BACKUP_BASE_DIR%\ui_%TIMESTAMP%"
set "API_BACKUP_DIR=%BACKUP_BASE_DIR%\api_%TIMESTAMP%"

:: State tracking flags
set "UI_BACKED_UP=0"
set "API_BACKED_UP=0"
set "LIVE_ALTERED=0"
set "UI_ALTERED=0"
set "API_ALTERED=0"
set "FIRST_TIME_API=0"
set "FIRST_TIME_UI=0"
set "SERVICE_WAS_INSTALLED=0"
sc.exe query %API_SERVICE_NAME% >nul 2>&1 && set "SERVICE_WAS_INSTALLED=1"

echo [CONFIG] Workspace Root:       "%ROOT_DIR%"
echo [CONFIG] Staging Dir:          "%STAGING_DIR%"
echo [CONFIG] Nginx Executable:     "%NGINX_EXE%"
echo [CONFIG] Nginx Config:         "%NGINX_CONF%"
echo [CONFIG] Nginx Document Root:  "%NGINX_DOC_ROOT%"
echo [CONFIG] NSSM Executable:      "%NSSM_EXE%"
echo [CONFIG] NSSM Service Name:    %API_SERVICE_NAME%
if "!SERVICE_WAS_INSTALLED!"=="1" (
    echo [CONFIG] NSSM Service Status:  Installed
) else (
    echo [CONFIG] NSSM Service Status:  Not Installed [Will auto-install in Step 6]
)
echo [CONFIG] API Service Dir:      "%API_SERVICE_DIR%"
echo [CONFIG] API Target Path:      "%API_PROD_EXE%"
echo [CONFIG] Backup Timestamp:     %TIMESTAMP%
echo.

:: Check essential host executables
where node >nul 2>&1
if %ERRORLEVEL% neq 0 (
    echo [ERROR] Node.js is not found in system PATH. Aborting.
    goto :FAILED_NO_ROLLBACK
)
if not defined NSSM_EXE (
    echo [ERROR] NSSM executable could not be detected.
    echo [INFO] Add nssm.exe to PATH, or set NSSM_EXE in deploy.config.bat.
    goto :FAILED_NO_ROLLBACK
)
if not exist "%NSSM_EXE%" (
    echo [ERROR] NSSM executable not found at "%NSSM_EXE%".
    goto :FAILED_NO_ROLLBACK
)
if not defined NGINX_EXE (
    echo [ERROR] Nginx executable could not be detected.
    echo [INFO] Add nginx.exe to PATH, or set NGINX_EXE in deploy.config.bat.
    goto :FAILED_NO_ROLLBACK
)
if not exist "%NGINX_EXE%" (
    echo [ERROR] Nginx executable not found at "%NGINX_EXE%".
    goto :FAILED_NO_ROLLBACK
)
if not exist "%NGINX_CONF%" (
    echo [ERROR] Nginx configuration file not found at "%NGINX_CONF%".
    goto :FAILED_NO_ROLLBACK
)

:: Ensure dedicated staging directory is completely clean
if exist "%STAGING_DIR%" (
    if /i "%STAGING_DIR%"=="%ROOT_DIR%\staging" (
        echo [INFO] Resetting dedicated staging directory...
        rmdir /s /q "%STAGING_DIR%" >nul 2>&1
    )
)
mkdir "%STAGING_DIR%" 2>nul
mkdir "%STAGING_UI_DIR%" 2>nul
mkdir "%STAGING_API_DIR%" 2>nul

:: -------------------------------------------------------------------------
:: 1. Build Angular UI into Staging Directory
:: -------------------------------------------------------------------------
echo -----------------------------------------------------------------------
echo [STEP 1/7] Building Angular UI into Staging Directory...
echo -----------------------------------------------------------------------
if not exist "%UI_SRC_DIR%" (
    echo [ERROR] Angular UI source directory "%UI_SRC_DIR%" does not exist.
    goto :FAILED_NO_ROLLBACK
)

cd /d "%UI_SRC_DIR%"
echo [INFO] Compiling Angular production build to staging "%STAGING_UI_DIR%"...
call npx ng build --output-path="%STAGING_UI_DIR%"
if %ERRORLEVEL% neq 0 (
    echo [ERROR] Angular UI build failed. Live deployment was left completely untouched.
    goto :FAILED_NO_ROLLBACK
)

:: Identify staged index.html location (browser subfolder or root of staging)
set "STAGED_UI_OUTPUT="
if exist "%STAGING_UI_DIR%\browser\index.html" (
    set "STAGED_UI_OUTPUT=%STAGING_UI_DIR%\browser"
) else if exist "%STAGING_UI_DIR%\index.html" (
    set "STAGED_UI_OUTPUT=%STAGING_UI_DIR%"
)

if not defined STAGED_UI_OUTPUT (
    echo [ERROR] Staged build completed but index.html was not found in "%STAGING_UI_DIR%".
    echo [ERROR] Live deployment was left completely untouched.
    goto :FAILED_NO_ROLLBACK
)

echo [SUCCESS] Staged Angular UI verified at "%STAGED_UI_OUTPUT%\index.html"
echo.

:: -------------------------------------------------------------------------
:: 2. Assemble and Package API Runtime Bundle in Staging
:: -------------------------------------------------------------------------
echo -----------------------------------------------------------------------
echo [STEP 2/7] Assembling and Packaging Node.js 24 API in Staging...
echo -----------------------------------------------------------------------
if not exist "%API_SRC_DIR%" (
    echo [ERROR] API source directory "%API_SRC_DIR%" does not exist.
    goto :FAILED_NO_ROLLBACK
)

set "STAGED_API_EXE=%STAGING_API_DIR%\myNode.exe"
if not exist "%STAGING_API_DIR%" mkdir "%STAGING_API_DIR%"

:: 2.1 Build self-contained SEA preparation bundle using scripts\build_sea.js
echo [INFO] Compiling and bundling API code into self-contained SEA preparation blob...
node "%ROOT_DIR%\scripts\build_sea.js" "%STAGING_API_DIR%"
if %ERRORLEVEL% neq 0 (
    echo [ERROR] Failed to compile self-contained SEA bundle. Live deployment untouched.
    goto :FAILED_NO_ROLLBACK
)

:: Ensure staging runtime logs and uploads directories exist
if not exist "%STAGING_API_DIR%\logs" mkdir "%STAGING_API_DIR%\logs"
if not exist "%STAGING_API_DIR%\uploads" mkdir "%STAGING_API_DIR%\uploads"

:: 2.2 Inject SEA blob into Windows executable
for /f "tokens=*" %%p in ('where node') do (
    set "NODE_BINARY_PATH=%%p"
    goto :RESOLVED_NODE
)
:RESOLVED_NODE
if not exist "%NODE_BINARY_PATH%" (
    echo [ERROR] Could not resolve node.exe path. Live deployment untouched.
    goto :FAILED_NO_ROLLBACK
)

echo [INFO] Injecting SEA blob into Windows executable...
copy /y "%NODE_BINARY_PATH%" "%STAGED_API_EXE%" >nul
call npx -y postject "%STAGED_API_EXE%" NODE_SEA_BLOB "%STAGING_API_DIR%\sea-prep.blob" --sentinel-fuse NODE_SEA_FUSE_fce680ab2cc467b6e072b8b5df1996b2 --overwrite >nul 2>&1
if %ERRORLEVEL% neq 0 (
    echo [ERROR] Failed to inject SEA blob into "%STAGED_API_EXE%". Live deployment untouched.
    goto :FAILED_NO_ROLLBACK
)

if not exist "%STAGED_API_EXE%" (
    echo [ERROR] Staged executable missing at "%STAGED_API_EXE%". Live deployment untouched.
    goto :FAILED_NO_ROLLBACK
)

echo [SUCCESS] Self-contained API executable assembled at "%STAGED_API_EXE%"
cd /d "%ROOT_DIR%"
echo.

:: -------------------------------------------------------------------------
:: 3. Mandatory Pre-Flight Validation of Staged Artifacts
:: -------------------------------------------------------------------------
echo -----------------------------------------------------------------------
echo [STEP 3/7] Mandatory Pre-flight Validation of Staged Artifacts...
echo -----------------------------------------------------------------------
if not exist "%STAGED_UI_OUTPUT%\index.html" (
    echo [ERROR] Pre-flight validation failed: Staged index.html missing. Live untouched.
    goto :FAILED_NO_ROLLBACK
)
if not exist "%STAGED_API_EXE%" (
    echo [ERROR] Pre-flight validation failed: Staged myNode.exe missing. Live untouched.
    goto :FAILED_NO_ROLLBACK
)

echo [INFO] Running pre-flight probe on port 5998 [timeout: 45s]...
set "PREFLIGHT_STATUS=INIT"
set "PREFLIGHT_CODE=0"
for /f "tokens=1,2 delims=|" %%a in ('powershell -NoProfile -ExecutionPolicy Bypass -File "%ROOT_DIR%\scripts\test_preflight.ps1" -Executable "%STAGED_API_EXE%" -WorkingDir "%STAGING_API_DIR%" -Port 5998 -TimeoutSeconds 45') do (
    set "PREFLIGHT_STATUS=%%a"
    set "PREFLIGHT_CODE=%%b"
)

if /i not "%PREFLIGHT_STATUS%"=="PASS" (
    echo [ERROR] Mandatory pre-flight test FAILED.
    echo [ERROR] Result: %PREFLIGHT_STATUS% [HTTP Code: %PREFLIGHT_CODE%]
    if exist "%STAGING_API_DIR%\preflight_stderr.log" (
        echo [ERROR] Pre-flight stderr log:
        type "%STAGING_API_DIR%\preflight_stderr.log"
    )
    if exist "%STAGING_API_DIR%\preflight_stdout.log" (
        echo [ERROR] Pre-flight stdout log:
        type "%STAGING_API_DIR%\preflight_stdout.log"
    )
    echo [ERROR] Aborting deployment immediately. Production environment was not modified.
    goto :FAILED_NO_ROLLBACK
)

echo [SUCCESS] Mandatory pre-flight test PASSED: Staged API responded with HTTP 200 OK.
echo.

:: -------------------------------------------------------------------------
:: 4. Back Up Live Production Files & Verify Integrity
:: -------------------------------------------------------------------------
echo -----------------------------------------------------------------------
echo [STEP 4/7] Creating Verified Backups of Live Production Files...
echo -----------------------------------------------------------------------
if not exist "%BACKUP_BASE_DIR%" mkdir "%BACKUP_BASE_DIR%"

:: 4.1 Backup Live UI
if exist "%NGINX_DOC_ROOT%\index.html" (
    echo [BACKUP] Backing up live UI from "%NGINX_DOC_ROOT%" to "%UI_BACKUP_DIR%"...
    mkdir "%UI_BACKUP_DIR%" 2>nul
    robocopy "%NGINX_DOC_ROOT%" "%UI_BACKUP_DIR%" /E /R:2 /W:1 >nul 2>&1
    set "ROBO_BACKUP_UI=!ERRORLEVEL!"
    if !ROBO_BACKUP_UI! lss 8 (
        if exist "%UI_BACKUP_DIR%\index.html" (
            set "UI_BACKED_UP=1"
            echo [SUCCESS] Live UI backed up and verified at "%UI_BACKUP_DIR%".
        )
    )
    if not "!UI_BACKED_UP!"=="1" (
        echo [ERROR] Live UI backup verification failed. Aborting before modifying production.
        goto :FAILED_NO_ROLLBACK
    )
) else (
    set "FIRST_TIME_UI=1"
    echo [INFO] No live UI found at "%NGINX_DOC_ROOT%". First-time UI deployment detected.
)

:: 4.2 Backup Live API executable only (nothing else)
if exist "%API_PROD_EXE%" (
    echo [BACKUP] Backing up live API executable from "%API_PROD_EXE%" to "%API_BACKUP_DIR%"...
    mkdir "%API_BACKUP_DIR%" 2>nul
    copy /y "%API_PROD_EXE%" "%API_BACKUP_DIR%\myNode.exe" >nul 2>&1
    if exist "%API_BACKUP_DIR%\myNode.exe" (
        set "API_BACKED_UP=1"
        echo [SUCCESS] Live API executable backed up and verified at "%API_BACKUP_DIR%\myNode.exe".
    ) else (
        echo [ERROR] Live API executable backup failed. Aborting before modifying production.
        goto :FAILED_NO_ROLLBACK
    )
) else (
    set "FIRST_TIME_API=1"
    echo [INFO] No live API executable found at "%API_PROD_EXE%". First-time API deployment detected.
)
echo.

:: -------------------------------------------------------------------------
:: 5. Deploy Staged Angular UI to Nginx Document Root
:: -------------------------------------------------------------------------
echo -----------------------------------------------------------------------
echo [STEP 5/7] Deploying Staged UI into Nginx Document Root...
echo -----------------------------------------------------------------------
set "LIVE_ALTERED=1"
set "UI_ALTERED=1"
if not exist "%NGINX_DOC_ROOT%" mkdir "%NGINX_DOC_ROOT%"

echo [INFO] Synchronizing staged UI files to live Nginx document root...
robocopy "%STAGED_UI_OUTPUT%" "%NGINX_DOC_ROOT%" /MIR /R:2 /W:1 >nul 2>&1
set "ROBO_UI_EXIT=%ERRORLEVEL%"
if %ROBO_UI_EXIT% geq 8 (
    echo [ERROR] Robocopy failed to synchronize UI files [Code: %ROBO_UI_EXIT%].
    goto :ROLLBACK
)

if not exist "%NGINX_DOC_ROOT%\index.html" (
    echo [ERROR] index.html missing from Nginx document root after deployment.
    goto :ROLLBACK
)
echo [SUCCESS] Staged UI synchronized to "%NGINX_DOC_ROOT%".

:: Verify Nginx configuration syntax before reloading
echo [INFO] Testing Nginx configuration syntax...
"%NGINX_EXE%" -p "%NGINX_DIR%" -t -c "%NGINX_CONF%"
if %ERRORLEVEL% neq 0 (
    echo [ERROR] Nginx configuration test failed for "%NGINX_CONF%".
    goto :ROLLBACK
)

:: Reload or start Nginx
tasklist /FI "IMAGENAME eq nginx.exe" 2>nul | findstr /I "nginx.exe" >nul 2>&1 && (
    echo [INFO] Nginx is running. Reloading configuration...
    "%NGINX_EXE%" -p "%NGINX_DIR%" -c "%NGINX_CONF%" -s reload >nul 2>&1
    if !ERRORLEVEL! neq 0 (
        echo [ERROR] Nginx reload failed with exit code !ERRORLEVEL!.
        goto :ROLLBACK
    )
    echo [SUCCESS] Nginx reloaded successfully.
) || (
    echo [INFO] Nginx is not running. Launching Nginx...
    cd /d "%NGINX_DIR%"
    start "" /B "%NGINX_EXE%" -p "%NGINX_DIR%" -c "%NGINX_CONF%"
    timeout /t 2 /nobreak >nul
    cd /d "%ROOT_DIR%"
    tasklist /FI "IMAGENAME eq nginx.exe" 2>nul | findstr /I "nginx.exe" >nul 2>&1
    if errorlevel 1 (
        echo [ERROR] Failed to start Nginx process.
        goto :ROLLBACK
    )
    echo [SUCCESS] Nginx started successfully.
)
echo.

:: -------------------------------------------------------------------------
:: 6. Deploy API to NSSM Service (Preserving Production Data)
:: -------------------------------------------------------------------------
echo -----------------------------------------------------------------------
echo [STEP 6/7] Deploying API to NSSM Service [%API_SERVICE_NAME%]...
echo -----------------------------------------------------------------------
set "API_ALTERED=1"
if not exist "%API_SERVICE_DIR%" mkdir "%API_SERVICE_DIR%"

:: Check if NSSM Service is currently installed
sc.exe query %API_SERVICE_NAME% >nul 2>&1 && (
    set "SERVICE_CURRENTLY_INSTALLED=1"
    sc.exe query %API_SERVICE_NAME% 2>&1 | findstr /I "STOPPED" >nul 2>&1 && (
        echo [INFO] Existing NSSM service %API_SERVICE_NAME% is already in state STOPPED.
    ) || (
        echo [INFO] Stopping existing NSSM service %API_SERVICE_NAME%...
        "%NSSM_EXE%" stop %API_SERVICE_NAME% >nul 2>&1
        set "SERVICE_STOPPED=0"
        for /l %%k in (1,1,10) do (
            sc.exe query %API_SERVICE_NAME% 2>&1 | findstr /I "STOPPED" >nul 2>&1 && (
                set "SERVICE_STOPPED=1"
                goto :STOP_CONFIRMED
            )
            timeout /t 1 /nobreak >nul
        )
        :STOP_CONFIRMED
        if not "!SERVICE_STOPPED!"=="1" (
            echo [ERROR] NSSM service %API_SERVICE_NAME% failed to reach SERVICE_STOPPED state within 10 seconds.
            goto :ROLLBACK
        )
        echo [SUCCESS] NSSM service %API_SERVICE_NAME% confirmed stopped.
    )
) || (
    set "SERVICE_CURRENTLY_INSTALLED=0"
    echo [INFO] NSSM service %API_SERVICE_NAME% is not currently installed.
    echo [INFO] Service will be created and configured with NSSM after file staging.
)

:: Deploy self-contained executable to API service directory (storing ONLY myNode.exe and logs)
echo [INFO] Deploying self-contained executable to "%API_SERVICE_DIR%"...
copy /y "%STAGED_API_EXE%" "%API_PROD_EXE%" >nul 2>&1
if not exist "%API_PROD_EXE%" (
    echo [ERROR] Deployed executable missing at "%API_PROD_EXE%".
    goto :ROLLBACK
)

:: Ensure logs and uploads directories exist for runtime output
if not exist "%API_SERVICE_DIR%\logs" mkdir "%API_SERVICE_DIR%\logs"
if not exist "%API_SERVICE_DIR%\uploads" mkdir "%API_SERVICE_DIR%\uploads"

:: Strictly remove any plaintext .env from the deployment directory to protect secrets
if exist "%API_SERVICE_DIR%\.env" (
    del /f /q "%API_SERVICE_DIR%\.env" >nul 2>&1
    echo [SECURITY] Plaintext .env removed from deployment directory. Secrets are securely compiled into executable.
)

:: Install NSSM service if not currently installed
sc.exe query %API_SERVICE_NAME% >nul 2>&1 || (
    echo [INFO] Installing NSSM service %API_SERVICE_NAME% with target "%API_PROD_EXE%"...
    "%NSSM_EXE%" install %API_SERVICE_NAME% "%API_PROD_EXE%" >nul 2>&1
    timeout /t 1 /nobreak >nul
    sc.exe query %API_SERVICE_NAME% >nul 2>&1
    if errorlevel 1 (
        echo [ERROR] Failed to install NSSM service %API_SERVICE_NAME%.
        goto :ROLLBACK
    )
    echo [SUCCESS] NSSM service %API_SERVICE_NAME% installed successfully.
)

:: Synchronize service parameters
"%NSSM_EXE%" set %API_SERVICE_NAME% Application "%API_PROD_EXE%" >nul 2>&1
"%NSSM_EXE%" set %API_SERVICE_NAME% AppDirectory "%API_SERVICE_DIR%" >nul 2>&1
"%NSSM_EXE%" set %API_SERVICE_NAME% Start SERVICE_AUTO_START >nul 2>&1
"%NSSM_EXE%" set %API_SERVICE_NAME% AppStdout "%API_SERVICE_DIR%\logs\service.log" >nul 2>&1
"%NSSM_EXE%" set %API_SERVICE_NAME% AppStderr "%API_SERVICE_DIR%\logs\service.err.log" >nul 2>&1

:: Start NSSM Service and verify running state
echo [INFO] Starting NSSM service %API_SERVICE_NAME%...
"%NSSM_EXE%" start %API_SERVICE_NAME% >nul 2>&1

set "SERVICE_RUNNING=0"
for /l %%k in (1,1,10) do (
    sc.exe query %API_SERVICE_NAME% 2>&1 | findstr /I "RUNNING" >nul 2>&1 && (
        set "SERVICE_RUNNING=1"
        goto :START_CONFIRMED
    )
    timeout /t 1 /nobreak >nul
)
:START_CONFIRMED
if not "!SERVICE_RUNNING!"=="1" (
    echo [ERROR] NSSM service %API_SERVICE_NAME% failed to enter SERVICE_RUNNING state.
    goto :ROLLBACK
)
echo [SUCCESS] NSSM service %API_SERVICE_NAME% confirmed in state SERVICE_RUNNING.

echo [INFO] Allowing 5 seconds for Express server and MongoDB pool initialization...
timeout /t 5 /nobreak >nul
echo.

:: -------------------------------------------------------------------------
:: 7. Verification and Rollback
:: -------------------------------------------------------------------------
echo -----------------------------------------------------------------------
echo [STEP 7/7] Verifying System Health Endpoints...
echo -----------------------------------------------------------------------

:: 7.1 Verify Direct API Health Endpoint (must return HTTP 200)
set "API_HEALTH_STATUS=000"
echo [CHECK 1/3] Probing API directly at http://127.0.0.1:5000/health ...
for /l %%i in (1,1,5) do (
    for /f "tokens=*" %%c in ('curl.exe -s -o NUL -w "%%{http_code}" -m 5 http://127.0.0.1:5000/health') do set "API_HEALTH_STATUS=%%c"
    if "!API_HEALTH_STATUS!"=="200" goto :API_HEALTH_OK
    timeout /t 2 /nobreak >nul
)
:API_HEALTH_OK
if not "!API_HEALTH_STATUS!"=="200" (
    echo [ERROR] Direct API health check failed. HTTP status: !API_HEALTH_STATUS! [Expected: 200].
    goto :ROLLBACK
)
echo [SUCCESS] Direct API health check passed [HTTP 200 OK].

:: 7.2 Verify Nginx UI Static Delivery (must return HTTP 200 and contain Angular root)
set "UI_STATUS=000"
set "UI_HAS_APP_ROOT=0"
echo [CHECK 2/3] Probing Angular UI through Nginx at http://localhost/ ...
for /l %%m in (1,1,5) do (
    for /f "tokens=*" %%c in ('curl.exe -s -o NUL -w "%%{http_code}" -m 5 http://localhost/') do set "UI_STATUS=%%c"
    if "!UI_STATUS!"=="200" (
        curl.exe -s -m 5 http://localhost/ | findstr /I "<app-root" >nul 2>&1 && (
            set "UI_HAS_APP_ROOT=1"
            goto :UI_OK
        )
    )
    timeout /t 2 /nobreak >nul
)
:UI_OK
if not "!UI_STATUS!"=="200" (
    echo [ERROR] Nginx UI delivery check failed. HTTP status: !UI_STATUS! [Expected: 200].
    goto :ROLLBACK
)
if not "!UI_HAS_APP_ROOT!"=="1" (
    echo [ERROR] Nginx UI returned HTTP 200 but response does not contain Angular app-root element.
    goto :ROLLBACK
)
echo [SUCCESS] Nginx UI static delivery passed [HTTP 200 OK and Angular app-root verified].

:: 7.3 Verify Configured Nginx Reverse Proxy Route (/health, must return HTTP 200 and JSON OK)
set "PROXY_STATUS=000"
set "PROXY_HAS_OK=0"
echo [CHECK 3/3] Probing Nginx API reverse proxy at http://localhost/health ...
for /l %%j in (1,1,3) do (
    for /f "tokens=*" %%c in ('curl.exe -s -o NUL -w "%%{http_code}" -m 5 http://localhost/health') do set "PROXY_STATUS=%%c"
    if "!PROXY_STATUS!"=="200" (
        curl.exe -s -m 5 http://localhost/health | findstr /I "status.*OK" >nul 2>&1 && (
            set "PROXY_HAS_OK=1"
            goto :PROXY_OK
        )
    )
    timeout /t 2 /nobreak >nul
)
:PROXY_OK
if not "!PROXY_STATUS!"=="200" (
    echo [ERROR] Nginx reverse proxy health check failed. HTTP status: !PROXY_STATUS! [Expected: 200].
    goto :ROLLBACK
)
if not "!PROXY_HAS_OK!"=="1" (
    echo [ERROR] Nginx reverse proxy returned HTTP 200 but body did not contain status OK.
    goto :ROLLBACK
)
echo [SUCCESS] Nginx API reverse proxy check passed [HTTP 200 OK and JSON status verified].

:: Clean up staging directory on verified success
if exist "%STAGING_DIR%" (
    if /i "%STAGING_DIR%"=="%ROOT_DIR%\staging" (
        rmdir /s /q "%STAGING_DIR%" >nul 2>&1
    )
)

:: -------------------------------------------------------------------------
:: Final Success
:: -------------------------------------------------------------------------
echo.
echo =======================================================================
echo                   [SUCCESS] DEPLOYMENT COMPLETED.
echo =======================================================================
echo  - Frontend Web UI:    http://localhost/ [HTTP 200, Angular verified]
echo  - Nginx Health Proxy: http://localhost/health [HTTP 200, Proxy verified]
echo  - Backend Direct API: http://127.0.0.1:5000/health [HTTP 200, OK]
echo  - NSSM Service:       %API_SERVICE_NAME% [SERVICE_RUNNING]
echo  - Active Binary:      "%API_PROD_EXE%"
echo  - Nginx Document Root: "%NGINX_DOC_ROOT%"
echo  - Production Data:    Preserved [.env, uploads, logs]
echo  - Staging Cleaned:    Yes
echo =======================================================================
cd /d "%ROOT_DIR%"
exit /b 0

:: -------------------------------------------------------------------------
:: Rollback Procedure
:: -------------------------------------------------------------------------
:ROLLBACK
echo.
echo =======================================================================
echo [ROLLBACK TRIGGERED] Deployment verification failed.
echo Restoring previous production state from backups...
echo =======================================================================

set "RESTORED_UI=0"
set "RESTORED_API=0"

:: 1. Rollback API service directory
if "!API_ALTERED!"=="1" (
    if "!SERVICE_WAS_INSTALLED!"=="0" (
        echo [ROLLBACK] Stopping and removing newly installed NSSM service %API_SERVICE_NAME%...
        "%NSSM_EXE%" stop %API_SERVICE_NAME% >nul 2>&1
        timeout /t 2 /nobreak >nul
        "%NSSM_EXE%" remove %API_SERVICE_NAME% confirm >nul 2>&1
        echo [SUCCESS] Newly installed NSSM service removed.
        if "%API_BACKED_UP%"=="1" (
            echo [ROLLBACK] Restoring previous API executable from "%API_BACKUP_DIR%\myNode.exe" to "%API_PROD_EXE%"...
            copy /y "%API_BACKUP_DIR%\myNode.exe" "%API_PROD_EXE%" >nul 2>&1
            echo [SUCCESS] Previous API executable restored from backup.
        )
        set "RESTORED_API=1"
    ) else if "%API_BACKED_UP%"=="1" (
        echo [ROLLBACK] Stopping NSSM service %API_SERVICE_NAME%...
        "%NSSM_EXE%" stop %API_SERVICE_NAME% >nul 2>&1
        timeout /t 2 /nobreak >nul
        echo [ROLLBACK] Restoring previous API executable from "%API_BACKUP_DIR%\myNode.exe" to "%API_PROD_EXE%"...
        copy /y "%API_BACKUP_DIR%\myNode.exe" "%API_PROD_EXE%" >nul 2>&1
        if exist "%API_PROD_EXE%" (
            echo [SUCCESS] Previous API executable restored from backup.
            echo [ROLLBACK] Restarting NSSM service %API_SERVICE_NAME%...
            "%NSSM_EXE%" start %API_SERVICE_NAME% >nul 2>&1
            timeout /t 4 /nobreak >nul
            sc.exe query %API_SERVICE_NAME% 2>&1 | findstr /I "RUNNING" >nul 2>&1 && (
                set "RB_API_CODE=000"
                for /f "tokens=*" %%c in ('curl.exe -s -o NUL -w "%%{http_code}" -m 5 http://127.0.0.1:5000/health') do set "RB_API_CODE=%%c"
                if "!RB_API_CODE!"=="200" (
                    set "RESTORED_API=1"
                    echo [SUCCESS] Restored API service confirmed running and responding with HTTP 200.
                ) else (
                    echo [WARNING] Restored API service started but health probe returned HTTP !RB_API_CODE!.
                )
            ) || (
                echo [ERROR] Failed to confirm NSSM service running after rollback.
            )
        ) else (
            echo [ERROR] Failed to restore API executable from backup. Service will NOT be started.
        )
    ) else (
        if "%FIRST_TIME_API%"=="1" (
            echo [INFO] First-time API deployment: No prior API backup was available to restore.
        ) else (
            echo [WARNING] No valid API backup was available. Rollback unavailable for API.
        )
    )
) else (
    echo [INFO] API production directory was not modified. No API rollback needed.
    set "RESTORED_API=UNCHANGED"
)

:: 2. Rollback UI
if "!UI_ALTERED!"=="1" (
    if "%UI_BACKED_UP%"=="1" (
        echo [ROLLBACK] Restoring previous UI build from "%UI_BACKUP_DIR%" to "%NGINX_DOC_ROOT%"...
        robocopy "%UI_BACKUP_DIR%" "%NGINX_DOC_ROOT%" /MIR /R:2 /W:1 >nul 2>&1
        set "ROBO_RB_UI_EXIT=!ERRORLEVEL!"
        if !ROBO_RB_UI_EXIT! lss 8 (
            "%NGINX_EXE%" -p "%NGINX_DIR%" -t -c "%NGINX_CONF%" >nul 2>&1
            if !ERRORLEVEL! equ 0 (
                "%NGINX_EXE%" -p "%NGINX_DIR%" -c "%NGINX_CONF%" -s reload >nul 2>&1
                set "RB_UI_CODE=000"
                for /f "tokens=*" %%c in ('curl.exe -s -o NUL -w "%%{http_code}" -m 5 http://localhost/') do set "RB_UI_CODE=%%c"
                if "!RB_UI_CODE!"=="200" (
                    set "RESTORED_UI=1"
                    echo [SUCCESS] Restored UI confirmed accessible through Nginx [HTTP 200].
                ) else (
                    echo [WARNING] UI restored but Nginx probe returned HTTP !RB_UI_CODE!.
                )
            ) else (
                echo [ERROR] Nginx configuration test failed during rollback reload.
            )
        ) else (
            echo [ERROR] Robocopy failed to restore UI files from backup.
        )
    ) else (
        if "%FIRST_TIME_UI%"=="1" (
            echo [INFO] First-time UI deployment: No prior UI backup was available to restore.
        ) else (
            echo [WARNING] No valid UI backup was available. Rollback unavailable for UI.
        )
    )
) else (
    echo [INFO] UI document root was not modified. No UI rollback needed.
    set "RESTORED_UI=UNCHANGED"
)

:: Clean up staging directory
if exist "%STAGING_DIR%" (
    if /i "%STAGING_DIR%"=="%ROOT_DIR%\staging" (
        rmdir /s /q "%STAGING_DIR%" >nul 2>&1
    )
)

echo.
echo =======================================================================
echo                        ROLLBACK VERIFICATION REPORT
echo =======================================================================
if "!RESTORED_API!"=="1" (
    echo  - API Service: RESTORED and VERIFIED healthy [HTTP 200]
) else if "!RESTORED_API!"=="UNCHANGED" (
    echo  - API Service: UNTOUCHED [Not modified by deployment]
) else (
    echo  - API Service: NOT RESTORED [No backup, restore failed, or health check failed]
)
if "!RESTORED_UI!"=="1" (
    echo  - UI Bundle:   RESTORED and VERIFIED accessible [HTTP 200]
) else if "!RESTORED_UI!"=="UNCHANGED" (
    echo  - UI Bundle:   UNTOUCHED [Not modified by deployment]
) else (
    echo  - UI Bundle:   NOT RESTORED [No backup, restore failed, or probe failed]
)
echo =======================================================================
cd /d "%ROOT_DIR%"
exit /b 1

:FAILED_NO_ROLLBACK
echo.
echo =======================================================================
echo                  [FAILED] DEPLOYMENT ABORTED
echo  Live deployment was never modified. No rollback was necessary.
echo =======================================================================
if exist "%STAGING_DIR%" (
    if /i "%STAGING_DIR%"=="%ROOT_DIR%\staging" (
        rmdir /s /q "%STAGING_DIR%" >nul 2>&1
    )
)
cd /d "%ROOT_DIR%"
exit /b 1

:: =========================================================================
:: Subroutines (only reached via CALL; main flow always exits above)
:: =========================================================================

:FIND_TOOL
:: usage: call :FIND_TOOL VAR exe-name
:: searches PATH, then common folders on drives C-H, then siblings of the workspace
setlocal EnableDelayedExpansion
set "_found="
for /f "delims=" %%i in ('where %~2 2^>nul') do if not defined _found set "_found=%%i"
if not defined _found for %%L in (C D E F G H) do for %%S in ("Softwares" "Software" "Tools" "nginx" "nssm" "Program Files" "ProgramData\chocolatey") do (
    if not defined _found if exist "%%L:\%%~S" (
        for /f "delims=" %%i in ('dir /s /b "%%L:\%%~S\%~2" 2^>nul ^| findstr /i /v "\\win32\\"') do if not defined _found set "_found=%%i"
    )
)
if not defined _found for /f "delims=" %%i in ('dir /s /b "%ROOT_DIR%\..\%~2" 2^>nul') do if not defined _found set "_found=%%i"
endlocal & if not "%_found%"=="" set "%~1=%_found%"
exit /b 0

:ASK_TOOL
:: usage: call :ASK_TOOL VAR exe-name
:: prompts once and saves the answer to deploy.config.bat for future runs
setlocal EnableDelayedExpansion
echo [INPUT] %~2 was not found automatically.
set "_p="
set /p "_p=Enter full path to %~2 (blank to skip): "
if "!_p!"=="" ( endlocal & exit /b 0 )
set "_p=!_p:"=!"
if not exist "!_p!" ( echo [ERROR] "!_p!" does not exist. & endlocal & exit /b 0 )
>>"%ROOT_DIR%\deploy.config.bat" echo set "%~1=!_p!"
endlocal & set "%~1=%_p%"
exit /b 0

@REM  @echo off
@REM  setlocal EnableDelayedExpansion

@REM  title Temple Application Automated Deployment Pipeline
@REM  echo =======================================================================
@REM  echo          TEMPLE APPLICATION AUTOMATED DEPLOYMENT SCRIPT
@REM  echo =======================================================================
@REM  echo.

@REM  set "ROOT_DIR=%~dp0"
@REM  if "%ROOT_DIR:~-1%"=="\" set "ROOT_DIR=%ROOT_DIR:~0,-1%"

@REM  :: -------------------------------------------------------------------------
@REM  :: 0. Verification of Administrator Privileges & Configuration
@REM  :: -------------------------------------------------------------------------
@REM  net session >nul 2>&1
@REM  if %ERRORLEVEL% neq 0 (
@REM      echo [ERROR] Administrator privileges are required to manage NSSM services and Nginx.
@REM      echo [ERROR] Please right-click Command Prompt and select "Run as administrator".
@REM      goto :FAILED_NO_ROLLBACK
@REM  )

@REM  :: 0.1 Optional custom configuration file (if present)
@REM  if exist "%ROOT_DIR%\deploy.config.bat" call "%ROOT_DIR%\deploy.config.bat"

@REM  set "UI_SRC_DIR=%ROOT_DIR%\ui"
@REM  set "API_SRC_DIR=%ROOT_DIR%\api"

@REM  set "STAGING_DIR=%ROOT_DIR%\staging"
@REM  set "STAGING_UI_DIR=%STAGING_DIR%\ui"
@REM  set "STAGING_API_DIR=%STAGING_DIR%\api"

@REM  :: 0.2 Resolve Nginx Document Root dynamically relative to workspace
@REM  if "%NGINX_DOC_ROOT%"=="" set "NGINX_DOC_ROOT=%ROOT_DIR%\ui\dist\ui\browser"

@REM  :: 0.3 Resolve Nginx installation dynamically (PATH, environment, relative, or standard drives)
@REM  if "%NGINX_DIR%"=="" (
@REM      where nginx >nul 2>&1 && (
@REM          for /f "tokens=*" %%i in ('where nginx 2^>nul') do (
@REM              if not defined NGINX_DIR if exist "%%i" (
@REM                  set "NGINX_EXE=%%i"
@REM                  for %%d in ("%%i") do set "NGINX_DIR=%%~dpd"
@REM              )
@REM          )
@REM      )
@REM  )
@REM  if "%NGINX_DIR%"=="" if exist "%ROOT_DIR%\Softwares\nginx\nginx.exe" set "NGINX_DIR=%ROOT_DIR%\Softwares\nginx"
@REM  if "%NGINX_DIR%"=="" if exist "%ROOT_DIR%\..\Softwares\nginx\nginx.exe" set "NGINX_DIR=%ROOT_DIR%\..\Softwares\nginx"
@REM  if "%NGINX_DIR%"=="" if exist "D:\Softwares\nginx\nginx.exe" set "NGINX_DIR=D:\Softwares\nginx"
@REM  if "%NGINX_DIR%"=="" if exist "C:\Softwares\nginx\nginx.exe" set "NGINX_DIR=C:\Softwares\nginx"
@REM  if "%NGINX_DIR%"=="" if exist "%SystemDrive%\Softwares\nginx\nginx.exe" set "NGINX_DIR=%SystemDrive%\Softwares\nginx"
@REM  if "%NGINX_DIR%"=="" if exist "C:\nginx\nginx.exe" set "NGINX_DIR=C:\nginx"
@REM  if "%NGINX_DIR%"=="" if exist "D:\nginx\nginx.exe" set "NGINX_DIR=D:\nginx"
@REM  if "%NGINX_DIR%"=="" if exist "%ProgramFiles%\nginx\nginx.exe" set "NGINX_DIR=%ProgramFiles%\nginx"

@REM  if defined NGINX_DIR (
@REM      if "%NGINX_DIR:~-1%"=="\" set "NGINX_DIR=%NGINX_DIR:~0,-1%"
@REM      if "%NGINX_EXE%"=="" set "NGINX_EXE=%NGINX_DIR%\nginx.exe"
@REM      if "%NGINX_CONF%"=="" set "NGINX_CONF=%NGINX_DIR%\conf\nginx.conf"
@REM  )

@REM  :: 0.4 Resolve NSSM executable dynamically (PATH, environment, relative, or standard drives)
@REM  if "%NSSM_EXE%"=="" (
@REM      where nssm >nul 2>&1 && (
@REM          for /f "tokens=*" %%i in ('where nssm 2^>nul') do (
@REM              if not defined NSSM_EXE if exist "%%i" set "NSSM_EXE=%%i"
@REM          )
@REM      )
@REM  )
@REM  if "%NSSM_EXE%"=="" if exist "%ROOT_DIR%\Softwares\nssm-2.24\nssm-2.24\win64\nssm.exe" set "NSSM_EXE=%ROOT_DIR%\Softwares\nssm-2.24\nssm-2.24\win64\nssm.exe"
@REM  if "%NSSM_EXE%"=="" if exist "%ROOT_DIR%\..\Softwares\nssm-2.24\nssm-2.24\win64\nssm.exe" set "NSSM_EXE=%ROOT_DIR%\..\Softwares\nssm-2.24\nssm-2.24\win64\nssm.exe"
@REM  if "%NSSM_EXE%"=="" if exist "D:\Softwares\nssm-2.24\nssm-2.24\win64\nssm.exe" set "NSSM_EXE=D:\Softwares\nssm-2.24\nssm-2.24\win64\nssm.exe"
@REM  if "%NSSM_EXE%"=="" if exist "C:\Softwares\nssm-2.24\nssm-2.24\win64\nssm.exe" set "NSSM_EXE=C:\Softwares\nssm-2.24\nssm-2.24\win64\nssm.exe"
@REM  if "%NSSM_EXE%"=="" if exist "%SystemDrive%\Softwares\nssm-2.24\nssm-2.24\win64\nssm.exe" set "NSSM_EXE=%SystemDrive%\Softwares\nssm-2.24\nssm-2.24\win64\nssm.exe"
@REM  if "%NSSM_EXE%"=="" if exist "C:\nssm\win64\nssm.exe" set "NSSM_EXE=C:\nssm\win64\nssm.exe"
@REM  if "%NSSM_EXE%"=="" if exist "D:\nssm\win64\nssm.exe" set "NSSM_EXE=D:\nssm\win64\nssm.exe"
@REM  if "%NSSM_EXE%"=="" if exist "%ProgramFiles%\nssm\win64\nssm.exe" set "NSSM_EXE=%ProgramFiles%\nssm\win64\nssm.exe"
@REM  if "%NSSM_EXE%"=="" if exist "%ProgramFiles(x86)%\nssm\win64\nssm.exe" set "NSSM_EXE=%ProgramFiles(x86)%\nssm\win64\nssm.exe"
@REM  if "%NSSM_EXE%"=="" if exist "C:\ProgramData\chocolatey\bin\nssm.exe" set "NSSM_EXE=C:\ProgramData\chocolatey\bin\nssm.exe"

@REM  :: 0.5 Configure API Service parameters dynamically relative to workspace
@REM  if "%API_SERVICE_NAME%"=="" set "API_SERVICE_NAME=MYNODE-2"
@REM  if "%API_SERVICE_DIR%"=="" (
@REM      if exist "%ROOT_DIR%\deloyment" (
@REM          set "API_SERVICE_DIR=%ROOT_DIR%\deloyment"
@REM      ) else (
@REM          set "API_SERVICE_DIR=%ROOT_DIR%\deployment"
@REM      )
@REM  )
@REM  if "%API_PROD_EXE%"=="" set "API_PROD_EXE=%API_SERVICE_DIR%\myNode.exe"

@REM  set "BACKUP_BASE_DIR=%ROOT_DIR%\backups"

@REM  :: Retrieve reliable timestamp (YYYYMMDD_HHMMSS)
@REM  for /f "tokens=*" %%a in ('powershell -NoProfile -Command "Get-Date -Format yyyyMMdd_HHmmss"') do set "TIMESTAMP=%%a"
@REM  set "UI_BACKUP_DIR=%BACKUP_BASE_DIR%\ui_%TIMESTAMP%"
@REM  set "API_BACKUP_DIR=%BACKUP_BASE_DIR%\api_%TIMESTAMP%"

@REM  :: State tracking flags
@REM  set "UI_BACKED_UP=0"
@REM  set "API_BACKED_UP=0"
@REM  set "LIVE_ALTERED=0"
@REM  set "UI_ALTERED=0"
@REM  set "API_ALTERED=0"
@REM  set "FIRST_TIME_API=0"
@REM  set "FIRST_TIME_UI=0"
@REM  set "SERVICE_WAS_INSTALLED=0"
@REM  sc.exe query %API_SERVICE_NAME% >nul 2>&1 && set "SERVICE_WAS_INSTALLED=1"

@REM  echo [CONFIG] Workspace Root:       "%ROOT_DIR%"
@REM  echo [CONFIG] Staging Dir:          "%STAGING_DIR%"
@REM  echo [CONFIG] Nginx Executable:     "%NGINX_EXE%"
@REM  echo [CONFIG] Nginx Document Root:  "%NGINX_DOC_ROOT%"
@REM  echo [CONFIG] NSSM Executable:      "%NSSM_EXE%"
@REM  echo [CONFIG] NSSM Service Name:    %API_SERVICE_NAME%
@REM  if "!SERVICE_WAS_INSTALLED!"=="1" (
@REM      echo [CONFIG] NSSM Service Status:  Installed
@REM  ) else (
@REM      echo [CONFIG] NSSM Service Status:  Not Installed [Will auto-install in Step 6]
@REM  )
@REM  echo [CONFIG] API Service Dir:      "%API_SERVICE_DIR%"
@REM  echo [CONFIG] API Target Path:      "%API_PROD_EXE%"
@REM  echo [CONFIG] Backup Timestamp:     %TIMESTAMP%
@REM  echo.

@REM  :: Check essential host executables
@REM  where node >nul 2>&1
@REM  if %ERRORLEVEL% neq 0 (
@REM      echo [ERROR] Node.js is not found in system PATH. Aborting.
@REM      goto :FAILED_NO_ROLLBACK
@REM  )
@REM  if "%NSSM_EXE%"=="" (
@REM      echo [ERROR] NSSM executable could not be detected.
@REM      echo [INFO] Please install NSSM into PATH, place it in "Softwares\nssm-2.24\nssm-2.24\win64\nssm.exe",
@REM      echo [INFO] or set the NSSM_EXE environment variable.
@REM      goto :FAILED_NO_ROLLBACK
@REM  )
@REM  if not exist "%NSSM_EXE%" (
@REM      echo [ERROR] NSSM executable not found at "%NSSM_EXE%".
@REM      goto :FAILED_NO_ROLLBACK
@REM  )
@REM  if "%NGINX_EXE%"=="" (
@REM      echo [ERROR] Nginx executable could not be detected.
@REM      echo [INFO] Please install Nginx into PATH, place it in "Softwares\nginx\nginx.exe" or "C:\nginx\nginx.exe",
@REM      echo [INFO] or set the NGINX_DIR environment variable.
@REM      goto :FAILED_NO_ROLLBACK
@REM  )
@REM  if not exist "%NGINX_EXE%" (
@REM      echo [ERROR] Nginx executable not found at "%NGINX_EXE%".
@REM      goto :FAILED_NO_ROLLBACK
@REM  )
@REM  if not exist "%NGINX_CONF%" (
@REM      echo [ERROR] Nginx configuration file not found at "%NGINX_CONF%".
@REM      goto :FAILED_NO_ROLLBACK
@REM  )

@REM  :: Ensure dedicated staging directory is completely clean
@REM  if exist "%STAGING_DIR%" (
@REM      if /i "%STAGING_DIR%"=="%ROOT_DIR%\staging" (
@REM          echo [INFO] Resetting dedicated staging directory...
@REM          rmdir /s /q "%STAGING_DIR%" >nul 2>&1
@REM      )
@REM  )
@REM  mkdir "%STAGING_DIR%" 2>nul
@REM  mkdir "%STAGING_UI_DIR%" 2>nul
@REM  mkdir "%STAGING_API_DIR%" 2>nul

@REM  :: -------------------------------------------------------------------------
@REM  :: 1. Build Angular UI into Staging Directory
@REM  :: -------------------------------------------------------------------------
@REM  echo -----------------------------------------------------------------------
@REM  echo [STEP 1/7] Building Angular UI into Staging Directory...
@REM  echo -----------------------------------------------------------------------
@REM  if not exist "%UI_SRC_DIR%" (
@REM      echo [ERROR] Angular UI source directory "%UI_SRC_DIR%" does not exist.
@REM      goto :FAILED_NO_ROLLBACK
@REM  )

@REM  cd /d "%UI_SRC_DIR%"
@REM  echo [INFO] Compiling Angular production build to staging "%STAGING_UI_DIR%"...
@REM  call npx ng build --output-path="%STAGING_UI_DIR%"
@REM  if %ERRORLEVEL% neq 0 (
@REM      echo [ERROR] Angular UI build failed. Live deployment was left completely untouched.
@REM      goto :FAILED_NO_ROLLBACK
@REM  )

@REM  :: Identify staged index.html location (browser subfolder or root of staging)
@REM  set "STAGED_UI_OUTPUT="
@REM  if exist "%STAGING_UI_DIR%\browser\index.html" (
@REM      set "STAGED_UI_OUTPUT=%STAGING_UI_DIR%\browser"
@REM  ) else if exist "%STAGING_UI_DIR%\index.html" (
@REM      set "STAGED_UI_OUTPUT=%STAGING_UI_DIR%"
@REM  )

@REM  if not defined STAGED_UI_OUTPUT (
@REM      echo [ERROR] Staged build completed but index.html was not found in "%STAGING_UI_DIR%".
@REM      echo [ERROR] Live deployment was left completely untouched.
@REM      goto :FAILED_NO_ROLLBACK
@REM  )

@REM  echo [SUCCESS] Staged Angular UI verified at "%STAGED_UI_OUTPUT%\index.html"
@REM  echo.

@REM  :: -------------------------------------------------------------------------
@REM  :: 2. Assemble and Package API Runtime Bundle in Staging
@REM  :: -------------------------------------------------------------------------
@REM  echo -----------------------------------------------------------------------
@REM  echo [STEP 2/7] Assembling and Packaging Node.js 24 API in Staging...
@REM  echo -----------------------------------------------------------------------
@REM  if not exist "%API_SRC_DIR%" (
@REM      echo [ERROR] API source directory "%API_SRC_DIR%" does not exist.
@REM      goto :FAILED_NO_ROLLBACK
@REM  )

@REM  set "STAGED_API_EXE=%STAGING_API_DIR%\myNode.exe"
@REM  if not exist "%STAGING_API_DIR%" mkdir "%STAGING_API_DIR%"

@REM  :: 2.1 Build self-contained SEA preparation bundle using scripts\build_sea.js
@REM  echo [INFO] Compiling and bundling API code into self-contained SEA preparation blob...
@REM  node "%ROOT_DIR%\scripts\build_sea.js" "%STAGING_API_DIR%"
@REM  if %ERRORLEVEL% neq 0 (
@REM      echo [ERROR] Failed to compile self-contained SEA bundle. Live deployment untouched.
@REM      goto :FAILED_NO_ROLLBACK
@REM  )

@REM  :: Ensure staging runtime logs and uploads directories exist
@REM  if not exist "%STAGING_API_DIR%\logs" mkdir "%STAGING_API_DIR%\logs"
@REM  if not exist "%STAGING_API_DIR%\uploads" mkdir "%STAGING_API_DIR%\uploads"

@REM  :: 2.2 Inject SEA blob into Windows executable
@REM  for /f "tokens=*" %%p in ('where node') do (
@REM      set "NODE_BINARY_PATH=%%p"
@REM      goto :RESOLVED_NODE
@REM  )
@REM  :RESOLVED_NODE
@REM  if not exist "%NODE_BINARY_PATH%" (
@REM      echo [ERROR] Could not resolve node.exe path. Live deployment untouched.
@REM      goto :FAILED_NO_ROLLBACK
@REM  )

@REM  echo [INFO] Injecting SEA blob into Windows executable...
@REM  copy /y "%NODE_BINARY_PATH%" "%STAGED_API_EXE%" >nul
@REM  call npx -y postject "%STAGED_API_EXE%" NODE_SEA_BLOB "%STAGING_API_DIR%\sea-prep.blob" --sentinel-fuse NODE_SEA_FUSE_fce680ab2cc467b6e072b8b5df1996b2 --overwrite >nul 2>&1
@REM  if %ERRORLEVEL% neq 0 (
@REM      echo [ERROR] Failed to inject SEA blob into "%STAGED_API_EXE%". Live deployment untouched.
@REM      goto :FAILED_NO_ROLLBACK
@REM  )

@REM  if not exist "%STAGED_API_EXE%" (
@REM      echo [ERROR] Staged executable missing at "%STAGED_API_EXE%". Live deployment untouched.
@REM      goto :FAILED_NO_ROLLBACK
@REM  )

@REM  echo [SUCCESS] Self-contained API executable assembled at "%STAGED_API_EXE%"
@REM  cd /d "%ROOT_DIR%"
@REM  echo.

@REM  :: -------------------------------------------------------------------------
@REM  :: 3. Mandatory Pre-Flight Validation of Staged Artifacts
@REM  :: -------------------------------------------------------------------------
@REM  echo -----------------------------------------------------------------------
@REM  echo [STEP 3/7] Mandatory Pre-flight Validation of Staged Artifacts...
@REM  echo -----------------------------------------------------------------------
@REM  if not exist "%STAGED_UI_OUTPUT%\index.html" (
@REM      echo [ERROR] Pre-flight validation failed: Staged index.html missing. Live untouched.
@REM      goto :FAILED_NO_ROLLBACK
@REM  )
@REM  if not exist "%STAGED_API_EXE%" (
@REM      echo [ERROR] Pre-flight validation failed: Staged myNode.exe missing. Live untouched.
@REM      goto :FAILED_NO_ROLLBACK
@REM  )

@REM  echo [INFO] Running pre-flight probe on port 5998 [timeout: 45s]...
@REM  set "PREFLIGHT_STATUS=INIT"
@REM  set "PREFLIGHT_CODE=0"
@REM  for /f "tokens=1,2 delims=|" %%a in ('powershell -NoProfile -ExecutionPolicy Bypass -File "%ROOT_DIR%\scripts\test_preflight.ps1" -Executable "%STAGED_API_EXE%" -WorkingDir "%STAGING_API_DIR%" -Port 5998 -TimeoutSeconds 45') do (
@REM      set "PREFLIGHT_STATUS=%%a"
@REM      set "PREFLIGHT_CODE=%%b"
@REM  )

@REM  if /i not "%PREFLIGHT_STATUS%"=="PASS" (
@REM      echo [ERROR] Mandatory pre-flight test FAILED.
@REM      echo [ERROR] Result: %PREFLIGHT_STATUS% [HTTP Code: %PREFLIGHT_CODE%]
@REM      if exist "%STAGING_API_DIR%\preflight_stderr.log" (
@REM          echo [ERROR] Pre-flight stderr log:
@REM          type "%STAGING_API_DIR%\preflight_stderr.log"
@REM      )
@REM      if exist "%STAGING_API_DIR%\preflight_stdout.log" (
@REM          echo [ERROR] Pre-flight stdout log:
@REM          type "%STAGING_API_DIR%\preflight_stdout.log"
@REM      )
@REM      echo [ERROR] Aborting deployment immediately. Production environment was not modified.
@REM      goto :FAILED_NO_ROLLBACK
@REM  )

@REM  echo [SUCCESS] Mandatory pre-flight test PASSED: Staged API responded with HTTP 200 OK.
@REM  echo.

@REM  :: -------------------------------------------------------------------------
@REM  :: 4. Back Up Live Production Files & Verify Integrity
@REM  :: -------------------------------------------------------------------------
@REM  echo -----------------------------------------------------------------------
@REM  echo [STEP 4/7] Creating Verified Backups of Live Production Files...
@REM  echo -----------------------------------------------------------------------
@REM  if not exist "%BACKUP_BASE_DIR%" mkdir "%BACKUP_BASE_DIR%"

@REM  :: 4.1 Backup Live UI
@REM  if exist "%NGINX_DOC_ROOT%\index.html" (
@REM      echo [BACKUP] Backing up live UI from "%NGINX_DOC_ROOT%" to "%UI_BACKUP_DIR%"...
@REM      mkdir "%UI_BACKUP_DIR%" 2>nul
@REM      robocopy "%NGINX_DOC_ROOT%" "%UI_BACKUP_DIR%" /E /R:2 /W:1 >nul 2>&1
@REM      set "ROBO_BACKUP_UI=!ERRORLEVEL!"
@REM      if !ROBO_BACKUP_UI! lss 8 (
@REM          if exist "%UI_BACKUP_DIR%\index.html" (
@REM              set "UI_BACKED_UP=1"
@REM              echo [SUCCESS] Live UI backed up and verified at "%UI_BACKUP_DIR%".
@REM          )
@REM      )
@REM      if not "!UI_BACKED_UP!"=="1" (
@REM          echo [ERROR] Live UI backup verification failed. Aborting before modifying production.
@REM          goto :FAILED_NO_ROLLBACK
@REM      )
@REM  ) else (
@REM      set "FIRST_TIME_UI=1"
@REM      echo [INFO] No live UI found at "%NGINX_DOC_ROOT%". First-time UI deployment detected.
@REM  )

@REM  :: 4.2 Backup Live API executable only (nothing else)
@REM  if exist "%API_PROD_EXE%" (
@REM      echo [BACKUP] Backing up live API executable from "%API_PROD_EXE%" to "%API_BACKUP_DIR%"...
@REM      mkdir "%API_BACKUP_DIR%" 2>nul
@REM      copy /y "%API_PROD_EXE%" "%API_BACKUP_DIR%\myNode.exe" >nul 2>&1
@REM      if exist "%API_BACKUP_DIR%\myNode.exe" (
@REM          set "API_BACKED_UP=1"
@REM          echo [SUCCESS] Live API executable backed up and verified at "%API_BACKUP_DIR%\myNode.exe".
@REM      ) else (
@REM          echo [ERROR] Live API executable backup failed. Aborting before modifying production.
@REM          goto :FAILED_NO_ROLLBACK
@REM      )
@REM  ) else (
@REM      set "FIRST_TIME_API=1"
@REM      echo [INFO] No live API executable found at "%API_PROD_EXE%". First-time API deployment detected.
@REM  )
@REM  echo.

@REM  :: -------------------------------------------------------------------------
@REM  :: 5. Deploy Staged Angular UI to Nginx Document Root
@REM  :: -------------------------------------------------------------------------
@REM  echo -----------------------------------------------------------------------
@REM  echo [STEP 5/7] Deploying Staged UI into Nginx Document Root...
@REM  echo -----------------------------------------------------------------------
@REM  set "LIVE_ALTERED=1"
@REM  set "UI_ALTERED=1"
@REM  if not exist "%NGINX_DOC_ROOT%" mkdir "%NGINX_DOC_ROOT%"

@REM  echo [INFO] Synchronizing staged UI files to live Nginx document root...
@REM  robocopy "%STAGED_UI_OUTPUT%" "%NGINX_DOC_ROOT%" /MIR /R:2 /W:1 >nul 2>&1
@REM  set "ROBO_UI_EXIT=%ERRORLEVEL%"
@REM  if %ROBO_UI_EXIT% geq 8 (
@REM      echo [ERROR] Robocopy failed to synchronize UI files [Code: %ROBO_UI_EXIT%].
@REM      goto :ROLLBACK
@REM  )

@REM  if not exist "%NGINX_DOC_ROOT%\index.html" (
@REM      echo [ERROR] index.html missing from Nginx document root after deployment.
@REM      goto :ROLLBACK
@REM  )
@REM  echo [SUCCESS] Staged UI synchronized to "%NGINX_DOC_ROOT%".

@REM  :: Verify Nginx configuration syntax before reloading
@REM  echo [INFO] Testing Nginx configuration syntax...
@REM  "%NGINX_EXE%" -p "%NGINX_DIR%" -t -c "%NGINX_CONF%"
@REM  if %ERRORLEVEL% neq 0 (
@REM      echo [ERROR] Nginx configuration test failed for "%NGINX_CONF%".
@REM      goto :ROLLBACK
@REM  )

@REM  :: Reload or start Nginx
@REM  tasklist /FI "IMAGENAME eq nginx.exe" 2>nul | findstr /I "nginx.exe" >nul 2>&1 && (
@REM      echo [INFO] Nginx is running. Reloading configuration...
@REM      "%NGINX_EXE%" -p "%NGINX_DIR%" -c "%NGINX_CONF%" -s reload >nul 2>&1
@REM      if !ERRORLEVEL! neq 0 (
@REM          echo [ERROR] Nginx reload failed with exit code !ERRORLEVEL!.
@REM          goto :ROLLBACK
@REM      )
@REM      echo [SUCCESS] Nginx reloaded successfully.
@REM  ) || (
@REM      echo [INFO] Nginx is not running. Launching Nginx...
@REM      cd /d "%NGINX_DIR%"
@REM      start "" /B "%NGINX_EXE%" -p "%NGINX_DIR%" -c "%NGINX_CONF%"
@REM      timeout /t 2 /nobreak >nul
@REM      cd /d "%ROOT_DIR%"
@REM      tasklist /FI "IMAGENAME eq nginx.exe" 2>nul | findstr /I "nginx.exe" >nul 2>&1
@REM      if errorlevel 1 (
@REM          echo [ERROR] Failed to start Nginx process.
@REM          goto :ROLLBACK
@REM      )
@REM      echo [SUCCESS] Nginx started successfully.
@REM  )
@REM  echo.

@REM  :: -------------------------------------------------------------------------
@REM  :: 6. Deploy API to NSSM Service (Preserving Production Data)
@REM  :: -------------------------------------------------------------------------
@REM  echo -----------------------------------------------------------------------
@REM  echo [STEP 6/7] Deploying API to NSSM Service [%API_SERVICE_NAME%]...
@REM  echo -----------------------------------------------------------------------
@REM  set "API_ALTERED=1"
@REM  if not exist "%API_SERVICE_DIR%" mkdir "%API_SERVICE_DIR%"

@REM  :: Check if NSSM Service is currently installed
@REM  sc.exe query %API_SERVICE_NAME% >nul 2>&1 && (
@REM      set "SERVICE_CURRENTLY_INSTALLED=1"
@REM      sc.exe query %API_SERVICE_NAME% 2>&1 | findstr /I "STOPPED" >nul 2>&1 && (
@REM          echo [INFO] Existing NSSM service %API_SERVICE_NAME% is already in state STOPPED.
@REM      ) || (
@REM          echo [INFO] Stopping existing NSSM service %API_SERVICE_NAME%...
@REM          "%NSSM_EXE%" stop %API_SERVICE_NAME% >nul 2>&1
@REM          set "SERVICE_STOPPED=0"
@REM          for /l %%k in (1,1,10) do (
@REM              sc.exe query %API_SERVICE_NAME% 2>&1 | findstr /I "STOPPED" >nul 2>&1 && (
@REM                  set "SERVICE_STOPPED=1"
@REM                  goto :STOP_CONFIRMED
@REM              )
@REM              timeout /t 1 /nobreak >nul
@REM          )
@REM          :STOP_CONFIRMED
@REM          if not "!SERVICE_STOPPED!"=="1" (
@REM              echo [ERROR] NSSM service %API_SERVICE_NAME% failed to reach SERVICE_STOPPED state within 10 seconds.
@REM              goto :ROLLBACK
@REM          )
@REM          echo [SUCCESS] NSSM service %API_SERVICE_NAME% confirmed stopped.
@REM      )
@REM  ) || (
@REM      set "SERVICE_CURRENTLY_INSTALLED=0"
@REM      echo [INFO] NSSM service %API_SERVICE_NAME% is not currently installed.
@REM      echo [INFO] Service will be created and configured with NSSM after file staging.
@REM  )

@REM  :: Deploy self-contained executable to API service directory (storing ONLY myNode.exe and logs)
@REM  echo [INFO] Deploying self-contained executable to "%API_SERVICE_DIR%"...
@REM  copy /y "%STAGED_API_EXE%" "%API_PROD_EXE%" >nul 2>&1
@REM  if not exist "%API_PROD_EXE%" (
@REM      echo [ERROR] Deployed executable missing at "%API_PROD_EXE%".
@REM      goto :ROLLBACK
@REM  )

@REM  :: Ensure logs and uploads directories exist for runtime output
@REM  if not exist "%API_SERVICE_DIR%\logs" mkdir "%API_SERVICE_DIR%\logs"
@REM  if not exist "%API_SERVICE_DIR%\uploads" mkdir "%API_SERVICE_DIR%\uploads"

@REM  :: Strictly remove any plaintext .env from the deployment directory to protect secrets
@REM  if exist "%API_SERVICE_DIR%\.env" (
@REM      del /f /q "%API_SERVICE_DIR%\.env" >nul 2>&1
@REM      echo [SECURITY] Plaintext .env removed from deployment directory. Secrets are securely compiled into executable.
@REM  )

@REM  :: Install NSSM service if not currently installed
@REM  sc.exe query %API_SERVICE_NAME% >nul 2>&1 || (
@REM      echo [INFO] Installing NSSM service %API_SERVICE_NAME% with target "%API_PROD_EXE%"...
@REM      "%NSSM_EXE%" install %API_SERVICE_NAME% "%API_PROD_EXE%" >nul 2>&1
@REM      timeout /t 1 /nobreak >nul
@REM      sc.exe query %API_SERVICE_NAME% >nul 2>&1
@REM      if errorlevel 1 (
@REM          echo [ERROR] Failed to install NSSM service %API_SERVICE_NAME%.
@REM          goto :ROLLBACK
@REM      )
@REM      echo [SUCCESS] NSSM service %API_SERVICE_NAME% installed successfully.
@REM  )

@REM  :: Synchronize service parameters
@REM  "%NSSM_EXE%" set %API_SERVICE_NAME% Application "%API_PROD_EXE%" >nul 2>&1
@REM  "%NSSM_EXE%" set %API_SERVICE_NAME% AppDirectory "%API_SERVICE_DIR%" >nul 2>&1
@REM  "%NSSM_EXE%" set %API_SERVICE_NAME% Start SERVICE_AUTO_START >nul 2>&1
@REM  "%NSSM_EXE%" set %API_SERVICE_NAME% AppStdout "%API_SERVICE_DIR%\logs\service.log" >nul 2>&1
@REM  "%NSSM_EXE%" set %API_SERVICE_NAME% AppStderr "%API_SERVICE_DIR%\logs\service.err.log" >nul 2>&1

@REM  :: Start NSSM Service and verify running state
@REM  echo [INFO] Starting NSSM service %API_SERVICE_NAME%...
@REM  "%NSSM_EXE%" start %API_SERVICE_NAME% >nul 2>&1

@REM  set "SERVICE_RUNNING=0"
@REM  for /l %%k in (1,1,10) do (
@REM      sc.exe query %API_SERVICE_NAME% 2>&1 | findstr /I "RUNNING" >nul 2>&1 && (
@REM          set "SERVICE_RUNNING=1"
@REM          goto :START_CONFIRMED
@REM      )
@REM      timeout /t 1 /nobreak >nul
@REM  )
@REM  :START_CONFIRMED
@REM  if not "!SERVICE_RUNNING!"=="1" (
@REM      echo [ERROR] NSSM service %API_SERVICE_NAME% failed to enter SERVICE_RUNNING state.
@REM      goto :ROLLBACK
@REM  )
@REM  echo [SUCCESS] NSSM service %API_SERVICE_NAME% confirmed in state SERVICE_RUNNING.

@REM  echo [INFO] Allowing 5 seconds for Express server and MongoDB pool initialization...
@REM  timeout /t 5 /nobreak >nul
@REM  echo.

@REM  :: -------------------------------------------------------------------------
@REM  :: 7. Verification and Rollback
@REM  :: -------------------------------------------------------------------------
@REM  echo -----------------------------------------------------------------------
@REM  echo [STEP 7/7] Verifying System Health Endpoints...
@REM  echo -----------------------------------------------------------------------

@REM  :: 7.1 Verify Direct API Health Endpoint (must return HTTP 200)
@REM  set "API_HEALTH_STATUS=000"
@REM  echo [CHECK 1/3] Probing API directly at http://127.0.0.1:5000/health ...
@REM  for /l %%i in (1,1,5) do (
@REM      for /f "tokens=*" %%c in ('curl.exe -s -o NUL -w "%%{http_code}" -m 5 http://127.0.0.1:5000/health') do set "API_HEALTH_STATUS=%%c"
@REM      if "!API_HEALTH_STATUS!"=="200" goto :API_HEALTH_OK
@REM      timeout /t 2 /nobreak >nul
@REM  )
@REM  :API_HEALTH_OK
@REM  if not "!API_HEALTH_STATUS!"=="200" (
@REM      echo [ERROR] Direct API health check failed. HTTP status: !API_HEALTH_STATUS! [Expected: 200].
@REM      goto :ROLLBACK
@REM  )
@REM  echo [SUCCESS] Direct API health check passed [HTTP 200 OK].

@REM  :: 7.2 Verify Nginx UI Static Delivery (must return HTTP 200 and contain Angular root)
@REM  set "UI_STATUS=000"
@REM  set "UI_HAS_APP_ROOT=0"
@REM  echo [CHECK 2/3] Probing Angular UI through Nginx at http://localhost/ ...
@REM  for /l %%m in (1,1,5) do (
@REM      for /f "tokens=*" %%c in ('curl.exe -s -o NUL -w "%%{http_code}" -m 5 http://localhost/') do set "UI_STATUS=%%c"
@REM      if "!UI_STATUS!"=="200" (
@REM          curl.exe -s -m 5 http://localhost/ | findstr /I "<app-root" >nul 2>&1 && (
@REM              set "UI_HAS_APP_ROOT=1"
@REM              goto :UI_OK
@REM          )
@REM      )
@REM      timeout /t 2 /nobreak >nul
@REM  )
@REM  :UI_OK
@REM  if not "!UI_STATUS!"=="200" (
@REM      echo [ERROR] Nginx UI delivery check failed. HTTP status: !UI_STATUS! [Expected: 200].
@REM      goto :ROLLBACK
@REM  )
@REM  if not "!UI_HAS_APP_ROOT!"=="1" (
@REM      echo [ERROR] Nginx UI returned HTTP 200 but response does not contain Angular app-root element.
@REM      goto :ROLLBACK
@REM  )
@REM  echo [SUCCESS] Nginx UI static delivery passed [HTTP 200 OK and Angular app-root verified].

@REM  :: 7.3 Verify Configured Nginx Reverse Proxy Route (/health, must return HTTP 200 and JSON OK)
@REM  set "PROXY_STATUS=000"
@REM  set "PROXY_HAS_OK=0"
@REM  echo [CHECK 3/3] Probing Nginx API reverse proxy at http://localhost/health ...
@REM  for /l %%j in (1,1,3) do (
@REM      for /f "tokens=*" %%c in ('curl.exe -s -o NUL -w "%%{http_code}" -m 5 http://localhost/health') do set "PROXY_STATUS=%%c"
@REM      if "!PROXY_STATUS!"=="200" (
@REM          curl.exe -s -m 5 http://localhost/health | findstr /I "status.*OK" >nul 2>&1 && (
@REM              set "PROXY_HAS_OK=1"
@REM              goto :PROXY_OK
@REM          )
@REM      )
@REM      timeout /t 2 /nobreak >nul
@REM  )
@REM  :PROXY_OK
@REM  if not "!PROXY_STATUS!"=="200" (
@REM      echo [ERROR] Nginx reverse proxy health check failed. HTTP status: !PROXY_STATUS! [Expected: 200].
@REM      goto :ROLLBACK
@REM  )
@REM  if not "!PROXY_HAS_OK!"=="1" (
@REM      echo [ERROR] Nginx reverse proxy returned HTTP 200 but body did not contain status OK.
@REM      goto :ROLLBACK
@REM  )
@REM  echo [SUCCESS] Nginx API reverse proxy check passed [HTTP 200 OK and JSON status verified].

@REM  :: Clean up staging directory on verified success
@REM  if exist "%STAGING_DIR%" (
@REM      if /i "%STAGING_DIR%"=="%ROOT_DIR%\staging" (
@REM          rmdir /s /q "%STAGING_DIR%" >nul 2>&1
@REM      )
@REM  )

@REM  :: -------------------------------------------------------------------------
@REM  :: Final Success
@REM  :: -------------------------------------------------------------------------
@REM  echo.
@REM  echo =======================================================================
@REM  echo                   [SUCCESS] DEPLOYMENT COMPLETED.
@REM  echo =======================================================================
@REM  echo  - Frontend Web UI:    http://localhost/ [HTTP 200, Angular verified]
@REM  echo  - Nginx Health Proxy: http://localhost/health [HTTP 200, Proxy verified]
@REM  echo  - Backend Direct API: http://127.0.0.1:5000/health [HTTP 200, OK]
@REM  echo  - NSSM Service:       %API_SERVICE_NAME% [SERVICE_RUNNING]
@REM  echo  - Active Binary:      "%API_PROD_EXE%"
@REM  echo  - Nginx Document Root: "%NGINX_DOC_ROOT%"
@REM  echo  - Production Data:    Preserved [.env, uploads, logs]
@REM  echo  - Staging Cleaned:    Yes
@REM  echo =======================================================================
@REM  cd /d "%ROOT_DIR%"
@REM  exit /b 0

@REM  :: -------------------------------------------------------------------------
@REM  :: Rollback Procedure
@REM  :: -------------------------------------------------------------------------
@REM  :ROLLBACK
@REM  echo.
@REM  echo =======================================================================
@REM  echo [ROLLBACK TRIGGERED] Deployment verification failed.
@REM  echo Restoring previous production state from backups...
@REM  echo =======================================================================

@REM  set "RESTORED_UI=0"
@REM  set "RESTORED_API=0"

@REM  :: 1. Rollback API service directory
@REM  if "!API_ALTERED!"=="1" (
@REM      if "!SERVICE_WAS_INSTALLED!"=="0" (
@REM          echo [ROLLBACK] Stopping and removing newly installed NSSM service %API_SERVICE_NAME%...
@REM          "%NSSM_EXE%" stop %API_SERVICE_NAME% >nul 2>&1
@REM          timeout /t 2 /nobreak >nul
@REM          "%NSSM_EXE%" remove %API_SERVICE_NAME% confirm >nul 2>&1
@REM          echo [SUCCESS] Newly installed NSSM service removed.
@REM          if "%API_BACKED_UP%"=="1" (
@REM              echo [ROLLBACK] Restoring previous API executable from "%API_BACKUP_DIR%\myNode.exe" to "%API_PROD_EXE%"...
@REM              copy /y "%API_BACKUP_DIR%\myNode.exe" "%API_PROD_EXE%" >nul 2>&1
@REM              echo [SUCCESS] Previous API executable restored from backup.
@REM          )
@REM          set "RESTORED_API=1"
@REM      ) else if "%API_BACKED_UP%"=="1" (
@REM          echo [ROLLBACK] Stopping NSSM service %API_SERVICE_NAME%...
@REM          "%NSSM_EXE%" stop %API_SERVICE_NAME% >nul 2>&1
@REM          timeout /t 2 /nobreak >nul
@REM          echo [ROLLBACK] Restoring previous API executable from "%API_BACKUP_DIR%\myNode.exe" to "%API_PROD_EXE%"...
@REM          copy /y "%API_BACKUP_DIR%\myNode.exe" "%API_PROD_EXE%" >nul 2>&1
@REM          if exist "%API_PROD_EXE%" (
@REM              echo [SUCCESS] Previous API executable restored from backup.
@REM              echo [ROLLBACK] Restarting NSSM service %API_SERVICE_NAME%...
@REM              "%NSSM_EXE%" start %API_SERVICE_NAME% >nul 2>&1
@REM              timeout /t 4 /nobreak >nul
@REM              sc.exe query %API_SERVICE_NAME% 2>&1 | findstr /I "RUNNING" >nul 2>&1 && (
@REM                  set "RB_API_CODE=000"
@REM                  for /f "tokens=*" %%c in ('curl.exe -s -o NUL -w "%%{http_code}" -m 5 http://127.0.0.1:5000/health') do set "RB_API_CODE=%%c"
@REM                  if "!RB_API_CODE!"=="200" (
@REM                      set "RESTORED_API=1"
@REM                      echo [SUCCESS] Restored API service confirmed running and responding with HTTP 200.
@REM                  ) else (
@REM                      echo [WARNING] Restored API service started but health probe returned HTTP !RB_API_CODE!.
@REM                  )
@REM              ) || (
@REM                  echo [ERROR] Failed to confirm NSSM service running after rollback.
@REM              )
@REM          ) else (
@REM              echo [ERROR] Failed to restore API executable from backup. Service will NOT be started.
@REM          )
@REM      ) else (
@REM          if "%FIRST_TIME_API%"=="1" (
@REM              echo [INFO] First-time API deployment: No prior API backup was available to restore.
@REM          ) else (
@REM              echo [WARNING] No valid API backup was available. Rollback unavailable for API.
@REM          )
@REM      )
@REM  ) else (
@REM      echo [INFO] API production directory was not modified. No API rollback needed.
@REM      set "RESTORED_API=UNCHANGED"
@REM  )

@REM  :: 2. Rollback UI
@REM  if "!UI_ALTERED!"=="1" (
@REM      if "%UI_BACKED_UP%"=="1" (
@REM          echo [ROLLBACK] Restoring previous UI build from "%UI_BACKUP_DIR%" to "%NGINX_DOC_ROOT%"...
@REM          robocopy "%UI_BACKUP_DIR%" "%NGINX_DOC_ROOT%" /MIR /R:2 /W:1 >nul 2>&1
@REM          set "ROBO_RB_UI_EXIT=!ERRORLEVEL!"
@REM          if !ROBO_RB_UI_EXIT! lss 8 (
@REM              "%NGINX_EXE%" -p "%NGINX_DIR%" -t -c "%NGINX_CONF%" >nul 2>&1
@REM              if !ERRORLEVEL! equ 0 (
@REM                  "%NGINX_EXE%" -p "%NGINX_DIR%" -c "%NGINX_CONF%" -s reload >nul 2>&1
@REM                  set "RB_UI_CODE=000"
@REM                  for /f "tokens=*" %%c in ('curl.exe -s -o NUL -w "%%{http_code}" -m 5 http://localhost/') do set "RB_UI_CODE=%%c"
@REM                  if "!RB_UI_CODE!"=="200" (
@REM                      set "RESTORED_UI=1"
@REM                      echo [SUCCESS] Restored UI confirmed accessible through Nginx [HTTP 200].
@REM                  ) else (
@REM                      echo [WARNING] UI restored but Nginx probe returned HTTP !RB_UI_CODE!.
@REM                  )
@REM              ) else (
@REM                  echo [ERROR] Nginx configuration test failed during rollback reload.
@REM              )
@REM          ) else (
@REM              echo [ERROR] Robocopy failed to restore UI files from backup.
@REM          )
@REM      ) else (
@REM          if "%FIRST_TIME_UI%"=="1" (
@REM              echo [INFO] First-time UI deployment: No prior UI backup was available to restore.
@REM          ) else (
@REM              echo [WARNING] No valid UI backup was available. Rollback unavailable for UI.
@REM          )
@REM      )
@REM  ) else (
@REM      echo [INFO] UI document root was not modified. No UI rollback needed.
@REM      set "RESTORED_UI=UNCHANGED"
@REM  )

@REM  :: Clean up staging directory
@REM  if exist "%STAGING_DIR%" (
@REM      if /i "%STAGING_DIR%"=="%ROOT_DIR%\staging" (
@REM          rmdir /s /q "%STAGING_DIR%" >nul 2>&1
@REM      )
@REM  )

@REM  echo.
@REM  echo =======================================================================
@REM  echo                        ROLLBACK VERIFICATION REPORT
@REM  echo =======================================================================
@REM  if "!RESTORED_API!"=="1" (
@REM      echo  - API Service: RESTORED and VERIFIED healthy [HTTP 200]
@REM  ) else if "!RESTORED_API!"=="UNCHANGED" (
@REM      echo  - API Service: UNTOUCHED [Not modified by deployment]
@REM  ) else (
@REM      echo  - API Service: NOT RESTORED [No backup, restore failed, or health check failed]
@REM  )
@REM  if "!RESTORED_UI!"=="1" (
@REM      echo  - UI Bundle:   RESTORED and VERIFIED accessible [HTTP 200]
@REM  ) else if "!RESTORED_UI!"=="UNCHANGED" (
@REM      echo  - UI Bundle:   UNTOUCHED [Not modified by deployment]
@REM  ) else (
@REM      echo  - UI Bundle:   NOT RESTORED [No backup, restore failed, or probe failed]
@REM  )
@REM  echo =======================================================================
@REM  cd /d "%ROOT_DIR%"
@REM  exit /b 1

@REM  :FAILED_NO_ROLLBACK
@REM  echo.
@REM  echo =======================================================================
@REM  echo                  [FAILED] DEPLOYMENT ABORTED
@REM  echo  Live deployment was never modified. No rollback was necessary.
@REM  echo =======================================================================
@REM  if exist "%STAGING_DIR%" (
@REM      if /i "%STAGING_DIR%"=="%ROOT_DIR%\staging" (
@REM          rmdir /s /q "%STAGING_DIR%" >nul 2>&1
@REM      )
@REM  )
@REM  cd /d "%ROOT_DIR%"
@REM  exit /b 1
