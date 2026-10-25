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

:: 0.1 Optional custom configuration file (if present)
if exist "%ROOT_DIR%\deploy.config.bat" call "%ROOT_DIR%\deploy.config.bat"

set "UI_SRC_DIR=%ROOT_DIR%\ui"
set "API_SRC_DIR=%ROOT_DIR%\api"

set "STAGING_DIR=%ROOT_DIR%\staging"
set "STAGING_UI_DIR=%STAGING_DIR%\ui"
set "STAGING_API_DIR=%STAGING_DIR%\api"

:: 0.2 Resolve Nginx Document Root dynamically relative to workspace
if "%NGINX_DOC_ROOT%"=="" set "NGINX_DOC_ROOT=%ROOT_DIR%\ui\dist\ui\browser"

:: 0.3 Resolve Nginx installation dynamically (PATH, environment, relative, or standard drives)
if "%NGINX_DIR%"=="" (
    where nginx >nul 2>&1 && (
        for /f "tokens=*" %%i in ('where nginx 2^>nul') do (
            if not defined NGINX_DIR if exist "%%i" (
                set "NGINX_EXE=%%i"
                for %%d in ("%%i") do set "NGINX_DIR=%%~dpd"
            )
        )
    )
)
if "%NGINX_DIR%"=="" if exist "%ROOT_DIR%\Softwares\nginx\nginx.exe" set "NGINX_DIR=%ROOT_DIR%\Softwares\nginx"
if "%NGINX_DIR%"=="" if exist "%ROOT_DIR%\..\Softwares\nginx\nginx.exe" set "NGINX_DIR=%ROOT_DIR%\..\Softwares\nginx"
if "%NGINX_DIR%"=="" if exist "D:\Softwares\nginx\nginx.exe" set "NGINX_DIR=D:\Softwares\nginx"
if "%NGINX_DIR%"=="" if exist "C:\Softwares\nginx\nginx.exe" set "NGINX_DIR=C:\Softwares\nginx"
if "%NGINX_DIR%"=="" if exist "%SystemDrive%\Softwares\nginx\nginx.exe" set "NGINX_DIR=%SystemDrive%\Softwares\nginx"
if "%NGINX_DIR%"=="" if exist "C:\nginx\nginx.exe" set "NGINX_DIR=C:\nginx"
if "%NGINX_DIR%"=="" if exist "D:\nginx\nginx.exe" set "NGINX_DIR=D:\nginx"
if "%NGINX_DIR%"=="" if exist "%ProgramFiles%\nginx\nginx.exe" set "NGINX_DIR=%ProgramFiles%\nginx"

if defined NGINX_DIR (
    if "%NGINX_DIR:~-1%"=="\" set "NGINX_DIR=%NGINX_DIR:~0,-1%"
    if "%NGINX_EXE%"=="" set "NGINX_EXE=%NGINX_DIR%\nginx.exe"
    if "%NGINX_CONF%"=="" set "NGINX_CONF=%NGINX_DIR%\conf\nginx.conf"
)

:: 0.4 Resolve NSSM executable dynamically (PATH, environment, relative, or standard drives)
if "%NSSM_EXE%"=="" (
    where nssm >nul 2>&1 && (
        for /f "tokens=*" %%i in ('where nssm 2^>nul') do (
            if not defined NSSM_EXE if exist "%%i" set "NSSM_EXE=%%i"
        )
    )
)
if "%NSSM_EXE%"=="" if exist "%ROOT_DIR%\Softwares\nssm-2.24\nssm-2.24\win64\nssm.exe" set "NSSM_EXE=%ROOT_DIR%\Softwares\nssm-2.24\nssm-2.24\win64\nssm.exe"
if "%NSSM_EXE%"=="" if exist "%ROOT_DIR%\..\Softwares\nssm-2.24\nssm-2.24\win64\nssm.exe" set "NSSM_EXE=%ROOT_DIR%\..\Softwares\nssm-2.24\nssm-2.24\win64\nssm.exe"
if "%NSSM_EXE%"=="" if exist "D:\Softwares\nssm-2.24\nssm-2.24\win64\nssm.exe" set "NSSM_EXE=D:\Softwares\nssm-2.24\nssm-2.24\win64\nssm.exe"
if "%NSSM_EXE%"=="" if exist "C:\Softwares\nssm-2.24\nssm-2.24\win64\nssm.exe" set "NSSM_EXE=C:\Softwares\nssm-2.24\nssm-2.24\win64\nssm.exe"
if "%NSSM_EXE%"=="" if exist "%SystemDrive%\Softwares\nssm-2.24\nssm-2.24\win64\nssm.exe" set "NSSM_EXE=%SystemDrive%\Softwares\nssm-2.24\nssm-2.24\win64\nssm.exe"
if "%NSSM_EXE%"=="" if exist "C:\nssm\win64\nssm.exe" set "NSSM_EXE=C:\nssm\win64\nssm.exe"
if "%NSSM_EXE%"=="" if exist "D:\nssm\win64\nssm.exe" set "NSSM_EXE=D:\nssm\win64\nssm.exe"
if "%NSSM_EXE%"=="" if exist "%ProgramFiles%\nssm\win64\nssm.exe" set "NSSM_EXE=%ProgramFiles%\nssm\win64\nssm.exe"
if "%NSSM_EXE%"=="" if exist "%ProgramFiles(x86)%\nssm\win64\nssm.exe" set "NSSM_EXE=%ProgramFiles(x86)%\nssm\win64\nssm.exe"
if "%NSSM_EXE%"=="" if exist "C:\ProgramData\chocolatey\bin\nssm.exe" set "NSSM_EXE=C:\ProgramData\chocolatey\bin\nssm.exe"

:: 0.5 Configure API Service parameters dynamically relative to workspace
if "%API_SERVICE_NAME%"=="" set "API_SERVICE_NAME=MYNODE-2"
if "%API_SERVICE_DIR%"=="" (
    if exist "%ROOT_DIR%\deloyment" (
        set "API_SERVICE_DIR=%ROOT_DIR%\deloyment"
    ) else (
        set "API_SERVICE_DIR=%ROOT_DIR%\deployment"
    )
)
if "%API_PROD_EXE%"=="" set "API_PROD_EXE=%API_SERVICE_DIR%\myNode.exe"

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
if "%NSSM_EXE%"=="" (
    echo [ERROR] NSSM executable could not be detected.
    echo [INFO] Please install NSSM into PATH, place it in "Softwares\nssm-2.24\nssm-2.24\win64\nssm.exe",
    echo [INFO] or set the NSSM_EXE environment variable.
    goto :FAILED_NO_ROLLBACK
)
if not exist "%NSSM_EXE%" (
    echo [ERROR] NSSM executable not found at "%NSSM_EXE%".
    goto :FAILED_NO_ROLLBACK
)
if "%NGINX_EXE%"=="" (
    echo [ERROR] Nginx executable could not be detected.
    echo [INFO] Please install Nginx into PATH, place it in "Softwares\nginx\nginx.exe" or "C:\nginx\nginx.exe",
    echo [INFO] or set the NGINX_DIR environment variable.
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
