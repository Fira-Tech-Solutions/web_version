/**
 * Ultimate Stable Machine ID Generator
 * Creates highly stable, unique, and persistent machine identifiers
 * Uses multiple fallback strategies and cross-platform compatibility
 */
import * as crypto from 'crypto';
import * as os from 'os';
import * as fs from 'fs';
import * as path from 'path';
import { execSync } from 'child_process';

interface MachineIdConfig {
  readonly idFile: string;
  readonly fallbackFile: string;
  readonly salt: string;
  readonly version: string;
}

interface HardwareFingerprint {
  cpuId: string;
  motherboardSerial: string;
  systemUuid: string;
  primaryMac: string;
  diskSerial: string;
  osFingerprint: string;
  installSignature: string;
}

class UltimateMachineIdGenerator {
  private static instance: UltimateMachineIdGenerator | null = null;
  private static readonly CONFIG: MachineIdConfig = {
    idFile: path.join(process.cwd(), '.machine-id'),
    fallbackFile: path.join(process.cwd(), '.machine-fallback'),
    salt: 'BINGO_MASTER_ULTIMATE_SALT_2024_STABLE',
    version: '2.0'
  };

  private cachedId: string | null = null;
  private fingerprint: HardwareFingerprint | null = null;

  private constructor() {
    this.collectHardwareFingerprint();
  }

  /**
   * Get singleton instance
   */
  public static getInstance(): UltimateMachineIdGenerator {
    if (!UltimateMachineIdGenerator.instance) {
      UltimateMachineIdGenerator.instance = new UltimateMachineIdGenerator();
    }
    return UltimateMachineIdGenerator.instance!;
  }

  /**
   * Generate or retrieve stable machine ID
   */
  public async getMachineId(): Promise<string> {
    if (this.cachedId) {
      return this.cachedId;
    }

    // Strategy 1: Try to read existing valid ID
    const existingId = this.tryReadExistingId();
    if (existingId && await this.verifyExistingId(existingId)) {
      this.cachedId = existingId;
      return this.cachedId;
    }

    // Strategy 2: Generate new ID from hardware fingerprint
    const newId = this.generateFromFingerprint();
    
    // Strategy 3: Persist with multiple fallbacks
    await this.persistMachineId(newId);

    this.cachedId = newId;
    return this.cachedId;
  }

  /**
   * Try to read existing machine ID with validation
   */
  private tryReadExistingId(): string | null {
    try {
      // Try primary file
      if (fs.existsSync(UltimateMachineIdGenerator.CONFIG.idFile)) {
        const content = fs.readFileSync(UltimateMachineIdGenerator.CONFIG.idFile, 'utf8').trim();
        if (this.isValidMachineIdFormat(content)) {
          return content;
        }
      }

      // Try fallback file
      if (fs.existsSync(UltimateMachineIdGenerator.CONFIG.fallbackFile)) {
        const content = fs.readFileSync(UltimateMachineIdGenerator.CONFIG.fallbackFile, 'utf8').trim();
        if (this.isValidMachineIdFormat(content)) {
          return content;
        }
      }
    } catch (error) {
      console.warn('Failed to read existing machine ID:', error);
    }

    return null;
  }

  /**
   * Validate machine ID format
   */
  private isValidMachineIdFormat(id: string): boolean {
    // Format: BNG-ULT-{version}-{12-char-hash}
    const pattern = /^BNG-ULT-2\.0-[A-F0-9]{12}$/;
    return pattern.test(id);
  }

  /**
   * Verify existing ID against current hardware
   */
  private async verifyExistingId(storedId: string): Promise<boolean> {
    try {
      // Extract hash from stored ID
      const storedHash = storedId.split('-').pop();
      if (!storedHash) return false;

      // Generate current fingerprint hash
      const currentHash = this.generateFingerprintHash();

      // Allow some tolerance for minor hardware changes
      return this.compareHashesWithTolerance(storedHash, currentHash);
    } catch (error) {
      console.warn('Failed to verify existing ID:', error);
      return false;
    }
  }

