# SecurePass Backend

A secure password manager API built with Node.js, TypeScript, Express, and PostgreSQL.

## Features

- 🔐 **Email/Password Authentication** - Secure registration and login with bcrypt
- 🌐 **OAuth 2.0** - Login with Google (Gmail) and GitHub
- 🎫 **JWT Tokens** - Short-lived access tokens + httpOnly refresh token cookies
- 🔒 **Vault Encryption** - AES-256-GCM encryption for all stored passwords
- 🔑 **Key Wrapping** - Per-user encryption keys wrapped with server MASTER_KEY
- 🛡️ **Security** - Helmet, CORS, rate limiting, input validation

## Architecture

### Authentication Flow

```
┌─────────────┐     ┌─────────────┐     ┌─────────────┐
│   Frontend  │────▶│   Backend   │────▶│  PostgreSQL │
└─────────────┘     └─────────────┘     └─────────────┘
       │                   │
       │  Access Token     │  Refresh Token (httpOnly cookie)
       │  (in memory)      │  (stored hashed in DB)
       ▼                   ▼
   API Requests      Token Refresh
```

### Encryption Hierarchy

```
MASTER_KEY (env variable)
    │
    ▼ wraps
Per-User Key (32 bytes, random)
    │
    ▼ encrypts
Vault Entries (passwords)
```

## Quick Start

### Prerequisites

- Node.js 20+
- PostgreSQL 15+
- npm or yarn

### 1. Clone and Install

```bash
cd backend
npm install
```

### 2. Configure Environment

```bash
cp .env.example .env
```

Edit `.env` with your values:

```bash
# Generate secrets
node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"  # JWT_SECRET
node -e "console.log(require('crypto').randomBytes(32).toString('base64'))"  # MASTER_KEY
```

### 3. Setup Database

```bash
# Run migrations
npx prisma migrate dev

# Generate Prisma client
npx prisma generate

# (Optional) Seed test user
npm run db:seed
```

### 4. Start Server

```bash
# Development
npm run dev

# Production
npm run build
npm start
```

## Docker Setup

```bash
# From project root
docker-compose up -d

# Run migrations inside container
docker-compose exec backend npx prisma migrate deploy
```

## API Endpoints

### Authentication

| Method | Endpoint | Description |
|--------|----------|-------------|
| POST | `/api/auth/register` | Register with email/password |
| POST | `/api/auth/login` | Login with email/password |
| POST | `/api/auth/logout` | Logout (revokes refresh token) |
| POST | `/api/auth/refresh` | Refresh access token |
| GET | `/api/auth/me` | Get current user profile |
| GET | `/api/auth/google` | Initiate Google OAuth |
| GET | `/api/auth/google/callback` | Google OAuth callback |
| GET | `/api/auth/github` | Initiate GitHub OAuth |
| GET | `/api/auth/github/callback` | GitHub OAuth callback |

### Passwords (Vault)

| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | `/api/passwords` | List all entries (no passwords) |
| GET | `/api/passwords/:id` | Get entry with decrypted password |
| POST | `/api/passwords` | Create new entry |
| PUT | `/api/passwords/:id` | Update entry |
| DELETE | `/api/passwords/:id` | Delete entry |

## OAuth Setup (Detailed)

