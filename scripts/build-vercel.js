#!/usr/bin/env node

import { execSync } from 'child_process';
import { readFileSync, writeFileSync } from 'fs';
import path from 'path';

console.log('🚀 Starting Vercel build preparation...');

try {
  // Step 1: Clean previous build
  console.log('🧹 Cleaning previous build...');
  execSync('rm -rf dist', { stdio: 'inherit' });

  // Step 2: Build the application (skip npm install for now)
  console.log('🔨 Building application...');
  execSync('npm run build:vercel', { stdio: 'inherit' });

  // Step 3: Create .env.production if it doesn't exist
  const envPath = path.join(process.cwd(), '.env.production');
  try {
    readFileSync(envPath);
    console.log('✅ .env.production already exists');
  } catch (error) {
    console.log('📝 Creating .env.production template...');
    const envTemplate = `# Production Environment Variables for Vercel
# These should be set in Vercel dashboard under Environment Variables

# Database Configuration (from your existing setup)
DATABASE_URL=postgres://7494ef1e6e1659bc4b1f951242b1733f0058d762b51259b7ae17d92ea4a2bb30:sk_W0TddwplDabfmO8HvglXo@db.prisma.io:5432/postgres?sslmode=require
POSTGRES_USER=postgres
POSTGRES_DB=postgres

# Security
ENCRYPTION_SECRET=bingo-master-secure-shared-secret-key-32
LICENSE_SECRET=your_license_secret (set in Vercel dashboard)

# Application
NODE_ENV=production

# Vercel-specific
VERCEL_OIDC_TOKEN=your_oidc_token_here (set in Vercel dashboard)
`;
    writeFileSync(envPath, envTemplate);
    console.log('✅ Created .env.production template');
  }

  // Step 4: Check if Vercel CLI is installed
  try {
    execSync('vercel --version', { stdio: 'pipe' });
    console.log('✅ Vercel CLI is installed');
  } catch (error) {
    console.log('📦 Please install Vercel CLI manually:');
    console.log('   npm install -g vercel');
  }

  // Step 5: Deployment instructions
  console.log('\n🎯 Build completed successfully!');
  console.log('\n📋 Next Steps:');
  console.log('1. Set up environment variables in Vercel dashboard:');
  console.log('   - DATABASE_URL (from your .env.local)');
  console.log('   - POSTGRES_USER=postgres');
  console.log('   - POSTGRES_DB=postgres');
  console.log('   - ENCRYPTION_SECRET');
  console.log('   - LICENSE_SECRET');
  console.log('   - VERCEL_OIDC_TOKEN');
  console.log('\n2. Deploy to Vercel:');
  console.log('   vercel --prod');
  console.log('\n3. Or use the automated script:');
  console.log('   npm run deploy:vercel');

} catch (error) {
  console.error('❌ Build preparation failed:', error.message);
  process.exit(1);
}
