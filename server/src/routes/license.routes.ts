// @ts-nocheck
import { Router } from "express";
import * as licenseController from "../controllers/license.controller";

const router = Router();
const rechargeRouter = Router();

// License routes
router.get("/status", licenseController.getStatus);
router.get("/machine-id", licenseController.getMachineId);
router.post("/generate-activation", licenseController.generateActivation);
router.post("/deactivate", licenseController.deactivate);

// Recharge routes
rechargeRouter.post("/topup", licenseController.topup);
rechargeRouter.get("/total", licenseController.getTotal);

export const licenseRoutes = router;
export const rechargeRoutes = rechargeRouter;
export { licenseController }; // Export for specific mounting requirements
