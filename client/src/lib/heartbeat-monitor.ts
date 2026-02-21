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
  
  // Obfuscated keys for security (browser-compatible)
  private readonly STORAGE_KEYS = {
    HEARTBEAT: atob('aGVhcnRiZWF0X2RhdGE='), // heartbeat_data
    LOCK_STATE: atob('bG9ja19zdGF0ZQ=='), // lock_state
    LAST_CHECK: atob('bGFzdF9jaGVjaw=='), // last_check
  };
  
  private constructor() {
    this.loadStoredData();
    this.checkInitialLock();
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
    return this.lockState.isLocked;
  }
  
  /**
   * Get lock reason
   */
  public getLockReason(): string {
    return this.lockState.reason;
  }
  
  /**
   * Clear lock state (for development/testing)
   */
  public clearLock(): void {
    this.lockState = { isLocked: false, reason: '', timestamp: 0 };
    localStorage.removeItem(this.STORAGE_KEYS.LOCK_STATE);
    // Reload page to clear lock screen if showing
    if (document.getElementById('tamper-lock-screen')) {
      window.location.reload();
    }
  }
  
  /**
   * Force lock the application
   */
  public forceLock(reason: string): void {
    this.lockState = {
      isLocked: true,
      reason,
      timestamp: Date.now()
    };
    this.saveLockState();
    this.stopMonitoring();
    
    // Force page reload to show lock screen
    window.location.reload();
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
        this.forceLock("Authentication failure - user data invalid");
        return;
      }
      
      // Get latest transaction
      const transactionsResponse = await apiRequest("GET", `/api/transactions/user/${userData.id}?limit=1`);
      const transactions = await transactionsResponse.json();
      
      const currentBalance = parseFloat(userData.balance || '0');
      const latestTransaction = transactions[0] || null;
      
      // Verify balance integrity
      const integrityCheck = this.verifyBalanceIntegrity(currentBalance, latestTransaction);
      
      if (!integrityCheck.valid) {
        this.forceLock(integrityCheck.reason || "Balance integrity check failed");
        return;
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
      
      // If multiple consecutive failures, lock app
      const lastCheck = this.getLastCheck();
      const timeSinceLastCheck = Date.now() - lastCheck;
      
      if (timeSinceLastCheck > 180000) { // 3 minutes
        this.forceLock("System integrity compromised - multiple heartbeat failures");
      }
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
    try {
      localStorage.setItem(this.STORAGE_KEYS.LOCK_STATE, JSON.stringify(this.lockState));
    } catch (error) {
      console.warn("Failed to save lock state:", error);
    }
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
    if (this.lockState.isLocked) {
      const timeSinceLock = Date.now() - this.lockState.timestamp;
      
      // Auto-clear lock if it's older than 1 hour (likely stale)
      if (timeSinceLock > 3600000) { // 1 hour
        console.log('🔓 Clearing stale lock state (older than 1 hour)');
        this.lockState = { isLocked: false, reason: '', timestamp: 0 };
        this.saveLockState();
        return;
      }
      
      // Also clear if user is not authenticated (prevents lock screen on login page)
      const userStr = localStorage.getItem('user_data') || sessionStorage.getItem('user_data');
      if (!userStr) {
        console.log('🔓 Clearing lock state - no user authentication found');
        this.lockState = { isLocked: false, reason: '', timestamp: 0 };
        this.saveLockState();
        return;
      }
      
      // If locked for more than 24 hours, allow unlock (emergency recovery)
      if (timeSinceLock > 86400000) {
        console.log('🔓 Emergency unlock - locked for more than 24 hours');
        this.lockState = { isLocked: false, reason: '', timestamp: 0 };
        this.saveLockState();
      } else {
        // Show lock screen
        this.showLockScreen();
      }
    }
  }
  
  /**
   * Show lock screen
   */
  private showLockScreen(): void {
    const lockScreen = document.createElement('div');
    lockScreen.id = 'tamper-lock-screen';
    lockScreen.style.cssText = `
      position: fixed;
      top: 0;
      left: 0;
      width: 100%;
      height: 100%;
      background: linear-gradient(135deg, #dc2626 0%, #991b1b 100%);
      color: white;
      display: flex;
      align-items: center;
      justify-content: center;
      z-index: 999999;
      font-family: system-ui, -apple-system, sans-serif;
    `;
    
    lockScreen.innerHTML = `
      <div style="text-align: center; padding: 2rem; max-width: 500px;">
        <div style="font-size: 4rem; margin-bottom: 1rem;">🔒</div>
        <h1 style="font-size: 2rem; margin-bottom: 1rem; font-weight: bold;">Application Locked</h1>
        <p style="font-size: 1.1rem; margin-bottom: 1.5rem; opacity: 0.9;">
          Security breach detected. The application has been locked to protect data integrity.
        </p>
        <div style="background: rgba(255,255,255,0.1); padding: 1rem; border-radius: 8px; margin-bottom: 1.5rem;">
          <p style="font-size: 0.9rem; margin: 0;">
            <strong>Reason:</strong> ${this.lockState.reason}
          </p>
          <p style="font-size: 0.9rem; margin: 0.5rem 0 0;">
            <strong>Time:</strong> ${new Date(this.lockState.timestamp).toLocaleString()}
          </p>
        </div>
        <p style="font-size: 0.9rem; opacity: 0.7;">
          Please contact your system administrator to resolve this issue.
        </p>
      </div>
    `;
    
    document.body.appendChild(lockScreen);
    
    // Prevent any interaction
    document.addEventListener('click', (e) => e.stopPropagation(), true);
    document.addEventListener('keydown', (e) => e.preventDefault(), true);
  }
}

export default HeartbeatMonitor.getInstance();
