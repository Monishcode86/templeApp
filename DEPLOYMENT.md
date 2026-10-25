# Temple Application Automated Deployment Guide (Windows, Nginx & NSSM)

This document describes the automated deployment architecture, data protection rules, safety mechanisms, and verification procedures implemented in [deploy.bat](file:///d:/study/templeApp/deploy.bat).

---

## 1. Verified Host Configuration & Paths

Every path, service name, and configuration parameter has been confirmed on the target host:

| Component | Path / Value | Verification Notes |
| :--- | :--- | :--- |
| **Workspace Root** | `D:\study\templeApp` | Contains `ui/`, `api/`, `deploy.bat`, and `DEPLOYMENT.md` |
| **Dedicated Staging Directory** | `D:\study\templeApp\staging` | Generated temporary build area (`staging\ui` and `staging\api`) |
| **Angular UI Source** | `D:\study\templeApp\ui` | Angular 22 project (`@angular/build:application`) |
| **Staging UI Output** | `D:\study\templeApp\staging\ui\browser` | Contains production `index.html` and bundled assets |
| **Node.js Active Runtime** | `v24.21.0` (x64) | Active Node binary in `PATH` (`C:\Program Files\nodejs\node.exe`) |
| **Node.js API Source** | `D:\study\templeApp\api` | Express 5 application (`index.js`) |
| **API Executable Technology** | Node.js 24 Single Executable Application (SEA) | Executable (`myNode.exe`) fused with bootstrap blob via `postject` |
| **NSSM Executable** | `D:\Softwares\nssm-2.24\nssm-2.24\win64\nssm.exe` | Verified exact binary path |
| **API NSSM Service** | `MYNODE-2` | Registered Windows service managed by NSSM |
| **API Target Executable** | `D:\study\New folder\myNode.exe` | Binary path registered under `MYNODE-2\Parameters` |
| **API Service Directory** | `D:\study\New folder` | Working directory configured in NSSM (quotes handle spaces) |
| **Nginx Installation** | `D:\Softwares\nginx` | `D:\Softwares\nginx\nginx.exe` |
| **Nginx Configuration** | `D:\Softwares\nginx\conf\nginx.conf` | Reverse proxies `/api/` and `/health` to `http://127.0.0.1:5000` |
| **Nginx Document Root** | `D:/study/templeApp/ui/dist/ui/browser` | Configured directly in `nginx.conf` |
| **Deployment Backups** | `D:\study\templeApp\backups\` | Timestamped UI and API rollbacks (never auto-deleted) |

---

## 2. API Packaging Architecture: Node 24 SEA with Staged Runtime

### Architecture & Runtime Model
`myNode.exe` is **not a monolithic self-contained virtual bundle**. On Windows, this backend requires physical disk paths for:
- **Native C++ Addons (`bcrypt`)**: The Windows dynamic link loader (`LoadLibraryExW`) requires physical `.node` binaries (`node.napi.node`) on an NTFS filesystem. Addons cannot be executed from inside virtual snapshots (such as `@yao-pkg/pkg`'s `C:\snapshot`).
- **Persistent Disk Logging (`winston-daily-rotate-file`)**: Daily log rotation creates and appends physical files in the `logs/` directory.
- **Persistent Uploads (`multer`)**: Static file delivery serves attachments from `uploads/`.

### How It Operates
1. [deploy.bat](file:///d:/study/templeApp/deploy.bat) compiles a **Node.js 24 Single Executable Application (SEA)** using `--experimental-sea-config` and `postject`.
2. The executable embeds a bootstrap script that dynamically anchors to the directory containing the binary:
   ```javascript
   const path = require('node:path');
   const { createRequire } = require('node:module');
   const appDir = path.dirname(process.execPath);
   process.chdir(appDir);
   const req = createRequire(path.join(appDir, 'package.json'));
   req('./index.js');
   ```
3. In staging, `deploy.bat` stages `myNode.exe` together with the application runtime files (`package.json`, `index.js`, `server/`, `config/`, `node_modules` with native `bcrypt` prebuilds, and `.env`).
4. This assembled bundle is verified during pre-flight before deployment to `D:\study\New folder\`.

---

## 3. Production Data Protection & Backup Scope

To prevent data loss or accidental overwrites, [deploy.bat](file:///d:/study/templeApp/deploy.bat) enforces strict data isolation:

1. **Production `.env` Protection**:
   - If `D:\study\New folder\.env` exists, it is **preserved byte-for-byte** and never overwritten by the development `api\.env`.
   - Robocopy explicitly excludes `/XF .env` when a production `.env` is detected.
   - If no production `.env` exists (first-time deployment), the staged `.env` template is initialized with a prominent warning that credentials and secrets must be reviewed.
2. **Persistent `uploads/` Directory Preservation**:
   - Robocopy excludes `/XD "%API_SERVICE_DIR%\uploads"` and `/XD "%STAGING_API_DIR%\uploads"`.
   - Existing user-uploaded files, receipts, and images in `D:\study\New folder\uploads` are never wiped, mirrored, or overwritten.
3. **Production `logs/` Directory Preservation**:
   - Robocopy excludes `/XD "%API_SERVICE_DIR%\logs"` and `/XD "%STAGING_API_DIR%\logs"`.
   - Winston daily rotating logs (`app-*.log`, `error-*.log`) are never deleted during deployment or rollback.
4. **Scope of Backups**:
   - The API backup (`backups\api_YYYYMMDD_HHMMSS\`) contains the application code, executable (`myNode.exe`), runtime dependencies (`node_modules`), and `.env`. It **does not** include persistent `logs/` or `uploads/` to avoid copying large binary assets or active rotating logs.
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
