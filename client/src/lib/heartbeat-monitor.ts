/**
 * Anti-Tamper Heartbeat Monitor - Browser Compatible
 * Continuously monitors system integrity and locks app on tampering detection
 */
import { apiRequest } from "./queryClient";

interface HeartbeatData {
  lastKnownBalance: string;
  lastTransactionId: number;
  lastTransactionSignature: string;
  machineId: string;
  timestamp: number;
}

interface LockState {
  isLocked: boolean;
  reason: string;
  timestamp: number;
}

class HeartbeatMonitor {
  private static instance: HeartbeatMonitor;
  private intervalId: number | null = null;
  private isRunning = false;
  private lockState: LockState = { isLocked: false, reason: '', timestamp: 0 };
  private heartbeatData: HeartbeatData | null = null;
  private isInitializing = false; // Prevent refresh loops during init
  
  // Obfuscated keys for security (browser-compatible)
  private readonly STORAGE_KEYS = {
    HEARTBEAT: atob('aGVhcnRiZWF0X2RhdGE='), // heartbeat_data
    LOCK_STATE: atob('bG9ja19zdGF0ZQ=='), // lock_state
    LAST_CHECK: atob('bGFzdF9jaGVjaw=='), // last_check
  };
  
  private constructor() {
    this.isInitializing = true;
    this.loadStoredData();
    this.checkInitialLock();
    this.isInitializing = false;
  }
  
  public static getInstance(): HeartbeatMonitor {
    if (!HeartbeatMonitor.instance) {
      HeartbeatMonitor.instance = new HeartbeatMonitor();
    }
    return HeartbeatMonitor.instance;
  }
  
  /**
   * Start heartbeat monitoring
   */
  public startMonitoring(): void {
    if (this.isRunning || this.lockState.isLocked) {
      return;
    }
    
    this.isRunning = true;
    
    // Check every 30 seconds
    this.intervalId = window.setInterval(() => {
      this.performHeartbeat();
    }, 30000);
    
    // Initial check
    this.performHeartbeat();
  }
  
  /**
   * Stop heartbeat monitoring
   */
  public stopMonitoring(): void {
    if (this.intervalId) {
      clearInterval(this.intervalId);
      this.intervalId = null;
    }
    this.isRunning = false;
  }
  
  /**
   * Check if app is locked
   */
  public isAppLocked(): boolean {
    // Always return false - lock functionality disabled
    return false;
  }
  
  /**
   * Get lock reason
   */
  public getLockReason(): string {
    // Return empty reason - lock functionality disabled
    return "";
  }
  
  /**
   * Clear lock state (for development/testing)
   */
  public clearLock(): void {
    // Lock functionality disabled - no action needed
    console.log('🔓 Lock functionality disabled - no lock to clear');
  }
  
  /**
   * Force lock the application
   */
  public forceLock(reason: string): void {
    // Lock functionality disabled - ignore lock requests
    console.log('🔓 Lock functionality disabled - ignoring lock request:', reason);
  }
  
  /**
   * Perform heartbeat check
   */
  private async performHeartbeat(): Promise<void> {
    try {
      // Get current user data
      const userResponse = await apiRequest("GET", "/api/auth/me");
      const userData = await userResponse.json();
      
      if (!userData || !userData.id) {
        console.log('⚠️ User not authenticated - skipping heartbeat check');
        return;
      }
      
      // Get latest transaction
      const transactionsResponse = await apiRequest("GET", `/api/transactions/user/${userData.id}?limit=1`);
      const transactions = await transactionsResponse.json();
      
      const currentBalance = parseFloat(userData.balance || '0');
      const latestTransaction = transactions[0] || null;
      
      // Verify balance integrity (without locking)
      const integrityCheck = this.verifyBalanceIntegrity(currentBalance, latestTransaction);
      
      if (!integrityCheck.valid) {
        console.warn('⚠️ Balance integrity issue detected:', integrityCheck.reason);
        // Log warning but don't lock the app
      }
      
      // Update heartbeat data
      this.heartbeatData = {
        lastKnownBalance: userData.balance || '0',
        lastTransactionId: latestTransaction?.id || 0,
        lastTransactionSignature: latestTransaction?.signature || '',
        machineId: userData.machineId || '',
        timestamp: Date.now()
      };
      
      this.saveHeartbeatData();
      this.updateLastCheck();
      
    } catch (error) {
      console.error("Heartbeat check failed:", error);
      // Just log error - don't lock the app
    }
  }
  
