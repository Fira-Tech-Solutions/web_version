// @ts-nocheck
import { Router } from "express";
import * as superAdminController from "../controllers/superAdmin.controller";

const router = Router();

// Admin management
router.get("/admins", superAdminController.getAdmins);
router.post("/admins", superAdminController.createAdminSA);
router.patch("/admins/:id", superAdminController.updateAdmin);
router.patch("/admins/:id/:action", superAdminController.toggleBlockAdmin);

// Referral management
router.get("/referral-commissions", superAdminController.getReferralCommissions);
router.get("/referral-settings", superAdminController.getReferralSettings);
router.patch("/referral-settings", superAdminController.updateReferralSettings);

export const superAdminRoutes = router;
