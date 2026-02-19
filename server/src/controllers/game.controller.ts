// @ts-nocheck
import type { Request, Response } from "express";
import { storage } from "../../storage/storage";
import { checkBingoWin } from "../services/bingo.service";
import { emitEvent } from "../services/socket.service";
import { getFixedCartelaPattern } from "../lib/fixed-cartelas";
import secureLogger from "../lib/secure-logger";

// ─── CREATE GAME ────────────────────────────────────────────────────
export async function createGame(req: Request, res: Response) {
    try {
        const userId = (req.session as any)?.userId;
        if (!userId) {
            return res.status(401).json({ message: "Authentication required" });
        }

        const user = await storage.getUser(userId);
        if (!user || user.role !== 'employee') {
            return res.status(403).json({ message: "Employee access required" });
        }

        // Check admin's credit balance
        const adminUser = await storage.getUserByShopId(user.shopId!);
        if (!adminUser) {
            return res.status(400).json({ message: "Shop admin not found" });
        }

        const adminBalance = parseFloat(adminUser.creditBalance || '0.00');
        if (adminBalance < 50) {
            return res.status(400).json({
                message: `Insufficient admin credit balance. Current balance: ${adminUser.creditBalance} ETB. Minimum required: 50.00 ETB.`
            });
        }

        const { entryFee, selectedCartelas } = req.body;
        if (!entryFee) {
            return res.status(400).json({ message: "Entry fee is required" });
        }

        // Check employee's credit balance
        const employeeBalance = parseFloat(user.creditBalance || '0');
        const totalCost = (selectedCartelas || []).length * parseFloat(entryFee);

        if (employeeBalance < totalCost) {
            return res.status(400).json({
                message: `Insufficient employee credit balance. You have ${employeeBalance.toFixed(2)} ETB but need ${totalCost.toFixed(2)} ETB.`,
                balance: employeeBalance.toFixed(2),
                required: totalCost.toFixed(2),
                cartelas: (selectedCartelas || []).length,
                entryFee: parseFloat(entryFee)
            });
        }

        const game = await storage.createGame({
            shopId: user.shopId!,
            employeeId: userId,
            status: 'pending',
            prizePool: '0.00',
            entryFee: req.body.entryFee || '20.00',
            calledNumbers: [],
            winnerId: null,
            startedAt: null,
            completedAt: null
        });

        // Log game creation
        secureLogger.logGameCreation(game, userId, user.username);

        res.json(game);
    } catch (error) {
        console.error("Create game error:", error);
        res.status(500).json({ message: "Failed to create game" });
    }
}

// ─── GET ACTIVE GAME ────────────────────────────────────────────────
export async function getActiveGame(req: Request, res: Response) {
    try {
        const userId = (req.session as any)?.userId;
        if (!userId) {
            return res.status(401).json({ message: "Authentication required" });
        }

        const user = await storage.getUser(userId);
        if (!user || !['employee', 'admin', 'collector'].includes(user.role)) {
            return res.status(403).json({ message: "Access denied" });
        }

        const activeGame = await storage.getActiveGameByEmployee(user.id);
        res.json(activeGame);
    } catch (error) {
        console.error("Get active game error:", error);
        res.status(500).json({ message: "Failed to get active game" });
    }
}

// ─── GET RECENT COMPLETED GAME ──────────────────────────────────────
export async function getRecentCompleted(req: Request, res: Response) {
    try {
        const userId = (req.session as any)?.userId;
        if (!userId) {
            return res.status(401).json({ message: "Authentication required" });
        }

        const user = await storage.getUser(userId);
        if (!user || !['employee', 'admin'].includes(user.role)) {
            return res.status(403).json({ message: "Access denied" });
        }

        const recentGame = await storage.getRecentCompletedGame(user.shopId!);
        res.json(recentGame);
    } catch (error) {
        console.error("Get recent completed game error:", error);
        res.status(500).json({ message: "Failed to get recent completed game" });
    }
}

