/**
 * Stable Machine ID Generator
 * Creates consistent, static machine IDs based on stable hardware identifiers
 */
import * as crypto from 'crypto';
import * as os from 'os';
import { execSync } from 'child_process';
import secureConfig from '../config/secure-config';

class StableMachineIdGenerator {
  private static instance: StableMachineIdGenerator | null = null;
  private cachedMachineId: string | null = null;
  private stableMarkers: any = null;

  public constructor() {
    this.collectStableMarkers();
  }

  /**
   * Get singleton instance
   */
  public static getInstance(): StableMachineIdGenerator {
    if (!StableMachineIdGenerator.instance) {
      StableMachineIdGenerator.instance = new StableMachineIdGenerator();
    }
    return StableMachineIdGenerator.instance!;
  }

  /**
   * Generate stable machine ID using only persistent hardware identifiers
   */
  public getMachineId(): string {
    if (this.cachedMachineId) {
      return this.cachedMachineId;
    }
    
    if (!this.stableMarkers) {
      throw new Error('Failed to collect stable hardware markers');
    }
    
    // Create fingerprint from only stable identifiers
    const fingerprint = this.createStableFingerprint(this.stableMarkers);
    
    // Hash with salt for additional security
    const salt = secureConfig.getMachineSalt();
    const hash = crypto.createHash('sha256');
    hash.update(fingerprint + salt);
    
    this.cachedMachineId = hash.digest('hex');
    return this.cachedMachineId;
  }

  /**
   * Collect stable hardware markers that don't change frequently
   */
  private collectStableMarkers(): void {
    try {
      const markers = {
        // Use only stable motherboard info
        motherboardSerial: this.getMotherboardSerial(),
        // Use system UUID (changes rarely)
        systemUuid: this.getSystemUuid(),
        // Use first MAC address (stable)
        primaryMacAddress: this.getPrimaryMacAddress(),
        // Use disk serial (stable)
        diskSerial: this.getDiskSerial(),
        // OS info (relatively stable)
        osInfo: this.getOsInfo()
      };
      
      this.stableMarkers = markers;
    } catch (error) {
      console.error('Failed to collect stable hardware markers:', error);
      // Fallback to basic markers
      this.stableMarkers = this.getFallbackMarkers();
    }
  }

  /**
   * Create stable fingerprint excluding dynamic values
   */
  private createStableFingerprint(markers: any): string {
    return [
      markers.motherboardSerial || 'unknown',
      markers.systemUuid || 'unknown',
      markers.primaryMacAddress || 'unknown',
      markers.diskSerial || 'unknown',
      markers.osInfo || 'unknown'
    ].join('|');
  }

  /**
   * Get motherboard serial number
   */
  private getMotherboardSerial(): string {
    try {
      // Try different methods for motherboard serial
      if (process.platform === 'linux') {
        try {
          const result = execSync('cat /sys/class/dmi/id/board_serial', { encoding: 'utf8' });
          return result.stdout.trim();
        } catch {
          // Fallback to dmidecode
          const result = execSync('sudo dmidecode -s baseboard', { encoding: 'utf8' });
          const match = result.stdout.match(/Serial Number:\s*(.+)/);
          return match ? match[1].trim() : 'unknown';
        }
      } else if (process.platform === 'win32') {
        const result = execSync('wmic baseboard get serialnumber', { encoding: 'utf8' });
        return result.stdout.trim();
      } else {
        return 'unknown';
      }
    } catch {
      return 'unknown';
    }
  }

  /**
   * Get system UUID
   */
  private getSystemUuid(): string {
    try {
      if (process.platform === 'linux') {
        const result = execSync('cat /sys/class/dmi/id/product_uuid', { encoding: 'utf8' });
        return result.stdout.trim();
      } else if (process.platform === 'win32') {
        const result = execSync('wmic csproduct get uuid', { encoding: 'utf8' });
        return result.stdout.trim();
      } else {
        return 'unknown';
      }
    } catch {
      return 'unknown';
    }
  }

  /**
   * Get primary MAC address
   */
  private getPrimaryMacAddress(): string {
    try {
      if (process.platform === 'linux') {
        const result = execSync('cat /sys/class/net/$(ls /sys/class/net/ | head -n1 | cut -d/ -f1)/address', { encoding: 'utf8' });
        return result.stdout.trim();
      } else if (process.platform === 'win32') {
        const result = execSync('getmac /v /fo csv', { encoding: 'utf8' });
        const lines = result.stdout.split('\n');
        for (const line of lines) {
          if (line.includes('Physical')) {
            return line.split(',')[0].trim();
          }
        }
      }
      return 'unknown';
    } catch {
      return 'unknown';
    }
  }

  /**
   * Get disk serial
   */
  private getDiskSerial(): string {
    try {
      if (process.platform === 'linux') {
        const result = execSync('lsblk -o NAME,SERIAL | head -n1', { encoding: 'utf8' });
        const lines = result.stdout.split('\n');
        for (const line of lines) {
          if (line.includes('disk')) {
            const parts = line.split(/\s+/);
            return parts[parts.length - 1] || 'unknown';
          }
        }
      } else if (process.platform === 'win32') {
        const result = execSync('wmic diskdrive get serialnumber', { encoding: 'utf8' });
        return result.stdout.trim();
      }
      return 'unknown';
    } catch {
      return 'unknown';
    }
  }

  /**
   * Get OS info
   */
  private getOsInfo(): string {
    try {
      const platform = os.platform();
      const arch = os.arch();
      const release = os.release();
      return `${platform}-${arch}-${release}`;
    } catch {
      return 'unknown';
    }
  }

  /**
   * Get fallback markers
   */
  private getFallbackMarkers(): any {
    return {
      motherboardSerial: 'unknown',
      systemUuid: 'unknown',
      primaryMacAddress: 'unknown',
      diskSerial: 'unknown',
      osInfo: this.getOsInfo()
    };
  }

  /**
   * Verify machine ID (for compatibility)
   */
  public verifyMachineId(storedId: string): boolean {
    const currentId = this.getMachineId();
    return currentId === storedId;
  }

  /**
   * Check if hardware has changed (for compatibility)
   */
  public hasHardwareChanged(): boolean {
    // For stable IDs, this should rarely change
    return false;
  }
}

export default StableMachineIdGenerator;
