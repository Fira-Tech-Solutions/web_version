# BingoMaster System Documentation

## Table of Contents
1. [System Overview](#system-overview)
2. [Architecture](#architecture)
3. [Client-Server Communication](#client-server-communication)
4. [Database Schema](#database-schema)
5. [Authentication & Authorization](#authentication--authorization)
6. [Game Mechanics](#game-mechanics)
7. [Business Logic](#business-logic)
8. [API Endpoints](#api-endpoints)
9. [WebSocket Communication](#websocket-communication)
10. [File-Based Operations](#file-based-operations)
11. [Security Features](#security-features)
12. [Deployment & Configuration](#deployment--configuration)

## System Overview

BingoMaster is a comprehensive online bingo gaming platform with a multi-tier architecture supporting Super Admins, Admins, Employees, and Collectors. The system provides real-time game management, financial tracking, and comprehensive reporting capabilities.

### Key Features
- **Multi-role system**: Super Admin → Admin → Employee → Collector hierarchy
- **Real-time bingo games** with WebSocket communication
- **Financial management** with credit loading and profit sharing
- **Cartela management** with both hardcoded and dynamic patterns
- **License-based activation** with hardware binding
- **File-based operations** for secure balance management
- **Comprehensive reporting** and analytics

### Technology Stack
- **Backend**: Node.js with Express, PostgreSQL, MongoDB
- **Frontend**: React with TypeScript, TanStack Query
- **Real-time**: WebSocket for live game updates
- **Security**: AES encryption, bcrypt hashing, JWT tokens
- **Database**: PostgreSQL (primary), MongoDB (analytics)

## Architecture

### Client-Server Model

```
┌─────────────────┐    HTTP/HTTPS     ┌─────────────────┐
│   Web Client    │ ◄──────────────►  │   Express API   │
│   (React App)   │                   │   (Node.js)     │
└─────────────────┘                   └─────────────────┘
         │                                        │
         │ WebSocket                              │ PostgreSQL
         │                                        │ MongoDB
         ▼                                        ▼
┌─────────────────┐                   ┌─────────────────┐
│  WebSocket      │                   │   Database      │
│  Connection     │                   │   Layer         │
└─────────────────┘                   └─────────────────┘
```

### Component Breakdown

#### Server Components
- **Express API**: Main HTTP server handling REST endpoints
- **WebSocket Server**: Real-time communication for game updates
- **Database Layer**: PostgreSQL for primary data, MongoDB for analytics
- **Storage Layer**: Abstraction layer for database operations
- **Authentication**: Session-based authentication with middleware
- **License System**: Hardware-bound activation and balance management

#### Client Components
- **React Application**: Single-page application with routing
- **State Management**: TanStack Query for server state, React hooks for local state
- **WebSocket Client**: Real-time game updates and number calling
- **Authentication**: Context-based auth with session management
- **UI Components**: Modular component architecture with Tailwind CSS

### Data Flow

1. **User Authentication**: Client → Server → Database → Session
2. **Game Creation**: Employee → Server → Database → WebSocket Broadcast
3. **Number Calling**: Employee → Server → Database → WebSocket → All Clients
4. **Winner Declaration**: Employee → Server → Database → Financial Processing
5. **Balance Management**: File Upload → Server → Encryption → Database Update

## Client-Server Communication

### HTTP REST API

The system uses RESTful API endpoints for all state-changing operations and data retrieval.

#### Base URL Structure
```
http://localhost:5000/api/
```

#### Authentication Flow
1. **Login**: POST `/api/auth/login` with username/password
2. **Session Creation**: Server creates session with user data
3. **Session Validation**: Middleware validates session on protected routes
4. **Logout**: POST `/api/auth/logout` destroys session

#### Request/Response Format
- **Content-Type**: `application/json`
- **Authentication**: Session cookies (`connect.sid`)
- **Error Handling**: Standard HTTP status codes with JSON error messages

### WebSocket Communication

Real-time game updates use WebSocket connections for immediate synchronization.

#### Connection Setup
```javascript
const protocol = window.location.protocol === "https:" ? "wss:" : "ws:";
const wsUrl = `${protocol}//${window.location.host}/game-ws?gameId=${gameId}`;
const ws = new WebSocket(wsUrl);
```

#### Message Types
- **`number_called`**: Broadcast when a number is called
- **`game_started`**: Notify when game status changes to active
- **`player_registered`**: Notify when new player joins
- **`game_updated`**: General game state updates

#### Message Format
```json
{
  "type": "number_called",
  "number": "B-15",
  "calledNumbers": ["B-15", "I-22", "N-35"]
}
```

### File-Based Operations

Secure file operations for balance management and user registration.

#### Balance Recharge File
- **Format**: Encrypted JSON with digital signature
- **Encryption**: AES-256 with system private key
- **Signature**: RSA signature for integrity verification
- **Validation**: Signature verification before processing

#### User Registration File
- **Format**: Encrypted user data
- **Content**: Username, password, name, shop ID, account number
- **Processing**: Decryption and database insertion

## Database Schema

### Core Tables (PostgreSQL)

#### Users Table
```sql
CREATE TABLE users (
  id SERIAL PRIMARY KEY,
  username TEXT NOT NULL UNIQUE,
  password TEXT NOT NULL,
  role TEXT NOT NULL, -- 'super_admin', 'admin', 'employee', 'collector'
  name TEXT NOT NULL,
  email TEXT,
  accountNumber TEXT UNIQUE,
  balance DECIMAL(12,2) DEFAULT '0.00',
  isBlocked BOOLEAN DEFAULT FALSE,
  shopId INTEGER REFERENCES shops(id),
  creditBalance DECIMAL(12,2) DEFAULT '0.00',
  referredBy INTEGER REFERENCES users(id),
  commissionRate DECIMAL(5,2) DEFAULT '0.00',
  createdAt TIMESTAMP DEFAULT NOW()
);
```

#### Shops Table
```sql
CREATE TABLE shops (
  id SERIAL PRIMARY KEY,
  name TEXT NOT NULL,
  adminId INTEGER REFERENCES users(id),
  profitMargin DECIMAL(5,2) DEFAULT '20.00',
  balance DECIMAL(12,2) DEFAULT '0.00',
  isBlocked BOOLEAN DEFAULT FALSE,
  superAdminCommission DECIMAL(5,2) DEFAULT '30.00',
  referralCommission DECIMAL(5,2) DEFAULT '10.00',
  totalRevenue DECIMAL(10,2) DEFAULT '0.00',
  totalGames INTEGER DEFAULT 0,
  totalPlayers INTEGER DEFAULT 0,
  createdAt TIMESTAMP DEFAULT NOW()
);
```

#### Games Table
```sql
CREATE TABLE games (
  id SERIAL PRIMARY KEY,
  shopId INTEGER REFERENCES shops(id) NOT NULL,
  employeeId INTEGER REFERENCES users(id) NOT NULL,
  status TEXT NOT NULL, -- 'waiting', 'active', 'completed', 'paused'
  prizePool DECIMAL(10,2) DEFAULT '0.00',
  entryFee DECIMAL(10,2) NOT NULL,
  calledNumbers JSONB DEFAULT '[]',
  winnerId INTEGER REFERENCES gamePlayers(id),
  startedAt TIMESTAMP,
  completedAt TIMESTAMP,
  isPaused BOOLEAN DEFAULT FALSE,
  createdAt TIMESTAMP DEFAULT NOW()
);
```

#### Game Players Table
```sql
CREATE TABLE gamePlayers (
  id SERIAL PRIMARY KEY,
  gameId INTEGER REFERENCES games(id) NOT NULL,
  playerName TEXT NOT NULL,
  cartelaNumbers JSONB NOT NULL,
  entryFee DECIMAL(10,2) NOT NULL,
  isWinner BOOLEAN DEFAULT FALSE,
  registeredAt TIMESTAMP DEFAULT NOW()
);
```

#### Cartelas Table
```sql
CREATE TABLE cartelas (
  id SERIAL PRIMARY KEY,
  shopId INTEGER NOT NULL REFERENCES shops(id),
  adminId INTEGER NOT NULL REFERENCES users(id),
  cartelaNumber INTEGER NOT NULL,
  name TEXT NOT NULL,
  pattern JSONB NOT NULL, -- 5x5 grid of numbers
  isHardcoded BOOLEAN DEFAULT FALSE,
  isActive BOOLEAN DEFAULT TRUE,
  isBooked BOOLEAN DEFAULT FALSE,
  bookedBy INTEGER REFERENCES users(id),
  gameId INTEGER REFERENCES games(id),
  createdAt TIMESTAMP DEFAULT NOW(),
  updatedAt TIMESTAMP DEFAULT NOW(),
  UNIQUE(shopId, cartelaNumber)
);
```

### MongoDB Collections

#### Game Analytics Collection
```javascript
{
  _id: ObjectId,
  gameId: Number,
  shopId: Number,
  employeeId: Number,
  totalCollected: String,
  prizeAmount: String,
  adminProfit: String,
  superAdminCommission: String,
  playerCount: Number,
  winnerName: String,
  winningCartela: String,
  completedAt: Date,
  createdAt: Date
}
```

#### Daily Revenue Summary Collection
```javascript
{
  _id: ObjectId,
  date: String, // YYYY-MM-DD format in EAT
  totalAdminRevenue: String,
  totalGamesPlayed: Number,
  totalPlayersRegistered: Number,
  createdAt: Date,
  updatedAt: Date
}
```

## Authentication & Authorization

### Role Hierarchy
```
Super Admin (super_admin)
    │
    └── Admin (admin)
        │
        ├── Employee (employee)
        │   └── Collector (collector)
        └── Other Employees
```

### Permission Matrix

| Role | Create Admin | Manage Shop | Create Employee | Manage Games | View Reports | Financial Ops |
|------|-------------|-------------|-----------------|--------------|--------------|---------------|
| Super Admin | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ |
| Admin | ❌ | ✅ | ✅ | ✅ | ✅ | ✅ |
| Employee | ❌ | ❌ | ❌ | ✅ | ✅ | ❌ |
| Collector | ❌ | ❌ | ❌ | ❌ | ❌ | ❌ |

### Authentication Flow

1. **Login Request**: Client sends username/password
2. **Password Verification**: bcrypt comparison with stored hash
3. **Session Creation**: Express session with user data
4. **Role Validation**: Middleware checks role for protected routes
5. **Cascading Blocks**: Admin block affects all subordinates

### Session Management

- **Storage**: PostgreSQL-backed session store
- **Duration**: 24 hours with rolling expiration
- **Security**: HttpOnly, SameSite cookies
- **Validation**: Middleware on all protected routes

### Authorization Middleware

```javascript
// Example middleware for role-based access
function requireRole(allowedRoles) {
  return (req, res, next) => {
    const user = req.session.user;
    if (!user || !allowedRoles.includes(user.role)) {
      return res.status(403).json({ message: "Access denied" });
    }
    next();
  };
}
```

## Game Mechanics

### Bingo Game Rules

#### Standard Bingo Patterns
- **Horizontal Rows**: Complete any row (B-I-N-G-O)
- **Vertical Columns**: Complete any column (B, I, N, G, O)
- **Diagonals**: Top-left to bottom-right or top-right to bottom-left
- **Free Space**: Center cell (N3) is always marked

#### Game States
1. **Waiting**: Game created, no players registered
2. **Active**: Game in progress, numbers being called
3. **Paused**: Game temporarily stopped
4. **Completed**: Game finished, winner declared

### Game Flow

#### 1. Game Creation
```javascript
// Employee creates game
POST /api/games
{
  "shopId": 1,
  "employeeId": 5,
  "entryFee": "20.00",
  "status": "waiting"
}
```

#### 2. Player Registration
```javascript
// Register multiple cartelas for one player
POST /api/games/{gameId}/players
{
  "playerName": "John Doe",
  "cartelaNumbers": [123, 456, 789],
  "entryFee": "20.00"
}
```

#### 3. Number Calling
```javascript
// Random number generation with BINGO letter
function generateRandomNumber(calledNumbers) {
  const letters = ['B', 'I', 'N', 'G', 'O'];
  const ranges = { 'B': [1,15], 'I': [16,30], 'N': [31,45], 'G': [46,60], 'O': [61,75] };
  
  const letter = letters[Math.floor(Math.random() * letters.length)];
  const [min, max] = ranges[letter];
  const number = Math.floor(Math.random() * (max - min + 1)) + min;
  
  return `${letter}-${number}`;
}
```

#### 4. Winner Verification
```javascript
function checkBingoWin(cartelaPattern, calledNumbers) {
  // Check rows, columns, and diagonals
  // Return win status and pattern type
}
```

### Cartela Management

#### Cartela Patterns
- **5x5 Grid**: Standard bingo card layout
- **B Column**: Numbers 1-15
- **I Column**: Numbers 16-30
- **N Column**: Numbers 31-45 (with free space at N3)
- **G Column**: Numbers 46-60
- **O Column**: Numbers 61-75

#### Cartela States
- **Available**: Not booked, can be selected
- **Booked**: Reserved for a player
- **Active**: Currently in use in a game
- **Completed**: Game finished, available again

## Business Logic

### Financial System

#### Profit Sharing Model
```
Player Entry Fee → Total Collected
├── Prize Pool (85%) → Winner
├── Admin Profit (10%) → Shop Admin
└── Super Admin Commission (5%) → Super Admin
```

#### Commission Rates (Configurable)
- **Super Admin Commission**: 15-30% (default: 30%)
- **Admin Profit Margin**: 10-20% (default: 20%)
- **Referral Commission**: 5-15% (default: 10%)

#### Balance Management
- **Credit Loading**: File-based encrypted balance updates
- **Real-time Deductions**: Automatic balance updates during game creation
- **Profit Distribution**: Automatic allocation after game completion
- **Commission Tracking**: Detailed tracking for all levels

### Game Revenue Calculation

```javascript
async function calculateProfitSharing(gameAmount, shopId) {
  const shop = await storage.getShop(shopId);
  const adminProfitMargin = parseFloat(shop.profitMargin || '20') / 100;
  const superAdminCommissionRate = parseFloat(shop.superAdminCommission || '30') / 100;
  
  const adminProfit = gameAmount * adminProfitMargin;
  const superAdminCommission = adminProfit * superAdminCommissionRate;
  const prizePool = gameAmount - adminProfit;
  
  return {
    totalCollected: gameAmount,
    prizePool,
    adminProfit,
    superAdminCommission
  };
}
```

### Referral System

#### Commission Structure
- **Direct Referrals**: Admins earn commission on referred admin's profits
- **Commission Rate**: Configurable percentage of admin profits
- **Payment Methods**: Credit balance or bank transfer
- **Tracking**: Automatic tracking of referral relationships

#### Referral Flow
1. **Admin Registration**: New admin specifies referrer
2. **Commission Tracking**: System tracks referred admin's profits
3. **Commission Calculation**: Automatic calculation based on configured rate
4. **Payout Options**: Convert to credit or request bank transfer

### License System

#### Hardware Binding
- **Hardware ID**: Generated from system specifications
- **Activation File**: Encrypted file containing hardware ID and expiration
- **Validation**: Server validates hardware ID matches activation
- **Grace Period**: 24-hour grace period for hardware changes

#### Balance Management
- **Encrypted Files**: AES-256 encrypted balance data
- **Digital Signatures**: RSA signatures for integrity verification
- **Redemption Tracking**: Database records of all balance redemptions
- **Security**: One-time use per signature

## API Endpoints

### Authentication Endpoints

#### POST /api/auth/login
Authenticate user and create session
```javascript
// Request
{
  "username": "admin",
  "password": "password123"
}

// Response
{
  "user": {
    "id": 1,
    "username": "admin",
    "role": "admin",
    "shopId": 1
  }
}
```

#### POST /api/auth/logout
Destroy user session
```javascript
// Response
{ "message": "Logged out" }
```

#### GET /api/auth/me
Get current user information
```javascript
// Response
{
  "user": {
    "id": 1,
    "username": "admin",
    "role": "admin",
    "shopId": 1,
    "creditBalance": "1000.00"
  }
}
```

### Game Management Endpoints

#### POST /api/games
Create new game
```javascript
// Request
{
  "shopId": 1,
  "employeeId": 5,
  "entryFee": "20.00",
  "status": "waiting"
}

// Response
{
  "id": 123,
  "shopId": 1,
  "employeeId": 5,
  "status": "waiting",
  "entryFee": "20.00",
  "prizePool": "0.00"
}
```

#### PATCH /api/games/{id}/start
Start game
```javascript
// Response
{
  "id": 123,
  "status": "active",
  "startedAt": "2024-01-01T10:00:00Z"
}
```

#### PATCH /api/games/{id}/numbers
Update called numbers
```javascript
// Request
{
  "calledNumbers": ["B-15", "I-22", "N-35"]
}

// Response
{
  "id": 123,
  "calledNumbers": ["B-15", "I-22", "N-35"],
  "latestNumber": "N-35"
}
```

### Financial Endpoints

#### POST /api/balance/recharge
Recharge balance using encrypted file
```javascript
// Request
{
  "fileData": "encrypted_balance_data_here"
}

// Response
{
  "message": "Recharge successful",
  "balance": "1500.00"
}
```

#### GET /api/transactions/shop/{shopId}
Get shop transaction history
```javascript
// Response
[
  {
    "id": 1,
    "amount": "100.00",
    "type": "entry_fee",
    "description": "Entry fee for Player 1",
    "createdAt": "2024-01-01T10:00:00Z"
  }
]
```

### Admin Management Endpoints

#### POST /api/admin/create-admin
Create new admin (Super Admin only)
```javascript
// Request
{
  "name": "New Admin",
  "username": "newadmin",
  "password": "password123",
  "shopName": "New Shop",
  "commissionRate": "25"
}

// Response
{
  "admin": { "id": 6, "username": "newadmin", "role": "admin" },
  "shop": { "id": 2, "name": "New Shop", "adminId": 6 }
}
```

#### PATCH /api/admin/employees/{id}/password
Update employee password
```javascript
// Request
{
  "newPassword": "newpassword123"
}

// Response
{ "success": true, "message": "Password updated successfully" }
```

## WebSocket Communication

### Connection Management

#### Client Connection
```javascript
import { useWebSocket } from '@/lib/websocket';

function GameComponent({ gameId }) {
  const { isConnected, sendMessage } = useWebSocket(gameId, (message) => {
    switch (message.type) {
      case 'number_called':
        handleNumberCalled(message);
        break;
      case 'game_started':
        handleGameStarted(message);
        break;
    }
  });
}
```

#### Server Broadcasting
```javascript
// Broadcast to all clients in a game
const clients = gameClients.get(gameId);
if (clients) {
  const message = JSON.stringify({
    type: 'number_called',
    number: calledNumber,
    calledNumbers: updatedNumbers
  });
  clients.forEach(client => {
    if (client.readyState === WebSocket.OPEN) {
      client.send(message);
    }
  });
}
```

### Message Types

#### Number Called
```javascript
{
  "type": "number_called",
  "number": "B-15",
  "calledNumbers": ["B-15", "I-22", "N-35"],
  "gameId": 123
}
```

#### Game Started
```javascript
{
  "type": "game_started",
  "game": {
    "id": 123,
    "status": "active",
    "startedAt": "2024-01-01T10:00:00Z"
  }
}
```

#### Player Registered
```javascript
{
  "type": "player_registered",
  "player": {
    "id": 456,
    "playerName": "John Doe",
    "cartelaNumbers": [123, 456],
    "entryFee": "20.00"
  }
}
```

### Auto-Play Feature

The system includes an auto-play mode for demonstration purposes:

```javascript
// Auto-call numbers every 3 seconds
setInterval(() => {
  if (game.status === 'active') {
    const letters = ['B', 'I', 'N', 'G', 'O'];
    const letter = letters[Math.floor(Math.random() * letters.length)];
    const [min, max] = ranges[letter];
    const number = Math.floor(Math.random() * (max - min + 1)) + min;
    const calledNumber = `${letter}-${number}`;
    
    // Update game and broadcast
    updateGameNumbers(gameId, [...calledNumbers, calledNumber]);
  }
}, 3000);
```

## File-Based Operations

### Balance Recharge Files

#### File Structure
```json
{
  "payload": {
    "employeeAccountNumber": "ACC123456",
    "amount": "500.00",
    "shopId": 1,
    "timestamp": 1704067200000,
    "nonce": "abc123def456"
  },
  "signature": "rsa_signature_here"
}
```

#### Processing Flow
1. **File Upload**: Admin uploads .enc file
2. **Decryption**: AES-256 decryption with system key
3. **Signature Verification**: RSA signature validation
4. **Data Validation**: Check employee account and shop ID
5. **Balance Update**: Update user balance in database
6. **Transaction Record**: Create transaction entry

### User Registration Files

#### File Structure
```json
{
  "username": "newemployee",
  "password": "hashed_password",
  "name": "New Employee",
  "shopId": 1,
  "accountNumber": "EMP123456",
  "generatedAt": "2024-01-01T10:00:00Z"
}
```

#### Processing Flow
1. **File Upload**: Admin uploads encrypted registration file
2. **Decryption**: AES-256 decryption
3. **Validation**: Check username availability
4. **User Creation**: Create new user with hashed password
5. **Response**: Return success confirmation

### License Files

#### Activation File Structure
```json
{
  "hardwareId": "unique_hardware_identifier",
  "expirationDate": "2025-12-31",
  "signature": "rsa_signature"
}
```

#### Validation Process
1. **Hardware ID Generation**: Create from system specs
2. **File Upload**: Admin uploads activation file
3. **Decryption**: AES-256 decryption
4. **Signature Verification**: RSA signature validation
5. **Hardware Matching**: Compare with current system
6. **Database Storage**: Store activation status

## Security Features

### Authentication Security
- **Password Hashing**: bcrypt with salt rounds
- **Session Security**: HttpOnly, SameSite cookies
- **Role-Based Access**: Middleware validation
- **Session Expiration**: 24-hour rolling expiration

### Data Encryption
- **File Encryption**: AES-256 for sensitive files
- **Digital Signatures**: RSA for file integrity
- **Database Encryption**: Sensitive fields encrypted
- **HTTPS Enforcement**: Secure transmission

### Input Validation
- **Zod Schema Validation**: Type-safe input validation
- **SQL Injection Prevention**: Parameterized queries
- **XSS Prevention**: Input sanitization
- **Rate Limiting**: API request limits

### License Security
- **Hardware Binding**: Unique system identification
- **Grace Period**: 24-hour hardware change tolerance
- **Signature Verification**: RSA digital signatures
- **One-Time Use**: Prevents file reuse

## Deployment & Configuration

### Environment Variables

#### Required Variables
```bash
# Database
DATABASE_URL="postgresql://user:password@localhost:5432/bingomaster"
MONGODB_URI="mongodb://localhost:27017/bingomaster"

# Security
SESSION_SECRET="your_session_secret_key"
ENCRYPTION_KEY="your_32_character_encryption_key"
PRIVATE_KEY_PATH="./keys/private_key.pem"
PUBLIC_KEY_PATH="./keys/public_key.pem"

# Application
NODE_ENV="production"
PORT=5000
```

#### Optional Variables
```bash
# CORS
CORS_ORIGIN="https://yourdomain.com"

# Logging
LOG_LEVEL="info"

# File Paths
ACTIVATION_FILE_PATH="./data/activation.enc"
BALANCE_FILE_PATH="./data/balance.enc"
```

### Database Setup

#### PostgreSQL Initialization
```sql
-- Create database
CREATE DATABASE bingomaster;

-- Create tables (run schema.sql)
\i server/db/schema.sql

-- Seed initial data
\i server/db/seed.sql
```

#### MongoDB Setup
```javascript
// Connect to MongoDB
const client = new MongoClient(process.env.MONGODB_URI);
await client.connect();

// Create collections and indexes
const db = client.db('bingomaster');
await db.createCollection('game_analytics');
await db.createCollection('daily_revenue_summary');
```

### Docker Deployment

#### Dockerfile
```dockerfile
FROM node:18-alpine

WORKDIR /app
COPY package*.json ./
RUN npm ci --only=production

COPY . .
EXPOSE 5000

CMD ["npm", "start"]
```

#### docker-compose.yml
```yaml
version: '3.8'
services:
  app:
    build: .
    ports:
      - "5000:5000"
    environment:
      - DATABASE_URL=postgresql://user:password@db:5432/bingomaster
      - MONGODB_URI=mongodb://mongo:27017/bingomaster
    depends_on:
      - db
      - mongo

  db:
    image: postgres:15
    environment:
      POSTGRES_DB: bingomaster
      POSTGRES_USER: user
      POSTGRES_PASSWORD: password
    volumes:
      - postgres_data:/var/lib/postgresql/data

  mongo:
    image: mongo:6
    volumes:
      - mongo_data:/data/db

volumes:
  postgres_data:
  mongo_data:
```

### Production Considerations

#### Security
- **HTTPS**: Use SSL/TLS certificates
- **Environment Variables**: Store secrets securely
- **Database Security**: Use strong passwords and network restrictions
- **File Permissions**: Restrict access to sensitive files

#### Performance
- **Database Indexing**: Optimize query performance
- **Caching**: Implement Redis for session storage
- **Load Balancing**: Use reverse proxy for high traffic
- **Monitoring**: Set up application monitoring

#### Backup & Recovery
- **Database Backups**: Regular PostgreSQL and MongoDB backups
- **File Backups**: Backup license and configuration files
- **Disaster Recovery**: Test recovery procedures
- **Version Control**: Use Git for code management

## Conclusion

BingoMaster provides a comprehensive, secure, and scalable bingo gaming platform with advanced features for multi-level administration, real-time gameplay, and sophisticated financial management. The system's modular architecture allows for easy maintenance and future enhancements while maintaining high security standards and performance.

For support and additional documentation, please refer to the project repository or contact the development team.