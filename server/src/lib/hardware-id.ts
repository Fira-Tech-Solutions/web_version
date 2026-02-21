/**
 * Hardware ID Generator - Ultimate Version Only
 * Uses ultimate stable hardware markers for consistent machine identification
 */
import UltimateMachineIdGenerator from './ultimate-machine-id';

let generator: UltimateMachineIdGenerator | null = null;

/**
 * Get hardware ID for machine binding
 */
export async function getHardwareId(): Promise<string> {
  if (!generator) {
    generator = UltimateMachineIdGenerator.getInstance();
  }
  return generator.getMachineId();
}

/**
 * Verify machine ID (ultimate format only)
 */
export async function verifyMachineId(storedId: string): Promise<boolean> {
  if (!generator) {
    generator = UltimateMachineIdGenerator.getInstance();
  }
  return generator.verifyMachineId(storedId);
}

/**
 * Check if hardware has changed (ultimate format only)
 */
export function hasHardwareChanged(): boolean {
  if (!generator) {
    generator = UltimateMachineIdGenerator.getInstance();
  }
  return generator.hasHardwareChanged();
}
