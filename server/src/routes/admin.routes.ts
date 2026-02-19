// @ts-nocheck
import { Router } from "express";
import * as adminController from "../controllers/admin.controller";

const router = Router();

// Employee & tracking management
router.get("/employees", adminController.getAdminEmployees);
router.delete("/employees/:id", adminController.deleteAdminEmployee);
router.post("/employees/generate-recharge-file", adminController.generateRechargeFile);
router.post("/recharge/generate-file", adminController.generateRechargeFile); // Backward compatibility
router.post("/employees/generate-account-file", adminController.generateAccountFile);
router.patch("/employees/:id/machine-id", adminController.updateEmployeeMachineId);
router.put("/employees/:id/machine-id", adminController.updateEmployeeMachineId); // Support PUT as well
router.patch("/employees/:id/password", adminController.updateEmployeePassword);

// Tracking data
router.get("/tracking-data", adminController.getTrackingData);

// Admin transactions
router.get("/transactions", adminController.getAdminTransactions);

// Admin financial
router.get("/master-float", adminController.getMasterFloat);
router.post("/load-credit", adminController.loadCredit);

// Shop stats
router.get("/shop-stats", adminController.getShopStatsWithCommission);

// Shops
router.get("/shops", adminController.getAdminShops);

// System settings
router.get("/settings", adminController.getSystemSettings);
router.patch("/settings", adminController.updateSystemSettings);

// Game history
router.get("/game-history", adminController.getAdminGameHistory);

// Admins management (from admin perspective)
router.post("/create-admin", adminController.createAdmin);
router.post("/create-employee", adminController.createEmployee);

export const adminRoutes = router;
