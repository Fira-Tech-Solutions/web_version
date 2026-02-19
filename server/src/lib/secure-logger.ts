/**
 * Secure Production Logger
 * Encrypted logging system for audit trail and security monitoring
 */
import * as crypto from 'crypto';
import * as fs from 'fs';
import * as path from 'path';
import secureConfig from '../config/secure-config';

interface LogEntry {
  timestamp: number;
  level: 'INFO' | 'WARN' | 'ERROR' | 'SECURITY' | 'AUDIT';
  category: 'GAME' | 'RECHARGE' | 'AUTH' | 'SYSTEM' | 'TAMPER';
  userId?: number;
  username?: string;
  action: string;
  details: any;
  machineId?: string;
  ip?: string;
}

class SecureLogger {
  private static instance: SecureLogger;
  private logBuffer: LogEntry[] = [];
  private encryptionKey: string;
  private logFilePath: string;
  private isProduction: boolean;
  private flushInterval: NodeJS.Timeout | null = null;
  
  private constructor() {
    this.encryptionKey = secureConfig.getLogEncryptionKey();
    this.logFilePath = path.join(process.cwd(), 'logs', 'audit.log.enc');
    this.isProduction = process.env.NODE_ENV === 'production';
    
    // Ensure logs directory exists
    const logsDir = path.dirname(this.logFilePath);
    if (!fs.existsSync(logsDir)) {
      try {
        fs.mkdirSync(logsDir, { recursive: true });
      } catch (error) {
        console.error('Failed to create logs directory:', error);
      }
    }
    
    // Start flush interval (every 30 seconds or 100 entries)
    this.startFlushInterval();
  }
  
  public static getInstance(): SecureLogger {
    if (!SecureLogger.instance) {
      SecureLogger.instance = new SecureLogger();
    }
    return SecureLogger.instance;
  }
  
  /**
   * Encrypt log entry
   */
  private encryptLogEntry(entry: LogEntry): string {
    try {
      const jsonString = JSON.stringify(entry);
      const iv = crypto.randomBytes(16);
      const cipher = crypto.createCipher('aes-256-cbc', this.encryptionKey);
      cipher.setAutoPadding(true);
      
      let encrypted = cipher.update(jsonString, 'utf8', 'hex');
      encrypted += cipher.final('hex');
      
      return iv.toString('hex') + ':' + encrypted;
    } catch (error) {
      console.error('Failed to encrypt log entry:', error);
      return '';
    }
  }
  
  /**
   * Decrypt log entry (for reading logs)
   */
  private decryptLogEntry(encryptedEntry: string): LogEntry | null {
    try {
      const [ivHex, encrypted] = encryptedEntry.split(':');
      const iv = Buffer.from(ivHex, 'hex');
      const decipher = crypto.createDecipher('aes-256-cbc', this.encryptionKey);
      
      let decrypted = decipher.update(encrypted, 'hex', 'utf8');
      decrypted += decipher.final('utf8');
      
      return JSON.parse(decrypted);
    } catch (error) {
      console.error('Failed to decrypt log entry:', error);
      return null;
    }
  }
  
  /**
   * Add entry to log buffer
   */
  private addLogEntry(entry: Omit<LogEntry, 'timestamp'>): void {
    const logEntry: LogEntry = {
      ...entry,
      timestamp: Date.now()
    };
    
    this.logBuffer.push(logEntry);
    
    // In production, don't log to console
    if (!this.isProduction) {
      this.logToConsole(logEntry);
    }
    
    // Flush if buffer is full
    if (this.logBuffer.length >= 100) {
      this.flushLogs();
    }
  }
  
  /**
   * Log to console (development only)
   */
  private logToConsole(entry: LogEntry): void {
    const timestamp = new Date(entry.timestamp).toISOString();
    const levelColor = this.getLevelColor(entry.level);
    
    console.log(
      `%c[${timestamp}]%c ${entry.level}%c [${entry.category}]%c ${entry.action}`,
      'color: gray',
      `color: ${levelColor}; font-weight: bold`,
      'color: blue',
      'color: default'
    );
    
    if (entry.details && Object.keys(entry.details).length > 0) {
      console.log('Details:', entry.details);
    }
  }
  
  /**
   * Get color for log level
   */
  private getLevelColor(level: string): string {
    switch (level) {
      case 'INFO': return 'green';
      case 'WARN': return 'orange';
      case 'ERROR': return 'red';
      case 'SECURITY': return 'magenta';
      case 'AUDIT': return 'cyan';
      case 'TAMPER': return 'red';
      default: return 'white';
    }
  }
  
  /**
   * Start automatic log flushing
   */
  private startFlushInterval(): void {
    if (this.flushInterval) {
      clearInterval(this.flushInterval);
    }
    
    this.flushInterval = setInterval(() => {
      this.flushLogs();
    }, 30000); // Flush every 30 seconds
  }
  
