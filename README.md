# firstcut (`node24api`)

A production-grade fullstack workspace featuring a decoupled **Node 24 REST API service** and an **Angular frontend application**. Architected for flexibility across **on-premise environments** (PM2, NSSM, Windows Service) and **cloud platforms** (Docker, Kubernetes).

---

## Architecture Overview

```
node24api/
├── package.json               # Root workspace commands
├── README.md                  # Comprehensive setup & operations guide
│
├── api/                       # Backend REST API Service
│   ├── config/logger.js       # Winston logger with 30-day rotation & auto-cleanup
│   ├── controller/            # User and Authentication controllers
│   ├── dao/commonDao.js       # Generic DAO (Mongoose 9 compatible)
│   ├── db/db.js               # Resilient MongoDB pool & idempotent admin seeder
│   ├── dto/index.js           # Schema dictionary registry
│   ├── logs/                  # Auto-generated daily log files (app-*.log, error-*.log)
│   ├── middleware/            # JWT Auth, Role Guard, Rate Limiter, Error Handler
│   ├── model/userModel.js     # User Mongoose schema (indexes, masked password)
│   ├── router/                # Modular API routes (/health, /login, /user)
│   ├── server/server.js       # Express 5 app with Helmet & CORS
│   ├── index.js               # App entry point with graceful startup & shutdown
│   ├── ecosystem.config.js    # PM2 cluster configuration
│   ├── Dockerfile             # Multi-stage production container build
│   ├── .dockerignore
│   ├── .env.example           # Production environment variable template
│   └── package.json           # Backend dependencies
│
└── ui/                        # Frontend Web Application
    ├── src/                   # Standalone Angular components, routing, and styles
    ├── angular.json           # Angular CLI build & serve configurations
    ├── proxy.conf.json        # Dev proxy routing /api -> http://localhost:5000
    ├── tsconfig.json
    └── package.json           # Angular dependencies
```

---

## System Requirements

| Component | Required Version | Verification Command |
| :--- | :--- | :--- |
| **Node.js** | **`v24.21.0`** or higher (Node 24 LTS) | `node -v` |
| **npm** | **`v11.x`** or higher | `npm -v` |
| **MongoDB** | **`v6.x`**, **`v7.x`**, or **`v8.x`** / MongoDB Atlas | `mongod --version` |

---

## 1. Environment Configuration

Navigate to the `api` folder and create your `.env` file from `.env.example`:

```bash
cd api
cp .env.example .env
```

### Configuration Parameters:

```ini
# Application Configuration
NODE_ENV=production
PORT=5000

# MongoDB Connection String (On-Prem or Cloud Atlas)
URI=mongodb://127.0.0.1:27017/node24api
MONGO_MAX_POOL_SIZE=20
MONGO_MIN_POOL_SIZE=5

# Initial Admin Auto-Seeder Credentials
adminUserPasssword=Admin@12345
ADMIN_EMAIL=admin@gmail.com
HASH_ROUNDS=10

# Security & Tokens
JWT_SECRET=super_secret_jwt_key_please_change_in_production_2026
ACCESS_TOKEN_EXPIRES_IN=15m
REFRESH_TOKEN_SECRET=super_secret_refresh_jwt_key_please_change_in_production_2026
REFRESH_TOKEN_EXPIRES_IN=7d

# Network Security
CORS_ORIGIN=*
RATE_LIMIT_WINDOW_MS=900000
RATE_LIMIT_MAX=100

# Logging & 30-Day Auto Retention
LOG_DIR=logs
LOG_LEVEL=info
LOG_RETENTION_DAYS=30d
ENABLE_CONSOLE_LOG=true
```

---

## 2. Dependency Installation

### Install all dependencies across both projects:
From the workspace root (`node24api/`):

```bash
# Install backend API dependencies
cd api && npm install && cd ..

# Install frontend UI dependencies
cd ui && npm install && cd ..
```

---

## 3. Development Commands

Run both services concurrently during local development:

### Run from Root Directory (`node24api/`):
```bash
# Terminal 1: Start Backend API with auto-reload (Nodemon on port 5000)
npm run dev:api

# Terminal 2: Start Frontend Angular with Dev Proxy (on port 4200)
npm run start:ui
```

