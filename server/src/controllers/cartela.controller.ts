// @ts-nocheck
import type { Request, Response } from "express";
import { eq, and, desc, count, like, or } from "drizzle-orm";
import { db } from "../../storage/storage";
import { cartelas } from "@shared/schema-postgres";
import { loadHardcodedCartelas as loadHardcodedLib } from "../lib/cartela-loader";

const logCartelaUpdate = (employeeId: number) => {
    console.log(`Cartela updated for employee ${employeeId} at ${new Date().toISOString()}`);
};

const parseBulkCartelaData = (bulkData: string) => {
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

        const pattern: number[][] = Array(5).fill(null).map(() => Array(5).fill(0));
        let valid = true;
        for (let i = 0; i < 25; i++) {
            const row = Math.floor(i / 5);
            const col = i % 5;

            if (row === 2 && col === 2) {
                if (numberStrings[i] !== 'free' && numberStrings[i] !== '0') {
                    results.invalid.push(`Cartela ${cartelaNumber}: center must be 'free' or '0'`);
                    valid = false;
                    break;
                }
                pattern[row][col] = 0;
            } else {
                const num = parseInt(numberStrings[i]);
                if (isNaN(num) || num < 1 || num > 75) {
                    results.invalid.push(`Cartela ${cartelaNumber}: invalid number '${numberStrings[i]}'`);
                    valid = false;
                    break;
                }
                pattern[row][col] = num;
            }
        }

        if (valid) {
            results.valid.push({
                cartelaNumber,
                pattern,
                name: `Cartela ${cartelaNumber}`
            });
        }
    }

    return results;
};

// GET /api/cartelas
export const getCartelas = async (req: Request, res: Response) => {
    try {
        const { search = "", page = "1", limit = "50" } = req.query;
        const pageNum = parseInt(page as string);
        const limitNum = parseInt(limit as string);

        if (isNaN(pageNum) || isNaN(limitNum) || pageNum < 1 || limitNum < 1) {
            return res.status(400).json({ error: "Invalid pagination parameters" });
        }

        const offset = (pageNum - 1) * limitNum;

        // Search conditions and TODO item fixed here
        const conditions = [];
        if (search && typeof search === "string" && search.trim()) {
            const searchTerm = `%${search.trim()}%`;
            const searchInt = parseInt(search.trim());

            if (!isNaN(searchInt)) {
                conditions.push(
                    or(
                        eq(cartelas.cartelaNumber, searchInt),
                        eq(cartelas.cardNo, searchInt),
                        like(cartelas.name, searchTerm)
                    )
                );
            } else {
                conditions.push(like(cartelas.name, searchTerm));
            }
        }

        let query = db.select().from(cartelas);
        if (conditions.length > 0) {
            query = query.where(and(...conditions)) as any;
        }

        const cartelasResult = await query
            .limit(limitNum)
            .offset(offset)
            .orderBy(cartelas.cartelaNumber);

        const cartelasWithCardNo = cartelasResult.map(cartela => ({
            ...cartela,
            cardNo: cartela.cardNo || cartela.cartelaNumber,
            cartelaNumber: cartela.cartelaNumber,
            cno: cartela.cartelaNumber,
            pattern: typeof cartela.pattern === 'string' ? JSON.parse(cartela.pattern) : cartela.pattern
        }));

        res.json(cartelasWithCardNo);
    } catch (error) {
        console.error('Cartelas error:', error);
        res.status(500).json({ error: "Failed to fetch cartelas" });
    }
};

