import { Router } from "express";
import { eq, and, desc, count, like, ilike, or } from "drizzle-orm";
import { db } from "../db/index.js";
import { cartelas, users } from "../../shared/schema-simple.js";
import { loadHardcodedCartelas } from "../lib/cartela-loader";

const router = Router();

// Function to log cartela updates (WebSocket temporarily disabled)
function logCartelaUpdate(employeeId: number) {
  console.log(`Cartela updated for employee ${employeeId} at ${new Date().toISOString()}`);
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

// GET /api/cartelas - Get all cartelas (for management table)
router.get("/", async (req, res) => {
  try {
    const { search = "", page = "1", limit = "50" } = req.query;
    
    // Validate pagination parameters
    const pageNum = parseInt(page as string);
    const limitNum = parseInt(limit as string);
    
    if (isNaN(pageNum) || isNaN(limitNum) || pageNum < 1 || limitNum < 1) {
      return res.status(400).json({ error: "Invalid pagination parameters" });
    }
    
    const offset = (pageNum - 1) * limitNum;

    let query = db.select().from(cartelas);
    
    if (search && typeof search === "string" && search.trim()) {
      // TODO: Add search conditions - for now just continue without search
      console.log('Search parameter ignored:', search);
    }

    const cartelasResult = await query
      .limit(limitNum)
      .offset(offset)
      .orderBy(cartelas.cartelaNumber);

    // Add cardNo field for frontend compatibility
    const cartelasWithCardNo = cartelasResult.map(cartela => ({
      ...cartela,
      cardNo: cartela.cardNo || cartela.cartelaNumber, // Use cardNo if available, fallback to cartelaNumber
      cartelaNumber: cartela.cartelaNumber, // Keep for reference
      cno: cartela.cartelaNumber, // Keep for compatibility
      // Parse pattern if it's a string
      pattern: typeof cartela.pattern === 'string' ? JSON.parse(cartela.pattern) : cartela.pattern
    }));

    const totalResult = await db.select({ count: count() }).from(cartelas);
    const total = totalResult[0]?.count || 0;

    res.json(cartelasWithCardNo);
  } catch (error) {
    console.error('Cartelas error:', error);
    res.status(500).json({ error: "Failed to fetch cartelas" });
  }
});

// GET /api/cartelas/master - Master table view
router.get("/master", async (req, res) => {
  try {
    const { search = "", page = "1", limit = "10" } = req.query;
    
    // Validate pagination parameters
    const pageNum = parseInt(page as string);
    const limitNum = parseInt(limit as string);
    
    if (isNaN(pageNum) || isNaN(limitNum) || pageNum < 1 || limitNum < 1) {
      return res.status(400).json({ error: "Invalid pagination parameters" });
    }
    
    const offset = (pageNum - 1) * limitNum;

    let query = db.select().from(cartelas);
    
    if (search && typeof search === "string" && search.trim()) {
      // TODO: Add search conditions - for now just continue without search
      console.log('Search parameter ignored:', search);
    }

    const cartelasResult = await query
      .limit(limitNum)
      .offset(offset)
      .orderBy(cartelas.cartelaNumber);

    // Add cardNo field for frontend compatibility
    const cartelasWithCardNo = cartelasResult.map(cartela => ({
      ...cartela,
      cardNo: cartela.cardNo || cartela.cartelaNumber, // Use cardNo if available, fallback to cartelaNumber
      cartelaNumber: cartela.cartelaNumber, // Keep for reference
      cno: cartela.cartelaNumber, // Keep for compatibility
    }));

    const totalResult = await db.select({ count: count() }).from(cartelas);
    const total = totalResult[0]?.count || 0;

    res.json({
      cartelas: cartelasWithCardNo,
      total,
      page: pageNum,
      totalPages: Math.ceil(total / limitNum)
    });
  } catch (error) {
    console.error('Master cartelas error:', error);
    res.status(500).json({ error: "Failed to fetch cartelas" });
  }
});

// GET /api/cartelas/:employeeId - Get all cartelas for an employee
router.get("/:employeeId", async (req, res) => {
  try {
    const employeeIdParam = req.params.employeeId;
    const employeeId = employeeIdParam === 'undefined' || employeeIdParam === 'NaN' || isNaN(parseInt(employeeIdParam)) ? undefined : parseInt(employeeIdParam);

    console.log(`Cartela request for employeeId: ${employeeId} (raw param: ${employeeIdParam})`);

    // Disable caching to ensure fresh data
    res.set('Cache-Control', 'no-cache, no-store, must-revalidate');
    res.set('Pragma', 'no-cache');
    res.set('Expires', '0');

    if (!employeeId) {
      console.log('Invalid employeeId provided, returning empty array');
      return res.json([]);
    }

    const employeeCartelas = await db
      .select()
      .from(cartelas)
      .where(eq(cartelas.employeeId, employeeId))
      .orderBy(cartelas.cartelaNumber);

    console.log(`Fetched ${employeeCartelas.length} cartelas for employee ${employeeId}`);

    // Parse JSON strings back to arrays for frontend
    const parsedCartelas = employeeCartelas.map(cartela => ({
      ...cartela,
      pattern: typeof cartela.pattern === 'string' ? JSON.parse(cartela.pattern) : cartela.pattern,
      // Use actual cardNo from database
      cardNo: cartela.cardNo,
      cartelaNumber: cartela.cartelaNumber, // Keep for reference
      cno: cartela.cartelaNumber, // Keep for compatibility
    }));

    res.json(parsedCartelas);
  } catch (error) {
    console.error("Error fetching cartelas:", error);
    res.status(500).json({ error: "Failed to fetch cartelas" });
  }
});

// POST /api/cartelas - Create new cartela
router.post("/", async (req, res) => {
  try {
    const { employeeId, cartelaNumber, name, pattern } = req.body;

    // Check if cartela number already exists for this employee
    const existing = await db
      .select()
      .from(cartelas)
      .where(
        and(
          eq(cartelas.employeeId, employeeId),
          eq(cartelas.cartelaNumber, cartelaNumber)
        )
      )
      .limit(1);

    if (existing.length > 0) {
      return res.status(400).json({ error: "Cartela number already exists for this employee" });
    }

    const [newCartela] = await db
      .insert(cartelas)
      .values({
        employeeId,
        cartelaNumber,
        name: name || `Cartela ${cartelaNumber}`,
        pattern: JSON.stringify(pattern),
        isHardcoded: false,
        isActive: true,
        createdAt: new Date(),
        updatedAt: new Date(),
      })
      .returning();

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
    const { employeeId, adminId, bulkData } = req.body;

    const parsed = parseBulkCartelaData(bulkData);
    let updated = 0;
    let errors = [];

    for (const cartelaData of parsed.valid) {
      try {
        // Check if cartela already exists for this employee
        const existing = await db
          .select()
          .from(cartelas)
          .where(
            and(
              eq(cartelas.employeeId, employeeId),
              eq(cartelas.cartelaNumber, cartelaData.cartelaNumber)
            )
          )
          .limit(1);

        if (existing.length > 0) {
          // Update existing cartela
          await db
            .update(cartelas)
            .set({
              name: cartelaData.name,
              pattern: cartelaData.pattern,
              isHardcoded: false, // Mark as custom when updated
            })
            .where(and(
              eq(cartelas.employeeId, employeeId),
              eq(cartelas.cartelaNumber, cartelaData.cartelaNumber)
            ))
            .returning();

          updated++;
        } else {
          // Insert new cartela
          await db
            .insert(cartelas)
            .values({
              employeeId,
              adminId,
              cartelaNumber: cartelaData.cartelaNumber,
              name: cartelaData.name,
              pattern: cartelaData.pattern,
              isHardcoded: false,
              isActive: true,
            })
            .returning();
        }
      } catch (error) {
        errors.push(`Failed to process cartela ${cartelaData.cartelaNumber}: ${error.message}`);
      }
    }

    res.json({
      updated,
      added: parsed.valid.length - updated,
      skipped: parsed.invalid.length,
      errors,
    });
  } catch (error) {
    console.error("Error bulk importing cartelas:", error);
    res.status(500).json({ error: "Failed to bulk import cartelas" });
  }
});

// POST /api/cartelas/load-hardcoded/:employeeId - Load hardcoded cartelas for employee
router.post("/load-hardcoded/:employeeId", async (req, res) => {
  try {
    const employeeId = parseInt(req.params.employeeId);
    const { adminId } = req.body;

    await loadHardcodedCartelas(employeeId, adminId);
    res.json({ message: "Hardcoded cartelas loaded successfully" });
  } catch (error) {
    console.error("Error loading hardcoded cartelas:", error);
    res.status(500).json({ error: "Failed to load hardcoded cartelas" });
  }
});

// POST /api/cartelas/import - CSV import
router.post("/import", async (req, res) => {
  try {
    const { cartelas: cartelaDataList } = req.body;
    let imported = 0;
    let errors = [];
    const now = new Date(); // Date object for timestamp mode

    console.log(`Starting import of ${cartelaDataList?.length || 0} cartelas`);

    // Get authenticated employee ID from session
    const user = (req as any).session?.user;
    const defaultEmployeeId = user?.id || 1; // Fallback to 1 for now

    for (const cartelaData of cartelaDataList) {
      try {
        // Validate cartela data before insertion
        if (!cartelaData.cno || !cartelaData.grid) {
          throw new Error('Missing required fields: cno or grid');
        }

        // Use user_id from CSV if provided, otherwise use authenticated user
        const employeeId = cartelaData.user_id ? parseInt(cartelaData.user_id) : defaultEmployeeId;

        // Check if cartela already exists for this employee
        const existing = await db.select()
          .from(cartelas)
          .where(and(
            eq(cartelas.employeeId, employeeId),
            eq(cartelas.cartelaNumber, cartelaData.cno)
          ))
          .limit(1);

        if (existing.length > 0) {
          // Update existing cartela
          await db.update(cartelas)
            .set({
              name: `Cartela ${cartelaData.cno}`,
              pattern: cartelaData.grid,
              cardNo: cartelaData.card_no || cartelaData.cno, // Use card_no from CSV
              updatedAt: new Date(),
            })
            .where(and(
              eq(cartelas.employeeId, employeeId),
              eq(cartelas.cartelaNumber, cartelaData.cno)
            ));
          console.log(`Updated cartela ${cartelaData.cno} for employee ${employeeId}`);
        } else {
          // Insert new cartela
          await db.insert(cartelas)
            .values({
              employeeId,
              cartelaNumber: cartelaData.cno,
              cardNo: cartelaData.card_no || cartelaData.cno, // Use card_no from CSV
              name: `Cartela ${cartelaData.cno}`,
              pattern: cartelaData.grid,
              isHardcoded: false,
              isActive: true,
              createdAt: new Date(),
              updatedAt: new Date(),
            });
          console.log(`Inserted cartela ${cartelaData.cno} with card_no ${cartelaData.card_no} for employee ${employeeId}`);
        }
        
        imported++;
      } catch (error) {
        const errorMsg = `Failed to import cartela ${cartelaData.cno}: ${error.message || error}`;
        console.error(errorMsg);
        errors.push(errorMsg);
      }
    }

    console.log(`Import completed: ${imported} successful, ${errors.length} failed`);

    // Return detailed status
    res.json({
      imported,
      errors,
      total: cartelaDataList?.length || 0,
      success: errors.length === 0
    });
  } catch (error) {
    console.error("Error importing cartelas:", error);
    res.status(500).json({ error: "Failed to import cartelas" });
  }
});

// POST /api/cartelas/manual - Create manual cartela
router.post("/manual", async (req, res) => {
  try {
    const { grid } = req.body;
    const now = new Date(); // Date object for timestamp mode
    
    // Get authenticated employee ID from session
    const user = (req as any).session?.user;
    const employeeId = user?.id || 1; // Fallback to 1 for now
    
    // Generate next cartelaNumber
    const lastCartela = await db
      .select({ cartelaNumber: cartelas.cartelaNumber })
      .from(cartelas)
      .where(eq(cartelas.employeeId, employeeId))
      .orderBy(cartelas.cartelaNumber)
      .limit(1);
    
    const nextCno = lastCartela.length > 0 ? lastCartela[0].cartelaNumber + 1 : 1;
    
    const [newCartela] = await db
      .insert(cartelas)
      .values({
        employeeId,
        cartelaNumber: nextCno,
        name: `Cartela ${nextCno}`,
        pattern: JSON.stringify(grid),
        isHardcoded: false,
        isActive: true,
        createdAt: now,
        updatedAt: now,
      })
      .returning();

    res.json(newCartela);
  } catch (error) {
    console.error('Manual cartela error:', error);
    res.status(500).json({ error: "Failed to create manual cartela" });
  }
});

export { router as cartelasRouter };