  /**
   * Compare hashes with tolerance for minor hardware changes
   */
  private compareHashesWithTolerance(stored: string, current: string): boolean {
    // Direct match first
    if (stored === current) return true;

    // Check if at least 50% of critical components match
    let matchingComponents = 0;
    const totalComponents = 5; // Critical components count

    try {
      // Compare critical hardware components
      if (this.fingerprint?.cpuId) matchingComponents++;
      if (this.fingerprint?.systemUuid) matchingComponents++;
      if (this.fingerprint?.primaryMac) matchingComponents++;
      if (this.fingerprint?.diskSerial) matchingComponents++;
      if (this.fingerprint?.motherboardSerial) matchingComponents++;
    } catch {
      return false;
    }

    return matchingComponents >= Math.floor(totalComponents * 0.5);
  }

  /**
   * Generate machine ID from hardware fingerprint
   */
  private generateFromFingerprint(): string {
    if (!this.fingerprint) {
      throw new Error('Failed to collect hardware fingerprint');
    }

    const hash = this.generateFingerprintHash();
    return `BNG-ULT-${UltimateMachineIdGenerator.CONFIG.version}-${hash}`;
  }

  /**
   * Generate hash from fingerprint
   */
  private generateFingerprintHash(): string {
    if (!this.fingerprint) {
      throw new Error('No fingerprint available');
    }

    const fingerprintString = [
      this.fingerprint.cpuId,
      this.fingerprint.motherboardSerial,
      this.fingerprint.systemUuid,
      this.fingerprint.primaryMac,
      this.fingerprint.diskSerial,
      this.fingerprint.osFingerprint,
      this.fingerprint.installSignature,
      UltimateMachineIdGenerator.CONFIG.salt
    ].join('|');

    const hash = crypto.createHash('sha256').update(fingerprintString).digest('hex');
    return hash.substring(0, 12).toUpperCase();
  }

  /**
   * Collect comprehensive hardware fingerprint
   */
  private collectHardwareFingerprint(): void {
    try {
      this.fingerprint = {
        cpuId: this.getCpuId(),
        motherboardSerial: this.getMotherboardSerial(),
        systemUuid: this.getSystemUuid(),
        primaryMac: this.getPrimaryMacAddress(),
        diskSerial: this.getDiskSerial(),
        osFingerprint: this.getOsFingerprint(),
        installSignature: this.getInstallSignature()
      };
    } catch (error) {
      console.error('Failed to collect hardware fingerprint:', error);
      this.fingerprint = this.getFallbackFingerprint();
    }
  }

  /**
   * Get stable CPU identifier
   */
  private getCpuId(): string {
    try {
      const cpus = os.cpus();
      if (cpus && cpus.length > 0) {
        const cpu = cpus[0];
        return `${cpu.model}-${cpus.length}-${cpu.speed}`.replace(/\s+/g, '_');
      }
    } catch {
      // Continue to fallback
    }

    // Platform-specific CPU info
    try {
      if (process.platform === 'linux') {
        const result = execSync('cat /proc/cpuinfo | grep "model name" | head -1', { encoding: 'utf8' });
        return result.split(':')[1]?.trim().replace(/\s+/g, '_') || 'unknown_cpu';
      } else if (process.platform === 'win32') {
        const result = execSync('wmic cpu get name /value', { encoding: 'utf8' });
        return result.split('=')[1]?.trim().replace(/\s+/g, '_') || 'unknown_cpu';
      }
    } catch {
      // Continue to final fallback
    }

    return 'unknown_cpu';
  }

  /**
   * Get motherboard serial number
   */
  private getMotherboardSerial(): string {
    const platform = process.platform;
    
    try {
      if (platform === 'linux') {
        // Try multiple methods for Linux
        const methods = [
          'cat /sys/class/dmi/id/board_serial',
          'sudo dmidecode -s baseboard-serial-number',
          'cat /sys/class/dmi/id/product_uuid'
        ];

        for (const method of methods) {
          try {
            const result = execSync(method, { encoding: 'utf8' });
            const serial = result.trim();
            if (serial && serial !== 'unknown' && serial.length > 0) {
              return serial;
            }
          } catch {
            // Try next method
          }
        }
      } else if (platform === 'win32') {
        const result = execSync('wmic baseboard get serialnumber /value', { encoding: 'utf8' });
        const serial = result.split('=')[1]?.trim();
        if (serial && serial !== 'unknown') {
          return serial;
        }
      } else if (platform === 'darwin') {
        const result = execSync('system_profiler SPHardwareDataType | grep "Serial Number" | awk \'{print $4}\'', { encoding: 'utf8' });
        const serial = result.trim();
        if (serial && serial !== 'unknown') {
          return serial;
        }
      }
    } catch {
      // Continue to fallback
    }

    return 'unknown_motherboard';
  }

