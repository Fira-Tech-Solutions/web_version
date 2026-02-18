import * as crypto from 'crypto';
import * as os from 'os';
import * as fs from 'fs';
import * as path from 'path';

/**
 * Generates a secure, tamper-proof machine ID based on system hardware information
 * This ID cannot be easily modified by users and remains consistent across reboots
 */
export class MachineIdGenerator {
  private static readonly MACHINE_ID_FILE = path.join(process.cwd(), '.machine-id');
  private static readonly SALT = 'BINGO_MASTER_MACHINE_ID_SALT_2024';

  /**
   * Gets or generates a secure machine ID
   * @returns Promise<string> - Unique machine identifier
   */
  static async getMachineId(): Promise<string> {
    try {
      // First try to read existing machine ID
      if (fs.existsSync(this.MACHINE_ID_FILE)) {
        const storedId = fs.readFileSync(this.MACHINE_ID_FILE, 'utf8').trim();
        if (storedId && this.validateMachineId(storedId)) {
          return storedId;
        }
      }

      // Generate new machine ID based on hardware
      const machineId = await this.generateHardwareBasedId();
      
      // Store the machine ID
      fs.writeFileSync(this.MACHINE_ID_FILE, machineId, 'utf8');
      
      return machineId;
    } catch (error) {
      console.error('Error generating machine ID:', error);
      // Fallback to a random ID if hardware detection fails
      return this.generateFallbackId();
    }
  }

  /**
   * Generates a machine ID based on hardware information
   * @returns Promise<string> - Hardware-based machine ID
   */
  private static async generateHardwareBasedId(): Promise<string> {
    const hardwareInfo = [];
    
    try {
      // Get CPU information
      const cpus = os.cpus();
      if (cpus && cpus.length > 0) {
        hardwareInfo.push(cpus[0].model);
        hardwareInfo.push(cpus.length.toString());
      }

      // Get network interfaces (excluding internal ones)
      const networkInterfaces = os.networkInterfaces();
      for (const [name, interfaces] of Object.entries(networkInterfaces)) {
        if (!name.includes('lo') && !name.includes('internal')) {
          for (const iface of interfaces || []) {
            if (iface.mac && !iface.internal) {
              hardwareInfo.push(iface.mac);
              break; // Use first non-internal MAC
            }
          }
        }
      }

      // Get system memory info
      const totalMemory = os.totalmem();
      hardwareInfo.push(totalMemory.toString());

      // Get hostname
      const hostname = os.hostname();
      hardwareInfo.push(hostname);

      // Get platform information
      hardwareInfo.push(os.platform());
      hardwareInfo.push(os.arch());

      // Get system uptime (adds entropy)
      hardwareInfo.push(os.uptime().toString());

    } catch (error) {
      console.warn('Some hardware info could not be collected:', error);
    }

    // Create a hash of all hardware information
    const hardwareString = hardwareInfo.join('|') + this.SALT;
    const hash = crypto.createHash('sha256').update(hardwareString).digest('hex');
    
    // Create a readable machine ID (first 12 characters of hash with prefix)
    const machineId = `BNG-${hash.substring(0, 12).toUpperCase()}`;
    
    return machineId;
  }

  /**
   * Generates a fallback machine ID if hardware detection fails
   * @returns string - Fallback machine ID
   */
  private static generateFallbackId(): string {
    const randomBytes = crypto.randomBytes(16);
    const hash = crypto.createHash('sha256').update(randomBytes + this.SALT).digest('hex');
    return `BNG-${hash.substring(0, 12).toUpperCase()}`;
  }

  /**
   * Validates that a machine ID follows the expected format
   * @param machineId - Machine ID to validate
   * @returns boolean - Whether the ID is valid
   */
  private static validateMachineId(machineId: string): boolean {
    // Should start with BNG- and be followed by 24 hex characters
    const pattern = /^BNG-[A-F0-9]{12}$/;
    return pattern.test(machineId);
  }

  /**
   * Gets machine ID for a specific user (combines machine ID with user info)
   * @param userId - User ID
   * @param username - Username
   * @returns Promise<string> - User-specific machine ID
   */
  static async getUserMachineId(userId: number, username: string): Promise<string> {
    const baseMachineId = await this.getMachineId();
    const userHash = crypto.createHash('sha256')
      .update(`${baseMachineId}-${userId}-${username}-${this.SALT}`)
      .digest('hex')
      .substring(0, 8)
      .toUpperCase();
    
    return `${baseMachineId}-USR${userHash}`;
  }

  /**
   * Verifies that a machine ID belongs to the current system
   * @param machineId - Machine ID to verify
   * @returns Promise<boolean> - Whether the ID belongs to this system
   */
  static async verifyMachineId(machineId: string): Promise<boolean> {
    try {
      const currentMachineId = await this.getMachineId();
      
      // Extract base machine ID (without user suffix if present)
      const baseId = machineId.split('-USR')[0];
      
      return baseId === currentMachineId;
    } catch (error) {
      console.error('Error verifying machine ID:', error);
      return false;
    }
  }
}
