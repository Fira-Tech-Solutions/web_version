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
  const [winnerResult, setWinnerResult] = useState({ isWinner: false, cartela: 0, message: "", pattern: "" });
  
  // Animation states
  const [isShuffling, setIsShuffling] = useState(false);
  
  // Auto-calling states
  const [isAutoCall, setIsAutoCall] = useState(false);
  const [autoCallInterval, setAutoCallInterval] = useState<NodeJS.Timeout | null>(null);
  const [isPaused, setIsPaused] = useState(false);
  const [currentAudio, setCurrentAudio] = useState<HTMLAudioElement | null>(null);
  const [nextNumber, setNextNumber] = useState<number | null>(null);
  const [isHovering, setIsHovering] = useState(false);
  
  // Active game query
  const { data: activeGame } = useQuery({
    queryKey: ['/api/games/active'],
    refetchInterval: 2000
  });

  // Shop data query
  const { data: shopData } = useQuery({
    queryKey: ['/api/shops', user?.shopId],
    enabled: !!user?.shopId
  });

  // Cartela preview state
  const [previewCartela, setPreviewCartela] = useState<number | null>(null);
  const [showCartelaPreview, setShowCartelaPreview] = useState(false);

  // Sync with active game data
  useEffect(() => {
    if (activeGame) {
      setActiveGameId((activeGame as any).id);
      setGameActive((activeGame as any).status === 'active');
      setGameFinished((activeGame as any).status === 'completed');
      setCalledNumbers((activeGame as any).calledNumbers || []);
      setBookedCartelas(new Set((activeGame as any).cartelas || []));
      
      const lastNumber = (activeGame as any).calledNumbers?.slice(-1)[0];
      setLastCalledNumber(lastNumber || null);
    }
  }, [activeGame]);

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

    // Get cartela pattern and check for win
    const cartelaPattern = getFixedCartelaPattern(cartelaNum);
    const cartelaNumbers = getCartelaNumbers(cartelaNum);
    
    // Check if all numbers in any winning pattern are called
    const isWinner = checkBingoWin(cartelaPattern, calledNumbers);
    
    setWinnerResult({
      isWinner: isWinner.isWinner,
      cartela: cartelaNum,
      message: isWinner.isWinner ? "BINGO! Winner found!" : "Not a winner yet",
      pattern: isWinner.pattern || ""
    });
    
    setShowWinnerResult(true);
    setShowWinnerChecker(false);
    
    if (isWinner.isWinner) {
      setGameActive(false);
      setGameFinished(true);
      
      // Submit winner to backend
      try {
        await fetch(`/api/games/${activeGameId}/declare-winner`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            cartelaNumber: cartelaNum,
            pattern: isWinner.pattern
          })
        });
        
        queryClient.invalidateQueries({ queryKey: ['/api/credit/balance'] });
      } catch (error) {
        console.error('Failed to declare winner:', error);
      }
    }
  };

  // Check for BINGO win patterns
  function checkBingoWin(cartelaPattern: number[][], calledNumbers: number[]): { isWinner: boolean; pattern?: string } {
    if (cartelaPattern.length !== 5) return { isWinner: false };
    
    // Check horizontal lines
    for (let row = 0; row < 5; row++) {
      let hasAllNumbers = true;
      for (let col = 0; col < 5; col++) {
        const num = cartelaPattern[row][col];
        if (num !== 0 && !calledNumbers.includes(num)) {
          hasAllNumbers = false;
          break;
        }
      }
      if (hasAllNumbers) {
        return { isWinner: true, pattern: `Horizontal Row ${row + 1}` };
      }
    }
    
    // Check vertical lines
    for (let col = 0; col < 5; col++) {
      let hasAllNumbers = true;
      for (let row = 0; row < 5; row++) {
        const num = cartelaPattern[row][col];
        if (num !== 0 && !calledNumbers.includes(num)) {
          hasAllNumbers = false;
          break;
        }
      }
      if (hasAllNumbers) {
        const letters = ['B', 'I', 'N', 'G', 'O'];
        return { isWinner: true, pattern: `Vertical ${letters[col]} Column` };
      }
    }
    
    // Check diagonal (top-left to bottom-right)
    let hasAllNumbers = true;
    for (let i = 0; i < 5; i++) {
      const num = cartelaPattern[i][i];
      if (num !== 0 && !calledNumbers.includes(num)) {
        hasAllNumbers = false;
        break;
      }
    }
    if (hasAllNumbers) {
      return { isWinner: true, pattern: "Diagonal (Top-Left to Bottom-Right)" };
    }
    
    // Check diagonal (top-right to bottom-left)
    hasAllNumbers = true;
    for (let i = 0; i < 5; i++) {
      const num = cartelaPattern[i][4 - i];
      if (num !== 0 && !calledNumbers.includes(num)) {
        hasAllNumbers = false;
        break;
      }
    }
    if (hasAllNumbers) {
      return { isWinner: true, pattern: "Diagonal (Top-Right to Bottom-Left)" };
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
                Welcome, {user?.name} | Employee | Shop: {(shopData as any)?.name || 'Loading...'}
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
                  {activeGameId && lastCalledNumber ? (
                    <>
                      <div className="flex justify-center items-center space-x-2 mb-2">
                        <div className="w-12 h-12 bg-red-500 text-white font-bold text-xl flex items-center justify-center rounded">
                          {getLetterForNumber(lastCalledNumber)}
                        </div>
                        <div className="w-12 h-12 bg-gray-800 text-white font-bold text-xl flex items-center justify-center rounded">
                          {lastCalledNumber}
                        </div>
                      </div>
                      <p className="text-xs text-gray-600">
                        {isShuffling ? "CALLING..." : `${getLetterForNumber(lastCalledNumber)}-${lastCalledNumber}`}
                      </p>
                    </>
                  ) : (
                    <>
                      <div className="flex justify-center items-center space-x-2 mb-2">
                        <div className="w-12 h-12 bg-gray-300 text-gray-500 font-bold text-xl flex items-center justify-center rounded">
                          ?
                        </div>
                        <div className="w-12 h-12 bg-gray-300 text-gray-500 font-bold text-xl flex items-center justify-center rounded">
                          ?
                        </div>
                      </div>
                      <p className="text-xs text-gray-600">
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

                  {/* Selected Cartelas Display */}
                  {selectedCartelas.size > 0 && (
                    <div className="bg-gray-50 p-3 rounded">
                      <Label className="text-sm font-medium">Selected Cartelas:</Label>
                      <div className="flex flex-wrap gap-1 mt-2">
                        {Array.from(selectedCartelas).map(num => (
                          <Badge key={num} variant="secondary" className="text-xs">
                            #{num}
                          </Badge>
                        ))}
                      </div>
                    </div>
                  )}

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
                    onClick={() => {
                      if (activeGameId && !gameActive) {
                        startGameMutation.mutate();
                      }
                    }}
                    disabled={!activeGameId || gameActive || startGameMutation.isPending}
                  >
                    {startGameMutation.isPending ? "Starting..." : "Start Game"}
                  </Button>

                  {/* Shuffle Button */}
                  <div className="flex justify-center">
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
                        className={`h-10 rounded flex items-center justify-center text-sm font-medium ${
                          calledNumbers.includes(num) 
                            ? 'bg-red-500 text-white border-2 border-red-600' + (isShuffling ? ' shuffle-animation' : '')
                            : 'bg-gray-100 text-gray-700 border border-gray-300'
                        }`}
                      >
                        {num}
                      </div>
                    ))}
                  </div>
                  
                  {/* I Column */}
                  <div className="space-y-2">
                    {Array.from({length: 15}, (_, i) => i + 16).map(num => (
                      <div 
                        key={num} 
                        className={`h-10 rounded flex items-center justify-center text-sm font-medium ${
                          calledNumbers.includes(num) 
                            ? 'bg-blue-500 text-white border-2 border-blue-600' + (isShuffling ? ' shuffle-animation' : '')
                            : 'bg-gray-100 text-gray-700 border border-gray-300'
                        }`}
                      >
                        {num}
                      </div>
                    ))}
                  </div>
                  
                  {/* N Column */}
                  <div className="space-y-2">
                    {Array.from({length: 15}, (_, i) => i + 31).map(num => (
                      <div 
                        key={num} 
                        className={`h-10 rounded flex items-center justify-center text-sm font-medium ${
                          calledNumbers.includes(num) 
                            ? 'bg-green-500 text-white border-2 border-green-600' + (isShuffling ? ' shuffle-animation' : '')
                            : 'bg-gray-100 text-gray-700 border border-gray-300'
                        }`}
                      >
                        {num}
                      </div>
                    ))}
                  </div>
                  
                  {/* G Column */}
                  <div className="space-y-2">
                    {Array.from({length: 15}, (_, i) => i + 46).map(num => (
                      <div 
                        key={num} 
                        className={`h-10 rounded flex items-center justify-center text-sm font-medium ${
                          calledNumbers.includes(num) 
                            ? 'bg-yellow-500 text-white border-2 border-yellow-600' + (isShuffling ? ' shuffle-animation' : '')
                            : 'bg-gray-100 text-gray-700 border border-gray-300'
                        }`}
                      >
                        {num}
                      </div>
                    ))}
                  </div>
                  
                  {/* O Column */}
                  <div className="space-y-2">
                    {Array.from({length: 15}, (_, i) => i + 61).map(num => (
                      <div 
                        key={num} 
                        className={`h-10 rounded flex items-center justify-center text-sm font-medium ${
                          calledNumbers.includes(num) 
                            ? 'bg-purple-500 text-white border-2 border-purple-600' + (isShuffling ? ' shuffle-animation' : '')
                            : 'bg-gray-100 text-gray-700 border border-gray-300'
                        }`}
                      >
                        {num}
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
              <div key={cartela.Board} className="space-y-1">
                <div
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
                <Button
                  size="sm"
                  variant="outline"
                  className="w-full text-xs py-1"
                  onClick={() => {
                    setPreviewCartela(cartela.Board);
                    setShowCartelaPreview(true);
                  }}
                >
                  View
                </Button>
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
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Winner Check Result</DialogTitle>
          </DialogHeader>
          <div className="text-center py-6">
            {winnerResult.isWinner ? (
              <div className="space-y-4">
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
            ) : (
              <div className="space-y-4">
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
              </div>
            )}
          </div>
        </DialogContent>
      </Dialog>

      {/* Cartela Preview Dialog */}
      <Dialog open={showCartelaPreview} onOpenChange={setShowCartelaPreview}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>Cartela #{previewCartela} Preview</DialogTitle>
            <DialogDescription>
              Fixed cartela pattern with predefined numbers
            </DialogDescription>
          </DialogHeader>
          {previewCartela && (
            <div className="space-y-4">
              {/* BINGO Headers */}
              <div className="grid grid-cols-5 gap-1">
                {['B', 'I', 'N', 'G', 'O'].map((letter, index) => {
                  const colors = ['bg-red-500', 'bg-blue-500', 'bg-green-500', 'bg-yellow-500', 'bg-purple-500'];
                  return (
                    <div key={letter} className={`h-8 ${colors[index]} text-white rounded flex items-center justify-center font-bold text-sm`}>
                      {letter}
                    </div>
                  );
                })}
              </div>
              
              {/* Cartela Grid */}
              <div className="grid grid-cols-5 gap-1">
                {(() => {
                  const cartela = FIXED_CARTELAS.find(c => c.Board === previewCartela);
                  if (!cartela) return null;
                  
                  const grid = [];
                  for (let row = 0; row < 5; row++) {
                    for (let col = 0; col < 5; col++) {
                      let value;
                      switch (col) {
                        case 0: value = cartela.B[row]; break;
                        case 1: value = cartela.I[row]; break;
                        case 2: value = cartela.N[row]; break;
                        case 3: value = cartela.G[row]; break;
                        case 4: value = cartela.O[row]; break;
                      }
                      
                      grid.push(
                        <div key={`${row}-${col}`} className="h-8 bg-gray-100 border rounded flex items-center justify-center text-sm font-medium">
                          {value === "FREE" ? "★" : value}
                        </div>
                      );
                    }
                  }
                  return grid;
                })()}
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}