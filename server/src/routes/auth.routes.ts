// @ts-nocheck
import { Router } from "express";
import * as authController from "../controllers/auth.controller";

const router = Router();

router.post("/login", authController.login);
router.post("/register-file", authController.registerFile);
router.post("/logout", authController.logout);
router.get("/me", authController.getCurrentUser);
router.post("/verify-machine-id", authController.verifyMachineId);

export const authRoutes = router;
