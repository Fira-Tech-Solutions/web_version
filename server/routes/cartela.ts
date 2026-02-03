import { Router } from "express";
import { db } from "../db";
import { cartelas } from "@shared/schema";
import { eq, and } from "drizzle-orm";
import { loadHardcodedCartelas } from "../lib/cartela-loader";

const router = Router();

// Function to log cartela updates (WebSocket temporarily disabled)
function logCartelaUpdate(shopId: number) {
  console.log(`Cartela updated for shop ${shopId} at ${new Date().toISOString()}`);
}

// Parse bulk cartela input
function parseBulkCartelaData(bulkData: string) {
  const lines = bulkData.split('\n').filter(line => line.trim());
  const results = {
    valid: [] as any[],
    invalid: [] as string[]
  };

  for (const line of lines) {
    const trimmed = line.trim();
    if (!trimmed) continue;

    const [cartelaNumberStr, numbersStr] = trimmed.split(':');
    if (!cartelaNumberStr || !numbersStr) {
      results.invalid.push(`Invalid format: ${trimmed}`);
      continue;
    }

    const cartelaNumber = parseInt(cartelaNumberStr.trim());
    if (isNaN(cartelaNumber)) {
      results.invalid.push(`Invalid cartela number: ${cartelaNumberStr}`);
      continue;
    }

    const numberStrings = numbersStr.split(',').map(n => n.trim().toLowerCase());
    if (numberStrings.length !== 25) {
      results.invalid.push(`Cartela ${cartelaNumber}: must have exactly 25 numbers`);
      continue;
    }

    // Convert numbers and handle "free"
    const numbers: number[] = [];
    const pattern: number[][] = Array(5).fill(null).map(() => Array(5).fill(0));
    let hasCenter = false;

    for (let i = 0; i < 25; i++) {
      const row = Math.floor(i / 5);
      const col = i % 5;

      if (row === 2 && col === 2) {
        // Center must be free or 0
        if (numberStrings[i] !== 'free' && numberStrings[i] !== '0') {
          results.invalid.push(`Cartela ${cartelaNumber}: center must be 'free' or '0'`);
          break;
        }
        numbers.push(0);
        pattern[row][col] = 0;
        hasCenter = true;
      } else {
        const num = parseInt(numberStrings[i]);
        if (isNaN(num) || num < 1 || num > 75) {
          results.invalid.push(`Cartela ${cartelaNumber}: invalid number '${numberStrings[i]}'`);
          break;
        }
        numbers.push(num);
        pattern[row][col] = num;
      }
    }

    if (hasCenter && numbers.length === 25) {
      results.valid.push({
        cartelaNumber,
        numbers,
        pattern,
        name: `Cartela ${cartelaNumber}`
      });
    }
  }

  return results;
}

// GET /api/cartelas/:shopId - Get all cartelas for a shop
router.get("/:shopId", async (req, res) => {
  try {
    const shopId = parseInt(req.params.shopId);

    // Disable caching to ensure fresh data
    res.set('Cache-Control', 'no-cache, no-store, must-revalidate');
    res.set('Pragma', 'no-cache');
    res.set('Expires', '0');

    const shopCartelas = await db
      .select()
      .from(cartelas)
      .where(eq(cartelas.shopId, shopId))
      .orderBy(cartelas.cartelaNumber);

    console.log(`Fetched ${shopCartelas.length} cartelas for shop ${shopId}`);

    // Parse JSON strings back to arrays for frontend
    const parsedCartelas = shopCartelas.map(cartela => ({
      ...cartela,
      pattern: typeof cartela.pattern === 'string' ? JSON.parse(cartela.pattern) : cartela.pattern,
      numbers: typeof cartela.numbers === 'string' ? JSON.parse(cartela.numbers) : cartela.numbers,
    }));

    // Debug: Log all cartelas to verify data structure and marked cartelas
    console.log(`🔍 CARTELA API DEBUG - Total cartelas: ${parsedCartelas.length}`);

    const markedCartelas = parsedCartelas.filter(c => c.collectorId !== null || c.bookedBy !== null);
    console.log(`📊 MARKED CARTELAS for shop ${shopId} (${markedCartelas.length} total):`, markedCartelas.map(c => ({
      number: c.cartelaNumber,
      collectorId: c.collectorId,
      bookedBy: c.bookedBy,
      source: c.collectorId !== null ? 'collector' : (c.bookedBy !== null ? 'employee' : 'none')
    })));

    // Also log first few cartelas to verify data structure
    console.log(`🔍 FIRST 3 CARTELAS structure:`, parsedCartelas.slice(0, 3).map(c => ({
      id: c.id,
      number: c.cartelaNumber,
      collectorId: c.collectorId,
      bookedBy: c.bookedBy
    })));

    res.json(parsedCartelas);
  } catch (error) {
    console.error("Error fetching cartelas:", error);
    res.status(500).json({ error: "Failed to fetch cartelas" });
  }
});