  /**
   * Get system UUID
   */
  private getSystemUuid(): string {
    const platform = process.platform;
    
    try {
      if (platform === 'linux') {
        const methods = [
          'cat /sys/class/dmi/id/product_uuid',
          'sudo dmidecode -s system-uuid',
          'cat /var/lib/dbus/machine-id 2>/dev/null || cat /etc/machine-id 2>/dev/null'
        ];

        for (const method of methods) {
          try {
            const result = execSync(method, { encoding: 'utf8' });
            const uuid = result.trim();
            if (uuid && uuid !== 'unknown' && uuid.length > 0) {
              return uuid;
            }
          } catch {
            // Try next method
          }
        }
      } else if (platform === 'win32') {
        const result = execSync('wmic csproduct get uuid /value', { encoding: 'utf8' });
        const uuid = result.split('=')[1]?.trim();
        if (uuid && uuid !== 'unknown') {
          return uuid;
        }
      } else if (platform === 'darwin') {
        const result = execSync('system_profiler SPHardwareDataType | grep "Hardware UUID" | awk \'{print $3}\'', { encoding: 'utf8' });
        const uuid = result.trim();
        if (uuid && uuid !== 'unknown') {
          return uuid;
        }
      }
    } catch {
      // Continue to fallback
    }

    return 'unknown_uuid';
  }

  /**
   * Get primary MAC address
   */
  private getPrimaryMacAddress(): string {
    try {
      const interfaces = os.networkInterfaces();
      const macAddresses: string[] = [];

      for (const [name, infos] of Object.entries(interfaces)) {
        if (infos) {
          for (const info of infos) {
            // Skip internal, virtual, and loopback interfaces
            if (!info.internal && 
                info.mac && 
                info.mac !== '00:00:00:00:00:00' &&
                !name.includes('lo') &&
                !name.includes('docker') &&
                !name.includes('veth') &&
                !name.includes('virbr')) {
              macAddresses.push(info.mac);
            }
          }
        }
      }

      // Sort for consistency and return first stable MAC
      if (macAddresses.length > 0) {
        return macAddresses.sort()[0];
      }
    } catch {
      // Continue to fallback
    }

    return 'unknown_mac';
  }

  /**
   * Get disk serial number
   */
  private getDiskSerial(): string {
    const platform = process.platform;
    
    try {
      if (platform === 'linux') {
        const methods = [
          'lsblk -o NAME,SERIAL -n | grep disk | head -1 | awk \'{print $2}\'',
          'sudo hdparm -I /dev/sda 2>/dev/null | grep "Serial Number" | awk \'{print $3}\'',
          'cat /sys/block/sda/device/serial 2>/dev/null || echo ""'
        ];

        for (const method of methods) {
          try {
            const result = execSync(method, { encoding: 'utf8' });
            const serial = result.trim();
            if (serial && serial !== 'unknown' && serial.length > 0) {
              return serial;
            }
          } catch {
            // Try next method
          }
        }
      } else if (platform === 'win32') {
        const result = execSync('wmic diskdrive get serialnumber /value', { encoding: 'utf8' });
        const serial = result.split('=')[1]?.trim();
        if (serial && serial !== 'unknown') {
          return serial;
        }
      } else if (platform === 'darwin') {
        const result = execSync('diskutil info / | grep "Serial Number" | awk \'{print $3}\'', { encoding: 'utf8' });
        const serial = result.trim();
        if (serial && serial !== 'unknown') {
          return serial;
        }
      }
    } catch {
      // Continue to fallback
    }

    return 'unknown_disk';
  }

