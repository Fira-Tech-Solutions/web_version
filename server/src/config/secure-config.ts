/**
 * Secure Configuration Module
 * Handles encrypted environment variables and production security settings
 */
import * as crypto from 'crypto';
import * as fs from 'fs';
import * as path from 'path';

// Obfuscated key names to prevent easy discovery
const OBFUSCATED_KEYS = {
  RSA_PUBLIC: Buffer.from('bGljZW5zZV9wdWJsaWNfa2V5', 'base64').toString('utf8'), // license_public_key
  RSA_PRIVATE: Buffer.from('bGljZW5zZV9wcml2YXRlX2tleQ==', 'base64').toString('utf8'), // license_private_key
  DB_ENCRYPTION: Buffer.from('ZGJfZW5jcnlwdGlvbl9rZXk=', 'base64').toString('utf8'), // db_encryption_key
  LOG_ENCRYPTION: Buffer.from('bG9nX2VuY3J5cHRpb25fa2V5', 'base64').toString('utf8'), // log_encryption_key
  HEARTBEAT_SECRET: Buffer.from('aGVhcnRiZWF0X3NlY3JldA==', 'base64').toString('utf8'), // heartbeat_secret
  MACHINE_SALT: Buffer.from('bWFjaGluZV9zYWx0', 'base64').toString('utf8'), // machine_salt
} as const;

class SecureConfig {
  private static instance: SecureConfig;
  private cache: Map<string, any> = new Map();
  
  private constructor() {
    this.loadSecureKeys();
  }
  
  public static getInstance(): SecureConfig {
    if (!SecureConfig.instance) {
      SecureConfig.instance = new SecureConfig();
    }
    return SecureConfig.instance;
  }
  
  /**
   * Decrypt obfuscated environment variable
   */
  private decryptValue(encrypted: string, key: string): string {
    try {
      const decipher = crypto.createDecipher('aes-256-cbc', key);
      let decrypted = decipher.update(encrypted, 'hex', 'utf8');
      decrypted += decipher.final('utf8');
      return decrypted;
    } catch {
      // Fallback to environment variable for development
      return process.env[this.getOriginalKeyName(encrypted)] || '';
    }
  }
  
  /**
   * Get original key name from obfuscated value
   */
  private getOriginalKeyName(obfuscated: string): string {
    const keyMap: { [key: string]: string } = {
      [OBFUSCATED_KEYS.RSA_PUBLIC]: 'LICENSE_PUBLIC_KEY',
      [OBFUSCATED_KEYS.RSA_PRIVATE]: 'LICENSE_PRIVATE_KEY',
      [OBFUSCATED_KEYS.DB_ENCRYPTION]: 'DB_ENCRYPTION_KEY',
      [OBFUSCATED_KEYS.LOG_ENCRYPTION]: 'LOG_ENCRYPTION_KEY',
      [OBFUSCATED_KEYS.HEARTBEAT_SECRET]: 'HEARTBEAT_SECRET',
      [OBFUSCATED_KEYS.MACHINE_SALT]: 'MACHINE_ID_SALT',
    };
    return keyMap[obfuscated] || '';
  }
  
  /**
   * Load and decrypt secure keys
   */
  private loadSecureKeys(): void {
    const isProduction = process.env.NODE_ENV === 'production';
    
    if (isProduction) {
      // Production: Load from environment variables
      Object.values(OBFUSCATED_KEYS).forEach(obfuscatedKey => {
        const value = process.env[obfuscatedKey];
        if (value) {
          const originalKey = this.getOriginalKeyName(obfuscatedKey);
          const decryptedValue = this.decryptValue(value, process.env.MASTER_KEY || 'default-fallback-key');
          this.cache.set(originalKey, decryptedValue);
        }
      });
    } else {
      // Development: Load from files with fallback
      this.loadDevelopmentKeys();
    }
  }
  
  /**
   * Development key loading with fallbacks
   */
  private loadDevelopmentKeys(): void {
    try {
      // Try to load from files first
      const publicKeyPath = path.join(process.cwd(), 'keys', 'public_key.pem');
      const privateKeyPath = path.join(process.cwd(), 'keys', 'private_key.pem');
      
      if (fs.existsSync(publicKeyPath)) {
        this.cache.set('LICENSE_PUBLIC_KEY', fs.readFileSync(publicKeyPath, 'utf8'));
      }
      
      if (fs.existsSync(privateKeyPath)) {
        this.cache.set('LICENSE_PRIVATE_KEY', fs.readFileSync(privateKeyPath, 'utf8'));
      }
      
      // Set development defaults
      this.cache.set('DB_ENCRYPTION_KEY', 'dev-db-key-32-chars-long');
      this.cache.set('LOG_ENCRYPTION_KEY', 'dev-log-key-32-chars-long');
      this.cache.set('HEARTBEAT_SECRET', 'dev-heartbeat-secret-32');
      this.cache.set('MACHINE_ID_SALT', 'dev-machine-salt-16');
    } catch (error) {
      console.warn('Failed to load development keys:', error);
      // Set minimal defaults
      this.cache.set('DB_ENCRYPTION_KEY', 'fallback-db-key');
      this.cache.set('LOG_ENCRYPTION_KEY', 'fallback-log-key');
      this.cache.set('HEARTBEAT_SECRET', 'fallback-heartbeat');
      this.cache.set('MACHINE_ID_SALT', 'fallback-salt');
    }
  }
  
  /**
   * Get secure configuration value
   */
  public get(key: string): string {
    return this.cache.get(key) || '';
  }
  
  /**
   * Get RSA public key
   */
  public getRSAPublicKey(): string {
    return this.get('LICENSE_PUBLIC_KEY');
  }
  
  /**
   * Get RSA private key (should be used carefully)
   */
  public getRSAPrivateKey(): string {
    return this.get('LICENSE_PRIVATE_KEY');
  }
  
  /**
   * Get database encryption key
   */
  public getDBEncryptionKey(): string {
    return this.get('DB_ENCRYPTION_KEY');
  }
  
  /**
   * Get log encryption key
   */
  public getLogEncryptionKey(): string {
    return this.get('LOG_ENCRYPTION_KEY');
  }
  
  /**
   * Get heartbeat secret
   */
  public getHeartbeatSecret(): string {
    return this.get('HEARTBEAT_SECRET');
  }
  
  /**
   * Get machine ID salt
   */
  public getMachineSalt(): string {
    return this.get('MACHINE_ID_SALT');
  }
  
  /**
   * Clear sensitive keys from memory (for logout/shutdown)
   */
  public clearSensitiveKeys(): void {
    this.cache.delete('LICENSE_PRIVATE_KEY');
    this.cache.delete('DB_ENCRYPTION_KEY');
    this.cache.delete('LOG_ENCRYPTION_KEY');
    // Force garbage collection if available
    if (global.gc) {
      global.gc();
    }
  }
  
  /**
   * Verify integrity of cached keys
   */
  public verifyKeyIntegrity(): boolean {
    const requiredKeys = ['LICENSE_PUBLIC_KEY', 'HEARTBEAT_SECRET', 'MACHINE_ID_SALT'];
    return requiredKeys.every(key => this.cache.has(key) && this.cache.get(key).length > 0);
  }
}

export default SecureConfig.getInstance();