  /**
   * Flush log buffer to encrypted file
   */
  private flushLogs(): void {
    if (this.logBuffer.length === 0) {
      return;
    }
    
    try {
      const encryptedEntries = this.logBuffer
        .map(entry => this.encryptLogEntry(entry))
        .filter(entry => entry.length > 0); // Filter out failed encryptions
      
      if (encryptedEntries.length === 0) {
        return;
      }
      
      const logData = encryptedEntries.join('\n') + '\n';
      
      // Append to file
      fs.appendFileSync(this.logFilePath, logData);
      
      // Clear buffer
      this.logBuffer = [];
      
      // Rotate log file if it gets too large (>10MB)
      this.rotateLogFileIfNeeded();
      
    } catch (error) {
      console.error('Failed to flush logs:', error);
      // Don't clear buffer on failure to try again
    }
  }
  
  /**
   * Rotate log file if it's too large
   */
  private rotateLogFileIfNeeded(): void {
    try {
      const stats = fs.statSync(this.logFilePath);
      const fileSizeMB = stats.size / (1024 * 1024);
      
      if (fileSizeMB > 10) {
        const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
        const archivePath = path.join(path.dirname(this.logFilePath), `audit-${timestamp}.log.enc`);
        
        // Move current log to archive
        fs.renameSync(this.logFilePath, archivePath);
        
        // Create new empty log file
        fs.writeFileSync(this.logFilePath, '');
      }
    } catch (error) {
      // Ignore rotation errors
    }
  }
  
  /**
   * Game creation log
   */
  public logGameCreation(gameData: any, userId: number, username: string): void {
    this.addLogEntry({
      level: 'AUDIT',
      category: 'GAME',
      userId,
      username,
      action: 'GAME_CREATED',
      details: {
        gameId: gameData.id,
        cardCount: gameData.cardCount || 0,
        entryFee: gameData.entryFee || 0
      }
    });
  }
  
  /**
   * Recharge attempt log
   */
  public logRechargeAttempt(amount: number, userId: number, username: string, machineId: string, success: boolean, reason?: string): void {
    this.addLogEntry({
      level: success ? 'AUDIT' : 'SECURITY',
      category: 'RECHARGE',
      userId,
      username,
      machineId,
      action: 'RECHARGE_ATTEMPT',
      details: {
        amount,
        success,
        reason: reason || (success ? 'Recharge successful' : 'Recharge failed')
      }
    });
  }
  
  /**
   * Authentication log
   */
  public logAuthAttempt(username: string, success: boolean, ip?: string, reason?: string): void {
    this.addLogEntry({
      level: success ? 'INFO' : 'SECURITY',
      category: 'AUTH',
      username,
      ip,
      action: 'LOGIN_ATTEMPT',
      details: {
        success,
        reason: reason || (success ? 'Login successful' : 'Login failed')
      }
    });
  }
  
  /**
   * Tamper detection log
   */
  public logTamperDetection(details: any, userId?: number, username?: string): void {
    this.addLogEntry({
      level: 'TAMPER',
      category: 'TAMPER',
      userId,
      username,
      action: 'TAMPER_DETECTED',
      details: {
        severity: 'HIGH',
        ...details
      }
    });
    
    // Force immediate flush for security events
    this.flushLogs();
  }
  
  /**
   * System event log
   */
  public logSystemEvent(action: string, level: 'INFO' | 'WARN' | 'ERROR' = 'INFO', details?: any): void {
    this.addLogEntry({
      level,
      category: 'SYSTEM',
      action,
      details
    });
  }
  
  /**
   * Error log
   */
  public logError(action: string, error: any, category: LogEntry['category'] = 'SYSTEM'): void {
    this.addLogEntry({
      level: 'ERROR',
      category,
      action,
      details: {
        error: error.message || error,
        stack: error.stack
      }
    });
  }
  
  /**
   * Read recent logs (for admin dashboard)
   */
  public readRecentLogs(limit: number = 100): LogEntry[] {
    try {
      if (!fs.existsSync(this.logFilePath)) {
        return [];
      }
      
      const logContent = fs.readFileSync(this.logFilePath, 'utf8');
      const lines = logContent.trim().split('\n').filter(line => line.length > 0);
      
      const entries: LogEntry[] = [];
      let count = 0;
      
      // Read from newest to oldest (reverse order)
      for (let i = lines.length - 1; i >= 0 && count < limit; i--) {
        const entry = this.decryptLogEntry(lines[i]);
        if (entry) {
          entries.push(entry);
          count++;
        }
      }
      
      return entries;
    } catch (error) {
      console.error('Failed to read logs:', error);
      return [];
    }
  }
  
  /**
   * Cleanup on shutdown
   */
  public shutdown(): void {
    if (this.flushInterval) {
      clearInterval(this.flushInterval);
    }
    
    // Flush any remaining logs
    this.flushLogs();
  }
}

export default SecureLogger.getInstance();