  /**
   * Get OS fingerprint
   */
  private getOsFingerprint(): string {
    try {
      return `${os.platform()}-${os.arch()}-${os.release()}`;
    } catch {
      return 'unknown_os';
    }
  }

  /**
   * Get installation signature (based on install path and timestamp)
   */
  private getInstallSignature(): string {
    try {
      const installPath = process.cwd();
      const stat = fs.statSync(installPath);
      return crypto.createHash('md5')
        .update(`${installPath}-${stat.birthtime || stat.mtime}`)
        .digest('hex')
        .substring(0, 8);
    } catch {
      return 'unknown_install';
    }
  }

  /**
   * Get fallback fingerprint for systems where hardware detection fails
   */
  private getFallbackFingerprint(): HardwareFingerprint {
    return {
      cpuId: os.cpus()[0]?.model || 'fallback_cpu',
      motherboardSerial: 'fallback_motherboard',
      systemUuid: 'fallback_uuid',
      primaryMac: 'fallback_mac',
      diskSerial: 'fallback_disk',
      osFingerprint: this.getOsFingerprint(),
      installSignature: this.getInstallSignature()
    };
  }

  /**
   * Persist machine ID with multiple fallback strategies
   */
  private async persistMachineId(machineId: string): Promise<void> {
    try {
      // Primary storage
      fs.writeFileSync(UltimateMachineIdGenerator.CONFIG.idFile, machineId, 'utf8');
      
      // Fallback storage
      fs.writeFileSync(UltimateMachineIdGenerator.CONFIG.fallbackFile, machineId, 'utf8');
      
      // Set file permissions to be readable by owner only
      fs.chmodSync(UltimateMachineIdGenerator.CONFIG.idFile, 0o600);
      fs.chmodSync(UltimateMachineIdGenerator.CONFIG.fallbackFile, 0o600);
    } catch (error) {
      console.error('Failed to persist machine ID:', error);
      // Continue anyway - we have the ID in memory
    }
  }

  /**
   * Verify machine ID matches current hardware
   */
  public async verifyMachineId(machineId: string): Promise<boolean> {
    try {
      // Extract base machine ID if it's user-specific
      const baseMachineId = machineId.split('-USR')[0];
      
      if (!this.isValidMachineIdFormat(baseMachineId)) {
        return false;
      }

      return this.verifyExistingId(baseMachineId);
    } catch {
      return false;
    }
  }

  /**
   * Get user-specific machine ID
   */
  public async getUserMachineId(userId: number, username: string): Promise<string> {
    const baseId = await this.getMachineId();
    const userHash = crypto.createHash('sha256')
      .update(`${baseId}-${userId}-${username}-${UltimateMachineIdGenerator.CONFIG.salt}`)
      .digest('hex')
      .substring(0, 8)
      .toUpperCase();
    
    return `${baseId}-USR${userHash}`;
  }

  /**
   * Check if hardware has significantly changed
   */
  public hasHardwareChanged(): boolean {
    try {
      if (!this.fingerprint) return false;
      
      // Recollect current fingerprint
      const currentFingerprint = this.getFallbackFingerprint();
      
      // Check critical components
      const criticalChanges = [
        currentFingerprint.cpuId !== this.fingerprint.cpuId,
        currentFingerprint.systemUuid !== this.fingerprint.systemUuid,
        currentFingerprint.motherboardSerial !== this.fingerprint.motherboardSerial
      ];

      return criticalChanges.some(change => change);
    } catch {
      return false;
    }
  }

  /**
   * Get machine ID information for debugging (development only)
   */
  public getDebugInfo(): any {
    if (process.env.NODE_ENV === 'production') {
      return null;
    }

    return {
      cachedId: this.cachedId,
      fingerprint: this.fingerprint,
      config: UltimateMachineIdGenerator.CONFIG,
      files: {
        primary: fs.existsSync(UltimateMachineIdGenerator.CONFIG.idFile),
        fallback: fs.existsSync(UltimateMachineIdGenerator.CONFIG.fallbackFile)
      }
    };
  }
}

export default UltimateMachineIdGenerator;
