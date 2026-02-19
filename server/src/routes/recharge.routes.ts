import { Router } from "express";
import * as rechargeController from "../controllers/recharge.controller";

const router = Router();

// Secure recharge endpoints
router.post("/topup", rechargeController.topup);
router.get("/machine-id", rechargeController.getMachineId);

export default router;
