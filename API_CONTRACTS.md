# API Contracts

Complete API reference for SecurePass frontend integration.

**Base URL:** `http://localhost:4000/api`

---

## Table of Contents
1. [Authentication](#authentication)
2. [Vault (Passwords)](#vault-passwords)
3. [Collections](#collections)
4. [Tags](#tags)
5. [Sharing](#sharing)
6. [Audit](#audit)
7. [Error Responses](#error-responses)

---

## Authentication

### POST /api/auth/register

Create a new user account.

**Request:**
```json
{
  "email": "user@example.com",
  "password": "SecurePass123!",
  "name": "John Doe"
}
```

| Field | Type | Required | Validation |
|-------|------|----------|------------|
| email | string | ✅ | Valid email format |
| password | string | ✅ | Min 8 chars, 1 uppercase, 1 lowercase, 1 number |
| name | string | ❌ | 1-100 chars |

**Response (201 Created):**
```json
{
  "message": "Registration successful",
  "user": {
    "id": "uuid-v4",
    "email": "user@example.com",
    "name": "John Doe",
    "hasVaultKey": true,
    "createdAt": "2024-01-15T10:30:00.000Z"
  },
  "accessToken": "eyJhbGciOiJIUzI1NiIs..."
}
```

**Cookie Set:**
```
Set-Cookie: refreshToken=<token>; HttpOnly; Path=/api/auth; SameSite=Lax; Expires=<30d>
```

---

### POST /api/auth/login

Authenticate an existing user.

**Request:**
```json
{
  "email": "user@example.com",
  "password": "SecurePass123!"
}
```

**Response (200 OK):**
```json
{
  "message": "Login successful",
  "user": {
    "id": "uuid-v4",
    "email": "user@example.com",
    "name": "John Doe",
    "hasVaultKey": true,
    "createdAt": "2024-01-15T10:30:00.000Z"
  },
  "accessToken": "eyJhbGciOiJIUzI1NiIs..."
}
```

**Cookie Set:** Same as register

---

### POST /api/auth/refresh

Get a new access token using refresh cookie.

**Request:**
- No body required
- Refresh token sent automatically via cookie

**Response (200 OK):**
```json
{
  "accessToken": "eyJhbGciOiJIUzI1NiIs...",
  "user": {
    "id": "uuid-v4",
    "email": "user@example.com",
    "name": "John Doe",
    "hasVaultKey": true,
    "createdAt": "2024-01-15T10:30:00.000Z"
  }
}
```

---

### POST /api/auth/logout

Revoke refresh token and clear cookie.

**Request:**
- Refresh token sent via cookie

**Response (200 OK):**
```json
{
  "message": "Logged out successfully"
}
```

**Cookie Cleared:**
```
Set-Cookie: refreshToken=; HttpOnly; Path=/api/auth; Max-Age=0
```

---

### GET /api/auth/me

Get current authenticated user.

**Headers:**
```
Authorization: Bearer <accessToken>
```

**Response (200 OK):**
```json
{
  "user": {
    "id": "uuid-v4",
    "email": "user@example.com",
    "name": "John Doe",
    "hasVaultKey": true,
    "createdAt": "2024-01-15T10:30:00.000Z"
  }
}
```

---

### OAuth Flows

#### GET /api/auth/google

Redirects to Google OAuth consent screen.

**Flow:**
1. Frontend redirects user to `GET /api/auth/google`
2. Google shows consent screen
3. Google redirects to `/api/auth/google/callback`
4. Backend sets refresh cookie
5. Backend redirects to `${FRONTEND_ORIGIN}/oauth-success.html`
6. Frontend calls `POST /api/auth/refresh` to get access token

#### GET /api/auth/github

Same flow as Google OAuth.

---

## Vault (Passwords)

All vault endpoints require:
```
Authorization: Bearer <accessToken>
```

### GET /api/passwords

List all password entries (without decrypted passwords).

**Query Parameters:**
| Param | Type | Description |
|-------|------|-------------|
| query | string | Search in title/username/site/notes |
| collectionId | string | Filter by collection |
| tagIds | string | Comma-separated tag IDs |
| isFavorite | boolean | Filter favorites only |
| isPinned | boolean | Filter pinned only |
| strengthMin | number | Minimum strength (0-4) |
| strengthMax | number | Maximum strength (0-4) |

**Response (200 OK):**
```json
{
  "entries": [
    {
      "id": "uuid-v4",
      "title": "Gmail Account",
      "username": "user@gmail.com",
      "site": "https://gmail.com",
      "collectionId": "uuid-v4" | null,
      "isFavorite": true,
      "isPinned": false,
      "strength": 4,
      "tags": [
        { "id": "uuid", "name": "email", "color": "#3b82f6" }
      ],
      "createdAt": "2024-01-15T10:30:00.000Z",
      "updatedAt": "2024-01-15T10:30:00.000Z"
    }
  ]
}
```

---

### GET /api/passwords/:id

Get a single entry with decrypted password.

**Response (200 OK):**
```json
{
  "entry": {
    "id": "uuid-v4",
    "title": "Gmail Account",
    "username": "user@gmail.com",
    "password": "MyDecryptedPassword123!",
    "site": "https://gmail.com",
    "notes": "Personal email account",
    "collectionId": "uuid-v4" | null,
    "isFavorite": true,
    "isPinned": false,
    "strength": 4,
    "tags": [
      { "id": "uuid", "name": "email", "color": "#3b82f6" }
    ],
    "createdAt": "2024-01-15T10:30:00.000Z",
    "updatedAt": "2024-01-15T10:30:00.000Z"
  }
}
```

---

### POST /api/passwords

Create a new password entry.

**Request:**
```json
{
  "title": "Gmail Account",
  "username": "user@gmail.com",
  "password": "MySecurePassword123!",
  "site": "https://gmail.com",
  "notes": "Personal email account",
  "tags": ["email", "personal"],
  "collectionId": "uuid-v4",
  "isFavorite": false,
  "isPinned": false
}
```

| Field | Type | Required | Validation |
|-------|------|----------|------------|
| title | string | ✅ | 1-255 chars |
| username | string | ❌ | Max 255 chars |
| password | string | ✅ | Min 1 char |
| site | string | ❌ | Valid URL |
| notes | string | ❌ | Max 5000 chars |
| tags | string[] | ❌ | Array of tag names |
| collectionId | string | ❌ | Valid collection UUID |
| isFavorite | boolean | ❌ | Default: false |
| isPinned | boolean | ❌ | Default: false |

**Response (201 Created):**
```json
{
  "message": "Password created successfully",
  "entry": {
    "id": "uuid-v4",
    "title": "Gmail Account",
    "username": "user@gmail.com",
    "password": "MySecurePassword123!",
    "site": "https://gmail.com",
    "notes": "Personal email account",
    "collectionId": "uuid-v4",
    "isFavorite": false,
    "isPinned": false,
    "strength": 4,
    "tags": [],
    "createdAt": "2024-01-15T10:30:00.000Z",
    "updatedAt": "2024-01-15T10:30:00.000Z"
  }
}
```

---

### POST /api/passwords/direct-save

Quick save from password generator (same as POST /api/passwords but different message).

**Request:** Same as POST /api/passwords

**Response (201 Created):**
```json
{
  "message": "Saved to vault",
  "entry": { ... }
}
```

---

### PUT /api/passwords/:id

Update an existing entry.

**Request:**
```json
{
  "title": "Updated Title",
  "password": "NewPassword456!",
  "isFavorite": true
}
```

All fields are optional. Only included fields are updated.

**Response (200 OK):**
```json
{
  "message": "Password updated successfully",
  "entry": { ... }
}
```

---

### DELETE /api/passwords/:id

Delete a password entry.

**Response (200 OK):**
```json
{
  "message": "Password deleted successfully"
}
```

---

### POST /api/passwords/:id/favorite

Toggle favorite status.

**Response (200 OK):**
```json
{
  "isFavorite": true
}
```

---

### POST /api/passwords/:id/pin

Toggle pinned status.

**Response (200 OK):**
```json
{
  "isPinned": true
}
```

---

### POST /api/passwords/bulk-delete

Delete multiple entries at once.

**Request:**
```json
{
  "entryIds": ["uuid-1", "uuid-2", "uuid-3"]
}
```

**Response (200 OK):**
```json
{
  "message": "Deleted 3 entries",
  "count": 3
}
```

---

### GET /api/passwords/health

Get password health analysis.

**Response (200 OK):**
```json
{
  "health": {
    "total": 50,
    "strong": 35,
    "medium": 10,
    "weak": 5,
    "reused": 3,
    "old": 8,
    "noPassword": 0
  }
}
```

| Field | Description |
|-------|-------------|
| total | Total password count |
| strong | Strength 4 |
| medium | Strength 2-3 |
| weak | Strength 0-1 |
| reused | Same password used multiple times |
| old | Created > 90 days ago |
| noPassword | Entries with empty password |

---

### GET /api/passwords/export

Export all entries with decrypted passwords.

**Response (200 OK):**
```json
{
  "entries": [
    {
      "id": "uuid-v4",
      "title": "Gmail Account",
      "username": "user@gmail.com",
      "password": "DecryptedPassword123!",
      "site": "https://gmail.com",
      "notes": "Personal email",
      "collectionId": null,
      "isFavorite": true,
      "isPinned": false,
      "strength": 4,
      "tags": [],
      "createdAt": "2024-01-15T10:30:00.000Z",
      "updatedAt": "2024-01-15T10:30:00.000Z"
    }
  ]
}
```

---

### POST /api/passwords/import

Import entries from JSON.

**Request:**
```json
{
  "entries": [
    {
      "title": "Twitter",
      "username": "myuser",
      "password": "Password123!",
      "site": "https://twitter.com"
    }
  ]
}
```

**Response (200 OK):**
```json
{
  "message": "Successfully imported 5 entries",
  "count": 5
}
```

---

## Collections

### GET /api/collections

List all collections.

**Response (200 OK):**
```json
{
  "collections": [
    {
      "id": "uuid-v4",
      "name": "Work",
      "description": "Work-related passwords",
      "icon": "💼",
      "color": "#3b82f6",
      "entryCount": 15,
      "createdAt": "2024-01-15T10:30:00.000Z",
      "updatedAt": "2024-01-15T10:30:00.000Z"
    }
  ]
}
```

---

### POST /api/collections

Create a new collection.

**Request:**
```json
{
  "name": "Personal",
  "description": "Personal accounts",
  "icon": "🏠",
  "color": "#22c55e"
}
```

| Field | Type | Required |
|-------|------|----------|
| name | string | ✅ |
| description | string | ❌ |
| icon | string | ❌ (emoji) |
| color | string | ❌ (hex color) |

**Response (201 Created):**
```json
{
  "collection": { ... }
}
```

---

### PUT /api/collections/:id

Update a collection.

**Request:**
```json
{
  "name": "Updated Name",
  "icon": "📁"
}
```

**Response (200 OK):**
```json
{
  "collection": { ... }
}
```

---

### DELETE /api/collections/:id

Delete a collection. Entries are moved to "uncategorized".

**Response (200 OK):**
```json
{
  "message": "Collection deleted"
}
```

---

### POST /api/collections/:id/entries

Move entries to a collection.

**Request:**
```json
{
  "entryIds": ["uuid-1", "uuid-2"]
}
```

Use `:id` = `null` to move to uncategorized.

**Response (200 OK):**
```json
{
  "message": "Moved 2 entries",
  "count": 2
}
```

---

## Tags

### GET /api/tags

List all tags.

**Response (200 OK):**
```json
{
  "tags": [
    {
      "id": "uuid-v4",
      "name": "email",
      "color": "#3b82f6",
      "entryCount": 5
    }
  ]
}
```

---

### POST /api/tags

Create a new tag.

**Request:**
```json
{
  "name": "social",
  "color": "#ec4899"
}
```

**Response (201 Created):**
```json
{
  "tag": {
    "id": "uuid-v4",
    "name": "social",
    "color": "#ec4899",
    "entryCount": 0
  }
}
```

---

### DELETE /api/tags/:id

Delete a tag.

**Response (200 OK):**
```json
{
  "message": "Tag deleted"
}
```

---

### POST /api/tags/entries/:entryId

Add tags to an entry.

**Request:**
```json
{
  "tagIds": ["uuid-1", "uuid-2"]
}
```

**Response (200 OK):**
```json
{
  "message": "Tags added"
}
```

---

### DELETE /api/tags/entries/:entryId

Remove tags from an entry.

**Request:**
```json
{
  "tagIds": ["uuid-1"]
}
```

**Response (200 OK):**
```json
{
  "message": "Tags removed"
}
```

---

## Sharing

### POST /api/share

Create a shareable link for a password entry.

**Request:**
```json
{
  "entryId": "uuid-v4",
  "maxViews": 1,
  "expiresInHours": 24,
  "includePassword": true,
  "includeNotes": false
}
```

| Field | Type | Default | Description |
|-------|------|---------|-------------|
| entryId | string | required | Password entry ID |
| maxViews | number | 1 | Maximum view count |
| expiresInHours | number | 24 | Hours until expiry |
| includePassword | boolean | true | Include password in share |
| includeNotes | boolean | false | Include notes in share |

**Response (201 Created):**
```json
{
  "link": {
    "id": "uuid-v4",
    "token": "abc123def456...",
    "entryId": "uuid-v4",
    "entryTitle": "Gmail Account",
    "maxViews": 1,
    "viewCount": 0,
    "expiresAt": "2024-01-16T10:30:00.000Z",
    "includePassword": true,
    "includeNotes": false,
    "createdAt": "2024-01-15T10:30:00.000Z"
  },
  "shareUrl": "http://localhost:3000/shared.html?token=abc123def456..."
}
```

---

### GET /api/share/:token

Access a shared entry (PUBLIC - no auth required).

**Response (200 OK):**
```json
{
  "entry": {
    "title": "Gmail Account",
    "username": "user@gmail.com",
    "site": "https://gmail.com",
    "password": "SharedPassword123!",
    "notes": "Optional notes if included"
  }
}
```

**Response (404 Not Found):**
```json
{
  "error": "Share link not found or expired"
}
```

---

### GET /api/share

List all share links for current user.

**Response (200 OK):**
```json
{
  "links": [
    {
      "id": "uuid-v4",
      "token": "",
      "entryId": "uuid-v4",
      "entryTitle": "Gmail Account",
      "maxViews": 1,
      "viewCount": 0,
      "expiresAt": "2024-01-16T10:30:00.000Z",
      "includePassword": true,
      "includeNotes": false,
      "createdAt": "2024-01-15T10:30:00.000Z"
    }
  ]
}
```

Note: `token` is empty in list response for security.

---

### DELETE /api/share/:id

Revoke a share link.

**Response (200 OK):**
```json
{
  "message": "Share link revoked"
}
```

---

## Audit

### GET /api/audit

Get audit log entries.

**Query Parameters:**
| Param | Type | Description |
|-------|------|-------------|
| limit | number | Max entries (default: 50) |
| offset | number | Pagination offset |
| action | string | Filter by action type |
| startDate | ISO date | Filter from date |
| endDate | ISO date | Filter to date |

**Action Types:**
- `login`, `logout`
- `reveal`, `copy`
- `create`, `update`, `delete`
- `export`, `import`
- `share`, `share_access`

**Response (200 OK):**
```json
{
  "logs": [
    {
      "id": "uuid-v4",
      "action": "reveal",
      "entryId": "uuid-v4",
      "entryTitle": "Gmail Account",
      "ipAddress": "127.0.0.1",
      "details": { "source": "dashboard" },
      "createdAt": "2024-01-15T10:30:00.000Z"
    }
  ],
  "total": 150
}
```

---

### GET /api/audit/summary

Get activity summary for dashboard.

**Query Parameters:**
| Param | Type | Default |
|-------|------|---------|
| days | number | 7 |

**Response (200 OK):**
```json
{
  "summary": {
    "reveal": 25,
    "copy": 50,
    "create": 5,
    "update": 3,
    "delete": 1,
    "login": 10
  },
  "days": 7
}
```

---

## Error Responses

All errors follow this format:

```json
{
  "error": "Error message here"
}
```

### Common HTTP Status Codes

| Code | Meaning |
|------|---------|
| 400 | Bad Request - Invalid input |
| 401 | Unauthorized - Invalid/expired token |
| 403 | Forbidden - Not allowed to access |
| 404 | Not Found - Resource doesn't exist |
| 429 | Too Many Requests - Rate limited |
| 500 | Internal Server Error |

### 401 Unauthorized Example

```json
{
  "error": "Access token expired"
}
```

**Frontend should:**
1. Call `POST /api/auth/refresh`
2. Retry original request with new token
3. If refresh fails, redirect to login

### 429 Rate Limited Example

```json
{
  "error": "Too many requests, please try again later"
}
```

---

## TypeScript Types

For frontend TypeScript integration:

```typescript
// User
interface User {
  id: string;
  email: string | null;
  name: string | null;
  hasVaultKey: boolean;
  createdAt: string;
}

// Auth Response
interface AuthResponse {
  message: string;
  user: User;
  accessToken: string;
}

// Password Entry (List)
interface PasswordListItem {
  id: string;
  title: string;
  username: string;
  site: string | null;
  collectionId: string | null;
  isFavorite: boolean;
  isPinned: boolean;
  strength: number | null;
  tags: Tag[];
  createdAt: string;
  updatedAt: string;
}

// Password Entry (Full)
interface PasswordEntry extends PasswordListItem {
  password: string;
  notes: string | null;
}

// Tag
interface Tag {
  id: string;
  name: string;
  color: string | null;
  entryCount?: number;
}

// Collection
interface Collection {
  id: string;
  name: string;
  description: string | null;
  icon: string | null;
  color: string | null;
  entryCount: number;
  createdAt: string;
  updatedAt: string;
}

// Password Health
interface PasswordHealth {
  total: number;
  strong: number;
  medium: number;
  weak: number;
  reused: number;
  old: number;
  noPassword: number;
}

// Audit Log
interface AuditLog {
  id: string;
  action: string;
  entryId: string | null;
  entryTitle: string | null;
  ipAddress: string | null;
  details: Record<string, unknown> | null;
  createdAt: string;
}

// Share Link
interface ShareLink {
  id: string;
  token: string;
  entryId: string;
  entryTitle: string;
  maxViews: number;
  viewCount: number;
  expiresAt: string;
  includePassword: boolean;
  includeNotes: boolean;
  createdAt: string;
}
```

---

## Frontend API Client Usage

```javascript
// Initialize
await SecurePassAPI.initAPI();

// Auth
const { user, accessToken } = await SecurePassAPI.login(email, password);
const { user, accessToken } = await SecurePassAPI.register(email, password, name);
await SecurePassAPI.logout();

// Passwords
const entries = await SecurePassAPI.getPasswords({ query: 'gmail', isFavorite: true });
const entry = await SecurePassAPI.getPassword(id);
await SecurePassAPI.directSave({ title, password, site });
await SecurePassAPI.updatePassword(id, { title: 'New Title' });
await SecurePassAPI.deletePassword(id);
await SecurePassAPI.toggleFavorite(id);
await SecurePassAPI.togglePinned(id);

// Health
const health = await SecurePassAPI.getPasswordHealth();

// Collections
const collections = await SecurePassAPI.getCollections();
await SecurePassAPI.createCollection({ name: 'Work', icon: '💼' });
await SecurePassAPI.moveToCollection(['id1', 'id2'], collectionId);

// Tags
const tags = await SecurePassAPI.getTags();
await SecurePassAPI.createTag({ name: 'important', color: '#ef4444' });

// Sharing
const { shareUrl } = await SecurePassAPI.createShareLink({ entryId, expiresInHours: 24 });

// Audit
const { logs, total } = await SecurePassAPI.getAuditLogs({ limit: 50, action: 'reveal' });
const { summary } = await SecurePassAPI.getActivitySummary(7);

// Export/Import
const entries = await SecurePassAPI.exportVault();
await SecurePassAPI.importVault(entries);
```
