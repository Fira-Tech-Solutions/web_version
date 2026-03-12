# 🚀 Vercel Environment Setup Guide

## 📋 Your Current Configuration

Based on your `.env.local`, here are the environment variables you need to set in Vercel:

### 🔑 **Required Environment Variables**

Copy these exactly to your Vercel Dashboard → Project Settings → Environment Variables:

```bash
# Database (PRIMARY - from your existing setup)
DATABASE_URL=postgres://7494ef1e6e1659bc4b1f951242b1733f0058d762b51259b7ae17d92ea4a2bb30:sk_W0TddwplDabfmO8HvglXo@db.prisma.io:5432/postgres?sslmode=require

# Database User
POSTGRES_USER=postgres

# Database Name  
POSTGRES_DB=postgres

# Security (Generate new secrets for production)
ENCRYPTION_SECRET=bingo-master-secure-shared-secret-key-32
LICENSE_SECRET=your_license_secret

# Application
NODE_ENV=production

# Vercel Authentication (from your .env.local)
VERCEL_OIDC_TOKEN=eyJhbGciOiJSUzI1NiIsInR5cCI6IkpXVCIsImtpZCI6Im1yay00MzAyZWMxYjY3MGY0OGE5OGFkNjFkYWRlNGEyM2JlNyJ9.eyJpc3MiOiJodHRwczovL29pZGMudmVyY2VsLmNvbS9zYW1naXJtYXMtcHJvamVjdHMiLCJzdWIiOiJvd25lcjpzYW1naXJtYXMtcHJvamVjdHM6cHJvamVjdDpiaW5nby13ZWItdmVyc2lvbjplbnZpcm9ubWVudCIsInNjb3BlIjoib3duZXI6c2FtZ2lybWFzLXByb2plY3RzOnByb2plY3Q6YmluZ28td2ViLXZlcnNpb246ZW52aXJvbm1lbnQ6ZGV2ZWxvcG1lbnQiLCJhdWQiOiJodHRwczovL3ZlcmNlbC5jb20vc2FtZ2lybWFzLXByb2plY3RzOnByb2plY3Q6YmluZ28td2ViLXZlcnNpb246ZW52aXJvbm1lbnQ6ZGV2ZWxvcG1lbnQiLCJhdWQiOiJodHRwczovL3ZlcmNlbC5jb20vc2FtZ2lybWFzLXByb2plY3RzOnByb2plY3Q6YmluZ28td2ViLXZlcnNpb246ZW52aXJvbm1lbnQ6ZGV2ZWxvcG1lbnQiLCJzdWIiOiJzdWI6InByal9JN0JmdnpGR3J1VDBvNjFHY05vZ2NjSkxkQUtTIiwiZW52aXJvbm1lbnQiOiJkZXZlbG9wbWVudCIsInBsYW4iOiJob2JieSIsInVzZXJfaWQiOiI5UEhYajh5WmpzRWtkZUhWNGZTeVJ5ODkiLCJuYmYiOjE3NzMzNDUxMjEsImlhdCI6MTc3MzM0NTEyMSwiZXhwIjoxNzczMzg4MzIxfQ.AxrVkCy_E_7__A49tOiZOqZVRwcsLDqAMlVM70hRsuwuyPTA761kMdiswS_nNKBzldqY2MHqfby7pIFNYOIYDm-hRI4knV4WYm5NZFcf5m9xF7GDX_pOZXd5oQcxtPUPjQ-KMtdG_bw3LTYyWqfjrjSsyhv5nXw09K9SeBPi6fbfQVPCGvUT6ptN8Ozh6c6Gyr0_X0LdOY13_OULToii3JHCAJ94L2SZmcxVLldYxev32nGP719PiSE1L9EAfQxbqCIB79J_ZiXIRkahi7dZf5GgCY6ShpLvKoQ6QXkvdlkyp5gcXsknk4H38qrdGxxlP8eohCkOPFPoRuPrRM7wXg
```

### 🔧 **Setup Steps**

#### 1. Go to Vercel Dashboard
1. Visit [vercel.com](https://vercel.com)
2. Select your project (or create new one)
3. Go to **Project Settings → Environment Variables**

#### 2. Add Environment Variables
1. Click **"Add New"** for each variable below
2. Copy and paste the exact values
3. Set **Environment** to **Production**, **Preview**, and **Development**
4. **Do NOT** check "Expose to Vercel CLI" for sensitive values

#### 3. Deploy
```bash
npm run deploy:vercel
```

### 🔐 **Security Notes**

⚠️ **IMPORTANT**: Generate new secrets for production:

#### Generate New Encryption Secret:
```bash
node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"
```

#### Generate New License Secret:
```bash
node -e "console.log(require('crypto').randomBytes(16).toString('hex'))"
```

### 📊 **Database Configuration**

Your database is already configured with:
- **Host**: `db.prisma.io`
- **Port**: `5432`
- **Database**: `postgres`
- **SSL**: Enabled (`sslmode=require`)
- **Connection**: Ready for Vercel

### 🌐 **Custom Domain (Optional)**

If you want to use a custom domain:
1. In Vercel dashboard, go to **Project Settings → Domains**
2. Add your custom domain
3. Update DNS records as instructed by Vercel
4. Add this environment variable:
   ```
   VERCEL_PROJECT_URL=https://your-custom-domain.com
   ```

### 🚀 **Deployment Commands**

#### Quick Deploy:
```bash
npm run deploy:vercel
```

#### Manual Deploy:
```bash
# Build
npm run build:vercel

# Deploy
vercel --prod
```

### 📱 **After Deployment**

Your app will be available at:
- **Vercel URL**: `https://your-project.vercel.app`
- **Custom Domain**: `https://your-custom-domain.com` (if configured)

### 🎯 **Features Available**

✅ **Fully Configured for Vercel:**
- Serverless API functions
- PostgreSQL database integration
- Optimized frontend build
- Secure environment variables
- Automatic SSL certificates
- Global CDN distribution
- Real-time deployment logs

### 🔧 **Troubleshooting**

#### Common Issues:

**Database Connection Failed:**
- Verify `DATABASE_URL` is exactly as shown above
- Check that all database variables are set
- Ensure database is accessible

**Build Errors:**
- Run `npm run build:vercel` locally first
- Check for TypeScript errors
- Verify all dependencies are installed

**Deployment Failed:**
- Check Vercel deployment logs
- Verify environment variables names
- Ensure all required variables are set

**Environment Variables Not Working:**
- Variables are case-sensitive
- Ensure no trailing spaces
- Redeploy after changing variables

---

## 🎉 **Ready to Deploy!**

Your Bingo platform is fully configured for Vercel deployment with your existing PostgreSQL database!

**Just run `npm run deploy:vercel` to go live!** 🚀
