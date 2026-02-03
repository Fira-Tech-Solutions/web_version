/**
 * Hardware Fingerprinting Module
 * Generates a unique Machine ID for the local machine (air-gapped licensing).
 * Uses CPU, hostname, and platform info - no network required.
 */
import * as os from "os";
import * as crypto from "crypto";

/**
 * Collects hardware/OS identifiers and produces a stable hash.
 * Works on Linux, Windows, macOS without internet.
 */
export function getHardwareId(): string {
  const components: string[] = [];

  try {
    // CPU info (architecture + model)
    const cpus = os.cpus();
    if (cpus.length > 0) {
      components.push(cpus[0].model || "");
      components.push(cpus[0].speed?.toString() || "");
    }

    // Hostname
    components.push(os.hostname());

    // Platform + arch
    components.push(os.platform());
    components.push(os.arch());

    // Total memory (stable per machine)
    components.push(os.totalmem().toString());

    // Machine type (e.g. x86_64)
    components.push(os.machine());

    // Network interfaces MAC addresses (if available, stable per NIC)
    const nets = os.networkInterfaces();
    for (const name of Object.keys(nets)) {
      const iface = nets[name];
      if (iface) {
        for (const config of iface) {
          if (config.mac && config.mac !== "00:00:00:00:00:00") {
            components.push(config.mac);
          }
        }
      }
    }

    // User info (home dir - stable per install)
    components.push(os.homedir());
  } catch (err) {
    console.warn("Hardware ID collection warning:", err);
  }

  const combined = components.filter(Boolean).join("|");
  return crypto.createHash("sha256").update(combined).digest("hex");
}