// ─── ADD PLAYERS ────────────────────────────────────────────────────
export async function addPlayers(req: Request, res: Response) {
    try {
        const userId = (req.session as any)?.userId;
        if (!userId) {
            return res.status(401).json({ message: "Not authenticated" });
        }

        const user = await storage.getUser(userId);
        if (!user || user.role !== 'employee') {
            return res.status(403).json({ message: "Employee access required" });
        }

        const gameId = parseInt(req.params.gameId);
        const { playerName, cartelaNumbers, entryFee } = req.body;

        if (!playerName || !cartelaNumbers || !Array.isArray(cartelaNumbers) || cartelaNumbers.length === 0) {
            return res.status(400).json({ message: "Player name and cartelaNumbers are required" });
        }

        const players = [];
        for (const cartelaNumber of cartelaNumbers) {
            const player = await storage.addGamePlayer({
                gameId,
                playerName: `${playerName} #${cartelaNumber}`,
                cartelaNumbers: [cartelaNumber],
                entryFee: entryFee.toString()
            });
            players.push(player);
        }

        // Update game prize pool
        const totalAmount = cartelaNumbers.length * parseFloat(entryFee);
        await storage.updateGamePrizePool(gameId, totalAmount);

        res.json(players);
    } catch (error) {
        console.error('Add players error:', error);
        res.status(500).json({ message: "Failed to add players" });
    }
}

// ─── GET GAME PLAYERS ───────────────────────────────────────────────
export async function getGamePlayers(req: Request, res: Response) {
    try {
        const userId = (req.session as any)?.userId;
        if (!userId) {
            return res.status(401).json({ message: "Not authenticated" });
        }

        const gameId = parseInt(req.params.gameId);
        const players = await storage.getGamePlayers(gameId);
        res.json(players);
    } catch (error) {
        console.error("Get players error:", error);
        res.status(500).json({ message: "Failed to get game players" });
    }
}

// ─── START GAME ─────────────────────────────────────────────────────
export async function startGame(req: Request, res: Response) {
    try {
        const userId = (req.session as any)?.userId;
        if (!userId) {
            return res.status(401).json({ message: "Authentication required" });
        }

        const user = await storage.getUser(userId);
        if (!user || user.role !== 'employee') {
            return res.status(403).json({ message: "Employee access required" });
        }

        const gameId = parseInt(req.params.gameId);
        const currentGame = await storage.getGame(gameId);

        if (!currentGame) {
            return res.status(404).json({ message: "Game not found" });
        }

        if (currentGame.status === 'active' || currentGame.status === 'completed') {
            return res.status(400).json({ message: "Game already started or completed" });
        }

        const game = await storage.updateGameStatus(gameId, 'active');
        res.json(game);
    } catch (error) {
        console.error("Start game error:", error);
        res.status(500).json({ message: "Failed to start game" });
    }
}

// ─── PAUSE/RESUME GAME ─────────────────────────────────────────────
export async function pauseGame(req: Request, res: Response) {
    try {
        const userId = (req.session as any)?.userId;
        if (!userId) {
            return res.status(401).json({ message: "Authentication required" });
        }

        const user = await storage.getUser(userId);
        if (!user || user.role !== 'employee') {
            return res.status(403).json({ message: "Employee access required" });
        }

        const gameId = parseInt(req.params.gameId);
        const { isPaused } = req.body;

        const currentGame = await storage.getGame(gameId);
        if (!currentGame) {
            return res.status(404).json({ message: "Game not found" });
        }

        const newStatus = isPaused ? 'paused' : 'active';
        const game = await storage.updateGameStatus(gameId, newStatus);

        res.json({ ...game, isPaused });
    } catch (error) {
        console.error("Pause/Resume game error:", error);
        res.status(500).json({ message: "Failed to pause/resume game" });
    }
}

// ─── UPDATE CALLED NUMBERS ─────────────────────────────────────────
export async function updateCalledNumbers(req: Request, res: Response) {
    try {
        const userId = (req.session as any)?.userId;
        if (!userId) {
            return res.status(401).json({ message: "Authentication required" });
        }

        const user = await storage.getUser(userId);
        if (!user || user.role !== 'employee') {
            return res.status(403).json({ message: "Employee access required" });
        }

        const gameId = parseInt(req.params.gameId);
        const game = await storage.getGame(gameId);

        if (!game || (game.status !== 'active' && game.status !== 'paused')) {
            return res.status(400).json({ message: "Game not active" });
        }

        if (game.status === 'paused') {
            return res.status(400).json({ message: "Game is paused" });
        }

        // Generate next random number
        const currentNumbers = game.calledNumbers || [];
        const availableNumbers = [];
        for (let i = 1; i <= 75; i++) {
            if (!currentNumbers.includes(i.toString())) {
                availableNumbers.push(i);
            }
        }

        if (availableNumbers.length === 0) {
            return res.status(400).json({ message: "All numbers have been called" });
        }

        const randomIndex = Math.floor(Math.random() * availableNumbers.length);
        const newNumber = availableNumbers[randomIndex];
        const updatedNumbers = [...currentNumbers, newNumber.toString()];

        const updatedGame = await storage.updateGameNumbers(gameId, updatedNumbers);

        emitEvent('number_called', {
            gameId, number: newNumber,
            calledNumbers: updatedNumbers,
            shopId: game.shopId
        });

        res.json({
            ...updatedGame,
            calledNumbers: updatedNumbers,
            calledNumber: newNumber
        });
    } catch (error) {
        console.error("Update numbers error:", error);
        res.status(500).json({ message: "Failed to update called numbers" });
    }
}

