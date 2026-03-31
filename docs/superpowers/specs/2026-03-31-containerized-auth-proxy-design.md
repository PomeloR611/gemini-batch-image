# Gemini Batch Image - Containerized Auth & Proxy Design

## Overview

Transform Gemini Batch Image from a pure frontend app to a server-backed application deployable in a Docker container on a local PC, accessible to LAN users with authentication, device binding, and API proxy.

## Goals

1. Docker single-container deployment with `--network=host`
2. Login code authentication with MAC address binding (one code per device)
3. All model API traffic proxied through the server (frontend never holds API Keys)
4. Non-admin users cannot see model configuration (API Keys)
5. Web-based admin panel for managing codes, users, and API Keys

## Tech Stack

- **Backend:** Node.js + Express
- **Database:** SQLite (via `better-sqlite3`)
- **Session:** `express-session` + SQLite session store
- **Frontend:** Existing React + Vite + Tailwind (modified)
- **Container:** Docker, single-stage build, `--network=host`

## Architecture

```
LAN User Browser
    |
    v
Docker Container (--network=host, port 3000)
+-- Express Backend
|   +-- Middleware: session auth (all routes except /login)
|   +-- POST /api/auth/login      -- login code verify + MAC bind
|   +-- POST /api/auth/logout
|   +-- GET  /api/auth/me          -- current user info
|   +-- POST /api/proxy/minimax    -- proxy MiniMax requests
|   +-- POST /api/proxy/gemini     -- proxy Gemini requests
|   +-- GET  /api/admin/codes      -- list login codes
|   +-- POST /api/admin/codes      -- generate login codes
|   +-- DELETE /api/admin/codes/:id -- revoke login code
|   +-- PUT  /api/admin/codes/:id  -- update code (unbind MAC, toggle enabled)
|   +-- GET  /api/admin/users      -- list bound users
|   +-- GET  /api/admin/config     -- get config (admin only)
|   +-- PUT  /api/admin/config     -- set API Keys (admin only)
|   +-- Static file serving -> frontend build output (dist/)
+-- SQLite (data/app.db, volume mounted to host)
```

## Authentication Flow

1. User visits the app -> frontend checks session via `GET /api/auth/me`
2. No session -> redirect to login page
3. User enters login code -> `POST /api/auth/login`
4. Backend processing:
   a. Look up code in SQLite `codes` table, verify it exists and is enabled
   b. Get client IP from request (`req.ip` or `x-forwarded-for`)
   c. Run `arp -a` on the host, parse output to find MAC for the client IP
   d. If code is **unbound** (mac IS NULL): bind this MAC, set `bound_at`, create session
   e. If code is **bound** and MAC **matches**: create session, update `last_login`
   f. If code is **bound** and MAC **does not match**: reject with error "This code is already bound to another device"
5. Session managed by `express-session` with SQLite store
6. Session cookie sent to browser, used for subsequent requests

### MAC Address Retrieval

The container runs with `--network=host`, so it shares the host's network stack. The server executes `arp -a` and parses the output to map client IP to MAC address.

**Windows ARP output format:**
```
Interface: 192.168.1.100 --- 0xc
  Internet Address      Physical Address      Type
  192.168.1.50          aa-bb-cc-dd-ee-ff     dynamic
```

**Implementation:**
```javascript
function getMacFromIp(clientIp) {
  const output = execSync('arp -a').toString();
  // Parse line by line, find the row matching clientIp
  // Extract physical address (MAC), normalize to lowercase colon-separated
  // Return null if not found (e.g., localhost access)
}
```

**Edge case:** When admin accesses from localhost (127.0.0.1 / ::1), ARP lookup will fail. For localhost access, skip MAC binding or use a special "local" identifier.

## Data Model

### codes table

| Column     | Type    | Description                                    |
|------------|---------|------------------------------------------------|
| id         | INTEGER | PRIMARY KEY AUTOINCREMENT                      |
| code       | TEXT    | UNIQUE, 8-char random alphanumeric string      |
| label      | TEXT    | Human-readable note (e.g., "Designer Wang")    |
| mac        | TEXT    | Bound MAC address, NULL if unbound             |
| is_admin   | INTEGER | DEFAULT 0. 1 = admin role                      |
| enabled    | INTEGER | DEFAULT 1. 0 = disabled/revoked                |
| created_at | TEXT    | ISO 8601 timestamp                             |
| bound_at   | TEXT    | ISO 8601 timestamp of first bind, NULL if unbound |
| last_login | TEXT    | ISO 8601 timestamp of most recent login        |

### config table

| Column | Type | Description                                |
|--------|------|--------------------------------------------|
| key    | TEXT | PRIMARY KEY. e.g., 'minimax_api_key'       |
| value  | TEXT | AES-256-CBC encrypted value                |

Encryption key sourced from `ENCRYPTION_KEY` environment variable.

### sessions table

Managed automatically by `express-session` SQLite store.

| Column  | Type | Description        |
|---------|------|--------------------|
| sid     | TEXT | PRIMARY KEY        |
| sess    | TEXT | JSON session data  |
| expired | TEXT | Expiry timestamp   |

### No separate users table

Login codes serve as user identity. Once a code is bound to a MAC, it effectively becomes an "account." This keeps the model simple for a small-scale LAN tool.

## Permission Model