### Google OAuth
1. Go to [Google Cloud Console](https://console.cloud.google.com/).
2. Create `SecurePass` project.
3. **APIs & Services > Credentials** > **Create Credentials** > **OAuth Client ID**.
4. Application Type: **Web application**.
5. **Authorized JavaScript origins**: `http://localhost:3000` (Local Frontend) and `http://localhost:4000` (Backend).
6. **Authorized redirect URIs**:
   - Local: `http://localhost:4000/api/auth/google/callback`
   - Prod: `https://api.yourdomain.com/api/auth/google/callback`
7. Copy `Client ID` and `Client Secret` to `.env`.

### GitHub OAuth
1. Go to **Settings > Developer settings > OAuth Apps**.
2. **New OAuth App**.
3. Homepage URL: `http://localhost:3000`.
4. Authorization callback URL:
   - Local: `http://localhost:4000/api/auth/github/callback`
   - Prod: `https://api.yourdomain.com/api/auth/github/callback`
5. Copy `Client ID` and Generate `Client Secret`.

### Troubleshooting OAuth
- **Cookie not set**: Ensure `FRONTEND_ORIGIN` matches exactly what you see in the browser URL bar.
- **SameSite Strict**: In dev (http), we use `SameSite=Lax`. In prod (https), we can use `Strict` if frontend/backend share the top-level domain. If cross-domain, must use `SameSite=None` + `Secure`.
- **CORS Error**: Ensure `credentials: true` is sent by frontend (axios/fetch) and `Access-Control-Allow-Credentials: true` is returned by backend.

---

## 🔧 Environment Variables

Required variables in `backend/.env`. **DO NOT COMMIT THIS FILE.**

| Variable | Description | Example / command to generate |
|---|---|---|
| `PORT` | API Port | `4000` |
| `DATABASE_URL` | PostgreSQL Connection | `postgresql://user:pass@localhost:5432/db` |
| `FRONTEND_ORIGIN` | CORS Origin for Frontend | `http://localhost:3000` |
| `MASTER_KEY` | 32-byte Base64 Key for wrapping | `node -e "console.log(require('crypto').randomBytes(32).toString('base64'))"` |
| `JWT_SECRET` | Signing Access Tokens | `node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"` |
| `REFRESH_TOKEN_SECRET` | Signing Refresh Tokens | `node -e "console.log(require('crypto').randomBytes(64).toString('hex'))"` |
| `GOOGLE_CLIENT_ID` | OAuth ID | From Google Console |
| `GOOGLE_CLIENT_SECRET` | OAuth Secret | From Google Console |
| `GITHUB_CLIENT_ID` | OAuth ID | From GitHub Settings |
| `GITHUB_CLIENT_SECRET` | OAuth Secret | From GitHub Settings |

---

## 🐳 Docker & Local Testing

### Running with Docker Compose
To spin up both Postgres and the Backend fully containerized:

```bash
# In project root
docker-compose up --build
```

The API will be available at `http://localhost:4000`.
Note: You must still configure `.env` in the `backend/` folder or pass them via `docker-compose.yml`.

### Testing OAuth in Development
1. Start Backend: `npm run dev` (Port 4000)
2. Start Frontend: `npx serve . -l 3000` (Port 3000)
3. Visit `http://localhost:3000/login.html`
4. Click "Continue with Google" -> Redirects to Accounts -> Redirects back to `localhost:3000/dashboard.html`.
5. Check DevTools > Application > Cookies: `refresh_token` should be present (HttpOnly).

---

## 🔐 Security Tradeoffs

### 1. Server-Side Key Wrapping (Current Architecture)
- **How it works**: User's encryption key is stored in DB but encrypted (wrapped) by a `MASTER_KEY` held by the application.
- **Pros**: 
  - User doesn't lose data if they forget their password.
  - Easier multi-device sync.
  - Backend can process data (e.g. Health Check) without user interaction if needed (though we currently decrypt on demand).
- **Cons**: 
  - If `MASTER_KEY` and DB are both compromised, attacker can decrypt everything.
- **Mitigation**: Use a Hardware Security Module (HSM) or Cloud KMS (AWS/GCP) to hold the `MASTER_KEY` so it never exists in plaintext memory/env vars.

### 2. Client-Side Encryption (Zero-Knowledge)
- **How it works**: Key is derived from Master Password on client (PBKDF2/Argon2). Server never sees the key.
- **Pros**:
  - True Zero-Knowledge. Server breach reveals nothing but blobs.
- **Cons**:
  - Forget password = **Permanent Data Loss**.
  - No backend features like "Password Health" without sending keys to server or running heavy logic in browser.

> **Recommendation**: For Enterprise/High-Value targets, move to **KMS-based unlocking** of the Master Key, or offer a "Client-Side Only" mode for paranoid users (Roadmap Item).

---

## 🔄 Migration & Production Plan

### Rotating MASTER_KEY
If the `MASTER_KEY` is compromised:
1. Put API in Maintenance Mode.
2. Script: Fetch all users' `wrappedKey`.
3. Unwrap using OLD Master Key.
4. Wrap using NEW Master Key.
5. Update DB and Restart Server with NEW Key.

### Data Backup
- **Regular Dump**: `pg_dump securepass > backup.sql`.
- **JSON Export**: Admin tool to pull all decrypted vaults (requires Master Key).

---

## License
MIT