// ─── UPDATE CALLED NUMBERS (simple) ────────────────────────────────
export async function updateCalledNumbersSimple(req: Request, res: Response) {
    try {
        const userId = (req.session as any)?.userId;
        if (!userId) {
            return res.status(401).json({ message: "Not authenticated" });
        }

        const gameId = parseInt(req.params.gameId);
        const { calledNumbers } = req.body;

        if (!Array.isArray(calledNumbers)) {
            return res.status(400).json({ message: "Called numbers must be an array" });
        }

        const game = await storage.updateGameNumbers(gameId, calledNumbers);
        res.json(game);
    } catch (error) {
        res.status(500).json({ message: "Failed to update called numbers" });
    }
}

// ─── CHECK WINNER (global) ──────────────────────────────────────────
export async function checkWinner(req: Request, res: Response) {
    try {
        const { cartelaNumber, calledNumbers } = req.body;

        if (!cartelaNumber || !calledNumbers) {
            return res.status(400).json({ error: "Missing required fields" });
        }

        const userId = req.session?.userId;
        if (!userId) {
            return res.status(401).json({ error: "Authentication required" });
        }

        const user = await storage.getUser(userId);
        if (!user) {
            return res.status(404).json({ error: "User not found" });
        }

        let cartelaPattern;
        const cartelas = await storage.getCartelas(user.shopId || 1);
        const cartela = cartelas.find((c: any) => c.cartelaNumber === cartelaNumber);

        if (cartela && cartela.pattern) {
            cartelaPattern = cartela.pattern;
        } else {
            cartelaPattern = getFixedCartelaPattern(cartelaNumber);
        }

        const winResult = checkBingoWin(cartelaPattern, calledNumbers);

        res.json({
            isWinner: winResult.isWinner,
            winningPattern: winResult.pattern || "",
            cartelaPattern
        });
    } catch (error) {
        console.error('Error checking winner:', error);
        res.status(500).json({ error: "Failed to check winner" });
    }
}

// ─── CHECK WINNER (per-game) ────────────────────────────────────────
export async function checkGameWinner(req: Request, res: Response) {
    try {
        const userId = (req.session as any)?.userId;
        if (!userId) {
            return res.status(401).json({ message: "Authentication required" });
        }

        const user = await storage.getUser(userId);
        if (!user || user.role !== 'employee') {
            return res.status(403).json({ message: "Employee access required" });
        }

        const gameId = parseInt(req.params.gameId);
        const { cartelaNumber, calledNumbers } = req.body;

        const cartela = await storage.getCartelaByNumber(user.shopId!, cartelaNumber);
        if (!cartela) {
            return res.status(404).json({
                message: "Cartela not found", cartelaNumber, isWinner: false
            });
        }

        const cartelaPattern = cartela.pattern;
        const winResult = checkBingoWin(cartelaPattern, calledNumbers);

        res.json({
            cartelaNumber,
            isWinner: winResult.isWinner,
            winningPattern: winResult.pattern,
            cartelaPattern,
            winningCells: winResult.winningCells || [],
            message: winResult.isWinner
                ? `Cartela Number: ${cartelaNumber}\nWinner ✓\nPattern: ${winResult.pattern}`
                : `Cartela Number: ${cartelaNumber}\nNot a Winner`
        });
    } catch (error) {
        console.error("Check winner error:", error);
        const { cartelaNumber } = req.body || {};
        res.status(500).json({
            message: "Failed to check winner",
            cartelaNumber: cartelaNumber || "unknown",
            isWinner: false, error: error.message
        });
    }
}

