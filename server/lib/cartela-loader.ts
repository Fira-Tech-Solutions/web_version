import { FIXED_CARTELAS } from "./fixed-cartelas";
import { db } from "../db";
import { cartelas } from "@shared/schema";
import { eq, and } from "drizzle-orm";

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

// Load hardcoded cartelas into database for a specific shop
export async function loadHardcodedCartelas(shopId: number, adminId: number): Promise<void> {
  console.log(`Loading hardcoded cartelas for shop ${shopId}...`);

  for (const hardcodedCartela of FIXED_CARTELAS) {
    const cartelaNumber = hardcodedCartela.Board;

    // Check if cartela already exists for this shop
    const existing = await db
      .select()
      .from(cartelas)
      .where(
        and(
          eq(cartelas.shopId, shopId),
          eq(cartelas.cartelaNumber, cartelaNumber)
        )
      )
      .limit(1);

    const converted = convertHardcodedCartela(hardcodedCartela);

    if (existing.length === 0) {
      // Insert new hardcoded cartela
      await db.insert(cartelas).values({
        shopId,
        adminId,
        cartelaNumber,
        name: converted.name,
        pattern: JSON.stringify(converted.pattern),
        numbers: JSON.stringify(converted.numbers),
        isHardcoded: true,
        isActive: true,
      });

      console.log(`Loaded hardcoded cartela ${cartelaNumber} for shop ${shopId}`);
    } else {
      // Update existing cartela if adding same cartela number
      await db
        .update(cartelas)
        .set({
          pattern: JSON.stringify(converted.pattern),
          numbers: JSON.stringify(converted.numbers),
          name: converted.name,
          isHardcoded: true,
        })
        .where(
          and(
            eq(cartelas.shopId, shopId),
            eq(cartelas.cartelaNumber, cartelaNumber)
          )
        );

      console.log(`Updated existing cartela ${cartelaNumber} for shop ${shopId} with default values`);
    }
  }

  console.log(`Finished loading hardcoded cartelas for shop ${shopId}`);
}

// Ensure all shops have hardcoded cartelas loaded
export async function ensureHardcodedCartelasLoaded(): Promise<void> {
  console.log("Loading hardcoded cartelas for all shops...");

  try {
    const { shops } = await import("@shared/schema");
    const allShops = await db.select().from(shops);

    for (const shop of allShops) {
      await loadHardcodedCartelas(shop.id, shop.adminId);
    }

    console.log("Hardcoded cartelas loaded successfully for all shops");
  } catch (error) {
    console.error("Error loading hardcoded cartelas:", error);
  }
}