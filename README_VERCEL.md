# 🚀 Vercel Deployment Guide

This guide will help you deploy the Bingo Web Application to Vercel.

## 📋 Prerequisites

- Vercel account ([vercel.com](https://vercel.com))
- PostgreSQL database (recommended: Vercel Postgres or Supabase)
- Node.js 18+ installed locally

## 🔧 Environment Variables

Set these in your Vercel dashboard under **Project Settings → Environment Variables**:

### Required Variables
- `POSTGRES_URL` - PostgreSQL connection string
- `POSTGRES_USER` - Database username
- `POSTGRES_PASSWORD` - Database password
- `POSTGRES_DB` - Database name
- `ENCRYPTION_SECRET` - Secret for encryption (32+ characters)
- `LICENSE_SECRET` - License validation secret

### Optional Variables
- `NODE_ENV` - Set to `production`

## 🏗️ Build Configuration

The application is configured for Vercel deployment with:

- **Build Command**: `npm run build:vercel`
- **Output Directory**: `dist`
- **Framework**: Vite
- **Node.js Runtime**: 18.x

## 📦 Deployment Steps

### Option 1: Automatic Deployment
```bash
# Install dependencies and deploy
npm run deploy:vercel
```

### Option 2: Manual Deployment
```bash
# 1. Install Vercel CLI
npm install -g vercel

# 2. Build the application
npm run build:vercel

# 3. Deploy to Vercel
vercel --prod
```

### Option 3: Through Vercel Dashboard
1. Connect your GitHub repository to Vercel
2. Configure build settings
3. Set environment variables
4. Deploy

## 🗄️ Database Setup

### Vercel Postgres (Recommended)
1. In Vercel dashboard, go to **Storage → Create Database**
2. Select **Postgres**
3. Copy connection string to `POSTGRES_URL`
4. Set other database variables

### External PostgreSQL
```env
POSTGRES_URL=postgresql://username:password@host:port/database
POSTGRES_USER=username
POSTGRES_PASSWORD=password
POSTGRES_DB=database_name
```

## 🔐 Security Configuration

### Encryption Secret
Generate a secure encryption secret:
```bash
node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"
```

### License Secret
Generate a license validation secret:
```bash
node -e "console.log(require('crypto').randomBytes(16).toString('hex'))"
```

## 📁 Project Structure

```
bingo-web-version/
├── api/                    # Vercel serverless functions
│   └── index.ts           # API entry point
├── client/                # React frontend
├── server/                # Express server
│   └── index.serverless.ts # Serverless-optimized server
├── shared/                # Shared types and schema
├── vercel.json           # Vercel configuration
├── .vercelignore         # Files to exclude
└── dist/                 # Build output
```

## 🔄 Build Process

The build process includes:

1. **Frontend Build**: Vite builds the React app
2. **Server Build**: Express server is bundled for serverless
3. **Asset Optimization**: Code splitting and minification
4. **Static Files**: Optimized for CDN delivery

## 🌐 API Routes

All API routes are automatically routed through `/api/*`:

- `/api/auth/*` - Authentication endpoints
- `/api/admin/*` - Admin management
- `/api/recharge/*` - Recharge processing
- `/api/games/*` - Game management

## 📊 Monitoring

### Health Check
- Endpoint: `/health`
- Returns: Server status and environment info

### Error Handling
- Errors are logged and return appropriate HTTP status codes
- Development: Full error stack traces
- Production: Sanitized error messages

## 🚀 Performance Optimizations

### Frontend
- Code splitting by routes
- Vendor chunking for libraries
- Asset compression
- CDN caching headers

### Backend
- Serverless functions for scalability
- Database connection pooling
- Response caching for static assets

## 🔧 Troubleshooting

### Common Issues

**Build Failures**
- Check Node.js version (18+ required)
- Verify all dependencies are installed
- Check for TypeScript errors

**Database Connection**
- Verify `POSTGRES_URL` format
- Check database credentials
- Ensure database is accessible

**Environment Variables**
- All variables must be set in Vercel dashboard
- Variables are case-sensitive
- Redeploy after changing variables

**API Errors**
- Check server logs in Vercel dashboard
- Verify CORS configuration
- Ensure proper request format

### Debug Mode
For debugging, temporarily set:
```env
NODE_ENV=development
```

## 📱 Features After Deployment

✅ **Fully Functional Bingo Platform**
- User authentication and authorization
- Admin dashboard with employee management
- Recharge file generation and processing
- Real-time game management
- Financial tracking and reporting

✅ **Production Ready**
- PostgreSQL database integration
- Secure encryption and signing
- Optimized for serverless deployment
- Responsive design for all devices

## 🎉 Success!

Once deployed, your Bingo application will be available at:
- **Production**: `https://your-app.vercel.app`
- **Custom Domain**: Configure in Vercel dashboard

## 📞 Support

For issues:
1. Check Vercel deployment logs
2. Verify environment variables
3. Test database connection
4. Review this guide

---

**🚀 Your Bingo platform is now ready for Vercel deployment!**