// ─── DECLARE WINNER ─────────────────────────────────────────────────
export async function declareWinner(req: Request, res: Response) {
    try {
        const userId = req.session?.userId;
        if (!userId) {
            return res.status(401).json({ message: "Not authenticated" });
        }

        const user = await storage.getUser(userId);
        if (!user || user.role !== 'employee') {
            return res.status(403).json({ message: "Employee access required" });
        }

        const gameId = parseInt(req.params.gameId);
        const { winnerCartelaNumber, totalPlayers, entryFeePerPlayer, allCartelaNumbers, calledNumbers } = req.body;

        if (!winnerCartelaNumber) {
            return res.status(400).json({ message: "Winner cartela number is required" });
        }

        // Verify winner
        const cartela = await storage.getCartelaByNumber(user.shopId!, winnerCartelaNumber);
        if (!cartela) {
            return res.status(404).json({ message: "Cartela not found", cartelaNumber: winnerCartelaNumber });
        }

        const winResult = checkBingoWin(cartela.pattern, calledNumbers);
        if (!winResult.isWinner) {
            return res.status(400).json({ message: "This cartela is not a winner", cartelaNumber: winnerCartelaNumber, isWinner: false });
        }

        // Financial calculations
        const existingPlayers = await storage.getGamePlayers(gameId);
        const totalCartelas = allCartelaNumbers ? allCartelaNumbers.length : (totalPlayers || 0);
        const actualEntryFee = parseFloat(entryFeePerPlayer?.toString() || '0');
        const totalCollected = totalCartelas * actualEntryFee;

        let winnerPlayer = existingPlayers.find(p => p.cartelaNumbers.includes(winnerCartelaNumber));
        if (!winnerPlayer) {
            winnerPlayer = await storage.addGamePlayer({
                gameId, playerName: `Player ${winnerCartelaNumber}`,
                cartelaNumbers: [winnerCartelaNumber],
                entryFee: actualEntryFee.toString(), isWinner: true
            });
        } else {
            winnerPlayer.isWinner = true;
        }

        // Get shop data for profit calculations
        const shop = await storage.getShop(user.shopId!);
        const shopProfitMargin = shop?.profitMargin ? parseFloat(shop.profitMargin) / 100 : 0.10;
        const adminProfit = totalCollected * shopProfitMargin;
        const prizeAmount = totalCollected * (1 - shopProfitMargin);
        const superAdminCommissionRate = shop?.superAdminCommission ? parseFloat(shop.superAdminCommission) / 100 : 0.20;
        const superAdminCommission = adminProfit * superAdminCommissionRate;

        // Update game status
        await storage.updateGameStatus(gameId, 'completed');

        // Record game history
        const gameHistory = {
            gameId, shopId: user.shopId!, employeeId: userId,
            totalCollected: totalCollected.toFixed(2), prizeAmount: prizeAmount.toFixed(2),
            adminProfit: adminProfit.toFixed(2), superAdminCommission: superAdminCommission.toFixed(2),
            playerCount: totalCartelas,
            winnerName: winnerPlayer.playerName || `Player ${winnerCartelaNumber}`,
            winningCartela: `#${winnerCartelaNumber}`,
            completedAt: new Date()
        };

        const historyRecord = await storage.recordGameHistory(gameHistory);

        // Save super admin commission
        if (superAdminCommission > 0) {
            try {
                const now = new Date();
                const eatDate = new Date(now.getTime() + 3 * 60 * 60 * 1000);
                const dateEAT = eatDate.toISOString().split('T')[0];

                await storage.createSuperAdminRevenue({
                    adminId: user.shopId || user.id,
                    adminName: user.name || 'Unknown Admin',
                    shopId: user.shopId || 1,
                    shopName: `Shop ${user.shopId || 'Unknown'}`,
                    gameId, revenueType: 'game_commission',
                    amount: superAdminCommission.toFixed(2),
                    commissionRate: '20.00',
                    sourceAmount: adminProfit.toFixed(2),
                    description: `Game ${gameId} commission from ${user.name || 'Admin'}`,
                    dateEAT
                });
            } catch (revenueError) {
                console.error('Failed to save super admin revenue:', revenueError);
            }
        }

        // Deduct commission from admin balance
        if (superAdminCommission > 0) {
            try {
                const shopAdmin = await storage.getUserByShopId(user.shopId!);
                if (shopAdmin && shopAdmin.role === 'admin') {
                    const currentBalance = parseFloat(shopAdmin.creditBalance || '0');
                    const newBalance = Math.max(0, currentBalance - superAdminCommission);
                    await storage.updateUserBalance(shopAdmin.id, newBalance.toFixed(2));
                }
            } catch (balanceError) {
                console.error('Failed to deduct commission from admin balance:', balanceError);
            }
        }

        const game = await storage.getGame(gameId);
        res.json({
            game, winner: winnerPlayer,
            financialData: {
                totalCollected: totalCollected.toFixed(2),
                prizeAmount: prizeAmount.toFixed(2),
                adminProfit: adminProfit.toFixed(2),
                superAdminCommission: superAdminCommission.toFixed(2)
            },
            isWinner: true, cartelaNumber: winnerCartelaNumber
        });
    } catch (error) {
        console.error("Declare winner error:", error);
        res.status(500).json({ message: "Failed to declare winner" });
    }
}