Two roles: **admin** (`is_admin = 1`) and **regular user** (`is_admin = 0`).

| Capability                    | Admin | User |
|-------------------------------|-------|------|
| Use image generation          | Yes   | Yes  |
| View/edit API Keys            | Yes   | No   |
| Generate/revoke login codes   | Yes   | No   |
| View bound users list         | Yes   | No   |
| Unbind device MAC             | Yes   | No   |
| View own usage history        | Yes   | Yes  |
| Access admin panel            | Yes   | No   |

### Middleware enforcement

```javascript
function requireAuth(req, res, next) {
  if (!req.session.user) return res.status(401).json({ error: 'Not authenticated' });
  next();
}

function requireAdmin(req, res, next) {
  if (!req.session.user?.is_admin) return res.status(403).json({ error: 'Admin required' });
  next();
}

// Route registration
app.use('/api/proxy', requireAuth);
app.use('/api/admin', requireAuth, requireAdmin);
```

## API Proxy

All external API calls go through the backend. The frontend never holds API Keys.

### Proxy flow

```
Frontend                      Backend                        External API
POST /api/proxy/gemini  ->  1. Verify session            -> POST generativelanguage.googleapis.com
     { prompt, params }     2. Read API Key from config
                            3. Forward request with Key
                         <- 4. Return response            <- Image base64
```

### Proxy endpoints

**POST /api/proxy/minimax**
- Request body: `{ messages, model, ...params }` (same shape as current MiniMax API call)
- Backend injects API Key, forwards to MiniMax API
- Returns MiniMax response as-is

**POST /api/proxy/gemini**
- Request body: `{ prompt, generationConfig }` (same shape as current Gemini API call)
- Backend injects API Key, forwards to Gemini API
- Returns Gemini response as-is

## Frontend Changes

### New pages/components

1. **LoginPage** - Login code input form. Shown when no valid session.
2. **AdminPanel** - Tab in the app, visible only to admins. Contains:
   - Login code management (generate, list, revoke, unbind MAC)
   - API Key configuration (MiniMax, Gemini)
   - Bound users list with last login time

### Modified modules

| Module | Change |
|--------|--------|
| `src/services/minimax.js` | Request URL changed to `/api/proxy/minimax`, remove API Key parameter |
| `src/services/gemini.js` | Request URL changed to `/api/proxy/gemini`, remove API Key parameter |
| `src/context/AppContext.jsx` | Add `user` state (role, login status); remove `apiKey` states; add auth check on mount |
| `src/components/Settings/index.jsx` | Remove API Key input fields for non-admin; keep language/currency preferences |
| `src/components/Header.jsx` | Add Admin tab (admin only); add logout button |
| `src/App.jsx` | Add route guard: redirect to login if unauthenticated; block admin routes for non-admin |
| `src/services/storage.js` | Image saving handled by server to mounted volume; frontend downloads via backend endpoint |

### Removed from frontend

- API Key storage in LocalStorage
- Direct external API calls from browser
- File System Access API (replaced by server-side file saving)

## Docker Deployment

### Dockerfile (multi-stage)

```dockerfile
# Stage 1: Build frontend
FROM node:20-alpine AS frontend
WORKDIR /app
COPY package*.json ./
RUN npm ci
COPY . .
RUN npm run build

# Stage 2: Production server
FROM node:20-alpine
WORKDIR /app
COPY server/package*.json ./server/
RUN cd server && npm ci --production
COPY server/ ./server/
COPY --from=frontend /app/dist ./dist/
EXPOSE 3000
CMD ["node", "server/index.js"]
```

### Run command

```bash
docker build -t gemini-batch .
docker run -d \
  --network=host \
  -v $(pwd)/data:/app/data \
  -e ENCRYPTION_KEY=your-random-secret-key \
  -e ADMIN_CODE=initial-admin-code \
  gemini-batch
```

- `--network=host`: Required for ARP-based MAC resolution
- `-v ./data:/app/data`: Persist SQLite DB and generated images
- `ENCRYPTION_KEY`: Used for AES encryption of API Keys in DB
- `ADMIN_CODE`: Initial admin login code created on first startup

### First-run initialization

On first startup, if the `codes` table is empty, the server creates one admin code using the `ADMIN_CODE` environment variable. The admin can then log in and create more codes via the admin panel.

## File Structure (new server directory)

```
server/
  index.js            -- Express app entry point
  package.json         -- Server dependencies
  middleware/
    auth.js            -- requireAuth, requireAdmin middleware
  routes/
    auth.js            -- /api/auth/* routes
    proxy.js           -- /api/proxy/* routes
    admin.js           -- /api/admin/* routes
  services/
    db.js              -- SQLite setup and helpers
    arp.js             -- MAC address lookup via ARP
    crypto.js          -- AES encrypt/decrypt for API Keys
  data/                -- (volume mount) SQLite DB + generated images
```

## Security Considerations

- API Keys encrypted at rest in SQLite (AES-256-CBC)
- Session cookies set with `httpOnly`, `sameSite: 'strict'`
- Admin routes protected by middleware
- No HTTPS needed for LAN-only deployment (optional: add self-signed cert)
- Rate limiting on login endpoint to prevent brute force
- ARP cache may be stale; consider running `arp -d` + `ping` before lookup if MAC not found