// GET /api/cartelas/master
export const getMasterCartelas = async (req: Request, res: Response) => {
    try {
        const { search = "", page = "1", limit = "10" } = req.query;
        const pageNum = parseInt(page as string);
        const limitNum = parseInt(limit as string);

        if (isNaN(pageNum) || isNaN(limitNum) || pageNum < 1 || limitNum < 1) {
            return res.status(400).json({ error: "Invalid pagination parameters" });
        }

        const offset = (pageNum - 1) * limitNum;

        // Search conditions implementation
        const conditions = [];
        if (search && typeof search === "string" && search.trim()) {
            const searchTerm = `%${search.trim()}%`;
            const searchInt = parseInt(search.trim());

            if (!isNaN(searchInt)) {
                conditions.push(
                    or(
                        eq(cartelas.cartelaNumber, searchInt),
                        eq(cartelas.cardNo, searchInt),
                        like(cartelas.name, searchTerm)
                    )
                );
            } else {
                conditions.push(like(cartelas.name, searchTerm));
            }
        }

        let query = db.select().from(cartelas);
        if (conditions.length > 0) {
            query = query.where(and(...conditions)) as any;
        }

        const cartelasResult = await query
            .limit(limitNum)
            .offset(offset)
            .orderBy(cartelas.cartelaNumber);

        const cartelasWithCardNo = cartelasResult.map(cartela => ({
            ...cartela,
            cardNo: cartela.cardNo || cartela.cartelaNumber,
            cartelaNumber: cartela.cartelaNumber,
            cno: cartela.cartelaNumber,
        }));

        let totalQuery = db.select({ count: count() }).from(cartelas);
        if (conditions.length > 0) {
            totalQuery = totalQuery.where(and(...conditions)) as any;
        }
        const totalResult = await totalQuery;
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
};

// GET /api/cartelas/:employeeId
export const getEmployeeCartelas = async (req: Request, res: Response) => {
    try {
        const employeeIdParam = req.params.employeeId;
        const employeeId = employeeIdParam === 'undefined' || employeeIdParam === 'NaN' || isNaN(parseInt(employeeIdParam)) ? undefined : parseInt(employeeIdParam);

        res.set('Cache-Control', 'no-cache, no-store, must-revalidate');
        if (!employeeId) return res.json([]);

        const employeeCartelas = await db
            .select()
            .from(cartelas)
            .where(eq(cartelas.employeeId, employeeId))
            .orderBy(cartelas.cartelaNumber);

        const parsedCartelas = employeeCartelas.map(cartela => ({
            ...cartela,
            pattern: typeof cartela.pattern === 'string' ? JSON.parse(cartela.pattern) : cartela.pattern,
            cardNo: cartela.cardNo,
            cartelaNumber: cartela.cartelaNumber,
            cno: cartela.cartelaNumber,
        }));

        res.json(parsedCartelas);
    } catch (error) {
        console.error("Error fetching cartelas:", error);
        res.status(500).json({ error: "Failed to fetch cartelas" });
    }
};

// POST /api/cartelas
export const createCartela = async (req: Request, res: Response) => {
    try {
        const { employeeId, cartelaNumber, name, pattern } = req.body;

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
                cardNo: cartelaNumber, // Use same by default
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
};

// PUT /api/cartelas/:id
export const updateCartela = async (req: Request, res: Response) => {
    try {
        const cartelaId = parseInt(req.params.id);
        const { cartelaNumber, name, pattern } = req.body;

        const current = await db
            .select()
            .from(cartelas)
            .where(eq(cartelas.id, cartelaId))
            .limit(1);

        if (current.length === 0) {
            return res.status(404).json({ error: "Cartela not found" });
        }

        if (cartelaNumber !== current[0].cartelaNumber) {
            const existing = await db
                .select()
                .from(cartelas)
                .where(
                    and(
                        eq(cartelas.employeeId, current[0].employeeId),
                        eq(cartelas.cartelaNumber, cartelaNumber)
                    )
                )
                .limit(1);

            if (existing.length > 0) {
                return res.status(400).json({ error: "Cartela number already exists for this employee" });
            }
        }

        const [updated] = await db
            .update(cartelas)
            .set({
                cartelaNumber,
                cardNo: cartelaNumber,
                name,
                pattern: typeof pattern === 'string' ? pattern : JSON.stringify(pattern),
                updatedAt: new Date(),
            })
            .where(eq(cartelas.id, cartelaId))
            .returning();

        res.json(updated);
    } catch (error) {
        console.error("Error updating cartela:", error);
        res.status(500).json({ error: "Failed to update cartela" });
    }
};

// DELETE /api/cartelas/:id
export const deleteCartela = async (req: Request, res: Response) => {
    try {
        const cartelaId = parseInt(req.params.id);

        const deleted = await db
            .delete(cartelas)
            .where(eq(cartelas.id, cartelaId))
            .returning();

        if (deleted.length === 0) {
            return res.status(404).json({ error: "Cartela not found" });
        }

        res.json({ message: "Cartela deleted successfully" });
    } catch (error) {
        console.error("Error deleting cartela:", error);
        res.status(500).json({ error: "Failed to delete cartela" });
    }
};

// POST /api/cartelas/bulk-import
export const bulkImport = async (req: Request, res: Response) => {
    try {
        const { employeeId, adminId, bulkData } = req.body;
        const parsed = parseBulkCartelaData(bulkData);
        let updated = 0;
        let errors = [];

        for (const data of parsed.valid) {
            try {
                const existing = await db
                    .select()
                    .from(cartelas)
                    .where(
                        and(
                            eq(cartelas.employeeId, employeeId),
                            eq(cartelas.cartelaNumber, data.cartelaNumber)
                        )
                    )
                    .limit(1);

                if (existing.length > 0) {
                    await db
                        .update(cartelas)
                        .set({
                            name: data.name,
                            pattern: JSON.stringify(data.pattern),
                            isHardcoded: false,
                            updatedAt: new Date(),
                        })
                        .where(eq(cartelas.id, existing[0].id));
                    updated++;
                } else {
                    await db
                        .insert(cartelas)
                        .values({
                            employeeId,
                            adminId,
                            cartelaNumber: data.cartelaNumber,
                            cardNo: data.cartelaNumber,
                            name: data.name,
                            pattern: JSON.stringify(data.pattern),
                            isHardcoded: false,
                            isActive: true,
                            createdAt: new Date(),
                            updatedAt: new Date(),
                        });
                }
            } catch (error) {
                errors.push(`Failed to process cartela ${data.cartelaNumber}: ${error.message}`);
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
};

// POST /api/cartelas/load-hardcoded/:employeeId
export const loadHardcoded = async (req: Request, res: Response) => {
    try {
        const employeeId = parseInt(req.params.employeeId);
        await loadHardcodedLib(employeeId);
        res.json({ message: "Hardcoded cartelas loaded successfully" });
    } catch (error) {
        console.error("Error loading hardcoded cartelas:", error);
        res.status(500).json({ error: "Failed to load hardcoded cartelas" });
    }
};

// POST /api/cartelas/import (CSV)
export const csvImport = async (req: Request, res: Response) => {
    try {
        const { cartelas: list } = req.body;
        const user = (req as any).session?.user;
        if (!user) return res.status(401).json({ error: "Not authenticated" });
        const employeeId = user.id;

        const validated = [];
        const errors = [];
        const now = new Date();

        for (const data of list) {
            if (!data.cno) {
                errors.push(`Missing cno for cartela`);
                continue;
            }

            let grid;
            if (data.grid) {
                grid = typeof data.grid === 'string' ? JSON.parse(data.grid) : data.grid;
            } else if (data.b && data.i && data.n && data.g && data.o) {
                const b = data.b.split(',').map(n => parseInt(n.trim()));
                const i = data.i.split(',').map(n => parseInt(n.trim()));
                const n = data.n.split(',').map(n => parseInt(n.trim()));
                const g = data.g.split(',').map(n => parseInt(n.trim()));
                const o = data.o.split(',').map(n => parseInt(n.trim()));

                grid = [0, 1, 2, 3, 4].map(idx => [
                    b[idx] || 0,
                    i[idx] || 0,
                    n[idx] || 0,
                    g[idx] || 0,
                    o[idx] || 0
                ]);
            } else {
                errors.push(`Missing grid data for ${data.cno}`);
                continue;
            }

            if (grid[2][2] !== 0) grid[2][2] = 0;

            validated.push({
                cartelaNumber: parseInt(data.cno),
                cardNo: data.card_no ? parseInt(data.card_no) : parseInt(data.cno),
                pattern: JSON.stringify(grid)
            });
        }

        if (validated.length === 0) return res.status(400).json({ error: "No valid cartelas", errors });

        try {
            // Delete existing cartelas for this employee
            await db.delete(cartelas).where(eq(cartelas.employeeId, employeeId));
            
            // Insert new cartelas
            const time = new Date();
            const cartelaData = validated.map(v => ({
                employeeId,
                cartelaNumber: v.cartelaNumber,
                cardNo: v.cardNo,
                name: `Cartela ${v.cartelaNumber}`,
                pattern: v.pattern,
                isHardcoded: false,
                isActive: true,
                createdAt: time,
                updatedAt: time,
            }));
            
            await db.insert(cartelas).values(cartelaData);
        } catch (e) {
            throw e;
        }

        res.json({ imported: validated.length, errors, total: list.length });
    } catch (error) {
        console.error("Error importing cartelas:", error);
        res.status(500).json({ error: "Failed to import cartelas" });
    }
};

// POST /api/cartelas/manual
export const createManualCartela = async (req: Request, res: Response) => {
    try {
        const { grid } = req.body;
        const user = (req as any).session?.user;
        const employeeId = user?.id || 1;

        const last = await db
            .select({ cno: cartelas.cartelaNumber })
            .from(cartelas)
            .where(eq(cartelas.employeeId, employeeId))
            .orderBy(desc(cartelas.cartelaNumber))
            .limit(1);

        const next = last.length > 0 ? last[0].cno + 1 : 1;

        const [nc] = await db
            .insert(cartelas)
            .values({
                employeeId,
                cartelaNumber: next,
                cardNo: next,
                name: `Cartela ${next}`,
                pattern: JSON.stringify(grid),
                isHardcoded: false,
                isActive: true,
                createdAt: new Date(),
                updatedAt: new Date(),
            })
            .returning();

        res.json(nc);
    } catch (error) {
        console.error('Manual cartela error:', error);
        res.status(500).json({ error: "Failed to create manual cartela" });
    }
};