// ─── COMPLETE GAME ──────────────────────────────────────────────────
export async function completeGame(req: Request, res: Response) {
    try {
        const userId = (req.session as any)?.userId;
        if (!userId) {
            return res.status(401).json({ message: "Authentication required" });
        }

        const user = await storage.getUser(userId);
        if (!user || user.role !== 'employee') {
            return res.status(403).json({ message: "Employee access required" });
        }

        const gameId = parseInt(req.params.gameId);
        const game = await storage.getGame(gameId);
        if (!game) {
            return res.status(404).json({ message: "Game not found" });
        }

        const { winnerId, winnerName, winningCartela, prizeAmount } = req.body;

        // Reset cartelas
        await storage.resetCartelasForShop(user.shopId!);

        const completedGame = await storage.completeGame(gameId, winnerId, prizeAmount);

        // Check if game history already exists
        try {
            const existingHistory = await storage.getGameHistory(gameId);
            if (!existingHistory) {
                const totalCollected = parseFloat(completedGame.prizePool || "0");
                const prize = parseFloat(prizeAmount || "0");
                const adminProfit = isNaN(totalCollected) || isNaN(prize) ? 0 : totalCollected - prize;

                const dbPlayerCount = await storage.getGamePlayerCount(gameId);
                const shopCartelas = await storage.getCartelasByShop(user.shopId!);
                const collectorMarkedCount = shopCartelas.filter(c => c.collectorId !== null).length;
                const totalPlayerCount = Math.max(dbPlayerCount, collectorMarkedCount);

                await storage.recordGameHistory({
                    gameId, shopId: user.shopId!, employeeId: user.id,
                    totalCollected: completedGame.prizePool || "0.00",
                    prizeAmount: prizeAmount || "0.00",
                    adminProfit: adminProfit.toString(),
                    superAdminCommission: "0.00",
                    playerCount: totalPlayerCount,
                    winnerName, winningCartela
                });
            }
        } catch (historyError) {
            console.log('Game history may already exist, skipping duplicate creation');
        }

        res.json(completedGame);
    } catch (error) {
        console.error("Complete game error:", error);
        res.status(500).json({ message: "Failed to complete game" });
    }
}

// ─── COMPLETE GAME (with manual winner) ─────────────────────────────
export async function completeGameManual(req: Request, res: Response) {
    try {
        const userId = req.session?.userId;
        if (!userId) {
            return res.status(401).json({ message: "Not authenticated" });
        }

        const user = await storage.getUser(userId);
        if (!user || user.role !== 'employee') {
            return res.status(403).json({ message: "Employee access required" });
        }

        const gameId = parseInt(req.params.gameId);
        const { winnerId, winnerName, winningCartela, prizeAmount } = req.body;

        if (!winnerId || !winnerName || !winningCartela || !prizeAmount) {
            return res.status(400).json({ message: "Winner details are required" });
        }

        const game = await storage.completeGame(gameId, winnerId, prizeAmount);

        await storage.recordGameHistory({
            gameId, shopId: user.shopId!, employeeId: userId,
            totalCollected: game.prizePool,
            prizeAmount,
            adminProfit: (parseFloat(game.prizePool) - parseFloat(prizeAmount)).toString(),
            superAdminCommission: '0.00',
            playerCount: await storage.getGamePlayerCount(gameId),
            winnerName, winningCartela,
            completedAt: new Date()
        });

        await storage.processGameProfits(gameId, game.prizePool);

        res.json(game);
    } catch (error) {
        console.error("Complete game error:", error);
        res.status(500).json({ message: "Failed to complete game" });
    }
}

