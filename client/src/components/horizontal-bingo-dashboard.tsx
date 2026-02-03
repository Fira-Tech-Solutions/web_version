import { useState, useEffect, useRef } from 'react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { Checkbox } from '@/components/ui/checkbox';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useToast } from '@/hooks/use-toast';

interface User {
  id: number;
  username: string;
  role: string;
  name?: string;
  shopId?: number;
}

interface BingoHorizontalDashboardProps {
  onLogout: () => void;
}

export default function BingoHorizontalDashboard({ onLogout }: BingoHorizontalDashboardProps) {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  
  // State variables
  const [gameAmount, setGameAmount] = useState("20");
  const [autoplaySpeed, setAutoplaySpeed] = useState(4); // Default balanced for all voices with dynamic audio speed
  const [selectedCartelas, setSelectedCartelas] = useState<Set<number>>(new Set());
  const [calledNumbers, setCalledNumbers] = useState<number[]>([]);
  const [lastCalledNumber, setLastCalledNumber] = useState<number | null>(null);
  const [gameActive, setGameActive] = useState(false);
  const [gameFinished, setGameFinished] = useState(false);
  const [showCartelaSelector, setShowCartelaSelector] = useState(false);
  const [bookedCartelas, setBookedCartelas] = useState<Set<number>>(new Set());
  const [autoCallInterval, setAutoCallInterval] = useState<NodeJS.Timeout | null>(null);
  const [currentGame, setCurrentGame] = useState<any>(null);
  const [showWinnerChecker, setShowWinnerChecker] = useState(false);
  const [winnerCartelaNumber, setWinnerCartelaNumber] = useState("");
  const [showWinnerModal, setShowWinnerModal] = useState(false);
  const [winnerResult, setWinnerResult] = useState<{isWinner: boolean, cartelaNumber: number} | null>(null);
  const [isShuffling, setIsShuffling] = useState(false);
  const [gameStartCartelaCount, setGameStartCartelaCount] = useState(0);
  const [gameStartEntryFee, setGameStartEntryFee] = useState("20");

  // Game state ref for reliable interval access
  const gameStateRef = useRef({
    active: false,
    calledNumbers: [] as number[],
    finished: false
  });

  // Fetch current user
  const { data: user } = useQuery({
    queryKey: ['/api/auth/me'],
  }) as { data: { id: number; shopId: number; role: string } | undefined };

  // Fetch admin stats for profit margin
  const { data: adminStats } = useQuery({
    queryKey: ['/api/admin/shop-stats'],
    refetchInterval: 5000,
  });

  // Fetch active game
  const { data: activeGame } = useQuery({
    queryKey: ['/api/games/active'],
    refetchInterval: 2000,
  });

  // Fetch cartelas to get collector-marked ones
  const { data: cartelas } = useQuery({
    queryKey: [`/api/cartelas/${user?.shopId}`],
    enabled: !!user?.shopId,
    refetchInterval: 2000,
  });

  // Update bookedCartelas to include both collector-marked and employee-booked cartelas
  useEffect(() => {
    if (cartelas) {
      console.log('🔍 HORIZONTAL DASHBOARD: Raw cartelas data sample:', cartelas?.slice(0, 10));
      
      // Create a single set to avoid double-counting cartelas that have both collector and employee markings
      const allBookedCartelas = (cartelas as any[])
        .filter((c: any) => {
          const hasCollector = c.collectorId !== null && c.collectorId !== undefined;
          const hasEmployee = c.bookedBy !== null && c.bookedBy !== undefined;
          const isMarked = hasCollector || hasEmployee;
          
          if (isMarked) {
            const source = hasCollector ? 'collector' : 'employee';
            const dualMarked = hasCollector && hasEmployee ? ' (DUAL-MARKED)' : '';
            console.log(`✅ Marked cartela found: #${c.cartelaNumber} by ${source}${dualMarked}`);
          }
          
          return isMarked;
        })
        .map((c: any) => c.cartelaNumber);
      
      console.log('🎯 HORIZONTAL DASHBOARD: All marked cartelas (no duplicates):', allBookedCartelas);
      console.log('🎯 HORIZONTAL DASHBOARD: Final bookedCartelas set size:', allBookedCartelas.length);
      
      setBookedCartelas(new Set(allBookedCartelas));
    }
  }, [cartelas]);

  // Calculate values
  const adminProfitMargin = (adminStats as any)?.commissionRate || 30;
  const totalCartelasCount = bookedCartelas.size; // bookedCartelas now includes both collector and employee cartelas
  const totalCollected = totalCartelasCount * parseFloat(gameAmount || "0");
  const prizeAmount = totalCollected * (100 - adminProfitMargin) / 100;

  // Helper function to get letter for number
  const getLetterForNumber = (num: number): string => {
    if (num <= 15) return 'B';
    if (num <= 30) return 'I';
    if (num <= 45) return 'N';
    if (num <= 60) return 'G';
    return 'O';
  };

  // Toggle cartela selection
  const toggleCartelaSelection = (num: number) => {
    const newSelected = new Set(selectedCartelas);
    if (newSelected.has(num)) {
      newSelected.delete(num);
    } else {
      newSelected.add(num);
    }
    setSelectedCartelas(newSelected);
  };

  // Create game mutation
  const createGameMutation = useMutation({
    mutationFn: async (data: { shopId: number; employeeId: number; entryFee: string }) => {
      const response = await fetch('/api/games', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(data),
        credentials: 'include'
      });
      if (!response.ok) throw new Error('Failed to create game');
      return response.json();
    },
    onSuccess: (newGame) => {
      setCurrentGame(newGame);
      toast({
        title: "Game Created",
        description: `New game started with ID: ${newGame.id}`,
      });
      queryClient.invalidateQueries({ queryKey: ['/api/games/active'] });
    }
  });

  // Add players mutation
  const addPlayersMutation = useMutation({
    mutationFn: async (data: { gameId: number; playerName: string; cartelaNumbers: number[]; entryFee: string }) => {
      const response = await fetch(`/api/games/${data.gameId}/players`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(data),
        credentials: 'include'
      });
      if (!response.ok) throw new Error('Failed to add players');
      return response.json();
    },
    onSuccess: () => {
      toast({
        title: "Cartelas Booked",
        description: `Successfully booked cartelas in backend`,
      });
    }
  });

  // Start game mutation
  const startGameMutation = useMutation({
    mutationFn: async (gameId: number) => {
      const response = await fetch(`/api/games/${gameId}/start`, {
        method: 'PATCH',
        credentials: 'include'
      });
      if (!response.ok) throw new Error('Failed to start game');
      return response.json();
    },
    onSuccess: () => {
      setGameActive(true);
      startAutoCall();
      toast({
        title: "Game Started",
        description: "Bingo game is now active!",
      });
      queryClient.invalidateQueries({ queryKey: ['/api/games/active'] });
    }
  });

  // Update numbers mutation
  const updateNumbersMutation = useMutation({
    mutationFn: async (data: { gameId: number; calledNumbers: number[] }) => {
      const response = await fetch(`/api/games/${data.gameId}/numbers`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ calledNumbers: data.calledNumbers }),
        credentials: 'include'
      });
      if (!response.ok) throw new Error('Failed to update numbers');
      return response.json();
    }
  });

  // Check winner mutation
  const checkWinnerMutation = useMutation({
    mutationFn: async (data: { gameId: number; cartelaNumber: number; calledNumbers: number[] }) => {
      // Get game players to determine actual player count
      console.log('🔍 Fetching game players for Game ' + data.gameId);
      const playersResponse = await fetch(`/api/games/${data.gameId}/players`, {
        credentials: 'include'
      });
      
      // Always use total cartelas (employee + collector) for accurate player count
      let actualPlayerCount = bookedCartelas.size; // bookedCartelas now includes both collector and employee cartelas
      let actualEntryFee = parseFloat(gameAmount || "20");
      
      if (playersResponse.ok) {
        const players = await playersResponse.json();
        console.log('🔍 PLAYERS RESPONSE:', players);
        if (players.length > 0) {
          actualEntryFee = parseFloat(players[0].entryFee || "20");
        }
        console.log('✅ USING CORRECT TOTAL COUNT:', {
          totalCartelas: actualPlayerCount,
          bookedCartelasSize: bookedCartelas.size,
          entryFeeFromDB: actualEntryFee,
          totalCollected: actualPlayerCount * actualEntryFee,
          dbPlayerRecords: players.length
        });
      } else {
        console.log('❌ PLAYERS FETCH FAILED, using cartela count:', {
          totalCartelas: actualPlayerCount,
          fallbackFee: actualEntryFee
        });
      }
      
      const totalCollectedAmount = actualPlayerCount * actualEntryFee;
      
      console.log('🎯 DECLARING WINNER: Cartela #' + data.cartelaNumber + ' in Game ' + data.gameId);
      console.log('📊 FINAL FINANCIAL DATA:', {
        actualPlayerCount,
        actualEntryFee,
        totalCollectedAmount,
        note: 'Prize amount will be calculated by backend using actual shop profit margin'
      });
      
      const requestBody = {
        winnerCartelaNumber: data.cartelaNumber,
        totalPlayers: actualPlayerCount,
        allCartelaNumbers: Array.from(bookedCartelas), // bookedCartelas now includes both collector and employee cartelas
        entryFeePerPlayer: actualEntryFee,
        calledNumbers: calledNumbers
      };
      
      console.log('🚀 SENDING DECLARE WINNER REQUEST:', {
        url: `/api/games/${data.gameId}/declare-winner`,
        method: 'POST',
        body: requestBody
      });
      
      let response;
      try {
        response = await fetch(`/api/games/${data.gameId}/declare-winner`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(requestBody),
          credentials: 'include'
        });
      } catch (fetchError) {
        console.error('❌ FETCH ERROR:', fetchError);
        throw new Error(`Network error: ${fetchError.message}`);
      }
      
      console.log('📡 DECLARE WINNER RESPONSE STATUS:', response.status, response.statusText);
      
      if (!response.ok) {
        const errorText = await response.text();
        console.error('❌ Declare winner error response:', errorText);
        throw new Error(`HTTP ${response.status}: ${errorText}`);
      }
      
      const result = await response.json();
      console.log('✅ WINNER SUCCESSFULLY LOGGED TO GAME HISTORY:', result);
      return result;
    },
    onSuccess: (result) => {
      setShowWinnerChecker(false);
      setWinnerCartelaNumber("");
      
      if (result.isWinner) {
        // Show winner modal
        setWinnerResult({ isWinner: true, cartelaNumber: result.cartelaNumber });
        setShowWinnerModal(true);
      } else {
        // Show non-winner modal and auto-resume after 3 seconds
        setWinnerResult({ isWinner: false, cartelaNumber: result.cartelaNumber });
        setShowWinnerModal(true);
        setTimeout(() => {
          setShowWinnerModal(false);
          if (!gameActive && !gameFinished) {
            resumeGame();
          }
        }, 3000);
      }
    },
    onError: (error) => {
      console.error('❌ CHECK WINNER MUTATION ERROR:', error);
      console.error('❌ ERROR DETAILS:', {
        message: error.message,
        stack: error.stack,
        name: error.name
      });
      toast({
        title: "Error Checking Winner",
        description: `Failed to check winner: ${error.message}`,
        variant: "destructive"
      });
    }
  });

  // Calculate prize amount based on booked cartelas
  const calculatePrizeAmount = () => {
    const totalCollected = bookedCartelas.size * parseFloat(gameAmount || "20");
    const profitMargin = 0.15; // 15% profit margin
    const prizeAmount = totalCollected * (1 - profitMargin);
    return Math.round(prizeAmount);
  };

  // Game functions
  const startNewGame = async () => {
    if (!(user as any)?.shopId || bookedCartelas.size === 0) return;
    
    // Preserve original cartela count and entry fee for accurate financial tracking
    setGameStartCartelaCount(bookedCartelas.size);
    setGameStartEntryFee(gameAmount);
    
    console.log('🎮 GAME START - Preserving financial data:', {
      cartelaCount: bookedCartelas.size,
      entryFee: gameAmount,
      totalExpected: bookedCartelas.size * parseFloat(gameAmount)
    });
    
    const newGame = await createGameMutation.mutateAsync({
      shopId: (user as any).shopId,
      employeeId: (user as any).id,
      entryFee: gameAmount
    });

    // Add players
    await addPlayersMutation.mutateAsync({
      gameId: newGame.id,
      playerName: `Player-${Date.now()}`,
      cartelaNumbers: Array.from(bookedCartelas),
      entryFee: gameAmount
    });

    // Start the game
    await startGameMutation.mutateAsync(newGame.id);
  };

  const bookSelectedCartelas = async () => {
    if (selectedCartelas.size === 0) {
      console.log('❌ No cartelas selected for booking');
      return;
    }
    
    console.log('🎯 BOOKING CARTELAS:', {
      selectedCount: selectedCartelas.size,
      cartelas: Array.from(selectedCartelas),
      currentGame: currentGame?.id
    });
    
    try {
      let gameId = currentGame?.id;
      
      // Create game first if it doesn't exist
      if (!gameId) {
        console.log('🎮 Creating backend game for cartela booking');
        const game = await createGameMutation.mutateAsync({ 
          shopId: user?.shopId || 0, 
          employeeId: user?.id || 0, 
          entryFee: gameAmount || "20" 
        });
        setCurrentGame(game);
        gameId = game.id;
        console.log('✅ Backend game created with ID:', gameId);
      }
      
      // CRITICAL: Create player records in backend
      console.log('📝 CALLING ADD PLAYERS API for game', gameId);
      console.log('📝 Selected cartelas for booking:', Array.from(selectedCartelas));
      
      const playerData = {
        gameId,
        playerName: "Player",
        cartelaNumbers: Array.from(selectedCartelas),
        entryFee: gameAmount || "20"
      };
      console.log('📝 Player data payload being sent:', playerData);
      
      const result = await addPlayersMutation.mutateAsync(playerData);
      console.log('✅ Player API response received:', result);
      console.log('✅ Created', result?.length || 0, 'player records in backend');
      
      // Update local state
      setBookedCartelas(new Set([...Array.from(bookedCartelas), ...Array.from(selectedCartelas)]));
      setSelectedCartelas(new Set());
      setShowCartelaSelector(false);
      
      toast({
        title: "Cartelas Booked Successfully",
        description: `${selectedCartelas.size} cartelas booked with ${result?.length || 0} backend records`,
      });
      
    } catch (error) {
      console.error('❌ BOOKING ERROR DETAILS:', error);
      console.error('❌ Error message:', error?.message);
      console.error('❌ Error response:', error?.response);
      toast({
        title: "Booking Failed",
        description: `Failed to book cartelas: ${error?.message || 'Unknown error'}`,
        variant: "destructive"
      });
    }
  };

  const startAutoCall = () => {
    if (autoCallInterval) clearInterval(autoCallInterval);
    
    const interval = setInterval(() => {
      if (gameStateRef.current.finished || gameStateRef.current.calledNumbers.length >= 75) {
        clearInterval(interval);
        setGameFinished(true);
        setGameActive(false);
        return;
      }

      const availableNumbers = Array.from({ length: 75 }, (_, i) => i + 1)
        .filter(n => !gameStateRef.current.calledNumbers.includes(n));
      
      if (availableNumbers.length === 0) {
        clearInterval(interval);
        setGameFinished(true);
        setGameActive(false);
        return;
      }

      const newNumber = availableNumbers[Math.floor(Math.random() * availableNumbers.length)];
      const newCalledNumbers = [...gameStateRef.current.calledNumbers, newNumber];
      
      gameStateRef.current.calledNumbers = newCalledNumbers;
      setCalledNumbers(newCalledNumbers);
      setLastCalledNumber(newNumber);
      
      // Play Amharic audio for called number
      try {
        const audioFileName = `${getLetterForNumber(newNumber)}${newNumber}.mp3`;
        const audio = new Audio(`/attached_assets/${audioFileName}`);
        audio.volume = 0.7;
        audio.play().catch(err => {
          console.log(`Audio file not found for ${audioFileName}`);
        });
      } catch (error) {
        console.log(`Audio playback error for ${getLetterForNumber(newNumber)}${newNumber}`);
      }
      console.log(`🔊 Calling: ${getLetterForNumber(newNumber)}-${newNumber}`);

      if (currentGame) {
        updateNumbersMutation.mutate({
          gameId: currentGame.id,
          calledNumbers: newCalledNumbers
        });
      }
    }, autoplaySpeed * 1000);
    
    setAutoCallInterval(interval);
  };

  const pauseGame = () => {
    console.log('🛑 CHECK WINNER CLICKED: Stopping everything immediately');
    
    // FIRST: Stop the interval to prevent new audio from starting
    setGameActive(false);
    stopAutoCalling();
    
    // THEN: Aggressively stop ALL existing audio like pausing music
    const allAudioElements = document.querySelectorAll('audio');
    console.log(`🛑 Found ${allAudioElements.length} audio elements to stop`);
    
    allAudioElements.forEach((audio, index) => {
      console.log(`🛑 Stopping audio element ${index + 1}: paused=${audio.paused}, currentTime=${audio.currentTime}`);
      audio.pause();
      audio.currentTime = 0;
      audio.volume = 0; // Mute completely
      // Try to clear the source
      try {
        audio.src = '';
      } catch (e) {
        // Ignore errors
      }
    });
    
    console.log('🛑 NEW EMPLOYEE DASHBOARD: All audio stopped immediately');
  };

  const resumeGame = () => {
    if (!gameFinished) {
      setGameActive(true);
      startAutoCall();
    }
  };

  const shuffleNumbers = () => {
    setIsShuffling(true);
    console.log("Playing shuffle sound effect...");
    
    setTimeout(() => {
      setIsShuffling(false);
    }, 2000);
  };

  const restartGame = () => {
    if (autoCallInterval) {
      clearInterval(autoCallInterval);
      setAutoCallInterval(null);
    }
    setGameActive(false);
    setGameFinished(false);
    setCurrentGame(null);
    setCalledNumbers([]);
    setBookedCartelas(new Set());
    setSelectedCartelas(new Set());
    setLastCalledNumber(null);
    gameStateRef.current = { active: false, calledNumbers: [], finished: false };
    toast({
      title: "Game Restarted",
      description: "Ready to start a new game",
    });
  };

  const checkWinnerCartela = () => {
    // Pause the game immediately when checking for winner
    pauseGame();
    
    if (!currentGame || !winnerCartelaNumber) return;
    
    checkWinnerMutation.mutate({
      gameId: currentGame.id,
      cartelaNumber: parseInt(winnerCartelaNumber),
      calledNumbers: calledNumbers
    });
  };

  // Update refs when state changes
  useEffect(() => {
    gameStateRef.current.active = gameActive;
    gameStateRef.current.calledNumbers = calledNumbers;
    gameStateRef.current.finished = gameFinished;
  }, [gameActive, calledNumbers, gameFinished]);

  // Load active game data
  useEffect(() => {
    if (activeGame) {
      setCurrentGame(activeGame);
      if ((activeGame as any).calledNumbers) {
        setCalledNumbers((activeGame as any).calledNumbers.map((n: string) => parseInt(n)));
      }
      if ((activeGame as any).status === 'active') {
        setGameActive(true);
      }
    }
  }, [activeGame]);

  return (
    <div className="min-h-screen bg-gray-100">
      {/* Header */}
      <div className="bg-white shadow-sm border-b px-6 py-4">
        <div className="flex justify-between items-center">
          <div>
            <h1 className="text-2xl font-semibold text-gray-900">Bingo Play</h1>
            <p className="text-gray-600">{(user as any)?.username} - Employee</p>
          </div>
          <div className="flex items-center space-x-6">
            <div className="text-right">
              <p className="text-sm text-gray-600">Total Collected</p>
              <p className="text-lg font-bold text-blue-600">{totalCollected.toFixed(0)} Birr</p>
            </div>
            <div className="text-right">
              <p className="text-sm text-gray-600">Winner Gets</p>
              <p className="text-lg font-bold text-green-600">{prizeAmount.toFixed(0)} Birr</p>
            </div>
            <Button onClick={onLogout} className="bg-teal-600 hover:bg-teal-700 text-white">
              Log Out
            </Button>
          </div>
        </div>
      </div>

      <div className="max-w-7xl mx-auto px-6 py-6">
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {/* Left Panel - Current Number & Controls - Minimized */}
          <div className="lg:col-span-1">
            <Card>
              <CardContent className="p-3">
                {/* Current Number Display - Compact */}
                <div className="text-center mb-3">
                  {lastCalledNumber ? (
                    <div className="flex justify-center items-center space-x-2 mb-2">
                      <div className="w-12 h-12 bg-red-500 text-white font-bold text-xl flex items-center justify-center rounded">
                        {getLetterForNumber(lastCalledNumber)}
                      </div>
                      <div className="w-12 h-12 bg-gray-800 text-white font-bold text-xl flex items-center justify-center rounded">
                        {lastCalledNumber}
                      </div>
                    </div>
                  ) : (
                    <div className="flex justify-center items-center space-x-2 mb-2">
                      <div className="w-12 h-12 bg-red-500 text-white font-bold text-xl flex items-center justify-center rounded">
                        N
                      </div>
                      <div className="w-12 h-12 bg-gray-800 text-white font-bold text-xl flex items-center justify-center rounded">
                        35
                      </div>
                    </div>
                  )}
                  <p className="text-xs text-gray-600">
                    {lastCalledNumber ? `${getLetterForNumber(lastCalledNumber)}-${lastCalledNumber}` : "N-35"}
                  </p>
                </div>

                {/* Main Action Button - Restored size */}
                <div className="text-center mb-6">
                  <div className="w-32 h-32 mx-auto bg-blue-600 rounded-full flex items-center justify-center text-white text-sm font-bold border-4 border-blue-200 shadow-lg cursor-pointer hover:bg-blue-700 transition-colors">
                    {gameActive ? "CALLING..." : "CALLING..."}
                  </div>
                  <p className="text-sm text-gray-500 mt-2">Generate Number</p>
                </div>

                {/* Game Settings */}
                <div className="space-y-4">
                  <div>
                    <Label htmlFor="gameAmount" className="text-sm font-medium">Game Amount (Birr)</Label>
                    <Input
                      id="gameAmount"
                      type="number"
                      value={gameAmount}
                      onChange={(e) => setGameAmount(e.target.value)}
                      disabled={gameActive}
                      min="1"
                      step="1"
                      className="mt-1"
                    />
                  </div>

                  {/* Selected Cartelas Display */}
                  <div className="border rounded-lg p-3 bg-gray-50">
                    <div className="flex items-center justify-between mb-2">
                      <span className="text-sm font-medium">Selected Cartelas</span>
                      {bookedCartelas.size > 0 && (
                        <span className="text-xs text-blue-600">{bookedCartelas.size} cartelas</span>
                      )}
                    </div>
                    {bookedCartelas.size > 0 ? (
                      <div className="flex flex-wrap gap-1 max-h-16 overflow-y-auto">
                        {Array.from(bookedCartelas).sort((a, b) => a - b).slice(0, 10).map(num => (
                          <Badge key={num} variant="default" className="text-xs bg-green-600 text-white">
                            #{num}
                          </Badge>
                        ))}
                        {bookedCartelas.size > 10 && (
                          <Badge variant="outline" className="text-xs">
                            +{bookedCartelas.size - 10}
                          </Badge>
                        )}
                      </div>
                    ) : (
                      <p className="text-xs text-gray-500">No cartelas selected yet</p>
                    )}
                  </div>
                </div>

                {/* Action Buttons */}
                <div className="space-y-3 mt-6">
                  <Dialog open={showCartelaSelector} onOpenChange={setShowCartelaSelector}>
                    <DialogTrigger asChild>
                      <Button 
                        variant="outline"
                        className="w-full bg-blue-600 hover:bg-blue-700 text-white border-blue-600"
                        size="sm"
                      >
                        Select Cartela
                      </Button>
                    </DialogTrigger>
                    <DialogContent className="max-w-6xl max-h-[90vh] overflow-auto">
                      <DialogHeader>
                        <DialogTitle>Select Cartelas (1-100)</DialogTitle>
                        <DialogDescription>
                          Choose multiple cartelas. Each number has a unique, fixed pattern.
                          Selected: {selectedCartelas.size} cartelas
                        </DialogDescription>
                      </DialogHeader>
                      <div className="grid grid-cols-10 gap-2 p-4">
                        {Array.from({ length: 100 }, (_, i) => i + 1).map(num => {
                          const isBooked = bookedCartelas.has(num);
                          const isSelected = selectedCartelas.has(num);
                          return (
                            <div key={num} className="flex flex-col items-center space-y-1">
                              <Button
                                variant={isSelected ? "default" : "outline"}
                                size="sm"
                                disabled={isBooked}
                                className={`h-12 w-12 ${
                                  isBooked 
                                    ? 'bg-red-500 text-white opacity-50' 
                                    : isSelected 
                                      ? 'bg-blue-600 text-white' 
                                      : 'hover:bg-blue-100'
                                }`}
                                onClick={() => toggleCartelaSelection(num)}
                              >
                                {num}
                              </Button>
                              <Checkbox
                                id={`cartela-${num}`}
                                checked={isSelected}
                                disabled={isBooked}
                                onCheckedChange={() => toggleCartelaSelection(num)}
                                className="h-3 w-3"
                              />
                            </div>
                          );
                        })}
                      </div>
                      
                      <div className="flex justify-between p-4">
                        <Button variant="outline" onClick={() => setShowCartelaSelector(false)}>
                          Close
                        </Button>
                        <Button 
                          onClick={bookSelectedCartelas}
                          disabled={selectedCartelas.size === 0 || addPlayersMutation.isPending}
                          className="bg-green-600 hover:bg-green-700"
                        >
                          {addPlayersMutation.isPending ? "Booking..." : `Book ${selectedCartelas.size} Cartelas`}
                        </Button>
                      </div>
                    </DialogContent>
                  </Dialog>

                  <Button 
                    className="w-full bg-red-600 hover:bg-red-700 text-white"
                    size="sm"
                    onClick={restartGame}
                  >
                    Reset Game
                  </Button>

                  {!currentGame ? (
                    <Button
                      onClick={startNewGame}
                      disabled={createGameMutation.isPending || bookedCartelas.size === 0}
                      className="w-full bg-green-600 hover:bg-green-700 text-white"
                    >
                      {createGameMutation.isPending ? "Creating..." : "Start Autoplay"}
                    </Button>
                  ) : gameActive ? (
                    <Button
                      onClick={pauseGame}
                      className="w-full bg-yellow-600 hover:bg-yellow-700 text-white"
                    >
                      Pause
                    </Button>
                  ) : (
                    <Button
                      onClick={resumeGame}
                      disabled={gameFinished}
                      className="w-full bg-green-600 hover:bg-green-700 text-white"
                    >
                      Resume
                    </Button>
                  )}

                  <Button 
                    className="w-full bg-purple-600 hover:bg-purple-700 text-white"
                    size="sm"
                    onClick={shuffleNumbers}
                    disabled={isShuffling}
                  >
                    {isShuffling ? "Shuffling..." : "Shuffle"}
                  </Button>

                  {/* Start Game Button - appears after cartela selection */}
                  {bookedCartelas.size > 0 && !currentGame && (
                    <Button
                      onClick={startNewGame}
                      disabled={createGameMutation.isPending}
                      className="w-full bg-green-600 hover:bg-green-700 text-white font-bold"
                      size="sm"
                    >
                      {createGameMutation.isPending ? "Starting..." : "Start Game"}
                    </Button>
                  )}
                </div>
              </CardContent>
            </Card>
          </div>

          {/* Center and Right - BINGO Board */}
          <div className="lg:col-span-2">
            <Card>
              <CardHeader>
                <CardTitle className="text-center">Called Numbers Board</CardTitle>
                <p className="text-center text-sm text-gray-600">
                  {gameFinished ? (
                    <span className="text-green-600 font-semibold">Game Completed!</span>
                  ) : (
                    <>Numbers Called: {calledNumbers?.length || 0}</>
                  )}
                </p>
              </CardHeader>
              <CardContent className="px-6">
                {/* BINGO Board - Bigger with bold numbers matching your image */}
                <div className="space-y-2">
                  {/* B Row */}
                  <div className="flex items-center space-x-3">
                    <div className="w-10 h-10 bg-red-500 text-white font-bold text-xl flex items-center justify-center rounded">B</div>
                    <div className="flex space-x-2">
                      {[1,2,3,4,5,6,7,8,9,10,11,12,13,14,15].map(num => (
                        <div
                          key={num}
                          className={`w-10 h-10 text-center font-bold text-lg flex items-center justify-center rounded ${
                            calledNumbers.includes(num)
                              ? 'bg-green-600 text-white'
                              : 'bg-gray-100 text-gray-700'
                          }`}
                        >
                          {num}
                        </div>
                      ))}
                    </div>
                  </div>

                  {/* I Row */}
                  <div className="flex items-center space-x-3">
                    <div className="w-10 h-10 bg-red-500 text-white font-bold text-xl flex items-center justify-center rounded">I</div>
                    <div className="flex space-x-2">
                      {[16,17,18,19,20,21,22,23,24,25,26,27,28,29,30].map(num => (
                        <div
                          key={num}
                          className={`w-10 h-10 text-center font-bold text-lg flex items-center justify-center rounded ${
                            calledNumbers.includes(num)
                              ? 'bg-green-600 text-white'
                              : 'bg-gray-100 text-gray-700'
                          }`}
                        >
                          {num}
                        </div>
                      ))}
                    </div>
                  </div>

                  {/* N Row */}
                  <div className="flex items-center space-x-3">
                    <div className="w-10 h-10 bg-red-500 text-white font-bold text-xl flex items-center justify-center rounded">N</div>
                    <div className="flex space-x-2">
                      {[31,32,33,34,35,36,37,38,39,40,41,42,43,44,45].map(num => (
                        <div
                          key={num}
                          className={`w-10 h-10 text-center font-bold text-lg flex items-center justify-center rounded ${
                            calledNumbers.includes(num)
                              ? 'bg-green-600 text-white'
                              : 'bg-gray-100 text-gray-700'
                          }`}
                        >
                          {num}
                        </div>
                      ))}
                    </div>
                  </div>

                  {/* G Row */}
                  <div className="flex items-center space-x-3">
                    <div className="w-10 h-10 bg-red-500 text-white font-bold text-xl flex items-center justify-center rounded">G</div>
                    <div className="flex space-x-2">
                      {[46,47,48,49,50,51,52,53,54,55,56,57,58,59,60].map(num => (
                        <div
                          key={num}
                          className={`w-10 h-10 text-center font-bold text-lg flex items-center justify-center rounded ${
                            calledNumbers.includes(num)
                              ? 'bg-green-600 text-white'
                              : 'bg-gray-100 text-gray-700'
                          }`}
                        >
                          {num}
                        </div>
                      ))}
                    </div>
                  </div>

                  {/* O Row */}
                  <div className="flex items-center space-x-3">
                    <div className="w-10 h-10 bg-red-500 text-white font-bold text-xl flex items-center justify-center rounded">O</div>
                    <div className="flex space-x-2">
                      {[61,62,63,64,65,66,67,68,69,70,71,72,73,74,75].map(num => (
                        <div
                          key={num}
                          className={`w-10 h-10 text-center font-bold text-lg flex items-center justify-center rounded ${
                            calledNumbers.includes(num)
                              ? 'bg-green-600 text-white'
                              : 'bg-gray-100 text-gray-700'
                          }`}
                        >
                          {num}
                        </div>
                      ))}
                    </div>
                  </div>
                </div>

                {/* Compact Control Buttons - Smaller bar to make Called Numbers Board bigger */}
                <div className="grid grid-cols-6 gap-2 mt-4">
                  <Dialog open={showCartelaSelector} onOpenChange={setShowCartelaSelector}>
                    <DialogTrigger asChild>
                      <Button className="bg-blue-600 hover:bg-blue-700 text-white py-2 text-xs">
                        Select Cartela
                      </Button>
                    </DialogTrigger>
                    <DialogContent className="max-w-6xl max-h-[90vh] overflow-auto">
                      <DialogHeader>
                        <DialogTitle>Select Cartelas (1-100)</DialogTitle>
                        <DialogDescription>
                          Choose multiple cartelas. Each number has a unique, fixed pattern.
                          Selected: {selectedCartelas.size} cartelas
                        </DialogDescription>
                      </DialogHeader>
                      <div className="grid grid-cols-10 gap-2 p-4">
                        {Array.from({ length: 100 }, (_, i) => i + 1).map(num => {
                          const isBooked = bookedCartelas.has(num);
                          const isSelected = selectedCartelas.has(num);
                          return (
                            <div key={num} className="flex flex-col items-center space-y-1">
                              <Button
                                variant={isSelected ? "default" : "outline"}
                                size="sm"
                                disabled={isBooked}
                                className={`h-12 w-12 ${
                                  isBooked 
                                    ? 'bg-red-500 text-white opacity-50' 
                                    : isSelected 
                                      ? 'bg-blue-600 text-white' 
                                      : 'hover:bg-blue-100'
                                }`}
                                onClick={() => toggleCartelaSelection(num)}
                              >
                                {num}
                              </Button>
                              <Checkbox
                                id={`cartela-${num}`}
                                checked={isSelected}
                                disabled={isBooked}
                                onCheckedChange={() => toggleCartelaSelection(num)}
                                className="h-3 w-3"
                              />
                            </div>
                          );
                        })}
                      </div>
                      
                      <div className="flex justify-between p-4">
                        <Button variant="outline" onClick={() => setShowCartelaSelector(false)}>
                          Close
                        </Button>
                        <Button 
                          onClick={bookSelectedCartelas}
                          disabled={selectedCartelas.size === 0 || addPlayersMutation.isPending}
                          className="bg-green-600 hover:bg-green-700"
                        >
                          {addPlayersMutation.isPending ? "Booking..." : `Book ${selectedCartelas.size} Cartelas`}
                        </Button>
                      </div>
                    </DialogContent>
                  </Dialog>

                  <Button 
                    className="bg-red-600 hover:bg-red-700 text-white py-2 text-xs"
                    onClick={restartGame}
                  >
                    Reset Game
                  </Button>

                  <Button 
                    className="bg-yellow-600 hover:bg-yellow-700 text-white py-2 text-xs"
                    onClick={shuffleNumbers}
                    disabled={isShuffling}
                  >
                    {isShuffling ? "Shuffling..." : "Shuffle"}
                  </Button>

                  {gameActive ? (
                    <Button
                      onClick={pauseGame}
                      className="bg-orange-600 hover:bg-orange-700 text-white py-2 text-xs"
                    >
                      Pause
                    </Button>
                  ) : (
                    <Button
                      onClick={resumeGame}
                      disabled={gameFinished || !currentGame}
                      className="bg-green-600 hover:bg-green-700 text-white py-2 text-xs"
                    >
                      Resume
                    </Button>
                  )}

                  <Dialog open={showWinnerChecker} onOpenChange={setShowWinnerChecker}>
                    <DialogTrigger asChild>
                      <Button 
                        className="bg-purple-600 hover:bg-purple-700 text-white py-2 text-xs"
                        disabled={!gameActive}
                      >
                        Check Winner
                      </Button>
                    </DialogTrigger>
                    <DialogContent>
                      <DialogHeader>
                        <DialogTitle>Check Winner Cartela</DialogTitle>
                        <DialogDescription>
                          Enter the cartela number to check if it's a valid winner.
                        </DialogDescription>
                      </DialogHeader>
                      <div className="space-y-4">
                        <Input
                          type="number"
                          placeholder="Enter cartela number (1-100)"
                          value={winnerCartelaNumber}
                          onChange={(e) => setWinnerCartelaNumber(e.target.value)}
                          min="1"
                          max="100"
                        />
                        <div className="flex justify-between">
                          <Button variant="outline" onClick={() => setShowWinnerChecker(false)}>
                            Cancel
                          </Button>
                          <Button 
                            onClick={checkWinnerCartela}
                            disabled={checkWinnerMutation.isPending}
                            className="bg-purple-600 hover:bg-purple-700"
                          >
                            {checkWinnerMutation.isPending ? "Checking..." : "Check Winner"}
                          </Button>
                        </div>
                      </div>
                    </DialogContent>
                  </Dialog>
                </div>
              </CardContent>
            </Card>
          </div>
        </div>

        {/* Winner Result Modal */}
        <Dialog open={showWinnerModal} onOpenChange={setShowWinnerModal}>
          <DialogContent className="max-w-md">
            <div className="text-center py-6">
              {winnerResult?.isWinner ? (
                <div>
                  <div className="text-6xl text-green-600 mb-4">✅</div>
                  <h2 className="text-2xl font-bold text-green-600 mb-2">Congratulations!</h2>
                  <p className="text-lg">Cartela #{winnerResult.cartelaNumber} Has Won!</p>
                  <p className="text-sm text-gray-600 mt-2">This cartela is a valid winner</p>
                </div>
              ) : (
                <div>
                  <div className="text-6xl text-red-600 mb-4">❌</div>
                  <h2 className="text-2xl font-bold text-red-600 mb-2">Not a Winner</h2>
                  <p className="text-lg">Cartela #{winnerResult?.cartelaNumber} Did Not Win</p>
                  <p className="text-sm text-gray-600 mt-4 mb-4">Game will resume automatically in 3 seconds</p>
                  <Button 
                    onClick={() => {
                      setShowWinnerModal(false);
                      if (!gameActive && !gameFinished) {
                        resumeGame();
                      }
                    }}
                    className="bg-blue-600 hover:bg-blue-700 text-white"
                  >
                    Continue Game Now
                  </Button>
                </div>
              )}
            </div>
          </DialogContent>
        </Dialog>
      </div>
    </div>
  );
}