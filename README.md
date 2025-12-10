# SecurePass - Password Manager

A full-stack secure password manager with encrypted vault storage, OAuth authentication, and a beautiful glassmorphism UI.

![Dashboard Preview](https://via.placeholder.com/800x450?text=SecurePass+Dashboard)

## Features

### 🔐 Secure Authentication
- Email/password registration and login
- Google OAuth 2.0 integration
- GitHub OAuth 2.0 integration
- JWT access tokens + httpOnly refresh token cookies
- Secure session management

### 🔒 Encrypted Vault
- AES-256-GCM encryption for all stored passwords
- Per-user encryption keys
- Server-side key wrapping with MASTER_KEY
- Zero plaintext password storage

### 🔑 Password Generation
- Customizable policy controls (length, character requirements)
- Cryptographically secure random generation using `crypto.getRandomValues()`
- Options to avoid similar characters (I, l, 1, 0, O)
- No immediate repeating characters option

### 🤖 AI-Powered Generation
- Integration with Google Gemini AI
- Natural language password descriptions
- Respects policy constraints

### 📊 Strength Analysis
- Real-time entropy calculation
- Visual strength meter with 5 levels
- Detailed strength labels (Very Weak → Very Strong)

### 📜 Password History
- Persistent storage using IndexedDB (localStorage fallback)
- Search with debounced filtering
- Sort by date, strength, or length
- Pagination for large histories
- Undo support for deletions

### 🎨 Premium UI/UX
- Dark/Light theme with smooth transitions
- Glassmorphism card design
- Micro-interactions and animations
- Fully responsive layout
- Accessible (ARIA, keyboard navigation)

## Project Structure

```
├── index.html              # Landing page
├── login.html              # Login page with OAuth buttons
├── register.html           # Registration page
├── dashboard.html          # Main password manager dashboard
├── oauth-success.html      # OAuth callback handler
├── styles/
│   ├── main.css           # Main styles with CSS variables
│   ├── auth.css           # Authentication page styles
│   └── dashboard.css      # Dashboard styles
├── js/
│   ├── api.js             # Backend API client
│   ├── auth.js            # Authentication logic
│   ├── main.js            # Application entry point
│   ├── passwordGenerator.js # Core password generation logic
│   ├── strengthMeter.js   # Entropy & strength calculations
│   ├── uiController.js    # DOM updates & event binding
│   ├── storage.js         # IndexedDB/localStorage management
│   ├── history.js         # Password history with search/sort
│   └── accessibility.js   # ARIA, keyboard shortcuts, focus
├── backend/               # Node.js + TypeScript API
│   ├── src/
│   │   ├── server.ts      # Express server entry point
│   │   ├── config/        # Database & Passport config
│   │   ├── routes/        # API routes (auth, passwords)
│   │   ├── services/      # Business logic
│   │   ├── middleware/    # Auth & validation middleware
│   │   └── utils/         # Encryption & token utilities
│   ├── prisma/            # Database schema & migrations
│   └── package.json
├── docker-compose.yml     # Docker setup for DB & backend
└── package.json           # Frontend configuration
```

## Getting Started

### Prerequisites
- Node.js 20+ 
- PostgreSQL 15+ (or Docker)
- npm or yarn

### Quick Start with Docker

```bash
# Start PostgreSQL database
docker-compose up -d db

# Install backend dependencies
cd backend && npm install

# Run database migrations
npx prisma migrate dev

# Start backend server
npm run dev
```

### Manual Setup

#### 1. Database Setup

```bash
# Create PostgreSQL database
createdb securepass

# Or use Docker
docker run -d --name securepass-db \
  -e POSTGRES_USER=securepass \
  -e POSTGRES_PASSWORD=securepass \
  -e POSTGRES_DB=securepass \
  -p 5432:5432 postgres:15-alpine
```

#### 2. Backend Setup

```bash
cd backend

# Install dependencies
npm install

# Copy environment file and configure
cp .env.example .env
# Edit .env with your settings

# Generate Prisma client
npx prisma generate

# Run migrations
npx prisma migrate dev

# (Optional) Seed test user
npm run db:seed

# Start development server
npm run dev
```

#### 3. Frontend Setup

```bash
# From project root
npm install
npm run dev
```

### Configuration

#### Backend Environment Variables

```env
# Server
PORT=4000
FRONTEND_ORIGIN=http://localhost:3000

# Database
DATABASE_URL=postgresql://securepass:securepass@localhost:5432/securepass

# JWT (generate with: node -e "console.log(require('crypto').randomBytes(32).toString('hex'))")
JWT_SECRET=your_jwt_secret
REFRESH_TOKEN_SECRET=your_refresh_secret
JWT_ACCESS_EXPIRES_IN=15m
JWT_REFRESH_EXPIRES_IN=30d

# Encryption (generate with: node -e "console.log(require('crypto').randomBytes(32).toString('base64'))")
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

### OAuth Setup

#### Google OAuth
1. Go to [Google Cloud Console](https://console.cloud.google.com/)
2. Create OAuth 2.0 credentials
3. Add redirect URI: `http://localhost:4000/api/auth/google/callback`

#### GitHub OAuth
1. Go to [GitHub Developer Settings](https://github.com/settings/developers)
2. Create new OAuth App
3. Set callback URL: `http://localhost:4000/api/auth/github/callback`

## Keyboard Shortcuts

| Key | Action |
|-----|--------|
| `G` | Generate new password |
| `C` | Copy password to clipboard |
| `T` | Toggle dark/light theme |
| `H` | Toggle password visibility |
| `/` | Focus search input |
| `Esc` | Close modal |

## Browser Support

- Chrome 90+
- Firefox 88+
- Safari 14+
- Edge 90+

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
| GET | `/api/auth/github` | Initiate GitHub OAuth |

### Password Vault
| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | `/api/passwords` | List all entries |
| GET | `/api/passwords/:id` | Get entry with decrypted password |
| POST | `/api/passwords` | Create new entry |
| PUT | `/api/passwords/:id` | Update entry |
| DELETE | `/api/passwords/:id` | Delete entry |

## Tech Stack

### Frontend
- **HTML5** - Semantic markup
- **CSS3** - Custom properties, Flexbox, Grid, animations
- **JavaScript ES6+** - Modules, async/await, Web APIs
- **IndexedDB** - Client-side storage fallback

### Backend
- **Node.js 20+** - Runtime
- **TypeScript** - Type safety
- **Express** - Web framework
- **Prisma** - ORM for PostgreSQL
- **Passport.js** - OAuth strategies
- **jsonwebtoken** - JWT handling
- **bcrypt** - Password hashing
- **node:crypto** - AES-256-GCM encryption

### Security
- **Helmet** - HTTP security headers
- **CORS** - Cross-origin resource sharing
- **Rate Limiting** - Brute force protection
- **Zod** - Input validation

## Testing

```bash
cd backend

# Run all tests
npm test

# Run with coverage
npm test -- --coverage
```

## Authors

- Harsh Saini
- Aditya Chauhan

## License

MIT License - feel free to use this project for learning or production.
