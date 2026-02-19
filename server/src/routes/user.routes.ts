// @ts-nocheck
import { Router } from "express";
import * as userController from "../controllers/user.controller";

const router = Router();

// Credit balance
router.get("/credit/balance", userController.getCreditBalance);

// User CRUD
router.post("/", userController.createUser);
router.get("/:id", userController.getUserById);
router.patch("/:id", userController.updateUser);
router.delete("/:id", userController.deleteUser);
router.patch("/:id/password", userController.updateUserPassword);

// Shop-based user lookup
router.get("/shop", userController.getShopUsers);

// Employee recharge
router.post("/employee/recharge/redeem", userController.rechargeRedeem);
router.post("/recharge/topup", userController.rechargeTopup);

// Stats
router.get("/stats/employee/:id", userController.getEmployeeStats);
router.get("/stats/today/:shopId", userController.getTodayStats);

// Transactions
router.get("/transactions/employee/:employeeId", userController.getTransactionsByEmployee);

// Game history
router.get("/game-history/:employeeId", userController.getGameHistoryByEmployee);

// Referral commissions
router.get("/referral-commissions/:referrerId", userController.getReferralCommissions);
router.post("/referral-commissions/withdraw", userController.withdrawReferralCommission);
router.post("/referral-commissions/convert", userController.convertCommissionToCredit);
router.patch("/referral-commissions/:id/:action", userController.processReferralCommission);

// Withdrawal requests
router.get("/withdrawal-requests", userController.getWithdrawalRequests);
router.post("/withdrawal-requests", userController.createWithdrawalRequest);
router.patch("/withdrawal-requests/:id/:action", userController.processWithdrawalRequest);

// Shop settings
router.patch("/shops/:shopId", userController.updateShop);

// Profits
router.post("/calculate-profits", userController.calculateProfits);
router.get("/referrals/earnings", userController.getReferralEarnings);

// All admins (super admin)
router.get("/admin/all-admins", userController.getAllAdmins);

// Shop games
router.get("/games/shop", userController.getShopGames);

export const userRoutes = router;