// ─── RESET CARTELAS ─────────────────────────────────────────────────
export async function resetCartelas(req: Request, res: Response) {
    try {
        const userId = req.session?.userId;
        if (!userId) {
            return res.status(401).json({ message: "Not authenticated" });
        }

        const user = await storage.getUser(userId);
        if (!user || !['employee', 'admin', 'collector'].includes(user.role)) {
            return res.status(403).json({ message: "Employee, admin, or collector access required" });
        }

        const shopId = req.body.shopId || user.shopId;

        await storage.resetShopCartelas(shopId);

        if (user.role === 'employee' || user.role === 'admin') {
            const activeGame = await storage.getActiveGameByEmployee(user.id);

            let gameToReset = activeGame;
            if (!activeGame) {
                const recentGames = await storage.getRecentGamesByShop(shopId, 1);
                const completedGame = recentGames.find(g => g.status === 'completed');
                if (completedGame) {
                    gameToReset = completedGame;
                }
            }

            if (gameToReset) {
                if (gameToReset.status !== 'completed') {
                    await storage.updateGameStatus(gameToReset.id, 'completed');
                }

                await storage.createGame({
                    shopId, employeeId: userId, status: 'waiting',
                    prizePool: '0.00', entryFee: gameToReset.entryFee || '20.00',
                    calledNumbers: [], winnerId: null, startedAt: null, completedAt: null
                });
            }
            res.json({ message: "All cartelas and game state reset successfully" });
        } else {
            res.json({ message: "All cartelas reset successfully" });
        }
    } catch (error) {
        console.error("Error resetting cartelas:", error);
        res.status(500).json({ error: "Failed to reset cartelas" });
    }
}

// ─── DEDUCT BALANCE ─────────────────────────────────────────────
export async function deductBalance(req: Request, res: Response) {
    try {
        const userId = (req.session as any)?.userId;
        if (!userId) {
            return res.status(401).json({ message: "Authentication required" });
        }

        const { amount, description, cardCount, cardFee, totalCollected, winnerReward } = req.body;
        if (!amount || parseFloat(amount) <= 0) {
            return res.status(400).json({ error: "Invalid amount" });
        }

        const user = await storage.getUser(userId);
        if (!user) {
            return res.status(404).json({ error: "User not found" });
        }

        const currentBalance = parseFloat(user.balance || "0");
        const deductionAmount = parseFloat(amount);

        if (currentBalance < deductionAmount) {
            return res.status(400).json({ 
                error: "Insufficient balance",
                required: deductionAmount.toFixed(2),
                available: currentBalance.toFixed(2)
            });
        }

        // Deduct amount
        const newBalance = currentBalance - deductionAmount;
        await storage.updateUserBalance(userId, newBalance.toString());

        // Create transaction record with complete game information
        await storage.createTransaction({
            gameId: null,
            userId: userId,
            amount: deductionAmount.toString(),
            type: 'game_fee',
            description: description || `Game fee for ${cardCount || 'unknown'} cards at ${cardFee || 'unknown'} ETB each`,
            metadata: {
                cardCount: cardCount || 0,
                cardFee: cardFee || 0,
                totalCollected: totalCollected || 0,
                winnerReward: winnerReward || 0,
                deductionAmount: deductionAmount
            }
        });

        console.log(`💰 Game fee deducted for user ${userId}:`, {
            previousBalance: currentBalance,
            deductionAmount,
            newBalance,
            cardCount,
            cardFee,
            totalCollected,
            winnerReward,
            description
        });

        res.json({ 
            success: true,
            previousBalance: currentBalance.toFixed(2),
            deductionAmount: deductionAmount.toFixed(2),
            newBalance: newBalance.toFixed(2),
            cardCount,
            cardFee,
            totalCollected,
            winnerReward: parseFloat(winnerReward || 0).toFixed(2)
        });

    } catch (error) {
        console.error("Error deducting balance:", error);
        res.status(500).json({ error: "Failed to deduct balance" });
    }
}
