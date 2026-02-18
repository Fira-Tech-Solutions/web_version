// @ts-nocheck
import { Router } from "express";
import * as cartelaController from "../controllers/cartela.controller";

const router = Router();

// GET all cartelas (management)
router.get("/", cartelaController.getCartelas);

// GET master view
router.get("/master", cartelaController.getMasterCartelas);

// GET employee's cartelas
router.get("/employee/:employeeId", cartelaController.getEmployeeCartelas);
// Backward compatibility for GET /api/cartelas/:employeeId
router.get("/:employeeId", cartelaController.getEmployeeCartelas);

// Create single cartela
router.post("/", cartelaController.createCartela);

// Update cartela
router.put("/:id", cartelaController.updateCartela);

// Delete cartela
router.delete("/:id", cartelaController.deleteCartela);

// Bulk operations
router.post("/bulk-import", cartelaController.bulkImport);
router.post("/load-hardcoded/:employeeId", cartelaController.loadHardcoded);
router.post("/import", cartelaController.csvImport);
router.post("/manual", cartelaController.createManualCartela);

export const cartelaRoutes = router;
