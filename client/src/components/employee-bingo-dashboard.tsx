import { useState, useEffect, useRef } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Badge } from "@/components/ui/badge";
import { useToast } from "@/hooks/use-toast";
import { useAuth } from "@/hooks/use-auth";
import { useMutation, useQuery } from "@tanstack/react-query";
import { queryClient } from "@/lib/queryClient";
import { FIXED_CARTELAS, getCartelaNumbers, getFixedCartelaPattern } from "@/data/fixed-cartelas";

interface EmployeeBingoDashboardProps {
  onLogout: () => void;
}

export default function EmployeeBingoDashboard({ onLogout }: EmployeeBingoDashboardProps) {
  const { user } = useAuth();
  const { toast } = useToast();

  // Game state
  const [gameActive, setGameActive] = useState(false);
  const [gameFinished, setGameFinished] = useState(false);
  const [calledNumbers, setCalledNumbers] = useState<number[]>([]);
  const [lastCalledNumber, setLastCalledNumber] = useState<number | null>(null);
  const [gameAmount, setGameAmount] = useState("20");
  const [activeGameId, setActiveGameId] = useState<number | null>(null);
  
  // Cartela management
  const [selectedCartelas, setSelectedCartelas] = useState<Set<number>>(new Set());
  const [bookedCartelas, setBookedCartelas] = useState<Set<number>>(new Set());
  const [showCartelaSelector, setShowCartelaSelector] = useState(false);
  
  // Winner checking
  const [showWinnerChecker, setShowWinnerChecker] = useState(false);
  const [winnerCartelaNumber, setWinnerCartelaNumber] = useState("");
  const [showWinnerResult, setShowWinnerResult] = useState(false);
  interface WinnerResult {
    isWinner: boolean;
    cartela: number;
    message: string;
    pattern: string;
    winningCells: number[];
    cartelaPattern?: number[][];
  }
  
  const [winnerResult, setWinnerResult] = useState<WinnerResult>({ isWinner: false, cartela: 0, message: "", pattern: "", winningCells: [], cartelaPattern: undefined });
  
  // Animation states
  const [isShuffling, setIsShuffling] = useState(false);
  
  // Auto-calling states
  const [isAutoCall, setIsAutoCall] = useState(false);
  const [autoCallInterval, setAutoCallInterval] = useState<NodeJS.Timeout | null>(null);
  const [isPaused, setIsPaused] = useState(false);
  const [currentAudio, setCurrentAudio] = useState<HTMLAudioElement | null>(null);
  const [nextNumber, setNextNumber] = useState<number | null>(null);
  const [isHovering, setIsHovering] = useState(false);
  
  // User balance query
  const { data: balance } = useQuery({
    queryKey: ['/api/credit/balance'],
    refetchInterval: 5000
  });

  // Shop data query
  const { data: shopData } = useQuery({
    queryKey: ['/api/shops', user?.shopId],
    enabled: !!user?.shopId
  });

  // Helper function to get letter for number
  const getLetterForNumber = (num: number): string => {
    if (num >= 1 && num <= 15) return "B";
    if (num >= 16 && num <= 30) return "I";
    if (num >= 31 && num <= 45) return "N";
    if (num >= 46 && num <= 60) return "G";
    if (num >= 61 && num <= 75) return "O";
    return "?";
  };

  // Helper function to get ball color for number
  const getBallColor = (num: number): string => {
    if (num >= 1 && num <= 15) return "from-blue-500 to-blue-700"; // B - Blue
    if (num >= 16 && num <= 30) return "from-red-500 to-red-700"; // I - Red
    if (num >= 31 && num <= 45) return "from-green-500 to-green-700"; // N - Green
    if (num >= 46 && num <= 60) return "from-yellow-500 to-yellow-600"; // G - Yellow
    if (num >= 61 && num <= 75) return "from-purple-500 to-purple-700"; // O - Purple
    return "from-gray-400 to-gray-600";
  };

  // Generate next number for calling
  const getNextNumber = (): number | null => {
    const availableNumbers = Array.from({ length: 75 }, (_, i) => i + 1)
      .filter(n => !calledNumbers.includes(n));
    
    if (availableNumbers.length === 0) return null;
    
    const randomIndex = Math.floor(Math.random() * availableNumbers.length);
    return availableNumbers[randomIndex];
  };

  // Call a single number with hover effect and audio
  const callNumber = async () => {
    if (!activeGameId || isPaused) return;

    const numberToCall = getNextNumber();
    if (!numberToCall) {
      setGameActive(false);
      setGameFinished(true);
      setIsAutoCall(false);
      return;
    }

    // Set hovering state for preview
    setNextNumber(numberToCall);
    setIsHovering(true);
    
    // Hover effect duration
    setTimeout(() => {
      setIsHovering(false);
      setIsShuffling(true);
      
      // Play calling sound
      try {
        const audio = new Audio('/attached_assets/money-counter-95830_1750063611267.mp3');
        audio.volume = 0.6;
        setCurrentAudio(audio);
        audio.play().catch(() => {
          console.log('Money counter sound not available');
        });
      } catch (error) {
        console.log('Audio playback error for calling sound');
      }

      // Call the API to add the number
      setTimeout(async () => {
        try {
          const response = await fetch(`/api/games/${activeGameId}/numbers`, {
            method: 'PATCH',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ number: numberToCall })
          });

          if (response.ok) {
            const updatedNumbers = [...calledNumbers, numberToCall];
            setCalledNumbers(updatedNumbers);
            setLastCalledNumber(numberToCall);
          }
        } catch (error) {
          console.error('Failed to call number:', error);
        }
        
        setIsShuffling(false);
        setNextNumber(null);
      }, 1500);
    }, 800); // Hover duration
  };

  // Start auto-calling
  const startAutoCall = () => {
    if (autoCallInterval) clearInterval(autoCallInterval);
    
    setIsAutoCall(true);
    setIsPaused(false);
    
    const interval = setInterval(() => {
      if (!isPaused && gameActive && !gameFinished) {
        callNumber();
      }
    }, 4000); // 4 seconds between calls
    
    setAutoCallInterval(interval);
  };

  // Stop auto-calling immediately
  const stopAutoCall = () => {
    setIsAutoCall(false);
    setIsPaused(false);
    
    if (autoCallInterval) {
      clearInterval(autoCallInterval);
      setAutoCallInterval(null);
    }
    
    // Stop any currently playing audio immediately
    if (currentAudio) {
      currentAudio.pause();
      currentAudio.currentTime = 0;
      setCurrentAudio(null);
    }
    
    // Reset states
    setIsShuffling(false);
    setIsHovering(false);
    setNextNumber(null);
  };

  // Pause auto-calling immediately
  const pauseAutoCall = () => {
    setIsPaused(!isPaused);
    
    // Stop any currently playing audio immediately when pausing
    if (!isPaused && currentAudio) {
      currentAudio.pause();
      currentAudio.currentTime = 0;
      setCurrentAudio(null);
      setIsShuffling(false);
      setIsHovering(false);
      setNextNumber(null);
    }
  };

  // Shuffle animation with sound
  const shuffleNumbers = () => {
    if (!activeGameId) return;
    
    setIsShuffling(true);
    
    // Play money counter sound effect for shuffle
    try {
      const audio = new Audio('/attached_assets/money-counter-95830_1750063611267.mp3');
      audio.volume = 0.6;
      audio.play().catch(() => {
        console.log('Money counter sound not available');
      });
    } catch (error) {
      console.log('Audio playback error for shuffle sound');
    }
    
    setTimeout(() => {
      setIsShuffling(false);
    }, 2500);
  };

  // Create game mutation
  const createGameMutation = useMutation({
    mutationFn: async () => {
      const response = await fetch('/api/games', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          amount: parseFloat(gameAmount),
          cartelas: Array.from(selectedCartelas)
        })
      });
      if (!response.ok) throw new Error('Failed to create game');
      return response.json();
    },
    onSuccess: (data) => {
      setActiveGameId(data.id);
      setGameActive(false);
      setGameFinished(false);
      setCalledNumbers([]);
      setLastCalledNumber(null);
      setBookedCartelas(new Set(selectedCartelas));
      setSelectedCartelas(new Set());
      queryClient.invalidateQueries({ queryKey: ['/api/credit/balance'] });
      toast({
        title: "Game Created",
        description: `Game created with ${Array.from(selectedCartelas).length} cartelas`
      });
    },
    onError: (error: any) => {
      toast({
        title: "Error",
        description: error.message || "Failed to create game",
        variant: "destructive"
      });
    }
  });

  // Start game mutation
  const startGameMutation = useMutation({
    mutationFn: async () => {
      const response = await fetch(`/api/games/${activeGameId}/start`, {
        method: 'PATCH'
      });
      if (!response.ok) throw new Error('Failed to start game');
      return response.json();
    },
    onSuccess: () => {
      setGameActive(true);
      toast({
        title: "Game Started",
        description: "Bingo game is now active"
      });
    }
  });

  // Check winner function
  const checkWinner = async () => {
    const cartelaNum = parseInt(winnerCartelaNumber);
    
    if (!cartelaNum || cartelaNum < 1) {
      toast({
        title: "Invalid Cartela",
        description: "Please enter a valid cartela number",
        variant: "destructive"
      });
      return;
    }

    if (!bookedCartelas.has(cartelaNum)) {
      toast({
        title: "Cartela Not Booked",
        description: "This cartela was not booked for this game",
        variant: "destructive"
      });
      return;
    }

    // Check winner using API with actual cartela data from database
    try {
      const response = await fetch('/api/games/check-winner', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          cartelaNumber: cartelaNum,
          calledNumbers: calledNumbers
        })
      });

      if (!response.ok) {
        throw new Error('Failed to check winner');
      }

      const result = await response.json();
      
      // Use the cartela pattern returned by the API
      const cartelaPattern = result.cartelaPattern || getFixedCartelaPattern(cartelaNum);
      
      // Calculate winning cells for highlighting if it's a winner
      let winningCells: number[] = [];
      if (result.isWinner && cartelaPattern) {
        const winResult = checkBingoWin(cartelaPattern, calledNumbers);
        winningCells = winResult.winningCells || [];
      }
      
      setWinnerResult({
        isWinner: result.isWinner,
        cartela: cartelaNum,
        message: result.isWinner ? "BINGO! Winner found!" : "Not a winner yet",
        pattern: result.winningPattern || "",
        winningCells: winningCells,
        cartelaPattern: cartelaPattern
      });
      
      setShowWinnerResult(true);
      setShowWinnerChecker(false);
      
      if (result.isWinner) {
        setGameActive(false);
        setGameFinished(true);
        
        // Submit winner to backend
        try {
          await fetch(`/api/games/${activeGameId}/declare-winner`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              cartelaNumber: cartelaNum,
              pattern: result.winningPattern
            })
          });
          
          queryClient.invalidateQueries({ queryKey: ['/api/credit/balance'] });
        } catch (error) {
          console.error('Failed to declare winner:', error);
        }
      }
    } catch (error) {
      console.error('Failed to check winner:', error);
      
      // Fallback to local check if API fails
      const cartelaPattern = getFixedCartelaPattern(cartelaNum);
      const isWinner = checkBingoWin(cartelaPattern, calledNumbers);
      
      setWinnerResult({
        isWinner: isWinner.isWinner,
        cartela: cartelaNum,
        message: isWinner.isWinner ? "BINGO! Winner found!" : "Not a winner yet",
        pattern: isWinner.pattern || "",
        winningCells: isWinner.winningCells || [],
        cartelaPattern: cartelaPattern
      });
      
      setShowWinnerResult(true);
      setShowWinnerChecker(false);
      
      toast({
        title: "Warning",
        description: "Using fallback verification. Pattern may not match database.",
        variant: "destructive"
      });
    }
  };

  // Check for BINGO win patterns
  function checkBingoWin(cartelaPattern: number[][], calledNumbers: number[]): { isWinner: boolean; pattern?: string; winningCells?: number[] } {
    if (cartelaPattern.length !== 5) return { isWinner: false };
    
    // Check horizontal lines
    for (let row = 0; row < 5; row++) {
      let hasAllNumbers = true;
      const winningCells = [];
      for (let col = 0; col < 5; col++) {
        const cellIndex = row * 5 + col;
        const num = cartelaPattern[row][col];
        if (num !== 0 && !calledNumbers.includes(num)) {
          hasAllNumbers = false;
          break;
        }
        winningCells.push(cellIndex);
      }
      if (hasAllNumbers) {
        return { isWinner: true, pattern: `Horizontal Row ${row + 1}`, winningCells };
      }
    }
    
    // Check vertical lines
    for (let col = 0; col < 5; col++) {
      let hasAllNumbers = true;
      const winningCells = [];
      for (let row = 0; row < 5; row++) {
        const cellIndex = row * 5 + col;
        const num = cartelaPattern[row][col];
        if (num !== 0 && !calledNumbers.includes(num)) {
          hasAllNumbers = false;
          break;
        }
        winningCells.push(cellIndex);
      }
      if (hasAllNumbers) {
        const letters = ['B', 'I', 'N', 'G', 'O'];
        return { isWinner: true, pattern: `Vertical ${letters[col]} Column`, winningCells };
      }
    }
    
    // Check diagonal (top-left to bottom-right)
    let hasAllNumbers = true;
    const diagonalCells1 = [];
    for (let i = 0; i < 5; i++) {
      const cellIndex = i * 5 + i;
      const num = cartelaPattern[i][i];
      if (num !== 0 && !calledNumbers.includes(num)) {
        hasAllNumbers = false;
        break;
      }
      diagonalCells1.push(cellIndex);
    }
    if (hasAllNumbers) {
      return { isWinner: true, pattern: "Diagonal (Top-Left to Bottom-Right)", winningCells: diagonalCells1 };
    }
    
    // Check diagonal (top-right to bottom-left)
    hasAllNumbers = true;
    const diagonalCells2 = [];
    for (let i = 0; i < 5; i++) {
      const cellIndex = i * 5 + (4 - i);
      const num = cartelaPattern[i][4 - i];
      if (num !== 0 && !calledNumbers.includes(num)) {
        hasAllNumbers = false;
        break;
      }
      diagonalCells2.push(cellIndex);
    }
    if (hasAllNumbers) {
      return { isWinner: true, pattern: "Diagonal (Top-Right to Bottom-Left)", winningCells: diagonalCells2 };
    }
    
    return { isWinner: false };
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-50 to-purple-50">
      {/* Header */}
      <div className="bg-white shadow-sm border-b">
        <div className="max-w-7xl mx-auto px-6 py-4">
          <div className="flex justify-between items-center">
            <div>
              <h1 className="text-2xl font-bold text-gray-900">BINGO Dashboard</h1>
              <p className="text-sm text-gray-600">
                Welcome, {user?.name} | Credit: {balance?.balance || '0.00'} Birr | Shop: {shopData?.name || 'Loading...'}
              </p>
            </div>
            <Button 
              variant="outline" 
              onClick={onLogout}
              className="bg-red-50 text-red-600 border-red-200 hover:bg-red-100"
            >
              Logout
            </Button>
          </div>
        </div>
      </div>

      <div className="max-w-7xl mx-auto px-6 py-6">
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {/* Left Panel - Current Number & Controls */}
          <div className="lg:col-span-1">
            <Card>
              <CardContent className="p-6">
                {/* Current Number Display */}
                <div className="text-center mb-6">
                  {activeGameId ? (
                    <>
                      <div className="flex justify-center items-center mb-4">
                        {/* Show next number if hovering, otherwise show last called number */}
                        {isHovering && nextNumber ? (
                          <div className={`relative w-24 h-24 bg-gradient-to-br ${getBallColor(nextNumber)} rounded-full shadow-lg transform scale-110 animate-pulse transition-all duration-300`}>
                            {/* Ball shine effect */}
                            <div className="absolute top-2 left-3 w-4 h-4 bg-white/30 rounded-full blur-sm"></div>
                            <div className="absolute top-1 left-2 w-2 h-2 bg-white/50 rounded-full"></div>
                            
                            {/* Letter */}
                            <div className="absolute top-2 left-1/2 transform -translate-x-1/2 text-white font-black text-sm">
                              {getLetterForNumber(nextNumber)}
                            </div>
                            
                            {/* Inner white circle for number background */}
                            <div className="absolute bottom-1 left-1/2 transform -translate-x-1/2 w-16 h-16 bg-white rounded-full flex items-center justify-center">
                              <span className="text-gray-900 font-black text-xl">
                                {nextNumber}
                              </span>
                            </div>
                          </div>
                        ) : lastCalledNumber ? (
                          <div className={`relative w-24 h-24 bg-gradient-to-br ${getBallColor(lastCalledNumber)} rounded-full shadow-lg transform ${isShuffling ? 'animate-bounce scale-110' : 'hover:scale-105'} transition-all duration-300`}>
                            {/* Ball shine effect */}
                            <div className="absolute top-2 left-3 w-4 h-4 bg-white/30 rounded-full blur-sm"></div>
                            <div className="absolute top-1 left-2 w-2 h-2 bg-white/50 rounded-full"></div>
                            
                            {/* Letter */}
                            <div className="absolute top-2 left-1/2 transform -translate-x-1/2 text-white font-black text-sm">
                              {getLetterForNumber(lastCalledNumber)}
                            </div>
                            
                            {/* Inner white circle for number background */}
                            <div className="absolute bottom-1 left-1/2 transform -translate-x-1/2 w-16 h-16 bg-white rounded-full flex items-center justify-center">
                              <span className="text-gray-900 font-black text-xl">
                                {lastCalledNumber}
                              </span>
                            </div>
                          </div>
                        ) : (
                          <div className="relative w-24 h-24 bg-gradient-to-br from-gray-300 to-gray-500 rounded-full shadow-lg">
                            <div className="absolute top-2 left-3 w-4 h-4 bg-white/30 rounded-full blur-sm"></div>
                            <div className="absolute top-1 left-2 w-2 h-2 bg-white/50 rounded-full"></div>
                            <div className="absolute bottom-1 left-1/2 transform -translate-x-1/2 w-16 h-16 bg-white rounded-full flex items-center justify-center">
                              <span className="text-gray-500 font-black text-xl">?</span>
                            </div>
                          </div>
                        )}
                      </div>
                      <p className="text-sm font-semibold text-gray-800">
                        {isHovering && nextNumber ? (
                          <span className="animate-pulse text-blue-600">NEXT: {getLetterForNumber(nextNumber)}-{nextNumber}</span>
                        ) : isShuffling ? (
                          <span className="animate-pulse text-orange-600">CALLING...</span>
                        ) : lastCalledNumber ? (
                          `${getLetterForNumber(lastCalledNumber)}-${lastCalledNumber}`
                        ) : (
                          "Ready to start"
                        )}
                      </p>
                      {isPaused && (
                        <p className="text-xs text-red-600 font-semibold mt-1">PAUSED</p>
                      )}
                    </>
                  ) : (
                    <>
                      <div className="flex justify-center items-center mb-4">
                        <div className="relative w-24 h-24 bg-gradient-to-br from-gray-300 to-gray-500 rounded-full shadow-lg">
                          <div className="absolute top-2 left-3 w-4 h-4 bg-white/30 rounded-full blur-sm"></div>
                          <div className="absolute top-1 left-2 w-2 h-2 bg-white/50 rounded-full"></div>
                          <div className="absolute bottom-1 left-1/2 transform -translate-x-1/2 w-16 h-16 bg-white rounded-full flex items-center justify-center">
                            <span className="text-gray-500 font-black text-xl">?</span>
                          </div>
                        </div>
                      </div>
                      <p className="text-sm text-gray-600">
                        No game active
                      </p>
                    </>
                  )}
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
                      className="mt-1"
                      placeholder="Enter amount"
                    />
                  </div>

                  {/* Select Cartelas Button */}
                  <Button 
                    className="w-full bg-purple-600 hover:bg-purple-700 text-white"
                    onClick={() => setShowCartelaSelector(true)}
                    disabled={gameActive}
                  >
                    Select Cartelas ({selectedCartelas.size})
                  </Button>

                  {/* Create Game Button */}
                  <Button 
                    className="w-full bg-green-600 hover:bg-green-700 text-white"
                    onClick={() => createGameMutation.mutate()}
                    disabled={gameActive || selectedCartelas.size === 0 || createGameMutation.isPending}
                  >
                    {createGameMutation.isPending ? "Creating..." : "Create Game"}
                  </Button>

                  {/* Start Game Button */}
                  <Button 
                    className="w-full bg-blue-600 hover:bg-blue-700 text-white"
                    onClick={() => startGameMutation.mutate()}
                    disabled={!activeGameId || gameActive || startGameMutation.isPending}
                  >
                    {startGameMutation.isPending ? "Starting..." : "Start Game"}
                  </Button>

                  {/* Number Calling Controls */}
                  {gameActive && (
                    <div className="space-y-2 mt-4 pt-4 border-t">
                      <h4 className="text-sm font-semibold text-gray-700 text-center">Number Calling</h4>
                      
                      {/* Manual Call Button */}
                      <Button 
                        className="w-full bg-green-600 hover:bg-green-700 text-white"
                        onClick={callNumber}
                        disabled={isAutoCall || isShuffling || isHovering}
                      >
                        Call Next Number
                      </Button>

                      {/* Auto Call Controls */}
                      <div className="flex space-x-2">
                        {!isAutoCall ? (
                          <Button 
                            className="flex-1 bg-purple-600 hover:bg-purple-700 text-white"
                            onClick={startAutoCall}
                            disabled={isShuffling || isHovering}
                          >
                            🎯 Auto Call
                          </Button>
                        ) : (
                          <>
                            <Button 
                              className={`flex-1 ${isPaused ? 'bg-green-600 hover:bg-green-700' : 'bg-yellow-600 hover:bg-yellow-700'} text-white`}
                              onClick={pauseAutoCall}
                            >
                              {isPaused ? '▶️ Resume' : '⏸️ Pause'}
                            </Button>
                            <Button 
                              className="flex-1 bg-red-600 hover:bg-red-700 text-white"
                              onClick={stopAutoCall}
                            >
                              ⏹️ Stop
                            </Button>
                          </>
                        )}
                      </div>

                      {/* Status Indicator */}
                      <div className="text-center text-xs">
                        {isAutoCall && !isPaused && (
                          <span className="text-green-600 font-semibold">🔄 Auto Calling Active</span>
                        )}
                        {isAutoCall && isPaused && (
                          <span className="text-yellow-600 font-semibold">⏸️ Auto Calling Paused</span>
                        )}
                        {!isAutoCall && (
                          <span className="text-gray-500">Manual Control</span>
                        )}
                      </div>
                    </div>
                  )}

                  {/* Shuffle Button */}
                  <div className="flex justify-center mt-4">
                    <Button 
                      className="bg-orange-600 hover:bg-orange-700 text-white py-1 text-xs"
                      onClick={shuffleNumbers}
                      disabled={isShuffling || !activeGameId}
                    >
                      {isShuffling ? "..." : "Shuffle"}
                    </Button>
                  </div>
                </div>
              </CardContent>
            </Card>
          </div>

          {/* Right Panel - BINGO Board */}
          <div className="lg:col-span-2">
            <Card>
              <CardHeader className="pb-3">
                <CardTitle className="text-center text-xl font-bold">
                  Called Numbers Board
                </CardTitle>
                <p className="text-center text-sm text-gray-600">
                  Numbers Called: {calledNumbers.length} / 75
                </p>
              </CardHeader>
              <CardContent>
                {/* BINGO Headers */}
                <div className="grid grid-cols-5 gap-2 mb-4">
                  {['B', 'I', 'N', 'G', 'O'].map((letter, index) => {
                    const colors = ['bg-red-500', 'bg-blue-500', 'bg-green-500', 'bg-yellow-500', 'bg-purple-500'];
                    return (
                      <div key={letter} className={`h-12 ${colors[index]} text-white rounded-lg flex items-center justify-center font-bold text-xl`}>
                        {letter}
                      </div>
                    );
                  })}
                </div>
                
                {/* Numbers Grid */}
                <div className="grid grid-cols-5 gap-2">
                  {/* B Column */}
                  <div className="space-y-2">
                    {Array.from({length: 15}, (_, i) => i + 1).map(num => (
                      <div 
                        key={num} 
                        className={`h-10 rounded flex items-center justify-center text-lg font-bold ${
                          calledNumbers.includes(num) 
                            ? 'bg-red-500 text-white border-2 border-red-600' + (isShuffling ? ' shuffle-animation' : '')
                            : 'bg-gray-100 text-gray-700 border border-gray-300'
                        }`}
                      >
                        <span style={{ transform: 'scaleY(3)', display: 'inline-block' }}>{num}</span>
                      </div>
                    ))}
                  </div>
                  
                  {/* I Column */}
                  <div className="space-y-2">
                    {Array.from({length: 15}, (_, i) => i + 16).map(num => (
                      <div 
                        key={num} 
                        className={`h-10 rounded flex items-center justify-center text-lg font-bold ${
                          calledNumbers.includes(num) 
                            ? 'bg-blue-500 text-white border-2 border-blue-600' + (isShuffling ? ' shuffle-animation' : '')
                            : 'bg-gray-100 text-gray-700 border border-gray-300'
                        }`}
                      >
                        <span style={{ transform: 'scaleY(3)', display: 'inline-block' }}>{num}</span>
                      </div>
                    ))}
                  </div>
                  
                  {/* N Column */}
                  <div className="space-y-2">
                    {Array.from({length: 15}, (_, i) => i + 31).map(num => (
                      <div 
                        key={num} 
                        className={`h-10 rounded flex items-center justify-center text-lg font-bold ${
                          calledNumbers.includes(num) 
                            ? 'bg-green-500 text-white border-2 border-green-600' + (isShuffling ? ' shuffle-animation' : '')
                            : 'bg-gray-100 text-gray-700 border border-gray-300'
                        }`}
                      >
                        <span style={{ transform: 'scaleY(3)', display: 'inline-block' }}>{num}</span>
                      </div>
                    ))}
                  </div>
                  
                  {/* G Column */}
                  <div className="space-y-2">
                    {Array.from({length: 15}, (_, i) => i + 46).map(num => (
                      <div 
                        key={num} 
                        className={`h-10 rounded flex items-center justify-center text-lg font-bold ${
                          calledNumbers.includes(num) 
                            ? 'bg-yellow-500 text-white border-2 border-yellow-600' + (isShuffling ? ' shuffle-animation' : '')
                            : 'bg-gray-100 text-gray-700 border border-gray-300'
                        }`}
                      >
                        <span style={{ transform: 'scaleY(3)', display: 'inline-block' }}>{num}</span>
                      </div>
                    ))}
                  </div>
                  
                  {/* O Column */}
                  <div className="space-y-2">
                    {Array.from({length: 15}, (_, i) => i + 61).map(num => (
                      <div 
                        key={num} 
                        className={`h-10 rounded flex items-center justify-center text-lg font-bold ${
                          calledNumbers.includes(num) 
                            ? 'bg-purple-500 text-white border-2 border-purple-600' + (isShuffling ? ' shuffle-animation' : '')
                            : 'bg-gray-100 text-gray-700 border border-gray-300'
                        }`}
                      >
                        <span style={{ transform: 'scaleY(3)', display: 'inline-block' }}>{num}</span>
                      </div>
                    ))}
                  </div>
                </div>

                {/* Check Winner Button */}
                <div className="mt-6 text-center">
                  <Button 
                    className="bg-yellow-600 hover:bg-yellow-700 text-white px-8 py-2"
                    onClick={() => setShowWinnerChecker(true)}
                    disabled={!gameActive || calledNumbers.length < 5}
                  >
                    Check Winner
                  </Button>
                </div>
              </CardContent>
            </Card>
          </div>
        </div>
      </div>

      {/* Cartela Selector Dialog */}
      <Dialog open={showCartelaSelector} onOpenChange={setShowCartelaSelector}>
        <DialogContent className="max-w-4xl max-h-[80vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Select Fixed Cartelas</DialogTitle>
            <DialogDescription>
              Choose from 75 fixed cartela patterns. Each cartela has a unique number arrangement.
            </DialogDescription>
          </DialogHeader>
          <div className="grid grid-cols-5 gap-2 p-4">
            {FIXED_CARTELAS.map((cartela) => (
              <div
                key={cartela.Board}
                className={`p-2 border rounded cursor-pointer text-center ${
                  selectedCartelas.has(cartela.Board)
                    ? 'bg-blue-500 text-white border-blue-600'
                    : bookedCartelas.has(cartela.Board)
                    ? 'bg-gray-300 text-gray-500 cursor-not-allowed'
                    : 'bg-gray-100 hover:bg-gray-200'
                }`}
                onClick={() => {
                  if (!bookedCartelas.has(cartela.Board)) {
                    const newSelected = new Set(selectedCartelas);
                    if (newSelected.has(cartela.Board)) {
                      newSelected.delete(cartela.Board);
                    } else {
                      newSelected.add(cartela.Board);
                    }
                    setSelectedCartelas(newSelected);
                  }
                }}
              >
                #{cartela.Board}
              </div>
            ))}
          </div>
          <div className="flex justify-between items-center p-4 border-t">
            <span>Selected: {selectedCartelas.size} cartelas</span>
            <Button onClick={() => setShowCartelaSelector(false)}>
              Done
            </Button>
          </div>
        </DialogContent>
      </Dialog>

      {/* Winner Checker Dialog */}
      <Dialog open={showWinnerChecker} onOpenChange={setShowWinnerChecker}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Check Winner</DialogTitle>
            <DialogDescription>
              Enter the cartela number to verify if it's a winner
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            <div>
              <Label htmlFor="cartelaNumber">Cartela Number</Label>
              <Input
                id="cartelaNumber"
                type="number"
                value={winnerCartelaNumber}
                onChange={(e) => setWinnerCartelaNumber(e.target.value)}
                placeholder="Enter cartela number"
                min="1"
              />
            </div>
            <Button onClick={checkWinner} className="w-full">
              Check Winner
            </Button>
          </div>
        </DialogContent>
      </Dialog>

      {/* Winner Result Dialog */}
      <Dialog open={showWinnerResult} onOpenChange={setShowWinnerResult}>
        <DialogContent className="max-w-2xl">
          <DialogHeader>
            <DialogTitle>Winner Check Result</DialogTitle>
          </DialogHeader>
          <div className="py-6">
            {winnerResult.isWinner ? (
              <div className="space-y-6">
                <div className="text-center">
                  <div className="text-6xl mb-4">🎉</div>
                  <div className="text-xl font-bold text-green-600">
                    Cartela #{winnerResult.cartela}
                  </div>
                  <div className="text-2xl font-bold text-green-600">
                    BINGO! WINNER!
                  </div>
                  <div className="text-lg text-gray-600">
                    Pattern: {winnerResult.pattern}
                  </div>
                </div>

                {/* Visual Cartela Grid */}
                <div className="bg-white p-4 rounded-lg border">
                  <div className="text-center mb-4">
                    <div className="text-md font-medium text-green-700 mb-2">Cartela Grid:</div>
                    <div className="grid grid-cols-5 gap-2 max-w-sm mx-auto">
                      {/* Header */}
                      <div className="text-center font-bold text-sm bg-green-100 p-2 rounded">B</div>
                      <div className="text-center font-bold text-sm bg-green-100 p-2 rounded">I</div>
                      <div className="text-center font-bold text-sm bg-green-100 p-2 rounded">N</div>
                      <div className="text-center font-bold text-sm bg-green-100 p-2 rounded">G</div>
                      <div className="text-center font-bold text-sm bg-green-100 p-2 rounded">O</div>
                      
                      {/* Cartela pattern */}
                      {(winnerResult.cartelaPattern || getFixedCartelaPattern(winnerResult.cartela)).flat().map((num, index) => {
                        const isWinningCell = winnerResult.winningCells?.includes(index);
                        const isCalled = num !== 0 && calledNumbers.includes(num);
                        const isFree = index === 12;
                        
                        return (
                          <div key={index} className={`text-center text-sm p-2 border-2 rounded ${
                            isWinningCell 
                              ? 'winner-cell-animation' 
                              : isCalled || isFree
                                ? 'bg-green-200 border-green-400 text-green-800'
                                : 'bg-gray-50 border-gray-200 text-gray-600'
                          }`}>
                            {isFree ? 'FREE' : num}
                          </div>
                        );
                      })}
                    </div>
                  </div>
                </div>
              </div>
            ) : (
              <div className="space-y-4 text-center">
                <div className="text-6xl mb-4">❌</div>
                <div className="text-xl font-bold text-red-600">
                  Cartela #{winnerResult.cartela}
                </div>
                <div className="text-2xl font-bold text-red-600">
                  Not a Winner
                </div>
                <div className="text-gray-600 mt-4">
                  Game continues...
                </div>

                {/* Visual Cartela Grid for Non-Winner */}
                <div className="bg-white p-4 rounded-lg border">
                  <div className="text-center mb-4">
                    <div className="text-md font-medium text-red-700 mb-2">Cartela Grid:</div>
                    <div className="grid grid-cols-5 gap-2 max-w-sm mx-auto">
                      {/* Header */}
                      <div className="text-center font-bold text-sm bg-red-100 p-2 rounded">B</div>
                      <div className="text-center font-bold text-sm bg-red-100 p-2 rounded">I</div>
                      <div className="text-center font-bold text-sm bg-red-100 p-2 rounded">N</div>
                      <div className="text-center font-bold text-sm bg-red-100 p-2 rounded">G</div>
                      <div className="text-center font-bold text-sm bg-red-100 p-2 rounded">O</div>
                      
                      {/* Cartela pattern */}
                      {getFixedCartelaPattern(winnerResult.cartela).flat().map((num, index) => {
                        const isCalled = num !== 0 && calledNumbers.includes(num);
                        const isFree = index === 12;
                        
                        return (
                          <div key={index} className={`text-center text-sm p-2 border-2 rounded ${
                            isCalled || isFree
                              ? 'bg-green-200 border-green-400 text-green-800'
                              : 'bg-gray-50 border-gray-200 text-gray-600'
                          }`}>
                            {isFree ? 'FREE' : num}
                          </div>
                        );
                      })}
                    </div>
                  </div>
                </div>
              </div>
            )}
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}