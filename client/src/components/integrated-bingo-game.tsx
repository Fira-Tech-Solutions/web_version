import { useState, useEffect, useRef } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { apiRequest } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";

interface IntegratedBingoGameProps {
  employeeName: string;
  employeeId: number;
  shopId: number;
  onLogout: () => void;
}

export default function IntegratedBingoGame({ employeeName, employeeId, shopId, onLogout }: IntegratedBingoGameProps) {
  const [calledNumbers, setCalledNumbers] = useState<number[]>([]);
  const [currentNumber, setCurrentNumber] = useState<number | null>(null);
  const [gameActive, setGameActive] = useState(false);
  const [lastCalledLetter, setLastCalledLetter] = useState<string>("");
  const [showCartelaSelector, setShowCartelaSelector] = useState(false);
  const [selectedCartela, setSelectedCartela] = useState<number | null>(null);
  const [cartelaCards, setCartelaCards] = useState<{[key: number]: number[][]}>({});
  const [bookedCartelas, setBookedCartelas] = useState<Set<number>>(new Set());
  const [gameAmount, setGameAmount] = useState("30");
  const [winnerFound, setWinnerFound] = useState<string | null>(null);
  const [winnerPattern, setWinnerPattern] = useState<string | null>(null);
  const [showWinnerVerification, setShowWinnerVerification] = useState(false);
  const [showWinnerDialog, setShowWinnerDialog] = useState(false);
  const [verificationCartela, setVerificationCartela] = useState("");
  const [autoCallInterval, setAutoCallInterval] = useState<NodeJS.Timeout | null>(null);
  const [gameFinished, setGameFinished] = useState(false);
  const [gamePaused, setGamePaused] = useState(false);
  const [totalCollected, setTotalCollected] = useState(0);
  const [finalPrizeAmount, setFinalPrizeAmount] = useState<number | null>(null);
  const [activeGameId, setActiveGameId] = useState<number | null>(null);
  const [gamePlayersMap, setGamePlayersMap] = useState<Map<number, number>>(new Map());
  const [autoplaySpeed, setAutoplaySpeed] = useState(3000);
  const [isCallingNumber, setIsCallingNumber] = useState(false);
  
  // Refs to track real-time state for closures
  const gameActiveRef = useRef(false);
  const gamePausedRef = useRef(false);
  const gameFinishedRef = useRef(false);
  const winnerFoundRef = useRef(false);
  const automaticCallTimeoutRef = useRef<NodeJS.Timeout | null>(null);
  const calledNumbersRef = useRef<number[]>([]);
  const activeGameIdRef = useRef<number | null>(null);
  const isCallingNumberRef = useRef(false);
  
  const { toast } = useToast();
  const queryClient = useQueryClient();
  
  // Fetch ALL shops and find the employee's shop for real-time profit margin
  const { data: allShops } = useQuery({
    queryKey: ["/api/shops"],
    refetchInterval: 1000,
    refetchIntervalInBackground: true,
    staleTime: 0,
  });

  // Find the specific shop data for this employee
  const shopData = Array.isArray(allShops) ? allShops.find((shop: any) => shop.id === shopId) : null;

  // Create game mutation
  const createGameMutation = useMutation({
    mutationFn: async () => {
      console.log("🌐 Creating backend game with data:", {
        shopId,
        employeeId,
        status: 'waiting',
        entryFee: gameAmount,
        prizePool: "0.00"
      });
      const response = await apiRequest("POST", "/api/games", {
        shopId,
        employeeId,
        status: 'waiting',
        entryFee: gameAmount,
        prizePool: "0.00"
      });
      const game = await response.json();
      console.log("✅ Backend game created successfully:", game);
      return game;
    },
    onSuccess: (game: any) => {
      setActiveGameId(game.id);
      console.log("🎮 Set activeGameId to:", game.id);
    }
  });

  // Start game mutation
  const startGameMutation = useMutation({
    mutationFn: async (gameId: number) => {
      return await apiRequest("POST", `/api/games/${gameId}/start`);
    },
    onSuccess: () => {
      console.log("Game started successfully");
    }
  });

  // Add player mutation
  const addPlayerMutation = useMutation({
    mutationFn: async (data: { gameId: number; cartelaNumbers: number[]; playerName: string }) => {
      console.log("🔍 Player mutation called with:", data);
      console.log("🔍 Current activeGameId state:", activeGameId);
      if (!data.gameId || data.gameId === undefined || isNaN(data.gameId)) {
        throw new Error(`Invalid gameId: ${data.gameId}`);
      }
      const response = await apiRequest("POST", `/api/games/${data.gameId}/players`, {
        playerName: data.playerName,
        cartelaNumbers: data.cartelaNumbers,
        entryFee: gameAmount
      });
      const player = await response.json();
      return player;
    },
    onSuccess: (player, variables) => {
      // Map ALL cartela numbers to this player ID, not just the first one
      setGamePlayersMap(prev => {
        const newMap = new Map(prev);
        variables.cartelaNumbers.forEach(cartelaNum => {
          newMap.set(cartelaNum, player.id);
          console.log(`Mapped cartela #${cartelaNum} to player ID ${player.id}`);
        });
        return newMap;
      });
      console.log("Player added:", player, "for cartelas:", variables.cartelaNumbers);
    }
  });

  // Update game prize pool mutation
  const updateGameMutation = useMutation({
    mutationFn: async (data: { gameId: number; prizePool: string }) => {
      return await apiRequest("PATCH", `/api/games/${data.gameId}`, {
        prizePool: data.prizePool
      });
    }
  });

  // End game without winner mutation
  const endGameWithoutWinnerMutation = useMutation({
    mutationFn: async (gameId: number) => {
      const response = await apiRequest("POST", `/api/games/${gameId}/end-without-winner`);
      const result = await response.json();
      return result;
    },
    onSuccess: (result) => {
      toast({
        title: "Game Ended",
        description: "Game ended without winner - no revenue recorded",
      });
      
      // Reset game state
      setActiveGameId(null);
      setGamePlayersMap(new Map());
      setBookedCartelas(new Set());
      setTotalCollected(0);
      setGameActive(false);
      setGameFinished(true);
    },
    onError: (error) => {
      toast({
        title: "Error",
        description: `Failed to end game: ${error.message}`,
        variant: "destructive"
      });
    }
  });

  // Declare winner mutation
  const declareWinnerMutation = useMutation({
    mutationFn: async (data: { gameId: number; winnerId: number; winnerCartela?: number }) => {
      const response = await apiRequest("POST", `/api/games/${data.gameId}/declare-winner`, {
        winnerId: data.winnerId,
        winnerCartela: data.winnerCartela
      });
      const result = await response.json();
      return result;
    },
    onSuccess: (result) => {
      toast({
        title: "Game Completed Successfully!",
        description: `Winner gets ${result.financial.prizeAmount} ETB. Admin profit: ${result.financial.adminProfit} ETB. Commission: ${result.financial.superAdminCommission} ETB deducted.`,
      });
      
      // End game properly - keep cartelas but mark as finished
      setGameActive(false);
      setGameFinished(true);
      setShowWinnerVerification(false);
      
      // Update refs to stop all processes
      gameActiveRef.current = false;
      gameFinishedRef.current = true;
      isCallingNumberRef.current = false;
      
      // Stop any automatic calling
      stopAutomaticNumberCalling();
    },
    onError: (error) => {
      toast({
        title: "Error",
        description: `Failed to declare winner: ${error.message}`,
        variant: "destructive"
      });
    }
  });

  // Stop automatic number calling
  const stopAutomaticNumberCalling = () => {
    if (automaticCallTimeoutRef.current) {
      clearTimeout(automaticCallTimeoutRef.current);
      automaticCallTimeoutRef.current = null;
    }
    setAutoCallInterval(null);
  };

  // Seeded random number generator for consistent cartelas
  const seededRandom = (min: number, max: number, seed: number): number => {
    const x = Math.sin(seed) * 10000;
    const random = x - Math.floor(x);
    return Math.floor(random * (max - min + 1)) + min;
  };

  // Generate fixed cartela based on number
  const generateFixedCartela = (cartelaNumber: number): number[][] => {
    const cartela: number[][] = [];
    const usedNumbers = new Set<number>();
    
    for (let col = 0; col < 5; col++) {
      const column: number[] = [];
      const min = col * 15 + 1;
      const max = (col + 1) * 15;
      
      for (let row = 0; row < 5; row++) {
        if (col === 2 && row === 2) {
          column.push(0); // FREE space
        } else {
          let num;
          let attempts = 0;
          do {
            num = seededRandom(min, max, col * 5 + row + attempts * 25);
            attempts++;
          } while (usedNumbers.has(num) && attempts < 50);
          
          usedNumbers.add(num);
          column.push(num);
        }
      }
      cartela.push(column);
    }

    // Transpose to get row-major format
    const transposed: number[][] = [];
    for (let row = 0; row < 5; row++) {
      transposed.push([]);
      for (let col = 0; col < 5; col++) {
        transposed[row].push(cartela[col][row]);
      }
    }
    
    return transposed;
  };

  // Backward compatibility wrapper - generates random cartela
  const generateCartela = () => generateFixedCartela(Math.floor(Math.random() * 100) + 1);

  // Generate random cartela number
  const generateCartelaNumber = () => {
    let cartelaNum;
    do {
      cartelaNum = Math.floor(Math.random() * 100) + 1;
    } while (cartelaCards[cartelaNum] || bookedCartelas.has(cartelaNum));
    return cartelaNum;
  };

  // Show cartela selector with full grid
  const showCartelaSelectorDialog = () => {
    setShowCartelaSelector(true);
  };

  // Select a specific cartela number
  const selectCartela = (cartelaNumber: number) => {
    setSelectedCartela(cartelaNumber);
    setCartelaCards(prev => ({
      ...prev,
      [cartelaNumber]: generateCartela()
    }));
  };

  // Book a cartela for the game
  const bookCartela = async () => {
    if (selectedCartela !== null) {
      try {
        let gameId = activeGameId;
        
        // Create game if none exists
        if (!gameId) {
          console.log("🎮 Creating new backend game for cartela booking");
          const game = await createGameMutation.mutateAsync();
          gameId = game.id;
          setActiveGameId(game.id);
          console.log("✅ Backend game created with ID:", gameId);
        }
        
        // Add player to the game
        console.log(`📝 Adding player for cartela #${selectedCartela} to game ${gameId}`);
        const player = await addPlayerMutation.mutateAsync({
          gameId: gameId,
          cartelaNumbers: [selectedCartela],
          playerName: `Player ${selectedCartela}`
        });

        setBookedCartelas(prev => new Set([...Array.from(prev), selectedCartela]));
        const newTotal = totalCollected + parseInt(gameAmount);
        setTotalCollected(newTotal);
        
        console.log(`✅ Game ${gameId}: Added player ${player.id} with cartela ${selectedCartela} for ${gameAmount} ETB`);
        console.log("Current gamePlayersMap after booking:", Array.from(gamePlayersMap.entries()));
        
        setShowCartelaSelector(false);
        setSelectedCartela(null);
        
        toast({
          title: "Cartela Booked!",
          description: `Cartela #${selectedCartela} booked for ${gameAmount} ETB`,
        });
      } catch (error) {
        console.error("❌ Failed to book cartela:", error);
        toast({
          title: "Error",
          description: "Failed to book cartela",
          variant: "destructive",
        });
      }
    }
  };

  // Start the game
  const startGame = async () => {
    try {
      let gameId = activeGameId;
      
      // Create game if none exists
      if (!gameId) {
        const game = await createGameMutation.mutateAsync();
        gameId = game.id;
      }
      
      // Start the game in the backend
      await startGameMutation.mutateAsync(gameId);
      
      // Update the prize pool with current collected amount
      const prizePool = (totalCollected * 0.8).toFixed(2);
      await updateGameMutation.mutateAsync({
        gameId: gameId,
        prizePool: prizePool
      });
      
      setFinalPrizeAmount(parseFloat(prizePool));
      setGameActive(true);
      setGameFinished(false);
      setGamePaused(false);
      
      // Update refs
      gameActiveRef.current = true;
      gameFinishedRef.current = false;
      gamePausedRef.current = false;
      activeGameIdRef.current = gameId;
      
      toast({
        title: "Game Started!",
        description: `Prize Pool: ${prizePool} ETB`,
      });
    } catch (error) {
      console.error("Failed to start game:", error);
      toast({
        title: "Error",
        description: "Failed to start game",
        variant: "destructive",
      });
    }
  };

  // Get letter for number
  const getLetterForNumber = (num: number): string => {
    if (num >= 1 && num <= 15) return "B";
    if (num >= 16 && num <= 30) return "I";
    if (num >= 31 && num <= 45) return "N";
    if (num >= 46 && num <= 60) return "G";
    if (num >= 61 && num <= 75) return "O";
    return "";
  };

  // Call next number
  const callNextNumber = () => {
    if (calledNumbers.length >= 75) {
      // All numbers called - pause game for manual verification
      setGamePaused(true);
      gamePausedRef.current = true;
      stopAutomaticNumberCalling();
      
      toast({
        title: "All Numbers Called!",
        description: "Game paused - check for winners manually",
      });
      return;
    }

    const availableNumbers = Array.from({ length: 75 }, (_, i) => i + 1)
      .filter(num => !calledNumbers.includes(num));
    
    if (availableNumbers.length === 0) return;

    const nextNumber = availableNumbers[Math.floor(Math.random() * availableNumbers.length)];
    const letter = getLetterForNumber(nextNumber);
    
    setCurrentNumber(nextNumber);
    setLastCalledLetter(letter);
    setCalledNumbers(prev => [...prev, nextNumber]);
    calledNumbersRef.current = [...calledNumbers, nextNumber];
    
    // Play audio
    playNumberAudio(letter, nextNumber);
  };

  // Play audio for called number
  const playNumberAudio = (letter: string, number: number) => {
    try {
      const audioFile = `${letter}${number}.mp3`;
      const audio = new Audio(`/audio/${audioFile}`);
      audio.play().catch(err => console.log("Audio playback failed:", err));
    } catch (error) {
      console.log("Audio file not found or failed to play");
    }
  };

  // Start automatic calling
  const startAutomaticCalling = () => {
    if (gameActiveRef.current && !gamePausedRef.current && !gameFinishedRef.current) {
      automaticCallTimeoutRef.current = setTimeout(() => {
        callNextNumber();
        startAutomaticCalling(); // Recursive call for continuous calling
      }, autoplaySpeed);
    }
  };

  // Pause game
  const pauseGame = () => {
    setGamePaused(true);
    gamePausedRef.current = true;
    stopAutomaticNumberCalling();
  };

  // Resume game
  const resumeGame = () => {
    setGamePaused(false);
    gamePausedRef.current = false;
    startAutomaticCalling();
  };

  // End game
  const endGame = async () => {
    setGameActive(false);
    setGameFinished(true);
    
    gameActiveRef.current = false;
    gameFinishedRef.current = true;
    
    stopAutomaticNumberCalling();
    
    // End game in backend without winner
    if (activeGameId) {
      try {
        await endGameWithoutWinnerMutation.mutateAsync(activeGameId);
      } catch (error) {
        console.error("Failed to end game in backend:", error);
      }
    }
  };

  // Reset game
  const resetGame = () => {
    setCalledNumbers([]);
    setCurrentNumber(null);
    setGameActive(false);
    setGameFinished(false);
    setGamePaused(false);
    setWinnerFound(null);
    setWinnerPattern(null);
    setShowWinnerVerification(false);
    setBookedCartelas(new Set());
    setCartelaCards({});
    setTotalCollected(0);
    setFinalPrizeAmount(null);
    setActiveGameId(null);
    setGamePlayersMap(new Map());
    
    // Reset refs
    gameActiveRef.current = false;
    gameFinishedRef.current = false;
    gamePausedRef.current = false;
    winnerFoundRef.current = false;
    calledNumbersRef.current = [];
    activeGameIdRef.current = null;
    
    stopAutomaticNumberCalling();
  };

  // Handle winner verification
  const handleWinnerVerification = () => {
    setShowWinnerVerification(true);
  };

  // Verify and declare winner
  const verifyAndDeclareWinner = async () => {
    if (!verificationCartela.trim()) {
      toast({
        title: "Error",
        description: "Please enter cartela number",
        variant: "destructive"
      });
      return;
    }

    const cartelaNum = parseInt(verificationCartela);
    const playerId = gamePlayersMap.get(cartelaNum);
    
    if (!playerId) {
      toast({
        title: "Error",
        description: "Cartela not found in this game",
        variant: "destructive"
      });
      return;
    }

    if (!activeGameId) {
      toast({
        title: "Error",
        description: "No active game found",
        variant: "destructive"
      });
      return;
    }

    try {
      await declareWinnerMutation.mutateAsync({
        gameId: activeGameId,
        winnerId: playerId,
        winnerCartela: cartelaNum
      });
      
      setVerificationCartela("");
    } catch (error) {
      console.error("Failed to declare winner:", error);
    }
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-purple-900 via-blue-900 to-indigo-900 p-4">
      <div className="max-w-7xl mx-auto">
        {/* Header */}
        <div className="flex justify-between items-center mb-6">
          <div>
            <h1 className="text-3xl font-bold text-white">Bingo Game System</h1>
            <p className="text-purple-200">Employee: {employeeName}</p>
            {shopData && (
              <p className="text-purple-200">
                Shop: {shopData.name} | Profit Margin: {shopData.profitMargin}%
              </p>
            )}
          </div>
          <Button onClick={onLogout} variant="outline" className="text-purple-900">
            Logout
          </Button>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {/* Game Control Panel */}
          <div className="lg:col-span-2">
            <Card className="bg-white/10 border-purple-300/30">
              <CardHeader>
                <CardTitle className="text-white">Game Control</CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                {/* Game Settings */}
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="block text-sm font-medium text-purple-200 mb-1">
                      Game Amount (ETB)
                    </label>
                    <Input
                      type="number"
                      value={gameAmount}
                      onChange={(e) => setGameAmount(e.target.value)}
                      disabled={gameActive}
                      className="bg-white/20 border-purple-300/50 text-white placeholder-purple-200"
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-purple-200 mb-1">
                      Auto Speed (ms)
                    </label>
                    <Input
                      type="number"
                      value={autoplaySpeed}
                      onChange={(e) => setAutoplaySpeed(parseInt(e.target.value))}
                      min="1000"
                      max="10000"
                      step="500"
                      className="bg-white/20 border-purple-300/50 text-white placeholder-purple-200"
                    />
                  </div>
                </div>

                {/* Current Number Display */}
                {currentNumber && (
                  <div className="text-center py-8">
                    <div className="text-6xl font-bold text-yellow-400 mb-2">
                      {lastCalledLetter}{currentNumber}
                    </div>
                    <Badge variant="secondary" className="text-lg px-4 py-2">
                      Latest Called Number
                    </Badge>
                  </div>
                )}

                {/* Game Controls */}
                <div className="flex flex-wrap gap-2">
                  {!gameActive && !gameFinished && (
                    <>
                      <Button 
                        onClick={showCartelaSelectorDialog}
                        className="bg-green-600 hover:bg-green-700"
                      >
                        Book Cartela
                      </Button>
                      <Button 
                        onClick={startGame}
                        disabled={bookedCartelas.size === 0}
                        className="bg-blue-600 hover:bg-blue-700"
                      >
                        Start Game
                      </Button>
                    </>
                  )}
                  
                  {gameActive && !gamePaused && (
                    <>
                      <Button onClick={callNextNumber} className="bg-orange-600 hover:bg-orange-700">
                        Call Number
                      </Button>
                      <Button onClick={pauseGame} className="bg-yellow-600 hover:bg-yellow-700">
                        Pause
                      </Button>
                      <Button onClick={endGame} className="bg-red-600 hover:bg-red-700">
                        End Game
                      </Button>
                      <Button 
                        onClick={startAutomaticCalling}
                        className="bg-purple-600 hover:bg-purple-700"
                      >
                        Auto Play
                      </Button>
                    </>
                  )}
                  
                  {gameActive && gamePaused && (
                    <>
                      <Button onClick={resumeGame} className="bg-green-600 hover:bg-green-700">
                        Resume
                      </Button>
                      <Button onClick={callNextNumber} className="bg-orange-600 hover:bg-orange-700">
                        Call Number
                      </Button>
                      <Button onClick={endGame} className="bg-red-600 hover:bg-red-700">
                        End Game
                      </Button>
                    </>
                  )}

                  {(gameActive || gamePaused) && (
                    <Button 
                      onClick={handleWinnerVerification}
                      className="bg-emerald-600 hover:bg-emerald-700"
                    >
                      Declare Winner
                    </Button>
                  )}
                  
                  {gameFinished && (
                    <Button onClick={resetGame} className="bg-indigo-600 hover:bg-indigo-700">
                      New Game
                    </Button>
                  )}
                </div>

                {/* Game Stats */}
                <div className="grid grid-cols-4 gap-4 mt-4">
                  <div className="text-center">
                    <div className="text-2xl font-bold text-white">{bookedCartelas.size}</div>
                    <div className="text-sm text-purple-200">Cartelas</div>
                  </div>
                  <div className="text-center">
                    <div className="text-2xl font-bold text-white">{totalCollected}</div>
                    <div className="text-sm text-purple-200">Collected ETB</div>
                  </div>
                  <div className="text-center">
                    <div className="text-2xl font-bold text-white">{calledNumbers.length}</div>
                    <div className="text-sm text-purple-200">Numbers Called</div>
                  </div>
                  <div className="text-center">
                    <div className="text-2xl font-bold text-white">
                      {finalPrizeAmount || (totalCollected * 0.8).toFixed(0)}
                    </div>
                    <div className="text-sm text-purple-200">Prize ETB</div>
                  </div>
                </div>
              </CardContent>
            </Card>

            {/* Called Numbers Grid */}
            <Card className="bg-white/10 border-purple-300/30 mt-6">
              <CardHeader>
                <CardTitle className="text-white">Called Numbers</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="grid grid-cols-15 gap-1 text-sm">
                  {Array.from({ length: 75 }, (_, i) => i + 1).map(num => (
                    <div
                      key={num}
                      className={`p-2 text-center rounded ${
                        calledNumbers.includes(num)
                          ? 'bg-red-500 text-white'
                          : 'bg-white/20 text-purple-200'
                      }`}
                    >
                      {num}
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>
          </div>

          {/* Booked Cartelas */}
          <div>
            <Card className="bg-white/10 border-purple-300/30">
              <CardHeader>
                <CardTitle className="text-white">Booked Cartelas</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="space-y-2 max-h-96 overflow-y-auto">
                  {Array.from(bookedCartelas).map(cartelaNum => (
                    <div key={cartelaNum} className="bg-white/20 p-2 rounded">
                      <div className="font-bold text-white">Cartela #{cartelaNum}</div>
                      <div className="text-xs text-purple-200">{gameAmount} ETB</div>
                    </div>
                  ))}
                  {bookedCartelas.size === 0 && (
                    <div className="text-center text-purple-200 py-8">
                      No cartelas booked yet
                    </div>
                  )}
                </div>
              </CardContent>
            </Card>
          </div>
        </div>

        {/* Cartela Selector Dialog */}
        <Dialog open={showCartelaSelector} onOpenChange={setShowCartelaSelector}>
          <DialogContent className="max-w-6xl max-h-[90vh] overflow-y-auto">
            <DialogHeader>
              <DialogTitle>Select Cartela Number (1-100)</DialogTitle>
              <DialogDescription>
                Choose a cartela number to book for {gameAmount} ETB
              </DialogDescription>
            </DialogHeader>
            <div className="grid grid-cols-10 gap-2 p-4">
              {Array.from({ length: 100 }, (_, i) => i + 1).map(num => {
                const isBooked = bookedCartelas.has(num);
                return (
                  <Button
                    key={num}
                    variant={selectedCartela === num ? "default" : "outline"}
                    size="sm"
                    disabled={isBooked}
                    className={`h-12 ${
                      isBooked 
                        ? 'bg-red-500 text-white opacity-50' 
                        : selectedCartela === num 
                          ? 'bg-blue-600 text-white' 
                          : 'hover:bg-blue-100'
                    }`}
                    onClick={() => selectCartela(num)}
                  >
                    {num}
                  </Button>
                );
              })}
            </div>
            <div className="flex justify-between p-4">
              <Button variant="outline" onClick={() => setShowCartelaSelector(false)}>
                Cancel
              </Button>
              <Button 
                onClick={bookCartela}
                disabled={selectedCartela === null}
                className="bg-green-600 hover:bg-green-700"
              >
                Book Cartela #{selectedCartela} for {gameAmount} ETB
              </Button>
            </div>
          </DialogContent>
        </Dialog>

        {/* Winner Verification Dialog */}
        <Dialog open={showWinnerVerification} onOpenChange={setShowWinnerVerification}>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Declare Winner</DialogTitle>
              <DialogDescription>
                Enter the cartela number of the winner for manual verification
              </DialogDescription>
            </DialogHeader>
            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium mb-1">
                  Winner Cartela Number
                </label>
                <Input
                  type="number"
                  value={verificationCartela}
                  onChange={(e) => setVerificationCartela(e.target.value)}
                  placeholder="Enter cartela number"
                  min="1"
                  max="100"
                />
              </div>
              <div className="flex justify-between">
                <Button 
                  variant="outline" 
                  onClick={() => setShowWinnerVerification(false)}
                >
                  Cancel
                </Button>
                <Button 
                  onClick={verifyAndDeclareWinner}
                  className="bg-green-600 hover:bg-green-700"
                  disabled={declareWinnerMutation.isPending}
                >
                  {declareWinnerMutation.isPending ? "Processing..." : "Declare Winner"}
                </Button>
              </div>
            </div>
          </DialogContent>
        </Dialog>
      </div>
    </div>
  );
}