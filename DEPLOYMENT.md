# Temple Application Automated Deployment Guide (Windows, Nginx & NSSM)

This document describes the automated deployment architecture, data protection rules, safety mechanisms, and verification procedures implemented in [deploy.bat](file:///d:/study/templeApp/deploy.bat).

---

## 1. Verified Host Configuration & Paths

Every path, service name, and configuration parameter has been confirmed on the target host:

| Component | Dynamic Resolution / Default | Verification Notes |
| :--- | :--- | :--- |
| **Workspace Root** | `%ROOT_DIR%` (`%~dp0`) | Automatically detected from script location on any drive/PC |
| **Dedicated Staging Directory** | `%ROOT_DIR%\staging` | Temporary build area (`staging\ui` and `staging\api`) |
| **Angular UI Source** | `%ROOT_DIR%\ui` | Angular 22 project (`@angular/build:application`) |
| **Staging UI Output** | `%ROOT_DIR%\staging\ui\browser` | Production `index.html` and bundled assets |
| **Node.js Active Runtime** | `node.exe` in system `PATH` | Verified Node 24 binary |
| **Node.js API Source** | `%ROOT_DIR%\api` | Express 5 application (`index.js`) |
| **API Executable Technology** | Node.js 24 Single Executable Application (SEA) | Standalone `myNode.exe` with bundled code and embedded secrets |
| **NSSM Executable** | Dynamic Auto-Detection | Checks `where nssm`, `%ROOT_DIR%\..\Softwares`, `C:\nssm`, `D:\Softwares`, etc. |
| **API NSSM Service** | `MYNODE-2` (configurable via `API_SERVICE_NAME`) | Registered Windows service (auto-created if not present) |
| **API Target Executable** | `%ROOT_DIR%\deployment\myNode.exe` | Binary path configured in NSSM |
| **API Service Directory** | `%ROOT_DIR%\deployment` | Working directory in NSSM (stores only `myNode.exe` and `logs/`) |
| **Nginx Installation** | Dynamic Auto-Detection | Checks `where nginx`, `C:\nginx`, `D:\Softwares\nginx`, etc. |
| **Nginx Configuration** | `%NGINX_DIR%\conf\nginx.conf` | Reverse proxies `/api/` and `/health` to `http://127.0.0.1:5000` |
| **Nginx Document Root** | `%ROOT_DIR%\ui\dist\ui\browser` | Dynamically points to the current workspace UI build |
| **Deployment Backups** | `%ROOT_DIR%\backups\` | Timestamped UI and API rollbacks (never auto-deleted) |

---

## 2. API Packaging Architecture: Self-Contained Node 24 SEA

### Architecture & Runtime Model
`myNode.exe` is compiled as a **genuinely self-contained Node.js 24 Single Executable Application (SEA)**:
- **No `node_modules` in Deployment Directory**: The deployment directory (`D:\study\templeApp\deployment`) exclusively stores `myNode.exe` and the `logs/` directory.
- **Embedded Application Code**: All Express routes, middleware, controllers, Mongoose models, and pure JavaScript dependencies are bundled into `sea-entry.js` with `esbuild`.
- **Embedded Native C++ Addon Loader (`bcrypt`)**: The prebuilt 64-bit Windows binary (`bcrypt.node`) is embedded as base64 in a loader shim. On application startup, if not already present in `%TEMP%`, it writes `templeapp_bcrypt_v6.node` to the OS temporary directory and loads it via `process.dlopen`. This provides 100% native C++ bcrypt cryptographic performance while keeping the deployment folder clean.
- **Persistent Disk Logging (`winston-daily-rotate-file`)**: Winston outputs daily rotating logs (`app-*.log`, `error-*.log`) directly into `logs/` relative to `process.cwd()` (`D:\study\templeApp\deployment\logs`).
- **NSSM Log Redirection**: NSSM routes `AppStdout` and `AppStderr` to `logs\service.log` and `logs\service.err.log`.

### How It Operates
1. [deploy.bat](file:///d:/study/templeApp/deploy.bat) invokes `scripts\build_sea.js` in Step 2.
2. `build_sea.js` bundles `api/index.js` using `esbuild` with the embedded `bcrypt` native loader shim into `staging\api\sea-entry.js`.
3. Node.js compiles `sea-entry.js` into `staging\api\sea-prep.blob` via `--experimental-sea-config`.
4. `postject` injects the SEA blob into `staging\api\myNode.exe`.
5. Pre-flight verification validates `myNode.exe` in an isolated environment on ephemeral port `5998`.
6. Step 6 deploys exclusively `myNode.exe` into `D:\study\templeApp\deployment`, creates `logs/`, updates NSSM parameters, and starts the service.

---

## 3. Production Data Protection & Backup Scope

To prevent data loss or accidental overwrites, [deploy.bat](file:///d:/study/templeApp/deploy.bat) enforces strict data isolation:

1. **Zero Plaintext `.env` in Production Directory (Anti-Leak Security)**:
   - To prevent secrets (MongoDB credentials, JWT signing keys, passwords) from being exposed in plaintext, **no `.env` file is deployed to the production directory**.
   - `scripts\build_sea.js` compiles the configuration directly into the encrypted executable binary.
   - Any accidental `.env` in the deployment directory is automatically removed.
2. **Persistent `uploads/` Directory Preservation**:
   - Uploads in `%API_SERVICE_DIR%\uploads` are preserved and served directly at `/uploads`.
3. **Production `logs/` Directory Preservation**:
   - Winston rotating logs and NSSM service stdout/stderr logs are stored in `%API_SERVICE_DIR%\logs` and never wiped during deployment or rollback.
4. **Scope of Backups**:
   - The API backup (`backups\api_YYYYMMDD_HHMMSS\`) stores exclusively the live executable (`myNode.exe`) and nothing else.
   - The UI backup (`backups\ui_YYYYMMDD_HHMMSS\`) contains all static assets from the Nginx document root.
5. **First-Time Deployment Handling**:
   - If no prior service files or UI files exist, the script records first-time deployment status and clearly reports that prior rollback is unavailable.

---

## 4. Pre-Flight and Post-Deployment Checks

### Dedicated Pre-Flight Validation Script (Step 3)
Before modifying any live files or stopping the Windows service:
- `deploy.bat` executes the standalone helper script `scripts\test_preflight.ps1`.
- The staged `myNode.exe` is booted on ephemeral port `5998` with stdout and stderr redirected to `staging\api\preflight_stdout.log` and `staging\api\preflight_stderr.log`.
- The script polls `http://127.0.0.1:5998/health` (up to 45s to accommodate cold-boot Defender scanning and MongoDB connection).
- The check requires:
  1. **HTTP Status Code**: Must be exactly `200` (checked via `StatusCode`).
  2. **JSON Body**: Must match `"status":\s*"OK"`.
- A `finally` block **guarantees** the test process is terminated via PID.
- **Hard Gate**: If pre-flight fails or times out, the script displays the captured `preflight_stderr.log` and halts immediately. Production is completely untouched.

### Startup & MongoDB Connection Verification
In `api/index.js`, the Express server `app.listen()` is only called **after** `await initDB()` successfully resolves the MongoDB connection pool and admin auto-seeding. If MongoDB is down, `initDB()` throws and the process immediately exits with code 1. Therefore, a successful HTTP 200 response on `/health` confirms that MongoDB connected and the database pool is active.

### Post-Deployment Verification (Step 7)
After deploying files and restarting services:
1. **Direct Backend API (`http://127.0.0.1:5000/health`)**:
   - Polled up to 5 times (10s max); requires HTTP `200`.
2. **Nginx Static UI Delivery (`http://localhost/`)**:
   - Probes Nginx web server; requires HTTP `200` **AND** confirms the HTML body contains the `<app-root` Angular root tag (rejecting default/error pages).
3. **Nginx Reverse Proxy Route (`http://localhost/health`)**:
   - Probes the configured Nginx reverse proxy endpoint routing to `/health`; requires HTTP `200` **AND** confirms the JSON body contains `"status":"OK"`.

---

## 5. Rollback Behavior & Verification

If any post-deployment health check fails:
1. **API Service**:
   - NSSM service `MYNODE-2` is stopped and confirmed in `SERVICE_STOPPED` state.
   - Previous API runtime files are restored from `backups\api_YYYYMMDD_HHMMSS\` (preserving `uploads/` and `logs/`).
   - If file restoration fails, the service is **not started** to avoid running corrupted state.
   - If restoration succeeds, the service is started and confirmed in `SERVICE_RUNNING` state.
   - The restored API is probed at `http://127.0.0.1:5000/health` to confirm HTTP `200`.
2. **Angular UI**:
   - The previous UI bundle is restored from `backups\ui_YYYYMMDD_HHMMSS\` to `D:\study\templeApp\ui\dist\ui\browser`.
   - Nginx configuration syntax is tested (`nginx -t`).
   - Nginx is reloaded (`nginx -s reload`).
   - The restored UI is probed at `http://localhost/` to confirm HTTP `200`.
3. **Rollback Verification Report**:
   - Outputs a clear report showing whether the API Service and UI Bundle were restored and verified healthy, or if rollback was unavailable.

---

## 6. Assumptions Requiring User Verification

Before running `deploy.bat`, please verify:

1. **MongoDB is running**:
   - The backend connects to `mongodb://127.0.0.1:27017/node24api`. Verify MongoDB is active (`Get-Service MongoDB` or port `27017` listening).
2. **Port 5000 is free**:
   - Stop any interactive development process (`nodemon index.js` or `npm run dev:api`) in other terminals so the NSSM service can bind to port `5000`.
3. **Production `.env`**:
   - If deploying to a new environment without an existing `D:\study\New folder\.env`, review `api\.env` to confirm production secrets, MongoDB URI, and JWT keys.

---

## 7. Safe Validation Commands (Non-Destructive)

To safely inspect and validate your system **without modifying production files or stopping services**:

### 1. Test Angular Production Build Output:
```cmd
cd /d D:\study\templeApp\ui
npx ng build --dry-run
```

### 2. Verify MongoDB Port & Service:
```powershell
Get-NetTCPConnection -LocalPort 27017 -ErrorAction SilentlyContinue | Select-Object LocalAddress, LocalPort, State
```

### 3. Verify NSSM Service & Path:
```powershell
& "D:\Softwares\nssm-2.24\nssm-2.24\win64\nssm.exe" status MYNODE-2
Get-ItemProperty HKLM:\SYSTEM\CurrentControlSet\Services\MYNODE-2\Parameters | Select-Object Application, AppDirectory
```

### 4. Verify Nginx Configuration Syntax:
```cmd
"D:\Softwares\nginx\nginx.exe" -p "D:\Softwares\nginx" -t -c "D:\Softwares\nginx\conf\nginx.conf"
```

---

## 8. Manual Deployment Command

When ready to execute the automated deployment:

1. Open **Command Prompt as Administrator**.
2. Run:
   ```cmd
   cd /d D:\study\templeApp
   deploy.bat
   ```

### Verification Endpoints:
- **Angular UI**: [http://localhost/](http://localhost/)
- **Nginx Reverse Proxy**: [http://localhost/health](http://localhost/health)
- **Direct Backend Health**: [http://127.0.0.1:5000/health](http://127.0.0.1:5000/health)
- **NSSM Service Status**:
  ```cmd
  "D:\Softwares\nssm-2.24\nssm-2.24\win64\nssm.exe" status MYNODE-2
  ```
