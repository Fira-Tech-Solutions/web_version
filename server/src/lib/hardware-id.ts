/**
 * Hardware ID Generator - Stable Version
 * Uses stable hardware markers for consistent machine identification
 */
import StableMachineIdGenerator from './stable-machine-id';

let generator: StableMachineIdGenerator | null = null;

/**
 * Get hardware ID for machine binding
 */
export function getHardwareId(): string {
  if (!generator) {
    generator = new StableMachineIdGenerator();
  }
  return generator.getMachineId();
}

/**
 * Verify machine ID (alias for stable generator)
 */
export function verifyMachineId(storedId: string): boolean {
  if (!generator) {
    generator = new StableMachineIdGenerator();
  }
  return generator.verifyMachineId(storedId);
}

/**
 * Check if hardware has changed (alias for stable generator)
 */
export function hasHardwareChanged(): boolean {
  if (!generator) {
    generator = new StableMachineIdGenerator();
  }
  return generator.hasHardwareChanged();
}
