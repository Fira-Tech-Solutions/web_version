// @ts-nocheck
import { Router } from "express";
import * as balanceController from "../controllers/balance.controller";

const router = Router();

// POST /api/balance/redeem
router.post("/redeem", balanceController.redeem);

export const balanceRoutes = router;
