import { useState, useEffect, useRef } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { useQuery, useMutation } from "@tanstack/react-query";
import { apiRequest } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";

interface BingoGameFixedProps {
  employeeName: string;
  employeeId: number;
  shopId: number;
  onLogout: () => void;
}

export default function BingoGameFixed({ employeeName, employeeId, shopId, onLogout }: BingoGameFixedProps) {
  const [calledNumbers, setCalledNumbers] = useState<number[]>([]);
  const [currentNumber, setCurrentNumber] = useState<number | null>(null);
  const [gameActive, setGameActive] = useState(false);
  const [lastCalledLetter, setLastCalledLetter] = useState<string>("");
  const [showCartelaSelector, setShowCartelaSelector] = useState(false);
  const [selectedCartela, setSelectedCartela] = useState<number | null>(null);
  const [cartelaCards, setCartelaCards] = useState<{[key: number]: number[][]}>({});
  const [bookedCartelas, setBookedCartelas] = useState<Set<number>>(new Set());
  const [gameAmount, setGameAmount] = useState("10");
  const [winnerFound, setWinnerFound] = useState<string | null>(null);
  const [winnerPattern, setWinnerPattern] = useState<string | null>(null);
  const [winnerPatternCells, setWinnerPatternCells] = useState<number[][] | null>(null);
  const [winnerCartelaCard, setWinnerCartelaCard] = useState<number[][] | null>(null);
  const [showWinnerVerification, setShowWinnerVerification] = useState(false);
  const [verificationCartela, setVerificationCartela] = useState("");
  const [autoCallInterval, setAutoCallInterval] = useState<NodeJS.Timeout | null>(null);
  const [gameFinished, setGameFinished] = useState(false);
  const [gamePaused, setGamePaused] = useState(false);
  const [totalCollected, setTotalCollected] = useState(0);
  const [winnerPayout, setWinnerPayout] = useState(0);
  
  const { toast } = useToast();
  
  // State for active game record
  const [activeGameId, setActiveGameId] = useState<number | null>(null);
  
  // Fetch shop data for profit margin calculation
  const { data: shopData } = useQuery({
    queryKey: ["/api/shops", shopId],
    enabled: !!shopId,
  });

  // Create game mutation
  const createGameMutation = useMutation({
    mutationFn: async () => {
      const response = await apiRequest("POST", "/api/games", {
        shopId,
        employeeId,
        status: 'waiting',
        entryFee: gameAmount,
        prizePool: totalCollected.toString()
      });
      return response;
    },
    onSuccess: (game) => {
      setActiveGameId(game.id);
    }
  });

  // Start game mutation
  const startGameMutation = useMutation({
    mutationFn: async (gameId: number) => {
      return await apiRequest("POST", `/api/games/${gameId}/start`);
    }
  });

  // Declare winner mutation
  const declareWinnerMutation = useMutation({
    mutationFn: async (data: { gameId: number; winnerId: number; winnerName: string }) => {
      return await apiRequest("POST", `/api/games/${data.gameId}/declare-winner`, {
        winnerId: data.winnerId,
        winnerName: data.winnerName
      });
    },
    onSuccess: (result) => {
      toast({
        title: "Game Completed",
        description: `Winner declared! Prize: ${result.financial.prizeAmount} ETB`,
      });
    }
  });

  // Get letter for BINGO number
  const getLetterForNumber = (number: number): string => {
    if (number >= 1 && number <= 15) return 'B';
    if (number >= 16 && number <= 30) return 'I';
    if (number >= 31 && number <= 45) return 'N';
    if (number >= 46 && number <= 60) return 'G';
    if (number >= 61 && number <= 75) return 'O';
    return '';
  };

  // Fixed cartela card generator - each cartela number always has the same numbers
  const generateFixedCartelaCard = (cartelaNumber: number): number[][] => {
    // Use cartela number as consistent seed
    const seed = cartelaNumber * 17 + 31;
    let currentSeed = seed;
    
    const seededRandom = () => {
      currentSeed = (currentSeed * 9301 + 49297) % 233280;
      return currentSeed / 233280;
    };
    
    const card: number[][] = [];
    const usedNumbers = new Set<number>();
    
    for (let row = 0; row < 5; row++) {
      const cardRow: number[] = [];
      
      for (let col = 0; col < 5; col++) {
        if (row === 2 && col === 2) {
          cardRow.push(0); // Free space
        } else {
          let min, max;
          if (col === 0) { min = 1; max = 15; }      // B column: 1-15
          else if (col === 1) { min = 16; max = 30; } // I column: 16-30  
          else if (col === 2) { min = 31; max = 45; } // N column: 31-45
          else if (col === 3) { min = 46; max = 60; } // G column: 46-60
          else { min = 61; max = 75; }                // O column: 61-75
          
          let num;
          let attempts = 0;
          do {
            num = Math.floor(seededRandom() * (max - min + 1)) + min;
            attempts++;
            if (attempts > 100) break; // Prevent infinite loop
          } while (usedNumbers.has(num));
          
          usedNumbers.add(num);
          cardRow.push(num);
        }
      }
      card.push(cardRow);
    }
    
    return card;
  };

  // Calculate winner payout based on profit margin
  const calculateWinnerPayout = (collectedAmount: number, profitMargin: string | undefined): number => {
    if (!profitMargin) return collectedAmount;
    
    const margin = parseFloat(profitMargin) || 0;
    const shopProfit = (collectedAmount * margin) / 100;
    return collectedAmount - shopProfit;
  };

  // Automatic number calling with 3-second intervals
  const startAutomaticNumberCalling = () => {
    if (autoCallInterval) {
      clearInterval(autoCallInterval);
    }
    
    const interval = setInterval(() => {
      callNumber();
    }, 3000);
    
    setAutoCallInterval(interval);
  };

  const stopAutomaticNumberCalling = () => {
    if (autoCallInterval) {
      clearInterval(autoCallInterval);
      setAutoCallInterval(null);
    }
  };

  // Call a single number
  const callNumber = () => {
    if (!gameActive || gamePaused || gameFinished) return;
    
    const allNumbers = Array.from({ length: 75 }, (_, i) => i + 1);
    const availableNumbers = allNumbers.filter(num => !calledNumbers.includes(num));
    
    if (availableNumbers.length === 0) {
      setGameActive(false);
      setGameFinished(true);
      stopAutomaticNumberCalling();
      return;
    }
    
    const randomIndex = Math.floor(Math.random() * availableNumbers.length);
    const newNumber = availableNumbers[randomIndex];
    
    setCurrentNumber(newNumber);
    setLastCalledLetter(getLetterForNumber(newNumber));
    
    // Play Amharic audio announcement
    playAmharicAudio(newNumber);
    
    const updated = [...calledNumbers, newNumber];
    setCalledNumbers(updated);
    
    // Check if all numbers have been called
    if (updated.length === 75) {
      setGameActive(false);
      setGameFinished(true);
      stopAutomaticNumberCalling();
    }
  };

  // Update payout calculation when total collected or shop data changes
  useEffect(() => {
    if (totalCollected > 0 && shopData) {
      const payout = calculateWinnerPayout(totalCollected, shopData.profitMargin);
      setWinnerPayout(payout);
    }
  }, [totalCollected, shopData]);

  // Play Amharic audio for number announcements
  const playAmharicAudio = (number: number) => {
    try {
      const letter = getLetterForNumber(number);
      const audioFile = `${letter}${number}.mp3`;
      
      const audio = new Audio(`/attached_assets/${audioFile}`);
      audio.volume = 0.7;
      audio.play().catch(error => {
        console.log(`Audio file not found: ${audioFile}`);
      });
    } catch (error) {
      console.log(`Error playing audio for number ${number}`);
    }
  };

  // Check for Bingo winning patterns
  const checkForBingo = (card: number[][], calledNums: number[]): { hasWin: boolean; pattern?: string; patternCells?: number[][] } => {
    const isMarked = (row: number, col: number) => {
      if (row === 2 && col === 2) return true; // Center is free space
      return calledNums.includes(card[row][col]);
    };

    // Pattern 1: Any horizontal line
    for (let row = 0; row < 5; row++) {
      if ([0, 1, 2, 3, 4].every(col => isMarked(row, col))) {
        return { 
          hasWin: true, 
          pattern: `Horizontal Line (Row ${row + 1})`,
          patternCells: [[row, 0], [row, 1], [row, 2], [row, 3], [row, 4]]
        };
      }
    }
    
    // Pattern 2: Any vertical line
    for (let col = 0; col < 5; col++) {
      const colNames = ['B', 'I', 'N', 'G', 'O'];
      if ([0, 1, 2, 3, 4].every(row => isMarked(row, col))) {
        return { 
          hasWin: true, 
          pattern: `Vertical Line (${colNames[col]} Column)`,
          patternCells: [[0, col], [1, col], [2, col], [3, col], [4, col]]
        };
      }
    }
    
    // Pattern 3: Diagonal (top-left to bottom-right)
    if ([0, 1, 2, 3, 4].every(i => isMarked(i, i))) {
      return { 
        hasWin: true, 
        pattern: "Diagonal (Top-Left to Bottom-Right)",
        patternCells: [[0, 0], [1, 1], [2, 2], [3, 3], [4, 4]]
      };
    }
    
    // Pattern 4: Diagonal (top-right to bottom-left)
    if ([0, 1, 2, 3, 4].every(i => isMarked(i, 4 - i))) {
      return { 
        hasWin: true, 
        pattern: "Diagonal (Top-Right to Bottom-Left)",
        patternCells: [[0, 4], [1, 3], [2, 2], [3, 1], [4, 0]]
      };
    }
    
    // Pattern 5: Four corners
    if (isMarked(0, 0) && isMarked(0, 4) && isMarked(4, 0) && isMarked(4, 4)) {
      return { 
        hasWin: true, 
        pattern: "Four Corners",
        patternCells: [[0, 0], [0, 4], [4, 0], [4, 4]]
      };
    }

    return { hasWin: false };
  };

  // Book cartela function with fixed numbers and profit calculation
  const bookCartela = () => {
    if (selectedCartela && !bookedCartelas.has(selectedCartela)) {
      const card = generateFixedCartelaCard(selectedCartela);
      setCartelaCards(prev => ({ ...prev, [selectedCartela]: card }));
      setBookedCartelas(prev => new Set([...prev, selectedCartela]));
      
      // Update total collected amount
      const amount = parseFloat(gameAmount);
      setTotalCollected(prev => prev + amount);
      
      toast({
        title: "Cartela Booked",
        description: `Cartela #${selectedCartela} booked for ${amount} Birr`,
      });
      
      setShowCartelaSelector(false);
      setSelectedCartela(null);
    }
  };

  // Generate cartela preview
  const generateCartelaPreview = (cartelaNumber: number) => {
    if (!cartelaCards[cartelaNumber]) {
      const card = generateFixedCartelaCard(cartelaNumber);
      setCartelaCards(prev => ({ ...prev, [cartelaNumber]: card }));
    }
    setSelectedCartela(cartelaNumber);
  };

  return (
    <div className="min-h-screen bg-gray-100 p-4">
      {/* Header */}
      <div className="bg-white shadow-sm rounded-lg mb-6 p-4">
        <div className="flex justify-between items-center">
          <div>
            <h1 className="text-2xl font-bold text-gray-900">Bingo Game Dashboard</h1>
            <p className="text-gray-600">Employee: {employeeName}</p>
          </div>
          <div className="flex items-center gap-4">
            <div className="text-right">
              <p className="text-sm text-gray-600">Total Collected</p>
              <p className="text-xl font-bold text-green-600">{totalCollected} Birr</p>
            </div>
            <div className="text-right">
              <p className="text-sm text-gray-600">Winner Gets</p>
              <p className="text-xl font-bold text-blue-600">{winnerPayout.toFixed(2)} Birr</p>
            </div>
            <Button onClick={onLogout} variant="outline">
              Logout
            </Button>
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-4 gap-6">
        {/* Left Panel - Game Controls */}
        <div className="lg:col-span-2">
          <Card>
            <CardHeader>
              <CardTitle className="text-center">Game Control Panel</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              {/* Current Number Display */}
              {currentNumber && (
                <div className="text-center p-6 bg-gradient-to-r from-blue-500 to-purple-600 rounded-lg text-white">
                  <div className="text-sm font-medium">Current Number</div>
                  <div className="text-4xl font-bold">{lastCalledLetter}-{currentNumber}</div>
                  <div className="text-lg">{lastCalledLetter} {currentNumber}</div>
                </div>
              )}

              {/* Game Status */}
              <div className="flex justify-center space-x-4">
                <Badge variant={gameActive ? "default" : "secondary"}>
                  {gameActive ? "Game Active" : "Game Inactive"}
                </Badge>
                <Badge variant={gameFinished ? "default" : "outline"}>
                  {gameFinished ? "Game Finished" : `${calledNumbers.length}/75 Numbers`}
                </Badge>
              </div>

              {/* Winner Display */}
              {winnerFound && (
                <div className="text-center p-4 bg-green-100 border border-green-400 rounded-lg">
                  <h3 className="text-lg font-bold text-green-800">Winner Found!</h3>
                  <p className="text-green-700">{winnerFound}</p>
                  <p className="text-sm text-green-600">Pattern: {winnerPattern}</p>
                  <p className="text-lg font-bold text-green-800">Payout: {winnerPayout.toFixed(2)} Birr</p>
                </div>
              )}

              {/* Game Amount Input */}
              <div className="space-y-2">
                <label className="text-sm font-medium">Game Amount (Birr)</label>
                <Input 
                  type="number" 
                  value={gameAmount}
                  onChange={(e) => setGameAmount(e.target.value)}
                  placeholder="10"
                />
              </div>

              {/* Action Buttons */}
              <Dialog open={showCartelaSelector} onOpenChange={setShowCartelaSelector}>
                <DialogTrigger asChild>
                  <Button className="w-full bg-blue-500 hover:bg-blue-600">
                    Book Cartela
                  </Button>
                </DialogTrigger>
                <DialogContent className="max-w-4xl max-h-[80vh] overflow-y-auto">
                  <DialogHeader>
                    <DialogTitle>Select Cartela (1-100)</DialogTitle>
                    <DialogDescription>
                      Choose a cartela number. Each cartela has fixed numbers that never change.
                    </DialogDescription>
                  </DialogHeader>
                  
                  {/* Cartela Number Grid */}
                  <div className="grid grid-cols-10 gap-2 mb-4">
                    {Array.from({ length: 100 }, (_, i) => i + 1).map(num => (
                      <Button
                        key={num}
                        variant={selectedCartela === num ? "default" : bookedCartelas.has(num) ? "destructive" : "outline"}
                        size="sm"
                        disabled={bookedCartelas.has(num)}
                        onClick={() => generateCartelaPreview(num)}
                        className="h-8 text-xs"
                      >
                        {num}
                      </Button>
                    ))}
                  </div>
                  
                  {/* Cartela Preview */}
                  {selectedCartela && cartelaCards[selectedCartela] && (
                    <div className="border-2 border-gray-300 rounded-lg p-4 bg-white">
                      <h3 className="text-lg font-bold mb-2 text-center">Cartela #{selectedCartela} Preview</h3>
                      
                      {/* BINGO Header */}
                      <div className="grid grid-cols-5 gap-1 mb-2">
                        {['B', 'I', 'N', 'G', 'O'].map((letter, index) => {
                          const colors = ['bg-orange-500', 'bg-green-500', 'bg-blue-500', 'bg-red-500', 'bg-purple-500'];
                          return (
                            <div key={letter} className={`h-8 ${colors[index]} text-white rounded flex items-center justify-center font-bold`}>
                              {letter}
                            </div>
                          );
                        })}
                      </div>
                      
                      {/* Numbers Grid */}
                      <div className="grid grid-cols-5 gap-1">
                        {cartelaCards[selectedCartela].flat().map((num, index) => (
                          <div
                            key={index}
                            className={`h-8 border border-gray-400 flex items-center justify-center text-sm font-medium ${
                              num === 0 ? 'bg-yellow-200 text-yellow-800' : 'bg-white'
                            }`}
                          >
                            {num === 0 ? 'FREE' : num}
                          </div>
                        ))}
                      </div>
                      
                      <div className="flex gap-2 mt-4 justify-center">
                        <Button 
                          className="bg-green-500 hover:bg-green-600"
                          onClick={bookCartela}
                        >
                          Book Card ({gameAmount} Birr)
                        </Button>
                        <Button 
                          variant="outline"
                          onClick={() => {
                            setShowCartelaSelector(false);
                            setSelectedCartela(null);
                          }}
                        >
                          Cancel
                        </Button>
                      </div>
                    </div>
                  )}
                </DialogContent>
              </Dialog>

              <Button 
                onClick={() => {
                  setGameActive(true);
                  setGameFinished(false);
                  setGamePaused(false);
                  setCalledNumbers([]);
                  setCurrentNumber(null);
                  setWinnerFound(null);
                  setLastCalledLetter("");
                  
                  // Start automatic number calling
                  setTimeout(() => {
                    callNumber();
                    startAutomaticNumberCalling();
                  }, 1000);
                }}
                className="w-full bg-green-500 hover:bg-green-600"
                disabled={gameActive}
              >
                {gameActive ? "Game Running..." : "Start Game"}
              </Button>

              {gameActive && (
                <div className="flex gap-2">
                  <Button 
                    onClick={() => {
                      setGamePaused(!gamePaused);
                      if (gamePaused) {
                        startAutomaticNumberCalling();
                      } else {
                        stopAutomaticNumberCalling();
                      }
                    }}
                    className="flex-1 bg-yellow-500 hover:bg-yellow-600"
                  >
                    {gamePaused ? "Resume Game" : "Pause Game"}
                  </Button>
                  
                  <Button 
                    onClick={() => {
                      setGameActive(false);
                      setGameFinished(true);
                      stopAutomaticNumberCalling();
                    }}
                    className="flex-1 bg-red-500 hover:bg-red-600"
                  >
                    End Game
                  </Button>
                </div>
              )}
            </CardContent>
          </Card>
        </div>

        {/* Right Panel - Called Numbers Board */}
        <div className="lg:col-span-2">
          <Card>
            <CardHeader>
              <CardTitle className="text-center">Called Numbers Board</CardTitle>
            </CardHeader>
            <CardContent>
              {/* BINGO Board */}
              <div className="max-w-xs mx-auto">
                {/* Header */}
                <div className="grid grid-cols-5 gap-1 mb-2">
                  {['B', 'I', 'N', 'G', 'O'].map((letter, index) => {
                    const colors = ['bg-orange-500', 'bg-green-500', 'bg-blue-500', 'bg-red-500', 'bg-purple-500'];
                    return (
                      <div key={letter} className={`h-8 ${colors[index]} text-white rounded flex items-center justify-center font-bold text-sm`}>
                        {letter}
                      </div>
                    );
                  })}
                </div>
                
                {/* Numbers Grid */}
                <div className="grid grid-cols-5 gap-1">
                  {Array.from({ length: 15 }, (_, row) =>
                    ['B', 'I', 'N', 'G', 'O'].map((letter, col) => {
                      let num;
                      if (letter === 'B') num = row + 1;
                      else if (letter === 'I') num = row + 16;
                      else if (letter === 'N') num = row + 31;
                      else if (letter === 'G') num = row + 46;
                      else num = row + 61;
                      
                      const isCalled = calledNumbers.includes(num);
                      const isCurrentNumber = num === currentNumber;
                      
                      return (
                        <div
                          key={`${letter}-${num}`}
                          className={`h-8 border border-gray-300 flex items-center justify-center text-xs font-medium rounded ${
                            isCurrentNumber 
                              ? 'bg-yellow-400 text-black border-yellow-600 font-bold' 
                              : isCalled 
                                ? 'bg-green-200 text-green-800 border-green-400' 
                                : 'bg-white text-gray-600'
                          }`}
                        >
                          {num}
                        </div>
                      );
                    })
                  ).flat()}
                </div>
              </div>

              {/* Booked Cartelas */}
              {bookedCartelas.size > 0 && (
                <div className="mt-6">
                  <h3 className="font-medium mb-2">Booked Cartelas ({bookedCartelas.size})</h3>
                  <div className="flex flex-wrap gap-1">
                    {[...bookedCartelas].map(num => (
                      <Badge key={num} variant="outline" className="text-xs">
                        #{num}
                      </Badge>
                    ))}
                  </div>
                </div>
              )}
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
}