// POST /api/cartelas - Create new cartela
router.post("/", async (req, res) => {
  try {
    const { shopId, adminId, cartelaNumber, name, pattern, numbers } = req.body;

    // Check if cartela number already exists for this shop
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

    if (existing.length > 0) {
      // Update existing cartela instead of creating new one
      const [updatedCartela] = await db
        .update(cartelas)
        .set({
          name,
          pattern: JSON.stringify(pattern),
          numbers: JSON.stringify(numbers),
          isHardcoded: false, // Mark as custom when updated
        })
        .where(eq(cartelas.id, existing[0].id))
        .returning();

      // Parse the response back to arrays
      const parsedCartela = {
        ...updatedCartela,
        pattern: typeof updatedCartela.pattern === 'string' ? JSON.parse(updatedCartela.pattern) : updatedCartela.pattern,
        numbers: typeof updatedCartela.numbers === 'string' ? JSON.parse(updatedCartela.numbers) : updatedCartela.numbers,
      };

      // Log cartela update
      logCartelaUpdate(shopId);

      return res.json(parsedCartela);
    }

    const [newCartela] = await db
      .insert(cartelas)
      .values({
        shopId,
        adminId,
        cartelaNumber,
        name,
        pattern: JSON.stringify(pattern),
        numbers: JSON.stringify(numbers),
        isHardcoded: false,
        isActive: true,
      })
      .returning();

    // Log cartela update
    logCartelaUpdate(shopId);

    res.json(newCartela);
  } catch (error) {
    console.error("Error creating cartela:", error);
    res.status(500).json({ error: "Failed to create cartela" });
  }
});

// PUT /api/cartelas/:id - Update existing cartela
router.put("/:id", async (req, res) => {
  try {
    const cartelaId = parseInt(req.params.id);
    const { cartelaNumber, name, pattern, numbers } = req.body;

    // Get current cartela to check shop ownership
    const currentCartela = await db
      .select()
      .from(cartelas)
      .where(eq(cartelas.id, cartelaId))
      .limit(1);

    if (currentCartela.length === 0) {
      return res.status(404).json({ error: "Cartela not found" });
    }

    // Check if new cartela number conflicts with existing ones (excluding current)
    if (cartelaNumber !== currentCartela[0].cartelaNumber) {
      const existing = await db
        .select()
        .from(cartelas)
        .where(
          and(
            eq(cartelas.shopId, currentCartela[0].shopId),
            eq(cartelas.cartelaNumber, cartelaNumber)
          )
        )
        .limit(1);

      if (existing.length > 0) {
        return res.status(400).json({ error: "Cartela number already exists for this shop" });
      }
    }

    const [updatedCartela] = await db
      .update(cartelas)
      .set({
        cartelaNumber,
        name,
        pattern,
        numbers,
        updatedAt: new Date(),
      })
      .where(eq(cartelas.id, cartelaId))
      .returning();

    res.json(updatedCartela);
  } catch (error) {
    console.error("Error updating cartela:", error);
    res.status(500).json({ error: "Failed to update cartela" });
  }
});

// DELETE /api/cartelas/:id - Delete cartela
router.delete("/:id", async (req, res) => {
  try {
    const cartelaId = parseInt(req.params.id);

    const deletedCartela = await db
      .delete(cartelas)
      .where(eq(cartelas.id, cartelaId))
      .returning();

    if (deletedCartela.length === 0) {
      return res.status(404).json({ error: "Cartela not found" });
    }

    res.json({ message: "Cartela deleted successfully" });
  } catch (error) {
    console.error("Error deleting cartela:", error);
    res.status(500).json({ error: "Failed to delete cartela" });
  }
});

// POST /api/cartelas/bulk-import - Bulk import cartelas
router.post("/bulk-import", async (req, res) => {
  try {
    const { shopId, adminId, bulkData } = req.body;

    const parsed = parseBulkCartelaData(bulkData);
    let updated = 0;
    let added = 0;
    const skipped = parsed.invalid.length;

    for (const cartelaData of parsed.valid) {
      try {
        // Check if cartela exists
        const existing = await db
          .select()
          .from(cartelas)
          .where(
            and(
              eq(cartelas.shopId, shopId),
              eq(cartelas.cartelaNumber, cartelaData.cartelaNumber)
            )
          )
          .limit(1);

        if (existing.length > 0) {
          // Update existing
          await db
            .update(cartelas)
            .set({
              name: cartelaData.name,
              pattern: cartelaData.pattern,
              numbers: cartelaData.numbers,
              updatedAt: new Date(),
            })
            .where(eq(cartelas.id, existing[0].id));
          updated++;
        } else {
          // Insert new
          await db
            .insert(cartelas)
            .values({
              shopId,
              adminId,
              cartelaNumber: cartelaData.cartelaNumber,
              name: cartelaData.name,
              pattern: cartelaData.pattern,
              numbers: cartelaData.numbers,
              isHardcoded: false,
              isActive: true,
            });
          added++;
        }
      } catch (error) {
        console.error(`Error processing cartela ${cartelaData.cartelaNumber}:`, error);
      }
    }

    res.json({
      updated,
      added,
      skipped,
      errors: parsed.invalid,
    });
  } catch (error) {
    console.error("Error bulk importing cartelas:", error);
    res.status(500).json({ error: "Failed to bulk import cartelas" });
  }
});

// POST /api/cartelas/load-hardcoded/:shopId - Load hardcoded cartelas for shop
router.post("/load-hardcoded/:shopId", async (req, res) => {
  try {
    const shopId = parseInt(req.params.shopId);
    const { adminId } = req.body;

    await loadHardcodedCartelas(shopId, adminId);
    res.json({ message: "Hardcoded cartelas loaded successfully" });
  } catch (error) {
    console.error("Error loading hardcoded cartelas:", error);
    res.status(500).json({ error: "Failed to load hardcoded cartelas" });
  }
});

export { router as cartelasRouter };