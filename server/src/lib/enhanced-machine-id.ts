/**
 * Enhanced Machine ID Generator
 * Multi-factor hardware binding using CPU, Motherboard, UUID, and other markers
 */
import * as crypto from 'crypto';
import * as os from 'os';
import { execSync } from 'child_process';
import secureConfig from '../config/secure-config';

interface HardwareMarkers {
  cpuInfo: string;
  motherboardSerial: string;
  systemUuid: string;
  macAddresses: string[];
  diskSerial: string;
  biosInfo: string;
  totalMemory: string;
  osInfo: string;
}

class EnhancedMachineIdGenerator {
  private static instance: EnhancedMachineIdGenerator | null = null;
  private cachedMachineId: string | null = null;
  private hardwareMarkers: HardwareMarkers | null = null;
  
  public constructor() {
    this.collectHardwareMarkers();
  }
  
  /**
   * Get singleton instance
   */
  public static getInstance(): EnhancedMachineIdGenerator {
    if (!EnhancedMachineIdGenerator.instance) {
      EnhancedMachineIdGenerator.instance = new EnhancedMachineIdGenerator();
    }
    return EnhancedMachineIdGenerator.instance!;
  }
  
  /**
   * Generate enhanced machine ID using multiple hardware markers
   */
  public getMachineId(): string {
    if (this.cachedMachineId) {
      return this.cachedMachineId;
    }
    
    if (!this.hardwareMarkers) {
      throw new Error('Failed to collect hardware markers');
    }
    
    // Create a comprehensive fingerprint
    const fingerprint = this.createFingerprint(this.hardwareMarkers);
    
    // Hash with salt for additional security
    const salt = secureConfig.getMachineSalt();
    const hash = crypto.createHash('sha256');
    hash.update(fingerprint + salt);
    
    this.cachedMachineId = hash.digest('hex');
    return this.cachedMachineId;
  }
  
  /**
   * Collect hardware markers from multiple sources
   */
  private collectHardwareMarkers(): void {
    try {
      const markers: HardwareMarkers = {
        cpuInfo: this.getCpuInfo(),
        motherboardSerial: this.getMotherboardSerial(),
        systemUuid: this.getSystemUuid(),
        macAddresses: this.getMacAddresses(),
        diskSerial: this.getDiskSerial(),
        biosInfo: this.getBiosInfo(),
        totalMemory: this.getTotalMemory(),
        osInfo: this.getOsInfo()
      };
      
      this.hardwareMarkers = markers;
    } catch (error) {
      console.error('Failed to collect hardware markers:', error);
      // Fallback to basic markers
      this.hardwareMarkers = this.getFallbackMarkers();
    }
  }
  
  /**
   * Get CPU information
   */
  private getCpuInfo(): string {
    try {
      const cpuModel = os.cpus()[0]?.model || '';
      const cpuCores = os.cpus().length.toString();
      const cpuSpeed = os.cpus()[0]?.speed || '';
      
      return `${cpuModel}-${cpuCores}-${cpuSpeed}`;
    } catch {
      return 'unknown-cpu';
    }
  }
  
  /**
   * Get motherboard serial number
   */
  private getMotherboardSerial(): string {
    try {
      // Try different commands based on platform
      const platform = os.platform();
      let serial = '';
      
      if (platform === 'win32') {
        // Windows: use wmic
        try {
          serial = execSync('wmic baseboard get serialnumber /value', { encoding: 'utf8' })
            .split('\n')
            .find(line => line.startsWith('SerialNumber='))
            ?.split('=')[1]
            ?.trim() || '';
        } catch {
          // Fallback to PowerShell
          serial = execSync('powershell "Get-WmiObject Win32_BaseBoard | Select-Object SerialNumber"', { encoding: 'utf8' })
            .split('\n')
            .find(line => line.trim() && !line.includes('SerialNumber'))
            ?.trim() || '';
        }
      } else if (platform === 'linux') {
        // Linux: try dmidecode
        try {
          serial = execSync('sudo dmidecode -s baseboard-serial-number', { encoding: 'utf8' }).trim();
        } catch {
          // Fallback to sysfs
          serial = execSync('cat /sys/class/dmi/id/board_serial 2>/dev/null || echo ""', { encoding: 'utf8' }).trim();
        }
      } else if (platform === 'darwin') {
        // macOS: use system_profiler
        serial = execSync('system_profiler SPHardwareDataType | grep "Serial Number" | awk \'{print $4}\'', { encoding: 'utf8' }).trim();
      }
      
      return serial || 'unknown-motherboard';
    } catch {
      return 'unknown-motherboard';
    }
  }
  
  /**
   * Get system UUID
   */
  private getSystemUuid(): string {
    try {
      const platform = os.platform();
      let uuid = '';
      
      if (platform === 'win32') {
        uuid = execSync('wmic csproduct get uuid /value', { encoding: 'utf8' })
          .split('\n')
          .find(line => line.startsWith('UUID='))
          ?.split('=')[1]
          ?.trim() || '';
      } else if (platform === 'linux') {
        try {
          uuid = execSync('sudo dmidecode -s system-uuid', { encoding: 'utf8' }).trim();
        } catch {
          uuid = execSync('cat /sys/class/dmi/id/product_uuid 2>/dev/null || echo ""', { encoding: 'utf8' }).trim();
        }
      } else if (platform === 'darwin') {
        uuid = execSync('system_profiler SPHardwareDataType | grep "Hardware UUID" | awk \'{print $3}\'', { encoding: 'utf8' }).trim();
      }
      
      return uuid || 'unknown-uuid';
    } catch {
      return 'unknown-uuid';
    }
  }
  
