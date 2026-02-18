// @ts-nocheck
import { FIXED_CARTELAS } from "./fixed-cartelas";
import { cartelas } from "@shared/schema-simple";
import { eq, and } from "drizzle-orm";
import { db } from "../../storage/storage";

// Convert hardcoded cartela to unified format
function convertHardcodedCartela(hardcodedCartela: any): {
  pattern: number[][];
  numbers: number[];
  name: string;
} {
  const pattern: number[][] = [];
  const numbers: number[] = [];

  // Convert B-I-N-G-O format to 5x5 pattern and flat numbers array
  const columns = ['B', 'I', 'N', 'G', 'O'];

  for (let row = 0; row < 5; row++) {
    const currentRow: number[] = [];
    for (let col = 0; col < 5; col++) {
      const value = hardcodedCartela[columns[col]][row];
      if (value === "FREE") {
        currentRow.push(0); // Use 0 to represent FREE
        numbers.push(0);
      } else {
        currentRow.push(value);
        numbers.push(value);
      }
    }
    pattern.push(currentRow);
  }

  return {
    pattern,
    numbers,
    name: `Cartela ${hardcodedCartela.Board}`
  };
}

// Load hardcoded cartelas into database
export async function loadHardcodedCartelas(adminId: number): Promise<void> {
  console.log("Loading hardcoded cartelas...");

  for (const hardcodedCartela of FIXED_CARTELAS) {
    const cartelaNumber = hardcodedCartela.Board;

    // Check if cartela already exists
    const existing = await db
      .select()
      .from(cartelas)
      .where(eq(cartelas.cartelaNumber, cartelaNumber))
      .limit(1);

    const converted = convertHardcodedCartela(hardcodedCartela);

    if (existing.length === 0) {
      // Insert new hardcoded cartela
      await db.insert(cartelas).values({
        employeeId: adminId,
        cartelaNumber,
        cardNo: cartelaNumber,
        name: converted.name,
        pattern: JSON.stringify(converted.pattern),
        isHardcoded: true,
        isActive: true,
        createdAt: new Date(),
        updatedAt: new Date(),
      });

      console.log(`Loaded hardcoded cartela ${cartelaNumber}`);
    } else {
      // Update existing cartela if adding same cartela number
      await db
        .update(cartelas)
        .set({
          pattern: JSON.stringify(converted.pattern),
          name: converted.name,
          isHardcoded: true,
          updatedAt: new Date(),
        })
        .where(eq(cartelas.cartelaNumber, cartelaNumber));

      console.log(`Updated existing cartela ${cartelaNumber} with default values`);
    }
  }

  console.log("Finished loading hardcoded cartelas");
}

// Ensure all employees have hardcoded cartelas loaded
export async function ensureHardcodedCartelasLoaded(): Promise<void> {
  console.log("Loading hardcoded cartelas for all employees...");

  try {
    const { users } = await import("@shared/schema-simple");
    const allEmployees = await db.select().from(users).where(eq(users.role, 'employee'));

    for (const employee of allEmployees) {
      await loadHardcodedCartelas(employee.id);
    }

    console.log("Finished loading hardcoded cartelas for all employees");
  } catch (error) {
    console.error("Error loading hardcoded cartelas:", error);
  }
}