# SecurePass - Password Manager

A full-stack secure password manager with encrypted vault storage, OAuth authentication, and a beautiful glassmorphism UI. **Digilocker-style** vault with folders, tags, favorites, sharing, and comprehensive security features.

## ✨ Features

### 🔐 Secure Authentication
- Email/password registration and login
- Google OAuth 2.0 integration
- GitHub OAuth 2.0 integration
- JWT access tokens + httpOnly refresh token cookies
- Secure session management

### 🔒 Encrypted Vault (Digilocker-Style)
- AES-256-GCM encryption for all stored passwords
- Per-user encryption keys wrapped with MASTER_KEY
- Zero plaintext password storage
- Server-side decryption on reveal

### 📁 Collections (Folders)
- Create custom folders to organize passwords
- Move entries between collections
- Custom icons and colors
- Entry count tracking

### 🏷️ Tags & Smart Filters
- Multi-select tags for categorization
- Search by title/username/site/notes
- Filter by collection, favorites, strength
- Quick filters: Personal, Work, Banking

### ⭐ Favorites & Pinning
- Star favorite entries for quick access
- Pin important credentials to top
- Bulk actions for multi-select

### 🔑 Password Generation
- Customizable length (8-64 characters)
- Character sets: uppercase, lowercase, numbers, symbols
- Cryptographically secure using `crypto.getRandomValues()`
- Real-time strength meter (0-4 score)
- **One-click Quick Save** to vault

### 📊 Password Health Dashboard
- Analysis of all vault passwords
- Categories: Strong, Medium, Weak
- Reused password detection
- Old password warnings (90+ days)

### 🔗 Secure Sharing
- Generate one-time shareable links
- Configurable expiry (hours)
- Max view count limit
- Access logging with IP tracking

### 📝 Audit Log
- Track all security events
- Actions: reveal, copy, create, update, delete, export, share
- IP and timestamp logging
- Activity summary dashboard

### 📤 Export/Import
- Export vault as JSON (decrypted)
- Import from JSON backup
- Validation on import

## 🚀 Quick Start

### Prerequisites
- Node.js 20+
- PostgreSQL 15+ (or Docker)

### 1. Clone and Install

```bash
git clone <repo-url>
cd Securepass

# Install backend dependencies
cd backend && npm install

# Setup environment
cp .env.example .env
# Edit .env with your settings
```

### 2. Database Setup

```bash
# Start PostgreSQL with Docker
docker run -d --name securepass-db \
  -e POSTGRES_USER=securepass \
  -e POSTGRES_PASSWORD=securepass \
  -e POSTGRES_DB=securepass \
  -p 5432:5432 postgres:15-alpine

# Run migrations
cd backend
npx prisma migrate dev
```

### 3. Start Servers

```bash
# Terminal 1: Backend
cd backend
npm run dev
# Runs on http://localhost:4000

# Terminal 2: Frontend
cd ..
npx serve . -l 3000
# Runs on http://localhost:3000
```

### 4. Test

Open http://localhost:3000 and register a new account!

## 🔧 Configuration

### Backend Environment Variables

```env
# Server
PORT=4000
NODE_ENV=development
FRONTEND_ORIGIN=http://localhost:3000

# Database
DATABASE_URL=postgresql://securepass:securepass@localhost:5432/securepass

# JWT Secrets (generate: node -e "console.log(require('crypto').randomBytes(32).toString('hex'))")
JWT_SECRET=your_jwt_secret_here
REFRESH_TOKEN_SECRET=your_refresh_secret_here
JWT_ACCESS_EXPIRES_IN=15m
JWT_REFRESH_EXPIRES_IN=30d

# Encryption (generate: node -e "console.log(require('crypto').randomBytes(32).toString('base64'))")
MASTER_KEY=your_32_byte_base64_key

# Google OAuth
GOOGLE_CLIENT_ID=your_google_client_id
GOOGLE_CLIENT_SECRET=your_google_client_secret
GOOGLE_CALLBACK_URL=http://localhost:4000/api/auth/google/callback

# GitHub OAuth
GITHUB_CLIENT_ID=your_github_client_id
GITHUB_CLIENT_SECRET=your_github_client_secret
GITHUB_CALLBACK_URL=http://localhost:4000/api/auth/github/callback
```

## 📡 API Endpoints