  /**
   * Get MAC addresses
   */
  private getMacAddresses(): string[] {
    try {
      const interfaces = os.networkInterfaces();
      const macAddresses: string[] = [];
      
      for (const [name, infos] of Object.entries(interfaces)) {
        if (infos) {
          for (const info of infos) {
            // Skip internal and virtual interfaces
            if (!info.internal && info.mac && info.mac !== '00:00:00:00:00:00') {
              macAddresses.push(info.mac);
            }
          }
        }
      }
      
      // Sort for consistency
      return macAddresses.sort();
    } catch {
      return ['unknown-mac'];
    }
  }
  
  /**
   * Get disk serial number
   */
  private getDiskSerial(): string {
    try {
      const platform = os.platform();
      let serial = '';
      
      if (platform === 'win32') {
        serial = execSync('wmic diskdrive get serialnumber /value', { encoding: 'utf8' })
          .split('\n')
          .find(line => line.startsWith('SerialNumber='))
          ?.split('=')[1]
          ?.trim() || '';
      } else if (platform === 'linux') {
        try {
          serial = execSync('lsblk -o NAME,SERIAL -n | head -1 | awk \'{print $2}\'', { encoding: 'utf8' }).trim();
        } catch {
          serial = execSync('sudo hdparm -I /dev/sda 2>/dev/null | grep "Serial Number" | awk \'{print $3}\' || echo ""', { encoding: 'utf8' }).trim();
        }
      } else if (platform === 'darwin') {
        serial = execSync('diskutil info / | grep "Serial Number" | awk \'{print $3}\'', { encoding: 'utf8' }).trim();
      }
      
      return serial || 'unknown-disk';
    } catch {
      return 'unknown-disk';
    }
  }
  
  /**
   * Get BIOS information
   */
  private getBiosInfo(): string {
    try {
      const platform = os.platform();
      let biosInfo = '';
      
      if (platform === 'win32') {
        biosInfo = execSync('wmic bios get version,serialnumber /value', { encoding: 'utf8' })
          .split('\n')
          .filter(line => line.includes('='))
          .map(line => line.split('=')[1])
          .join('-')
          .trim();
      } else if (platform === 'linux') {
        biosInfo = execSync('sudo dmidecode -s bios-version && sudo dmidecode -s bios-release-date', { encoding: 'utf8' })
          .split('\n')
          .filter(line => line.trim())
          .join('-')
          .trim();
      } else if (platform === 'darwin') {
        biosInfo = execSync('system_profiler SPHardwareDataType | grep "Boot ROM Version" | awk \'{print $4}\'', { encoding: 'utf8' }).trim();
      }
      
      return biosInfo || 'unknown-bios';
    } catch {
      return 'unknown-bios';
    }
  }
  
  /**
   * Get total memory
   */
  private getTotalMemory(): string {
    try {
      return os.totalmem().toString();
    } catch {
      return 'unknown-memory';
    }
  }
  
  /**
   * Get OS information
   */
  private getOsInfo(): string {
    try {
      return `${os.platform()}-${os.arch()}-${os.release()}`;
    } catch {
      return 'unknown-os';
    }
  }
  
  /**
   * Create fingerprint from hardware markers
   */
  private createFingerprint(markers: HardwareMarkers): string {
    const components = [
      markers.cpuInfo,
      markers.motherboardSerial,
      markers.systemUuid,
      markers.macAddresses.join('|'),
      markers.diskSerial,
      markers.biosInfo,
      markers.totalMemory,
      markers.osInfo
    ];
    
    return components.join('::');
  }
  
  /**
   * Get fallback markers for systems where hardware access fails
   */
  private getFallbackMarkers(): HardwareMarkers {
    return {
      cpuInfo: os.cpus()[0]?.model || 'fallback-cpu',
      motherboardSerial: 'fallback-motherboard',
      systemUuid: 'fallback-uuid',
      macAddresses: this.getMacAddresses(),
      diskSerial: 'fallback-disk',
      biosInfo: 'fallback-bios',
      totalMemory: os.totalmem().toString(),
      osInfo: `${os.platform()}-${os.arch()}`
    };
  }
  
  /**
   * Verify machine ID against current hardware
   */
  public verifyMachineId(storedId: string): boolean {
    try {
      const currentId = this.getMachineId();
      return currentId === storedId;
    } catch {
      return false;
    }
  }
  
  /**
   * Get hardware markers for debugging (never expose in production)
   */
  public getHardwareMarkers(): HardwareMarkers | null {
    if (process.env.NODE_ENV === 'production') {
      return null;
    }
    return this.hardwareMarkers;
  }
  
  /**
   * Check if hardware has changed significantly
   */
  public hasHardwareChanged(): boolean {
    if (!this.hardwareMarkers) {
      return false;
    }
    
    // Recollect current markers
    const currentMarkers = this.getFallbackMarkers();
    
    // Check critical components
    const criticalChecks = [
      currentMarkers.cpuInfo !== this.hardwareMarkers.cpuInfo,
      currentMarkers.motherboardSerial !== this.hardwareMarkers.motherboardSerial,
      currentMarkers.systemUuid !== this.hardwareMarkers.systemUuid
    ];
    
    return criticalChecks.some(check => check);
  }
}

export default EnhancedMachineIdGenerator;
