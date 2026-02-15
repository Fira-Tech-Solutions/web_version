/**
 * Device Information Bridge
 * Works in both Browser (Development) and Electron/Windows (Production)
 */

// Generate a UUID for development purposes
function generateDevUUID(): string {
  const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789';
  let result = 'DEV-';
  for (let i = 0; i < 8; i++) {
    result += chars.charAt(Math.floor(Math.random() * chars.length));
  }
  return result;
}

/**
 * Gets the machine ID based on the environment
 * Browser: Uses localStorage with generated UUID
 * Electron/Windows: Uses native hardware ID (placeholder for now)
 */
export async function getMachineId(): Promise<string> {
  // Check if we're in a desktop/electron environment
  const isElectron = typeof window !== 'undefined' && 
    (window.process?.versions?.electron || 
     window.electronAPI || 
     navigator.userAgent.toLowerCase().indexOf('electron') > -1);

  if (isElectron) {
    // Electron/Windows environment
    try {
      // TODO: Replace with actual native call to node-machine-id
      // For now, use a placeholder that simulates hardware binding
      const electronMachineId = await getElectronMachineId();
      return electronMachineId;
    } catch (error) {
      console.warn('Failed to get Electron machine ID, falling back to browser method:', error);
      return getBrowserMachineId();
    }
  } else {
    // Browser environment
    return getBrowserMachineId();
  }
}

/**
 * Synchronous version of getMachineId for immediate needs
 */
export function getMachineIdSync(): string {
  // Check if we're in a desktop/electron environment
  const isElectron = typeof window !== 'undefined' && 
    (window.process?.versions?.electron || 
     window.electronAPI || 
     navigator.userAgent.toLowerCase().indexOf('electron') > -1);

  if (isElectron) {
    // Electron/Windows environment
    try {
      // TODO: Replace with actual native call to node-machine-id
      // For now, use a placeholder that simulates hardware binding
      return getElectronMachineIdSync();
    } catch (error) {
      console.warn('Failed to get Electron machine ID sync, falling back to browser method:', error);
      return getBrowserMachineIdSync();
    }
  } else {
    // Browser environment
    return getBrowserMachineIdSync();
  }
}

/**
 * Browser-specific machine ID implementation
 */
function getBrowserMachineId(): Promise<string> {
  return new Promise((resolve) => {
    resolve(getBrowserMachineIdSync());
  });
}

function getBrowserMachineIdSync(): string {
  if (typeof window === 'undefined') {
    // SSR fallback
    return 'SSR-ENVIRONMENT';
  }

  // Check localStorage for existing device ID
  let deviceId = localStorage.getItem('dev_machine_id');
  
  if (!deviceId) {
    // Generate new device ID and save it
    deviceId = generateDevUUID();
    localStorage.setItem('dev_machine_id', deviceId);
    console.log('Generated new development machine ID:', deviceId);
  }
  
  return deviceId;
}

/**
 * Electron-specific machine ID implementation
 * TODO: Replace with actual native implementation
 */
async function getElectronMachineId(): Promise<string> {
  // TODO: This is where the actual native node-machine-id call will go
  // For now, we'll use a placeholder that simulates hardware binding
  
  // In actual Electron implementation, this would be:
  // const machineId = await window.electronAPI.getMachineId();
  // return machineId;
  
  // Placeholder implementation
  const electronMachineId = getElectronMachineIdSync();
  return electronMachineId;
}

function getElectronMachineIdSync(): string {
  // TODO: This is where the actual native node-machine-id call will go
  // For now, we'll use a placeholder that simulates hardware binding
  
  // In actual Electron implementation, this would be:
  // const machineId = window.electronAPI.getMachineIdSync();
  // return machineId;
  
  // Placeholder implementation - simulate hardware-bound ID
  // In production, this would be the actual hardware ID from node-machine-id
  const userAgent = navigator.userAgent;
  const platform = navigator.platform;
  const language = navigator.language;
  
  // Create a pseudo-unique ID based on available browser info
  // This is just for development - in production this will be replaced
  // with actual hardware ID from node-machine-id
  const baseString = `${platform}-${language}-${userAgent.slice(-10)}`;
  const hash = simpleHash(baseString);
  
  return `ELECTRON-${hash}`;
}

/**
 * Simple hash function for creating consistent pseudo-unique IDs
 */
function simpleHash(str: string): string {
  let hash = 0;
  for (let i = 0; i < str.length; i++) {
    const char = str.charCodeAt(i);
    hash = ((hash << 5) - hash) + char;
    hash = hash & hash; // Convert to 32-bit integer
  }
  return Math.abs(hash).toString(16).toUpperCase().padStart(8, '0');
}

/**
 * Reset the development machine ID (for testing purposes)
 * Only works in browser environment
 */
export function resetDevMachineId(): boolean {
  if (typeof window === 'undefined') {
    return false;
  }

  const isElectron = typeof window !== 'undefined' && 
    (window.process?.versions?.electron || 
     window.electronAPI || 
     navigator.userAgent.toLowerCase().indexOf('electron') > -1);

  if (isElectron) {
    console.warn('Cannot reset machine ID in Electron environment');
    return false;
  }

  try {
    localStorage.removeItem('dev_machine_id');
    console.log('Development machine ID reset successfully');
    return true;
  } catch (error) {
    console.error('Failed to reset development machine ID:', error);
    return false;
  }
}

/**
 * Get environment information for debugging
 */
export function getDeviceInfo(): {
  environment: 'browser' | 'electron' | 'unknown';
  machineId: string;
  isDevelopment: boolean;
} {
  const isElectron = typeof window !== 'undefined' && 
    (window.process?.versions?.electron || 
     window.electronAPI || 
     navigator.userAgent.toLowerCase().indexOf('electron') > -1);
  
  const isDevelopment = process?.env?.NODE_ENV === 'development' || 
                      window.location?.hostname === 'localhost' ||
                      window.location?.hostname === '127.0.0.1';

  return {
    environment: isElectron ? 'electron' : 'browser',
    machineId: getMachineIdSync(),
    isDevelopment
  };
}

/**
 * Check if the current environment supports native machine ID
 */
export function supportsNativeMachineId(): boolean {
  const isElectron = typeof window !== 'undefined' && 
    (window.process?.versions?.electron || 
     window.electronAPI || 
     navigator.userAgent.toLowerCase().indexOf('electron') > -1);
  
  return isElectron;
}
