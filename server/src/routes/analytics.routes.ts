// @ts-nocheck
import { Router } from "express";
import * as analyticsController from "../controllers/analytics.controller";

const router = Router();

router.get("/shop/:shopId", analyticsController.getShopAnalytics);
router.get("/profit-distribution", analyticsController.getProfitDistribution);
router.get("/trends", analyticsController.getFinancialTrends);
router.get("/employee-performance", analyticsController.getEmployeePerformance);
router.get("/export", analyticsController.exportAnalytics);

export const analyticsRoutes = router;
