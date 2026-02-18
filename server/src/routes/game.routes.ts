// @ts-nocheck
import { Router } from "express";
import * as gameController from "../controllers/game.controller";

const router = Router();

// Game lifecycle
router.post("/", gameController.createGame);
router.get("/active", gameController.getActiveGame);
router.get("/recent-completed", gameController.getRecentCompleted);
router.post("/check-winner", gameController.checkWinner);

// Balance operations
router.post("/deduct-balance", gameController.deductBalance);

// Game-specific operations
router.post("/:gameId/players", gameController.addPlayers);
router.get("/:gameId/players", gameController.getGamePlayers);
router.patch("/:gameId/start", gameController.startGame);
router.patch("/:gameId/pause", gameController.pauseGame);
router.patch("/:gameId/numbers", gameController.updateCalledNumbers);
router.post("/:gameId/check-winner", gameController.checkGameWinner);
router.post("/:gameId/declare-winner", gameController.declareWinner);
router.patch("/:gameId/complete", gameController.completeGame);

// Cartela reset
router.post("/cartelas/reset", gameController.resetCartelas);

export const gameRoutes = router;