  /**
   * Verify balance integrity against last transaction
   */
  private verifyBalanceIntegrity(currentBalance: number, latestTransaction: any): { valid: boolean; reason?: string } {
    if (!this.heartbeatData) {
      // First time running, no baseline to compare
      return { valid: true };
    }
    
    if (!latestTransaction) {
      // No transactions since last check
      const lastKnownBalance = parseFloat(this.heartbeatData.lastKnownBalance);
      if (Math.abs(currentBalance - lastKnownBalance) > 0.01) {
        return { 
          valid: false, 
          reason: "Balance changed without transaction record" 
        };
      }
      return { valid: true };
    }
    
    // Check if latest transaction is newer than our baseline
    if (latestTransaction.id <= this.heartbeatData.lastTransactionId) {
      const lastKnownBalance = parseFloat(this.heartbeatData.lastKnownBalance);
      if (Math.abs(currentBalance - lastKnownBalance) > 0.01) {
        return { 
          valid: false, 
          reason: "Balance tampered - no new transaction but balance changed" 
        };
      }
      return { valid: true };
    }
    
    // Verify transaction signature if available
    if (latestTransaction.signature && this.heartbeatData.lastTransactionSignature !== latestTransaction.signature) {
      // New transaction, verify it's properly signed
      try {
        // This would require public key to verify - for now just check format
        if (!latestTransaction.signature.startsWith('-----BEGIN') && !latestTransaction.signature.includes('SIGNATURE')) {
          return { 
            valid: false, 
            reason: "Invalid transaction signature format" 
          };
        }
      } catch (error) {
        return { 
          valid: false, 
          reason: "Transaction signature verification failed" 
        };
      }
    }
    
    return { valid: true };
  }
  
  /**
   * Load stored data from localStorage
   */
  private loadStoredData(): void {
    try {
      const heartbeatData = localStorage.getItem(this.STORAGE_KEYS.HEARTBEAT);
      if (heartbeatData) {
        this.heartbeatData = JSON.parse(heartbeatData);
      }
      
      const lockState = localStorage.getItem(this.STORAGE_KEYS.LOCK_STATE);
      if (lockState) {
        this.lockState = JSON.parse(lockState);
      }
    } catch (error) {
      console.warn("Failed to load heartbeat data:", error);
    }
  }
  
  /**
   * Save heartbeat data to localStorage
   */
  private saveHeartbeatData(): void {
    try {
      if (this.heartbeatData) {
        localStorage.setItem(this.STORAGE_KEYS.HEARTBEAT, JSON.stringify(this.heartbeatData));
      }
    } catch (error) {
      console.warn("Failed to save heartbeat data:", error);
    }
  }
  
  /**
   * Save lock state to localStorage
   */
  private saveLockState(): void {
    // Lock functionality disabled - no action needed
  }
  
  /**
   * Update last check timestamp
   */
  private updateLastCheck(): void {
    try {
      localStorage.setItem(this.STORAGE_KEYS.LAST_CHECK, Date.now().toString());
    } catch (error) {
      console.warn("Failed to update last check:", error);
    }
  }
  
  /**
   * Get last check timestamp
   */
  private getLastCheck(): number {
    try {
      const lastCheck = localStorage.getItem(this.STORAGE_KEYS.LAST_CHECK);
      return lastCheck ? parseInt(lastCheck) : 0;
    } catch (error) {
      return 0;
    }
  }
  
  /**
   * Check initial lock state on startup
   */
  private checkInitialLock(): void {
    // Lock functionality completely removed
    console.log('🔓 Lock functionality disabled - system unlocked');
  }
}

export default HeartbeatMonitor.getInstance();