### Authentication
| Method | Endpoint | Description |
|--------|----------|-------------|
| POST | `/api/auth/register` | Register with email/password |
| POST | `/api/auth/login` | Login with email/password |
| POST | `/api/auth/logout` | Logout (revokes refresh token) |
| POST | `/api/auth/refresh` | Refresh access token |
| GET | `/api/auth/me` | Get current user profile |
| GET | `/api/auth/google` | Initiate Google OAuth |
| GET | `/api/auth/github` | Initiate GitHub OAuth |

### Password Vault
| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | `/api/passwords` | List entries (supports search/filter) |
| GET | `/api/passwords/:id` | Get entry with decrypted password |
| POST | `/api/passwords` | Create new entry |
| PUT | `/api/passwords/:id` | Update entry |
| DELETE | `/api/passwords/:id` | Delete entry |
| POST | `/api/passwords/direct-save` | Quick save from generator |
| POST | `/api/passwords/:id/favorite` | Toggle favorite |
| POST | `/api/passwords/:id/pin` | Toggle pin |
| POST | `/api/passwords/bulk-delete` | Delete multiple entries |
| GET | `/api/passwords/health` | Get password health analysis |
| GET | `/api/passwords/export` | Export vault (decrypted JSON) |
| POST | `/api/passwords/import` | Import vault |

### Collections
| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | `/api/collections` | List all collections |
| POST | `/api/collections` | Create collection |
| PUT | `/api/collections/:id` | Update collection |
| DELETE | `/api/collections/:id` | Delete collection |
| POST | `/api/collections/:id/entries` | Move entries to collection |

### Tags
| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | `/api/tags` | List all tags |
| POST | `/api/tags` | Create tag |
| DELETE | `/api/tags/:id` | Delete tag |
| POST | `/api/tags/entries/:entryId` | Add tags to entry |

### Sharing
| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | `/api/share/:token` | Access shared entry (public) |
| GET | `/api/share` | List share links |
| POST | `/api/share` | Create share link |
| DELETE | `/api/share/:id` | Revoke share link |

### Audit
| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | `/api/audit` | Get audit logs |
| GET | `/api/audit/summary` | Get activity summary |

## 🔐 Security Features

### Encryption
- **AES-256-GCM** for password encryption
- Per-user encryption keys
- Keys wrapped with server MASTER_KEY
- Passwords decrypted only on demand

### Cookie Security
```javascript
{
  httpOnly: true,
  secure: process.env.NODE_ENV === 'production',
  sameSite: 'lax',
  path: '/api/auth'
}
```

### Rate Limiting
- 100 requests/15min (general)
- 20 requests/15min (auth endpoints)

### Password Auto-Clear
- Clipboard clears after 15 seconds
- Revealed passwords hide after 10 seconds

## 🧪 Testing

```bash
cd backend

# Run all tests
npm test

# Run with coverage
npm test -- --coverage
```

## 📂 Project Structure

```
├── index.html              # Landing page
├── login.html              # Login page
├── register.html           # Registration page
├── dashboard.html          # Main dashboard
├── oauth-success.html      # OAuth callback handler
├── styles/
│   └── main.css           # Main styles
├── js/
│   ├── api.js             # Backend API client
│   ├── auth.js            # Authentication logic
│   └── dashboard.js       # Dashboard controller
├── backend/
│   ├── src/
│   │   ├── server.ts      # Express server
│   │   ├── config/        # DB & Passport config
│   │   ├── routes/        # API routes
│   │   ├── services/      # Business logic
│   │   ├── middleware/    # Auth & validation
│   │   └── utils/         # Encryption & tokens
│   ├── prisma/            # Database schema
│   └── package.json
└── README.md
```

## 🛠️ Tech Stack

### Frontend
- HTML5, CSS3, JavaScript ES6+
- Glassmorphism UI design
- IndexedDB fallback storage

### Backend
- Node.js 20+ / TypeScript
- Express.js
- Prisma ORM (PostgreSQL)
- Passport.js (OAuth)
- jsonwebtoken, bcrypt, node:crypto

### Security
- Helmet (HTTP headers)
- CORS with credentials
- Rate limiting
- Zod validation

## 👥 Authors

- Harsh Saini
- Aditya Chauhan

## 📄 License

MIT License - feel free to use for learning or production.