> **Note on Dev Proxy**: The Angular dev server automatically proxies all `/api/*` calls to `http://localhost:5000/api/*` via [proxy.conf.json](file:///d:/study/node24api/ui/proxy.conf.json).

---

## 4. Build & Testing Commands

### Build Frontend (Angular):
```bash
# From workspace root:
npm run build:ui

# Or inside ui/ directory:
cd ui
npm run build
```
*Output bundle location:* `ui/dist/ui`

### Run Frontend Unit Tests:
```bash
npm run test:ui
```

### Verify Backend Syntax & Imports:
```bash
cd api
node --check index.js server/server.js
```

---

## 5. Logging & 30-Day Auto-Deletion

The API uses **Winston Daily Rotate File** to guarantee reliable logging without exhausting storage:

- **Directory**: `api/logs/`
- **Application Logs**: `api/logs/app-YYYY-MM-DD.log` (All HTTP traffic, status codes, query timing, info)
- **Error Logs**: `api/logs/error-YYYY-MM-DD.log` (All error events, stack traces, and request payloads)
- **Retention Policy**: Logs are compressed (`.gz`) and **automatically pruned after 30 days (`30d`)**.

---

## 6. Security Hardening & PWA Capabilities

### Security Defenses:
- **NoSQL / SQL Query Injection Prevention**: Express 5 recursive input sanitizer automatically strips malicious MongoDB operators (`$`, `.`) from request bodies, parameters, and query strings.
- **Cross-Site Scripting (XSS) & Clickjacking**:
  - `Helmet` enforces `X-Content-Type-Options: nosniff`, `X-Frame-Options: SAMEORIGIN`, and strict referrers.
  - Angular template engine performs strict contextual DOM sanitization, eliminating client-side XSS.
- **HTTP Parameter Pollution (HPP)**: Protected using `hpp` middleware.
- **Brute Force & DoS Protection**: `express-rate-limit` throttles excessive requests per IP.
- **JWT & Automatic Refresh Token Rotation**:
  - Short-lived Access Tokens (`15m`).
  - Secure Refresh Tokens (`7d`) with automatic rotation in Angular `errorInterceptor` upon receiving HTTP `401`.

### Progressive Web App (PWA) & Mobile Adaptive Layout:
- **Viewport & Touch Targets**: Standard minimum 44px touch targets, mobile viewport protection, and safe-area insets configured in `ui/src/index.html`.
- **Adaptive Drawer Navigation**: Slide-out mobile drawer with frosted backdrop blur on viewports `< 768px`.
- **Dark & Light Themes**: Instant switching with persistent theme settings.
- **Multi-Language (i18n)**: English, Spanish, and French with instant UI translation.

---

## 7. Production Deployment Guides

### Option A: On-Premise via PM2 (Recommended for Linux & Windows Server)

PM2 provides process clustering, zero-downtime reloads, and automatic crash recovery.

```bash
cd api

# 1. Start application in cluster mode across CPU cores
npx pm2 start ecosystem.config.js --env production

# 2. View running processes and status
npx pm2 status

# 3. Monitor live logs
npx pm2 logs node24api

# 4. Save process list to automatically start on server reboot
npx pm2 save
npx pm2 startup
```

---

### Option B: On-Premise via NSSM (Windows Service)

To run the API as a background Windows Service using NSSM (Non-Sucking Service Manager):

1. Download NSSM and place `nssm.exe` in your `PATH`.
2. Open PowerShell / Command Prompt as **Administrator**:

```cmd
:: Install the service
nssm.exe install node24api "C:\Program Files\nodejs\node.exe" "D:\study\node24api\api\index.js"

:: Set working directory
nssm.exe set node24api AppDirectory "D:\study\node24api\api"

:: Configure automatic restart on crash
nssm.exe set node24api AppExit Default Restart
nssm.exe set node24api AppRestartDelay 5000

:: Start the service
nssm.exe start node24api

:: Check status
nssm.exe status node24api
```

---

### Option C: Containerized Deployment (Docker / Cloud)

A multi-stage production Dockerfile is ready in `api/`:

```bash
cd api

# 1. Build Docker image
docker build -t node24api:latest .

# 2. Run container mapping port 5000
docker run -d \
  --name node24api-prod \
  -p 5000:5000 \
  --env-file .env \
  --restart unless-stopped \
  node24api:latest

# 3. Inspect container logs
docker logs -f node24api-prod
```

---

### Option D: Production Frontend Serving (NGINX Example)

When deploying to production, build the Angular UI with `npm run build:ui` and serve via NGINX:

```nginx
server {
    listen 80;
    server_name yourdomain.com;

    # Serve Angular Static Files
    location / {
        root /var/www/node24api/ui/dist/ui/browser;
        index index.html;
        try_files $uri $uri/ /index.html;
    }

    # Proxy API Traffic to Node 24 Express Service
    location /api/ {
        proxy_pass http://127.0.0.1:5000/api/;
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection 'upgrade';
        proxy_set_header Host $host;
        proxy_cache_bypass $http_upgrade;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
    }
}
```

---

## 8. API Reference

### Base URL: `http://localhost:5000`

| Method | Endpoint | Description | Auth Required |
| :--- | :--- | :--- | :--- |
| `GET` | `/health` | Liveness & Readiness probe (returns uptime & status) | None |
| `POST` | `/api/login` | Authenticate with `{ email, password }` -> returns `{ accessToken, refreshToken, user }` | None |
| `POST` | `/api/login/refresh` | Exchange `{ refreshToken }` for new `{ accessToken, refreshToken }` | None |
| `GET` | `/api/login/me` | Fetch authenticated user details | Bearer JWT |
| `POST` | `/api/user` | Create user `{ username, email, password, role }` | None / Controller |
| `GET` | `/api/user` | Fetch all registered users | None / Controller |
| `GET` | `/api/user/:id` | Fetch specific user by ID | None / Controller |
| `PUT` | `/api/user/:id` | Update user details or password | None / Controller |
| `DELETE` | `/api/user/:id` | Delete user by ID | None / Controller |
>>>>>>> 59ee713 (Initial commit: Node24 API and Angular UI with Shift Management)
