# BingoMaster - Web Application

A standalone web-based bingo management system with real-time game functionality and balance management.

## Features

- **Real-time Bingo Games**: Live game management with number calling
- **Employee Dashboard**: Complete employee interface for game management
- **Admin Dashboard**: Admin panel for system management
- **Balance Management**: Secure encrypted balance top-up system
- **Cartela Management**: Digital bingo card management
- **Real-time Updates**: Socket.io integration for live updates
- **Secure Authentication**: Session-based authentication system

## Quick Start

### Development
```bash
npm run dev
```

### Production Build
```bash
npm run build:web
npm run start:web
```

### Database Setup
```bash
npm run db:push
```

## Project Structure

```
├── client/                 # React frontend
│   ├── src/
│   │   ├── components/     # React components
│   │   ├── pages/         # Page components
│   │   └── hooks/         # Custom hooks
├── server/                # Express backend
│   ├── routes/           # API routes
│   ├── lib/              # Server utilities
│   └── index.ts          # Main server file
├── shared/               # Shared types and schemas
└── scripts/              # Utility scripts
```

## API Endpoints

### Authentication
- `POST /api/login` - User login
- `POST /api/logout` - User logout
- `GET /api/auth/me` - Get current user

### Games
- `GET /api/games/active` - Get active game
- `POST /api/games` - Create new game
- `PATCH /api/games/:id/numbers` - Update called numbers

### Balance Management
- `POST /api/recharge/topup` - Process encrypted balance top-up
- `GET /api/recharge/total` - Get total recharge amount

### Cartela Management
- `GET /api/cartelas` - Get user cartelas
- `POST /api/cartelas` - Create new cartela

## Security Features

- **Encrypted Balance Files**: RSA-encrypted balance top-up files
- **Session Management**: Secure session-based authentication
- **Input Validation**: Comprehensive server-side validation
- **Error Handling**: Detailed error messages for debugging

## Technologies

- **Frontend**: React, TypeScript, Tailwind CSS, Vite
- **Backend**: Express.js, TypeScript, Socket.io
- **Database**: SQLite with Drizzle ORM
- **Authentication**: Passport.js with session management
- **Real-time**: Socket.io for live updates

## Environment Variables

Create a `.env` file in the root directory:

```
NODE_ENV=development
SESSION_SECRET=your-secret-key-here
```

## Development Notes

- The application runs on port 5000 by default
- Hot reload is enabled in development mode
- Database is automatically initialized on startup
- Socket.io provides real-time updates for game state

## Production Deployment

1. Build the application: `npm run build:web`
2. Set production environment variables
3. Start the server: `npm run start:web`
4. The application will be available on the configured port

## License

MIT License - see LICENSE file for details
