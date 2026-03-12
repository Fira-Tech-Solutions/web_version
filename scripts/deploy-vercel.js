#!/usr/bin/env node

import { execSync } from 'child_process';
import { readFileSync, writeFileSync } from 'fs';
import path from 'path';

console.log('🚀 Starting Vercel deployment preparation...');

try {
  // Step 1: Clean previous build
  console.log('🧹 Cleaning previous build...');
  execSync('rm -rf dist', { stdio: 'inherit' });

  // Step 2: Install dependencies
  console.log('📦 Installing dependencies...');
  execSync('npm ci', { stdio: 'inherit' });

  // Step 3: Build the application
  console.log('🔨 Building application...');
  execSync('npm run build:vercel', { stdio: 'inherit' });

  // Step 4: Create .env.production if it doesn't exist
  const envPath = path.join(process.cwd(), '.env.production');
  try {
    readFileSync(envPath);
    console.log('✅ .env.production already exists');
  } catch (error) {
    console.log('📝 Creating .env.production template...');
    const envTemplate = `# Production Environment Variables for Vercel
# These should be set in Vercel dashboard under Environment Variables

# Database Configuration
POSTGRES_URL=postgresql://user:password@host:port/database
POSTGRES_USER=postgres
POSTGRES_PASSWORD=your_password
POSTGRES_DB=your_database

# Security
ENCRYPTION_SECRET=bingo-master-secure-shared-secret-key-32
LICENSE_SECRET=your_license_secret

# Application
NODE_ENV=production
`;
    writeFileSync(envPath, envTemplate);
    console.log('✅ Created .env.production template');
  }

  // Step 5: Check if Vercel CLI is installed
  try {
    execSync('vercel --version', { stdio: 'pipe' });
    console.log('✅ Vercel CLI is installed');
  } catch (error) {
    console.log('📦 Installing Vercel CLI...');
    execSync('npm install -g vercel', { stdio: 'inherit' });
  }

  // Step 6: Deployment instructions
  console.log('\n🎯 Ready for Vercel deployment!');
  console.log('\n📋 Next Steps:');
  console.log('1. Set up environment variables in Vercel dashboard:');
  console.log('   - POSTGRES_URL');
  console.log('   - POSTGRES_USER');
  console.log('   - POSTGRES_PASSWORD');
  console.log('   - POSTGRES_DB');
  console.log('   - ENCRYPTION_SECRET');
  console.log('   - LICENSE_SECRET');
  console.log('\n2. Run deployment:');
  console.log('   npm run deploy:vercel');
  console.log('\n3. Or deploy manually:');
  console.log('   vercel --prod');

} catch (error) {
  console.error('❌ Deployment preparation failed:', error.message);
  process.exit(1);
}
