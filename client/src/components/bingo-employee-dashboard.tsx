import { useState, useEffect, useRef } from "react";
import React from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useToast } from "@/hooks/use-toast";
import { useAuth } from "@/hooks/use-auth";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Upload, X, Settings, Trophy, Eye, EyeOff, Edit } from "lucide-react";
import { customBingoVoice } from "@/lib/custom-voice-synthesis";

interface BingoEmployeeDashboardProps {
  onLogout: () => void;
}

type GameState = 'SETTING' | 'REGISTERING' | 'PLAYING' | 'REPORT';

export default function BingoEmployeeDashboard({ onLogout }: BingoEmployeeDashboardProps) {
  const { user } = useAuth();
  const { toast } = useToast();
  const queryClient = useQueryClient();

  // Game state management
  const [gameState, setGameState] = useState<GameState>('SETTING');
  const [calledNumbers, setCalledNumbers] = useState<number[]>([]);
  const [currentNumber, setCurrentNumber] = useState<number | null>(null);
  const [speed, setSpeed] = useState(4);
  const [isAutoPlay, setIsAutoPlay] = useState(false);
  const [checkCardInput, setCheckCardInput] = useState("");
  const [isManual, setIsManual] = useState(false);
  const [selectedCards, setSelectedCards] = useState<Set<number>>(new Set());
  const [topUpFee, setTopUpFee] = useState("10");
  const [gameMode, setGameMode] = useState("Bereket");
  const [rechargeFile, setRechargeFile] = useState<File | null>(null);
  const [showNewGameConfirm, setShowNewGameConfirm] = useState(false);
  const [expandedCard, setExpandedCard] = useState<number | null>(null);
  const [isCallingNumber, setIsCallingNumber] = useState(false);
  const [isAutoCalling, setIsAutoCalling] = useState(false);
  const [isEditMode, setIsEditMode] = useState(false);
  const [editingCard, setEditingCard] = useState<number | null>(null);
  const [viewingCard, setViewingCard] = useState<number | null>(null);
  const [checkedCardResult, setCheckedCardResult] = useState<{
    cartelaNumber: number;
    isWinner: boolean;
    pattern?: string;
    cardNumbers: number[][];
  } | null>(null);
  const [isShuffling, setIsShuffling] = useState(false);
  const [selectedVoice, setSelectedVoice] = useState<string>("arada");
  const autoCallInterval = useRef<NodeJS.Timeout | null>(null);

  // Initialize voice selection
  useEffect(() => {
    const voices = customBingoVoice.getAvailableVoices();
    if (voices.length > 0) {
      const currentVoice = customBingoVoice.getCurrentVoice();
      if (currentVoice) {
        setSelectedVoice(currentVoice.name);
      }
    }
  }, []);

  // Generate 15x5 grid (1-75)
  const generateBingoGrid = () => {
    const grid: number[][] = [];
    for (let row = 0; row < 5; row++) {
      const rowNumbers: number[] = [];
      for (let col = 0; col < 15; col++) {
        const num = row * 15 + col + 1;
        rowNumbers.push(num);
      }
      grid.push(rowNumbers);
    }
    return grid;
  };

  const bingoGrid = generateBingoGrid();

  // Active game query
  const { data: activeGame } = useQuery({
    queryKey: ['/api/games/active'],
    refetchInterval: 5000
  });

  // Shop data query
  const { data: shopData } = useQuery({
    queryKey: [`/api/shops/${user?.shopId}`],
    enabled: !!user?.shopId,
  });

  // Cartelas query
  const { data: cartelas } = useQuery({
    queryKey: ['/api/cartelas', user?.shopId],
    queryFn: async () => {
      if (!user?.shopId) return [];
      const response = await fetch(`/api/cartelas/${user.shopId}`);
      if (!response.ok) return [];
      return response.json();
    },
    enabled: !!user?.shopId,
  });

  // Helper function to get letter for number
  const getLetterForNumber = (num: number): string => {
    if (num >= 1 && num <= 15) return "B";
    if (num >= 16 && num <= 30) return "I";
    if (num >= 31 && num <= 45) return "N";
    if (num >= 46 && num <= 60) return "G";
    if (num >= 61 && num <= 75) return "O";
    return "";
  };

  // Get color for BINGO letters
  const getLetterColor = (letter: string): string => {
    switch (letter) {
      case "B": return "bg-blue-900 text-white"; // Navy
      case "I": return "bg-red-600 text-white"; // Red
      case "N": return "bg-white text-black"; // White
      case "G": return "bg-green-600 text-white"; // Green
      case "O": return "bg-yellow-400 text-black"; // Yellow
      default: return "bg-gray-600 text-white";
    }
  };

  // Get ball gradient color
  const getBallGradient = (num: number): string => {
    if (num >= 1 && num <= 15) return "from-blue-500 to-blue-700";
    if (num >= 16 && num <= 30) return "from-red-500 to-red-700";
    if (num >= 31 && num <= 45) return "from-white to-gray-200";
    if (num >= 46 && num <= 60) return "from-green-500 to-green-700";
    if (num >= 61 && num <= 75) return "from-yellow-400 to-yellow-600";
    return "from-gray-400 to-gray-600";
  };

  // CSV Import handler
  const handleCSVImport = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      const reader = new FileReader();
      reader.onload = (ev) => {
        const content = ev.target?.result as string;
        // Process CSV content here
        toast({
          title: "CSV Imported",
          description: "Card data loaded successfully"
        });
      };
      reader.readAsText(file);
    }
  };

  // Top-up file handler
  const handleTopUpFile = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file && file.name.endsWith('.enc')) {
      setRechargeFile(file);
      const reader = new FileReader();
      reader.onload = (ev) => {
        const content = ev.target?.result as string;
        // Process .enc file for balance update
        fetch('/api/recharge/topup', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ encryptedData: content })
        })
          .then(response => response.json())
          .then(result => {
            toast({
              title: "Balance Updated",
              description: `Added ${result.amount} ETB. New balance: ${result.balance} ETB`
            });
            queryClient.invalidateQueries({ queryKey: ['/api/auth/me'] });
          })
          .catch(error => {
            toast({
              title: "Top-up Failed",
              description: error.message,
              variant: "destructive"
            });
          });
      };
      reader.readAsText(file);
    } else {
      toast({
        title: "Invalid File",
        description: "Please select a .enc file",
        variant: "destructive"
      });
    }
  };

  // Call number handler with voice synthesis
  const handleCallNumber = async () => {
    const availableNumbers = Array.from({ length: 75 }, (_, i) => i + 1)
      .filter(n => !calledNumbers.includes(n));

    if (availableNumbers.length === 0) {
      // Stop auto-calling if all numbers are called
      stopAutoCalling();
      return;
    }

    const randomIndex = Math.floor(Math.random() * availableNumbers.length);
    const newNumber = availableNumbers[randomIndex];

    setIsCallingNumber(true);

    // Update UI state immediately
    setCurrentNumber(newNumber);
    const newCalledNumbers = [...calledNumbers, newNumber];
    setCalledNumbers(newCalledNumbers);
    
    console.log(`Called number: ${newNumber}, Total called: ${newCalledNumbers.length}`, newCalledNumbers);

    // Show toast immediately
    toast({
      title: "Number Called",
      description: `${getLetterForNumber(newNumber)} ${newNumber}`
    });

    // Play voice announcement in background (non-blocking)
    try {
      await customBingoVoice.callNumber(newNumber);
    } catch (error) {
      console.error('Error calling number:', error);
      // Voice error doesn't affect the game state
    } finally {
      setIsCallingNumber(false);
    }
  };

  // Start auto-calling
  const startAutoCalling = () => {
    if (isAutoCalling) return;
    
    setIsAutoCalling(true);
    
    // Call first number immediately
    handleCallNumber();
    
    // Then call numbers at intervals based on speed
    const intervalMs = Math.max(1000, 11000 - (speed * 1000)); // Speed 1=10s, 10=1s
    autoCallInterval.current = setInterval(() => {
      handleCallNumber();
    }, intervalMs);
  };

  // Stop auto-calling
  const stopAutoCalling = () => {
    setIsAutoCalling(false);
    if (autoCallInterval.current) {
      clearInterval(autoCallInterval.current);
      autoCallInterval.current = null;
    }
  };

  // Toggle auto-calling
  const toggleAutoCalling = () => {
    if (isAutoCalling) {
      stopAutoCalling();
    } else {
      startAutoCalling();
    }
  };

  // Shuffle effect - shows all 75 cards in random order
  const handleShuffle = async () => {
    if (isShuffling) return;
    
    setIsShuffling(true);
    
    // Play shuffle sound
    try {
      await customBingoVoice.playShuffle();
    } catch (error) {
      console.warn('Error playing shuffle sound:', error);
    }
    
    // Stop shuffling after audio finishes (about 3 seconds)
    setTimeout(() => {
      setIsShuffling(false);
    }, 3000);
  };

  // Force re-render for checked card result
  const [, forceUpdate] = useState({});

  // Clean up interval on component unmount
  useEffect(() => {
    return () => {
      if (autoCallInterval.current) {
        clearInterval(autoCallInterval.current);
      }
    };
  }, []);

  // Update interval when speed changes
  useEffect(() => {
    if (isAutoCalling) {
      // Only restart if we're actually auto-calling
      // Don't stop and start immediately - just update the interval
      if (autoCallInterval.current) {
        clearInterval(autoCallInterval.current);
      }
      
      const intervalMs = Math.max(1000, 11000 - (speed * 1000));
      autoCallInterval.current = setInterval(() => {
        handleCallNumber();
      }, intervalMs);
    }
  }, [speed, isAutoCalling]);


  const handleCheckCard = async () => {
    console.log('handleCheckCard called, checkCardInput:', checkCardInput);
    
    if (!checkCardInput) {
      toast({
        title: "No Card Number",
        description: "Please enter a cartela number to check",
        variant: "destructive"
      });
      return;
    }

    const cartelaNumber = parseInt(checkCardInput);
    if (isNaN(cartelaNumber) || cartelaNumber <= 0) {
      toast({
        title: "Invalid Card Number",
        description: "Please enter a valid cartela number",
        variant: "destructive"
      });
      return;
    }

    // Check if cartela is registered for this game
    const isRegistered = selectedCards.has(cartelaNumber);
    console.log('Cartela:', cartelaNumber, 'isRegistered:', isRegistered, 'selectedCards:', Array.from(selectedCards));
    
    if (!isRegistered) {
      // Clear any previous result
      setCheckedCardResult(null);
      
      // Set not registered message to display in small popup
      setCheckedCardResult({
        cartelaNumber,
        isWinner: false,
        pattern: undefined,
        cardNumbers: []
      });
      
      // Force re-render
      forceUpdate({});
      
      // Play "not registered" audio
      try {
        await customBingoVoice.playNotRegistered();
      } catch (error) {
        console.warn('Error playing not registered audio:', error);
      }
      
      // Clear the message after 3 seconds
      setTimeout(() => {
        setCheckedCardResult(null);
        forceUpdate({});
      }, 3000);
      
      return;
    }

    // Cartela is registered - generate card layout with marked numbers
    const cardNumbers = generateCardNumbersWithCalled(cartelaNumber);
    console.log('Generated card numbers:', cardNumbers);
    
    // Check if it's a winner
    const result = checkCardWinner(cartelaNumber);
    console.log('Winner check result:', result);
    
    // Set the checked card result to display
    setCheckedCardResult({
      cartelaNumber,
      isWinner: result.isWinner,
      pattern: result.pattern,
      cardNumbers
    });
    
    // Force re-render
    forceUpdate({});
    
    // Play appropriate audio immediately
    try {
      if (result.isWinner) {
        await customBingoVoice.announceWinner(cartelaNumber, true);
      } else {
        await customBingoVoice.announceWinner(cartelaNumber, false);
      }
    } catch (error) {
      console.warn('Error playing audio:', error);
    }
  };

  // Start game with voice announcement
  const handleStartGame = async () => {
    if (selectedCards.size === 0) {
      toast({
        title: "No Cards Selected",
        description: "Please select at least one card to start the game",
        variant: "destructive"
      });
      return;
    }

    try {
      // Announce game start
      await customBingoVoice.announceGameStart();
      setGameState('PLAYING');
      toast({
        title: "Game Started",
        description: `Playing with ${selectedCards.size} cards`
      });
    } catch (error) {
      console.error('Error announcing game start:', error);
      // Still start the game even if voice fails
      setGameState('PLAYING');
      toast({
        title: "Game Started",
        description: `Playing with ${selectedCards.size} cards`
      });
    }
  };

  // Generate bingo card numbers for display
  const generateCardNumbers = (cardNum: number): number[][] => {
    // Use a deterministic seed based on card number for consistent display
    const seed = cardNum * 12345;
    const random = (min: number, max: number) => {
      const x = Math.sin(seed + min + max) * 10000;
      return Math.floor((x - Math.floor(x)) * (max - min + 1)) + min;
    };

    const card: number[][] = [];

    // B column (1-15)
    const b = Array.from({ length: 5 }, () => random(1, 15));
    // I column (16-30)
    const i = Array.from({ length: 5 }, () => random(16, 30));
    // N column (31-45) with free space in middle
    const n = Array.from({ length: 2 }, () => random(31, 45));
    n.push(0); // Free space
    n.push(...Array.from({ length: 2 }, () => random(31, 45)));
    // G column (46-60)
    const g = Array.from({ length: 5 }, () => random(46, 60));
    // O column (61-75)
    const o = Array.from({ length: 5 }, () => random(61, 75));

    card.push(b, i, n, g, o);
    return card;
  };

  // Generate card numbers with called number highlighting
  const generateCardNumbersWithCalled = (cardNum: number): number[][] => {
    const card = generateCardNumbers(cardNum);
    
    // Mark called numbers by making them negative (for display logic)
    const markedCard = card.map(row => 
      row.map(num => {
        if (num === 0) return 0; // Free space
        return calledNumbers.includes(num) ? -num : num;
      })
    );
    
    return markedCard;
  };

  // Check if a card is a winner
  const checkCardWinner = (cardNum: number): { isWinner: boolean; pattern?: string } => {
    const card = generateCardNumbers(cardNum);
    
    // Check rows
    for (let row = 0; row < 5; row++) {
      let rowComplete = true;
      for (let col = 0; col < 5; col++) {
        const num = card[row][col];
        if (num !== 0 && !calledNumbers.includes(num)) {
          rowComplete = false;
          break;
        }
      }
      if (rowComplete) {
        return { isWinner: true, pattern: `Horizontal Row ${row + 1}` };
      }
    }

    // Check columns
    for (let col = 0; col < 5; col++) {
      let colComplete = true;
      for (let row = 0; row < 5; row++) {
        const num = card[row][col];
        if (num !== 0 && !calledNumbers.includes(num)) {
          colComplete = false;
          break;
        }
      }
      if (colComplete) {
        const columnNames = ['B', 'I', 'N', 'G', 'O'];
        return { isWinner: true, pattern: `Vertical Column ${columnNames[col]}` };
      }
    }

    // Check diagonal 1 (top-left to bottom-right)
    let diag1Complete = true;
    for (let i = 0; i < 5; i++) {
      const num = card[i][i];
      if (num !== 0 && !calledNumbers.includes(num)) {
        diag1Complete = false;
        break;
      }
    }
    if (diag1Complete) {
      return { isWinner: true, pattern: 'Diagonal (Top-Left to Bottom-Right)' };
    }

    // Check diagonal 2 (top-right to bottom-left)
    let diag2Complete = true;
    for (let i = 0; i < 5; i++) {
      const num = card[i][4 - i];
      if (num !== 0 && !calledNumbers.includes(num)) {
        diag2Complete = false;
        break;
      }
    }
    if (diag2Complete) {
      return { isWinner: true, pattern: 'Diagonal (Top-Right to Bottom-Left)' };
    }

    return { isWinner: false };
  };

  // Render bingo card component
  const renderBingoCard = (cardNum: number, isSelected: boolean) => {
    const cardNumbers = generateCardNumbers(cardNum);

    return (
      <div className={`relative transition-all duration-200 ${isSelected ? 'scale-105' : 'scale-100'}`}>
        <div
          className={`p-3 rounded-lg border-2 transition-all ${isSelected
            ? 'border-blue-600 bg-blue-50 shadow-lg'
            : 'border-gray-300 bg-white hover:border-blue-400 hover:shadow-md'
            }`}
        >
          {/* Card Header with Number and Eye Icon */}
          <div className="flex justify-between items-center mb-2">
            <div className="font-bold text-lg text-gray-700">Card #{cardNum}</div>
            <button
              onClick={(e) => {
                e.stopPropagation();
                setExpandedCard(cardNum);
              }}
              className="p-1 rounded hover:bg-gray-200 transition-colors"
              title="Show card layout"
            >
              <Eye className="w-4 h-4 text-gray-600" />
            </button>
          </div>

          {/* Compact View - Simple card number display */}
          <div
            onClick={() => {
              const newSelected = new Set(selectedCards);
              if (isSelected) {
                newSelected.delete(cardNum);
              } else {
                newSelected.add(cardNum);
              }
              setSelectedCards(newSelected);
            }}
            className="cursor-pointer"
          >
            <div className={`p-4 rounded-lg border-2 transition-all ${isSelected
              ? 'border-blue-600 bg-blue-50 shadow-lg'
              : 'border-gray-300 bg-white hover:border-blue-400 hover:shadow-md'
              }`}>
              <div className="flex justify-between items-center">
                <div className="font-bold text-lg text-gray-700">Card #{cardNum}</div>
                <button
                  onClick={(e) => {
                    e.stopPropagation();
                    setExpandedCard(cardNum);
                  }}
                  className="p-1 rounded hover:bg-gray-200 transition-colors"
                  title="Show card layout"
                >
                  <Eye className="w-4 h-4 text-gray-600" />
                </button>
              </div>
              {isSelected && (
                <div className="mt-2 bg-blue-600 text-white rounded px-2 py-1 text-center text-xs font-bold">
                  SELECTED
                </div>
              )}
            </div>
          </div>
        </div>
      </div>
    );
  };

  return (
    <div className="min-h-screen bg-gradient-to-b from-gray-900 via-gray-800 to-gray-900 text-white">
      {/* Game Setting Overlay */}
      {gameState === 'SETTING' && (
        <div className="fixed inset-0 bg-black bg-opacity-70 flex items-center justify-center z-50">
          <div className="bg-white text-black rounded-lg shadow-2xl max-w-2xl w-full mx-4">
            {/* Header */}
            <div className="bg-gray-800 text-white px-6 py-3 rounded-t-lg flex justify-between items-center">
              <div className="flex gap-4 text-sm">
                <button onClick={onLogout} className="hover:text-blue-400 transition">
                  Logout
                </button>
                <button
                  onClick={() => setGameState('REGISTERING')}
                  className="hover:text-blue-400 transition"
                >
                  Register Card
                </button>
                <button
                  onClick={() => setGameState('REPORT')}
                  className="hover:text-blue-400 transition"
                >
                  Report
                </button>
              </div>
              <div className="text-sm">Round 1</div>
            </div>

            {/* Content */}
            <div className="p-8 text-center">
              <h2 className="text-2xl font-bold mb-6 text-gray-800">የጨዋታው ትእዛዝ</h2>

              {/* Card Preview Image */}
              <div className="bg-blue-600 rounded-lg p-6 mb-6 mx-auto max-w-md">
                <div className="bg-white rounded-lg p-4">
                  <div className="grid grid-cols-5 gap-2 mb-2">
                    <div className="font-bold text-blue-900">B</div>
                    <div className="font-bold text-blue-900">I</div>
                    <div className="font-bold text-blue-900">N</div>
                    <div className="font-bold text-blue-900">G</div>
                    <div className="font-bold text-blue-900">O</div>
                  </div>
                  <div className="grid grid-cols-5 gap-2 text-sm">
                    {[15, 16, 39, 59, 66].map((n, i) => (
                      <div key={i} className="bg-white border-2 border-blue-900 rounded p-2 font-bold text-blue-900">
                        {n}
                      </div>
                    ))}
                    {[11, 28, 40, 51, 68].map((n, i) => (
                      <div key={i} className="bg-white border-2 border-blue-900 rounded p-2 font-bold text-blue-900">
                        {n}
                      </div>
                    ))}
                    {[12, 20].map((n, i) => (
                      <div key={i} className="bg-white border-2 border-blue-900 rounded p-2 font-bold text-blue-900">
                        {n}
                      </div>
                    ))}
                    <div className="bg-yellow-400 rounded p-2 flex items-center justify-center">
                      <span className="text-2xl">★</span>
                    </div>
                    {[56, 67].map((n, i) => (
                      <div key={i} className="bg-white border-2 border-blue-900 rounded p-2 font-bold text-blue-900">
                        {n}
                      </div>
                    ))}
                    {[3, 30, 35, 60, 72].map((n, i) => (
                      <div key={i} className="bg-white border-2 border-blue-900 rounded p-2 font-bold text-blue-900">
                        {n}
                      </div>
                    ))}
                    {[10, 24, 37, 53, 64].map((n, i) => (
                      <div key={i} className="bg-white border-2 border-blue-900 rounded p-2 font-bold text-blue-900">
                        {n}
                      </div>
                    ))}
                  </div>
                  <div className="mt-4 bg-yellow-400 text-black font-bold py-2 rounded">
                    Card No 1
                  </div>
                </div>
              </div>

              <Button
                onClick={() => setGameState('REGISTERING')}
                className="bg-blue-600 hover:bg-blue-700 text-white px-8 py-3 text-lg"
              >
                Start
              </Button>
            </div>
          </div>
        </div>
      )}

      {/* Report View */}
      {gameState === 'REPORT' && (
        <div className="fixed inset-0 bg-black bg-opacity-70 flex items-center justify-center z-50 p-4">
          <div className="bg-white text-black rounded-lg shadow-2xl max-w-4xl w-full max-h-[90vh] overflow-hidden flex flex-col">
            {/* Header */}
            <div className="bg-gray-800 text-white px-6 py-3 flex justify-between items-center">
              <h2 className="text-xl font-bold">Game Report & Balance</h2>
              <button onClick={() => setGameState('SETTING')} className="hover:text-red-400">
                <X className="w-6 h-6" />
              </button>
            </div>

            <div className="p-6 overflow-y-auto">
              {/* Balance Section */}
              <div className="mb-6 bg-blue-50 rounded-lg p-6">
                <h3 className="text-xl font-bold mb-4">Current Balance</h3>
                <div className="text-4xl font-bold text-blue-600 mb-4">
                  {(shopData as any)?.balance || 0} ETB
                </div>
                <label className="cursor-pointer">
                  <input
                    type="file"
                    accept=".enc"
                    onChange={handleTopUpFile}
                    className="hidden"
                  />
                  <Button className="bg-green-600 hover:bg-green-700 text-white">
                    <Upload className="w-4 h-4 mr-2" />
                    Top Up Balance (.enc file)
                  </Button>
                </label>
              </div>

              {/* Game History */}
              <div className="mb-6">
                <h3 className="text-xl font-bold mb-4">Game History</h3>
                <div className="bg-gray-50 rounded-lg overflow-hidden">
                  <table className="w-full">
                    <thead className="bg-gray-200">
                      <tr>
                        <th className="px-4 py-3 text-left">Round</th>
                        <th className="px-4 py-3 text-left">Date</th>
                        <th className="px-4 py-3 text-left">Cards</th>
                        <th className="px-4 py-3 text-left">Amount</th>
                        <th className="px-4 py-3 text-left">Winner</th>
                        <th className="px-4 py-3 text-left">Status</th>
                      </tr>
                    </thead>
                    <tbody>
                      {/* Sample data - replace with actual game history */}
                      <tr className="border-b border-gray-200">
                        <td className="px-4 py-3">Round 1</td>
                        <td className="px-4 py-3">{new Date().toLocaleDateString()}</td>
                        <td className="px-4 py-3">25</td>
                        <td className="px-4 py-3">250 ETB</td>
                        <td className="px-4 py-3">Card #15</td>
                        <td className="px-4 py-3">
                          <span className="bg-green-100 text-green-800 px-2 py-1 rounded text-sm">
                            Completed
                          </span>
                        </td>
                      </tr>
                      <tr className="border-b border-gray-200">
                        <td className="px-4 py-3">Round 2</td>
                        <td className="px-4 py-3">{new Date().toLocaleDateString()}</td>
                        <td className="px-4 py-3">30</td>
                        <td className="px-4 py-3">300 ETB</td>
                        <td className="px-4 py-3">Card #42</td>
                        <td className="px-4 py-3">
                          <span className="bg-green-100 text-green-800 px-2 py-1 rounded text-sm">
                            Completed
                          </span>
                        </td>
                      </tr>
                    </tbody>
                  </table>
                </div>
              </div>

              {/* Statistics */}
              <div className="grid grid-cols-3 gap-4">
                <div className="bg-blue-50 rounded-lg p-4 text-center">
                  <div className="text-3xl font-bold text-blue-600">
                    {calledNumbers.length}
                  </div>
                  <div className="text-sm text-gray-600 mt-2">Total Games</div>
                </div>
                <div className="bg-green-50 rounded-lg p-4 text-center">
                  <div className="text-3xl font-bold text-green-600">
                    {selectedCards.size}
                  </div>
                  <div className="text-sm text-gray-600 mt-2">Cards Sold</div>
                </div>
                <div className="bg-purple-50 rounded-lg p-4 text-center">
                  <div className="text-3xl font-bold text-purple-600">
                    {selectedCards.size * parseInt(topUpFee)}
                  </div>
                  <div className="text-sm text-gray-600 mt-2">Total Revenue (ETB)</div>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Registration Workflow */}
      {gameState === 'REGISTERING' && (
        <div className="fixed inset-0 bg-black bg-opacity-70 flex items-center justify-center z-50 p-4">
          <div className="bg-white text-black rounded-lg shadow-2xl max-w-6xl w-full max-h-[90vh] overflow-hidden flex flex-col">
            {/* Header */}
            <div className="bg-gray-800 text-white px-6 py-3 flex justify-between items-center">
              <h2 className="text-xl font-bold">Register Cards</h2>
              <button onClick={() => setGameState('SETTING')} className="hover:text-red-400">
                <X className="w-6 h-6" />
              </button>
            </div>

            <div className="flex flex-1 overflow-hidden">
              {/* Left Side - Available Cards */}
              <div className="w-2/3 border-r border-gray-300 p-6 overflow-y-auto bg-gradient-to-b from-gray-800 to-gray-900">
                <div className="flex justify-between items-center mb-4">
                  <h3 className="text-lg font-bold text-white">Available Cards</h3>
                  <div className="flex gap-2">
                    <Button
                      className={`${isEditMode ? 'bg-orange-600 hover:bg-orange-700' : 'bg-blue-600 hover:bg-blue-700'} text-white`}
                      onClick={() => {
                        setIsEditMode(!isEditMode);
                        setEditingCard(null);
                        toast({
                          title: isEditMode ? "Edit Mode Disabled" : "Edit Mode Enabled",
                          description: isEditMode ? "Click cards to select them" : "Click cards to edit their numbers"
                        });
                      }}
                    >
                      <Edit className="w-4 h-4 mr-2" />
                      {isEditMode ? 'Done Editing' : 'Edit'}
                    </Button>
                    <label className="cursor-pointer">
                      <input
                        type="file"
                        accept=".csv"
                        onChange={handleCSVImport}
                        className="hidden"
                      />
                      <Button className="bg-green-600 hover:bg-green-700 text-white">
                        <Upload className="w-4 h-4 mr-2" />
                        CSV Import
                      </Button>
                    </label>
                  </div>
                </div>

                {/* Circular Card Grid */}
                <div className="grid grid-cols-11 gap-2 p-4">
                  {Array.from({ length: 100 }, (_, i) => i + 1).map((cardNum) => {
                    const isSelected = selectedCards.has(cardNum);
                    const isBeingEdited = editingCard === cardNum;
                    return (
                      <div key={cardNum} className="relative">
                        <button
                          onClick={() => {
                            if (isEditMode) {
                              // In edit mode, open edit dialog
                              setEditingCard(cardNum);
                            } else {
                              // In normal mode, toggle selection
                              const newSelected = new Set(selectedCards);
                              if (isSelected) {
                                newSelected.delete(cardNum);
                              } else {
                                newSelected.add(cardNum);
                              }
                              setSelectedCards(newSelected);
                            }
                          }}
                          className={`
                            w-14 h-14 rounded-full flex items-center justify-center
                            font-bold text-xl transition-all duration-200
                            border-4
                            ${isBeingEdited
                              ? 'bg-orange-600 text-white border-orange-400 shadow-lg shadow-orange-400/50 scale-110 animate-pulse'
                              : isSelected
                                ? 'bg-green-600 text-white border-yellow-400 shadow-lg shadow-green-400/50 scale-110'
                                : 'bg-blue-700 text-white border-yellow-600 hover:bg-blue-600 hover:border-yellow-400 hover:scale-105'
                            }
                          `}
                          title={isEditMode ? `Edit Card #${cardNum}` : `Card #${cardNum}`}
                        >
                          {cardNum}
                        </button>
                        {isSelected && (
                          <button
                            onClick={(e) => {
                              e.stopPropagation();
                              setViewingCard(cardNum);
                            }}
                            className="absolute -bottom-1 -right-1 w-5 h-5 bg-blue-600 hover:bg-blue-700 text-white rounded-full flex items-center justify-center shadow-md transition-all hover:scale-110 z-10"
                            title="View card layout"
                          >
                            <Eye className="w-3 h-3" />
                          </button>
                        )}
                      </div>
                    );
                  })}
                </div>
              </div>

              {/* Right Side - Summary */}
              <div className="w-1/3 p-6 bg-gray-700 overflow-y-auto">
                <h3 className="text-lg font-bold mb-4 text-white">Summary</h3>

                <div className="mb-4">
                  <div className="text-sm text-gray-200 mb-3 font-semibold">Selected Cards: {selectedCards.size}</div>

                  {/* Display selected cards as circular buttons */}
                  {selectedCards.size > 0 ? (
                    <div className="bg-gradient-to-b from-gray-800 to-gray-900 border border-gray-300 rounded-lg p-4 max-h-96 overflow-y-auto">
                      <div className="grid grid-cols-5 gap-2">
                        {Array.from(selectedCards).sort((a, b) => a - b).map((cardNum) => (
                          <div key={cardNum} className="relative">
                            <button
                              className="w-12 h-12 rounded-full flex items-center justify-center font-bold text-lg transition-all duration-200 border-4 bg-green-600 text-white border-yellow-400 shadow-lg shadow-green-400/50 hover:scale-110"
                              title={`Card #${cardNum}`}
                            >
                              {cardNum}
                            </button>
                            <button
                              onClick={() => {
                                const newSelected = new Set(selectedCards);
                                newSelected.delete(cardNum);
                                setSelectedCards(newSelected);
                              }}
                              className="absolute -top-1 -right-1 w-5 h-5 bg-red-600 hover:bg-red-700 text-white rounded-full flex items-center justify-center shadow-md transition-all hover:scale-110"
                              title="Remove card"
                            >
                              <X className="w-3 h-3" />
                            </button>
                          </div>
                        ))}
                      </div>
                    </div>
                  ) : (
                    <div className="bg-white border border-gray-300 rounded-lg p-4 text-center text-gray-500 text-sm">
                      No cards selected
                    </div>
                  )}
                </div>

                <div className="mb-4">
                  <label className="block text-sm font-medium mb-2 text-white">Top-up Fee (ETB)</label>
                  <Select value={topUpFee} onValueChange={setTopUpFee}>
                    <SelectTrigger className="w-full">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="10">10 ETB</SelectItem>
                      <SelectItem value="20">20 ETB</SelectItem>
                      <SelectItem value="40">40 ETB</SelectItem>
                      <SelectItem value="50">50 ETB</SelectItem>
                      <SelectItem value="100">100 ETB</SelectItem>
                      <SelectItem value="200">200 ETB</SelectItem>
                    </SelectContent>
                  </Select>
                </div>

                <div className="mb-4">
                  <div className="text-sm text-gray-200 font-semibold">Total: {selectedCards.size * parseInt(topUpFee)} ETB</div>
                </div>

                <Button
                  onClick={handleStartGame}
                  className="w-full bg-blue-600 hover:bg-blue-700 text-white py-3"
                  disabled={selectedCards.size === 0}
                >
                  Start Game
                </Button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Edit Card Dialog */}
      {editingCard !== null && (
        <div className="fixed inset-0 bg-black bg-opacity-70 flex items-center justify-center z-[60] p-4">
          <div className="bg-white text-black rounded-lg shadow-2xl max-w-md w-full p-4">
            <div className="flex justify-between items-center mb-3">
              <h3 className="text-lg font-bold">Edit Card #{editingCard}</h3>
              <button
                onClick={() => setEditingCard(null)}
                className="text-gray-600 hover:text-gray-800"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="mb-4">
              {/* Card Preview */}
              <div className="bg-blue-50 rounded-lg p-3">
                <div className="text-center mb-2 text-sm font-bold text-gray-700">Card Layout</div>
                <div className="flex justify-center">
                  <div className="bg-white rounded-lg p-2 inline-block">
                    <div className="grid grid-cols-5 gap-1 mb-1">
                      <div className="font-bold text-blue-900 text-center text-xs">B</div>
                      <div className="font-bold text-red-900 text-center text-xs">I</div>
                      <div className="font-bold text-gray-900 text-center text-xs">N</div>
                      <div className="font-bold text-green-900 text-center text-xs">G</div>
                      <div className="font-bold text-yellow-900 text-center text-xs">O</div>
                    </div>
                    <div className="grid grid-cols-5 gap-1">
                      {generateCardNumbers(editingCard).map((col, colIdx) => (
                        <div key={colIdx} className="flex flex-col gap-1">
                          {col.map((num, rowIdx) => (
                            <div
                              key={rowIdx}
                              className={`w-8 h-8 border border-blue-900 rounded flex items-center justify-center font-bold text-xs ${num === 0 ? 'bg-yellow-400 text-yellow-900' : 'bg-white text-blue-900'
                                }`}
                            >
                              {num === 0 ? '★' : num}
                            </div>
                          ))}
                        </div>
                      ))}
                    </div>
                  </div>
                </div>
              </div>

              <div className="bg-yellow-50 border border-yellow-300 rounded-lg p-2 mt-3">
                <p className="text-xs text-yellow-800">
                  <strong>Note:</strong> Full editing coming soon.
                </p>
              </div>
            </div>

            <div className="flex gap-2 justify-end">
              <Button
                onClick={() => setEditingCard(null)}
                className="bg-gray-500 hover:bg-gray-600 text-white text-sm py-2 px-3"
              >
                Cancel
              </Button>
              <Button
                onClick={() => {
                  toast({
                    title: "Card Updated",
                    description: `Card #${editingCard} updated`
                  });
                  setEditingCard(null);
                }}
                className="bg-blue-600 hover:bg-blue-700 text-white text-sm py-2 px-3"
              >
                Save
              </Button>
            </div>
          </div>
        </div>
      )}

      {/* View Card Dialog */}
      {viewingCard !== null && (
        <div className="fixed inset-0 bg-black bg-opacity-70 flex items-center justify-center z-[60] p-4">
          <div className="bg-white text-black rounded-lg shadow-2xl max-w-md w-full p-4">
            <div className="flex justify-between items-center mb-3">
              <h3 className="text-lg font-bold">Card #{viewingCard}</h3>
              <button
                onClick={() => setViewingCard(null)}
                className="text-gray-600 hover:text-gray-800"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="mb-4">
              {/* Card Preview */}
              <div className="bg-blue-50 rounded-lg p-3">
                <div className="text-center mb-2 text-sm font-bold text-gray-700">Card Layout</div>
                <div className="flex justify-center">
                  <div className="bg-white rounded-lg p-2 inline-block">
                    <div className="grid grid-cols-5 gap-1 mb-1">
                      <div className="font-bold text-blue-900 text-center text-xs">B</div>
                      <div className="font-bold text-red-900 text-center text-xs">I</div>
                      <div className="font-bold text-gray-900 text-center text-xs">N</div>
                      <div className="font-bold text-green-900 text-center text-xs">G</div>
                      <div className="font-bold text-yellow-900 text-center text-xs">O</div>
                    </div>
                    <div className="grid grid-cols-5 gap-1">
                      {generateCardNumbers(viewingCard).map((col, colIdx) => (
                        <div key={colIdx} className="flex flex-col gap-1">
                          {col.map((num, rowIdx) => (
                            <div
                              key={rowIdx}
                              className={`w-8 h-8 border border-blue-900 rounded flex items-center justify-center font-bold text-xs ${num === 0 ? 'bg-yellow-400 text-yellow-900' : 'bg-white text-blue-900'
                                }`}
                            >
                              {num === 0 ? '★' : num}
                            </div>
                          ))}
                        </div>
                      ))}
                    </div>
                  </div>
                </div>
              </div>
            </div>

            <div className="flex justify-center">
              <Button
                onClick={() => setViewingCard(null)}
                className="bg-blue-600 hover:bg-blue-700 text-white text-sm py-2 px-4"
              >
                Close
              </Button>
            </div>
          </div>
        </div>
      )}

      {/* Main Game Floor */}
      {gameState === 'PLAYING' && (
        <div className="h-screen flex flex-col p-4 overflow-hidden">
          {/* Shuffle Effect Overlay */}
          {isShuffling && (
            <div className="fixed inset-0 bg-black bg-opacity-95 flex flex-col items-center justify-center z-50">
              <div className="relative w-96 h-96 mb-8">
                {/* Bingo Cage Circle */}
                <div className="absolute inset-0 rounded-full border-8 border-yellow-500 animate-spin-slow">
                  {/* Mixing balls inside cage */}
                  <div className="absolute inset-0 flex items-center justify-center">
                    {Array.from({ length: 20 }, (_, i) => i + 1).map((num, idx) => {
                      const angle = (idx * 18) * (Math.PI / 180);
                      const radius = 35 + Math.sin(idx * 0.5) * 15;
                      const x = Math.cos(angle) * radius;
                      const y = Math.sin(angle) * radius;
                      const letter = num <= 15 ? 'B' : num <= 30 ? 'I' : num <= 45 ? 'N' : num <= 60 ? 'G' : 'O';
                      const colors: Record<string, string> = {
                        'B': 'bg-blue-500',
                        'I': 'bg-red-500',
                        'N': 'bg-white',
                        'G': 'bg-green-500',
                        'O': 'bg-yellow-500'
                      };
                      return (
                        <div
                          key={num}
                          className={`absolute w-12 h-12 rounded-full ${colors[letter]} flex items-center justify-center font-bold text-sm text-black shadow-lg animate-bounce-slow`}
                          style={{
                            transform: `translate(${x}px, ${y}px)`,
                            animationDelay: `${idx * 0.1}s`
                          }}
                        >
                          {letter}{num}
                        </div>
                      );
                    })}
                  </div>
                </div>
                {/* Cage wire effect */}
                <div className="absolute inset-0 rounded-full border-4 border-gray-400 opacity-30 animate-spin-reverse"></div>
              </div>
              
              <h2 className="text-4xl font-bold text-white mb-8 animate-pulse tracking-widest">SHUFFLING...</h2>
              
              {/* All 75 numbers grid with continuous shuffling */}
              <div className="w-full max-w-6xl px-4">
                <div className="bg-gray-900 rounded-xl p-4 border-2 border-yellow-500">
                  <div className="grid grid-cols-15 gap-2">
                    {Array.from({ length: 75 }, (_, i) => i + 1)
                      .sort(() => Math.random() - 0.5)
                      .map((num) => {
                        const letter = num <= 15 ? 'B' : num <= 30 ? 'I' : num <= 45 ? 'N' : num <= 60 ? 'G' : 'O';
                        const colors: Record<string, string> = {
                          'B': 'bg-blue-500',
                          'I': 'bg-red-500',
                          'N': 'bg-white',
                          'G': 'bg-green-500',
                          'O': 'bg-yellow-500'
                        };
                        return (
                          <div
                            key={num}
                            className={`w-8 h-8 ${colors[letter]} rounded flex items-center justify-center text-xs font-bold text-black animate-shuffle`}
                            style={{ animationDelay: `${Math.random() * 2}s` }}
                          >
                            {letter}{num}
                          </div>
                        );
                      })}
                  </div>
                </div>
              </div>
              
              {/* CSS for shuffle animations */}
              <style>{`
                @keyframes spin-slow {
                  from { transform: rotate(0deg); }
                  to { transform: rotate(360deg); }
                }
                @keyframes spin-reverse {
                  from { transform: rotate(360deg); }
                  to { transform: rotate(0deg); }
                }
                @keyframes bounce-slow {
                  0%, 100% { transform: translateY(0); }
                  50% { transform: translateY(-10px); }
                }
                @keyframes shuffle {
                  0%, 100% { transform: translateX(0) scale(1); }
                  25% { transform: translateX(-5px) scale(1.1); }
                  50% { transform: translateX(5px) scale(0.95); }
                  75% { transform: translateX(-3px) scale(1.05); }
                }
                .animate-spin-slow {
                  animation: spin-slow 3s linear infinite;
                }
                .animate-spin-reverse {
                  animation: spin-reverse 2s linear infinite;
                }
                .animate-bounce-slow {
                  animation: bounce-slow 0.5s ease-in-out infinite;
                }
                .animate-shuffle {
                  animation: shuffle 0.8s ease-in-out infinite;
                }
              `}</style>
            </div>
          )}

          {/* Top Row Dashboard */}
          <div className="grid grid-cols-4 gap-2 mb-2">
            {/* Large Number Ball */}
            <div className="bg-gray-800 rounded-lg p-3 flex items-center justify-center">
              <div className={`w-32 h-32 rounded-full bg-gradient-to-br ${currentNumber ? getBallGradient(currentNumber) : 'from-gray-600 to-gray-800'
                } flex items-center justify-center shadow-2xl border-4 border-white`}>
                <div className="text-center">
                  {currentNumber && (
                    <>
                      <div className="text-4xl font-bold text-white">
                        {currentNumber}
                      </div>
                      <div className="text-xl font-bold text-white mt-1">
                        {getLetterForNumber(currentNumber)}
                      </div>
                    </>
                  )}
                </div>
              </div>
            </div>

            {/* 5x5 Pattern Preview */}
            <div className="bg-gray-800 rounded-lg p-2">
              <div className="grid grid-cols-5 gap-2 mb-2">
                <div className="font-bold text-blue-900">B</div>
                <div className="font-bold text-blue-900">I</div>
                <div className="font-bold text-blue-900">N</div>
                <div className="font-bold text-blue-900">G</div>
                <div className="font-bold text-blue-900">O</div>
              </div>
              <div className="grid grid-cols-5 gap-2 text-sm">
                {[15, 16, 39, 59, 66].map((n, i) => (
                  <div key={i} className="bg-white border-2 border-blue-900 rounded p-2 font-bold text-blue-900">
                    {n}
                  </div>
                ))}
                {[11, 28, 40, 51, 68].map((n, i) => (
                  <div key={i} className="bg-white border-2 border-blue-900 rounded p-2 font-bold text-blue-900">
                    {n}
                  </div>
                ))}
                {[12, 20].map((n, i) => (
                  <div key={i} className="bg-white border-2 border-blue-900 rounded p-2 font-bold text-blue-900">
                    {n}
                  </div>
                ))}
              </div>
            </div>

            {/* Recent 5 Numbers */}
            <div className="bg-blue-900 rounded-lg p-2">
              <h3 className="text-xl font-bold mb-2 text-center">Recent 5 Numbers</h3>
              <div className="flex justify-center gap-2 mb-4 relative h-16">
                {Array.from({ length: 5 }).map((_, slotIndex) => {
                  // Get last 5 numbers in reverse order (newest first)
                  const recentNumbers = calledNumbers.slice(-5).reverse();
                  const num = recentNumbers[slotIndex];
                  const isNewest = slotIndex === 0 && num !== undefined;
                  
                  return (
                    <div
                      key={`slot-${slotIndex}`}
                      className="relative w-16 h-16"
                    >
                      <div
                        key={num !== undefined ? `num-${num}` : `empty-${slotIndex}`}
                        className={`absolute inset-0 w-16 h-16 rounded-full flex items-center justify-center shadow-lg transition-all duration-500 ${
                          num !== undefined
                            ? `bg-gradient-to-br ${getBallGradient(num)}`
                            : 'bg-gray-700 border-2 border-gray-600'
                        }`}
                        style={{
                          animation: isNewest ? 'slideInFromLeft 0.5s ease-out' : 'none'
                        }}
                      >
                        {num !== undefined ? (
                          <span className="text-white font-bold text-xl">{num}</span>
                        ) : (
                          <span className="text-gray-500 font-bold text-2xl">?</span>
                        )}
                      </div>
                    </div>
                  );
                })}
              </div>
              <div className="text-center">
                <div className="inline-block bg-purple-600 rounded-full px-4 py-2 text-white font-bold">
                  {calledNumbers.length}/75
                </div>
              </div>
            </div>
            <style>{`
              @keyframes slideInFromLeft {
                0% {
                  transform: translateX(-100px) scale(0.5);
                  opacity: 0;
                }
                50% {
                  transform: translateX(-20px) scale(1.1);
                }
                100% {
                  transform: translateX(0) scale(1);
                  opacity: 1;
                }
              }
            `}</style>

            {/* Prize Section */}
            <div className="bg-blue-900 rounded-lg p-2 text-center">
              <div className="text-6xl font-bold mb-2">ደረሻ</div>
              <div className="bg-blue-700 rounded-lg p-4">
                <div className="text-5xl font-bold text-yellow-400">10</div>
                <div className="text-2xl">ብር</div>
              </div>
            </div>
          </div>

          {/* Main 15x5 BINGO Board */}
          <div className="bg-gray-800 rounded-lg p-2 mb-2 flex-1">
            {/* Grid Rows */}
            {['B', 'I', 'N', 'G', 'O'].map((letter, rowIdx) => (
              <div key={letter} className="grid grid-cols-[auto_repeat(15,1fr)] gap-1 mb-1">
                <div className={`w-16 h-16 flex items-center justify-center text-3xl font-bold rounded ${getLetterColor(letter)}`}>
                  {letter}
                </div>
                {bingoGrid[rowIdx].map((num) => {
                  const isCalled = calledNumbers.includes(num);
                  return (
                    <div
                      key={num}
                      className={`h-16 rounded text-xl font-bold flex items-center justify-center ${isCalled
                        ? `bg-gradient-to-br ${getBallGradient(num)} text-white shadow-lg`
                        : 'bg-gray-700 text-gray-300'
                        }`}
                    >
                      {num}
                    </div>
                  );
                })}
              </div>
            ))}
          </div>

          {/* Control Bar */}
          <div className="bg-gray-800 rounded-lg p-4 flex items-center justify-between gap-4">
            <Button
              onClick={toggleAutoCalling}
              disabled={isCallingNumber}
              className={`${isAutoCalling ? 'bg-orange-600 hover:bg-orange-700' : 'bg-blue-600 hover:bg-blue-700'} text-white px-8 py-3 text-lg font-bold`}
            >
              {isAutoCalling ? "Pause" : "Bingo"}
            </Button>

            <Button
              onClick={() => setShowNewGameConfirm(true)}
              className="bg-blue-600 hover:bg-blue-700 text-white px-8 py-3 text-lg font-bold"
            >
              New Game
            </Button>

            <Button
              onClick={handleShuffle}
              disabled={isShuffling}
              className={`${isShuffling ? 'bg-purple-600 animate-pulse' : 'bg-blue-600 hover:bg-blue-700'} text-white px-8 py-3 text-lg font-bold`}
            >
              {isShuffling ? 'Shuffling...' : 'Bowzew'}
            </Button>

            <Select value={gameMode} onValueChange={setGameMode}>
              <SelectTrigger className="w-40 bg-white text-black">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="Bereket">Bereket</SelectItem>
                <SelectItem value="Standard">Standard</SelectItem>
                <SelectItem value="Quick">Quick</SelectItem>
              </SelectContent>
            </Select>

            <Select value={selectedVoice} onValueChange={(voice) => {
              setSelectedVoice(voice);
              const voices = customBingoVoice.getAvailableVoices();
              const selected = voices.find(v => v.name === voice);
              if (selected) {
                customBingoVoice.setVoice(selected);
              }
            }}>
              <SelectTrigger className="w-40 bg-white text-black">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {customBingoVoice.getAvailableVoices().map((voice) => (
                  <SelectItem key={voice.name} value={voice.name}>
                    {voice.displayName}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>

            <div className="flex items-center gap-2">
              <label className="text-white font-medium">Speed: {speed}</label>
              <input
                type="range"
                min="1"
                max="10"
                value={speed}
                onChange={(e) => setSpeed(parseInt(e.target.value))}
                className="w-32"
              />
            </div>

            <Input
              type="text"
              placeholder="Enter Card Num"
              value={checkCardInput}
              onChange={(e) => setCheckCardInput(e.target.value)}
              className="w-48 bg-white text-black"
            />

            <Button
              onClick={handleCheckCard}
              disabled={!checkCardInput}
              className={`${!checkCardInput ? 'bg-gray-400 cursor-not-allowed' : 'bg-blue-600 hover:bg-blue-700'} text-white px-8 py-3 text-lg font-bold`}
            >
              Check
            </Button>
          </div>

          {/* Checked Card Result Display */}
          {checkedCardResult && (
            <div className={`mt-4 ${checkedCardResult.cardNumbers.length === 0 ? 'bg-red-600 rounded-lg p-3' : 'bg-gray-800 rounded-lg p-4 border-2 border-yellow-500'}`}>
              {checkedCardResult.cardNumbers.length === 0 ? (
                // Not registered message - small popup above check button
                <div className="flex items-center justify-between">
                  <span className="text-white font-bold">
                    Card #{checkedCardResult.cartelaNumber} Not Registered
                  </span>
                  <Button
                    onClick={() => setCheckedCardResult(null)}
                    variant="ghost"
                    size="sm"
                    className="text-white hover:bg-red-700"
                  >
                    <X className="w-4 h-4" />
                  </Button>
                </div>
              ) : (
                // Registered card - show full card layout
                <>
                  <div className="flex justify-between items-center mb-4">
                    <h3 className="text-lg font-bold text-white">
                      Card #{checkedCardResult.cartelaNumber} - {checkedCardResult.isWinner ? '🎉 WINNER! 🎉' : 'NOT A WINNER'}
                    </h3>
                    <Button
                      onClick={() => setCheckedCardResult(null)}
                      variant="ghost"
                      size="sm"
                      className="text-white hover:bg-gray-700"
                    >
                      <X className="w-4 h-4" />
                    </Button>
                  </div>
                  
                  {/* Card Layout */}
                  <div className="border-2 rounded-lg overflow-hidden">
                    {/* BINGO Header */}
                    <div className="grid grid-cols-5 gap-1 bg-gray-700">
                      {['B', 'I', 'N', 'G', 'O'].map((letter) => (
                        <div 
                          key={letter} 
                          className={`text-center py-2 font-bold text-white ${getLetterColor(letter)}`}
                        >
                          {letter}
                        </div>
                      ))}
                    </div>
                    {/* Card Numbers */}
                    {checkedCardResult.cardNumbers.map((row, rowIndex) => (
                      <div key={rowIndex} className="grid grid-cols-5 gap-1">
                        {row.map((num, colIndex) => {
                          const isCalled = num < 0;
                          const displayNum = Math.abs(num);
                          const isFreeSpace = num === 0;
                          
                          return (
                            <div 
                              key={colIndex}
                              className={`h-10 flex items-center justify-center text-sm font-medium border ${
                                isCalled 
                                  ? 'bg-yellow-400 text-black' 
                                  : 'bg-white text-black'
                              } ${isFreeSpace ? 'bg-blue-100' : ''}`}
                            >
                              {isFreeSpace ? '★' : displayNum}
                            </div>
                          );
                        })}
                      </div>
                    ))}
                  </div>
                  
                  {checkedCardResult.pattern && (
                    <p className="text-yellow-400 mt-2 text-center font-bold">
                      Pattern: {checkedCardResult.pattern}
                    </p>
                  )}
                </>
              )}
            </div>
          )}
        </div>
      )}

      {/* New Game Confirmation Dialog */}
      {showNewGameConfirm && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <div className="bg-white rounded-lg shadow-2xl max-w-md w-full mx-4">
            <div className="bg-red-600 text-white px-6 py-4 rounded-t-lg">
              <h2 className="text-xl font-bold">Quit Current Game?</h2>
            </div>
            <div className="p-6">
              <p className="text-gray-700 mb-6">
                Are you sure you want to quit the current game? All progress will be lost and you will return to the game settings.
              </p>
              <div className="flex gap-4">
                <Button
                  onClick={() => {
                    stopAutoCalling();
                    setCalledNumbers([]);
                    setCurrentNumber(null);
                    setGameState('SETTING');
                    setShowNewGameConfirm(false);
                  }}
                  className="flex-1 bg-red-600 hover:bg-red-700 text-white"
                >
                  Quit
                </Button>
                <Button
                  onClick={() => setShowNewGameConfirm(false)}
                  className="flex-1 bg-gray-600 hover:bg-gray-700 text-white"
                >
                  Resume
                </Button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Expanded Card Popup */}
      {expandedCard && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <div className="bg-white rounded-lg shadow-2xl max-w-2xl w-full mx-4">
            {/* Header */}
            <div className="bg-blue-600 text-white px-6 py-4 rounded-t-lg flex justify-between items-center">
              <h2 className="text-xl font-bold">Card #{expandedCard} Layout</h2>
              <Button
                onClick={() => setExpandedCard(null)}
                variant="ghost"
                size="sm"
                className="text-white hover:bg-white hover:bg-opacity-20"
              >
                <X className="w-5 h-5" />
              </Button>
            </div>

            {/* Card Content */}
            <div className="p-6">
              <div className="bg-white rounded border-2 border-gray-400 p-4 mx-auto" style={{ maxWidth: '400px' }}>
                {/* Column Headers */}
                <div className="grid grid-cols-5 gap-2 mb-2">
                  {['B', 'I', 'N', 'G', 'O'].map((letter) => (
                    <div key={letter} className="bg-blue-600 text-white text-lg font-bold text-center py-2 rounded">
                      {letter}
                    </div>
                  ))}
                </div>

                {/* Number Grid */}
                {generateCardNumbersWithCalled(expandedCard).map((row, rowIdx) => (
                  <div key={rowIdx} className="grid grid-cols-5 gap-2 mb-2 last:mb-0">
                    {row.map((num, colIdx) => {
                      const isCalled = num < 0;
                      const displayNum = Math.abs(num);
                      const isWinner = checkCardWinner(expandedCard).isWinner;
                      
                      return (
                        <div
                          key={colIdx}
                          className={`text-lg font-bold text-center py-3 rounded border-2 transition-all duration-300 ${
                            displayNum === 0
                              ? 'bg-yellow-400 text-black border-yellow-500'
                              : isCalled
                                ? isWinner
                                  ? 'bg-green-500 text-white border-green-600 shadow-lg shadow-green-400/50 animate-pulse'
                                  : 'bg-blue-500 text-white border-blue-600'
                                : 'bg-white text-gray-800 border-gray-300 hover:bg-gray-50'
                          }`}
                        >
                          {displayNum === 0 ? '★' : displayNum}
                        </div>
                      );
                    })}
                  </div>
                ))}
              </div>

              {/* Action Buttons */}
              <div className="mt-6 flex gap-4">
                <Button
                  onClick={() => {
                    const newSelected = new Set(selectedCards);
                    if (selectedCards.has(expandedCard)) {
                      newSelected.delete(expandedCard);
                    } else {
                      newSelected.add(expandedCard);
                    }
                    setSelectedCards(newSelected);
                  }}
                  className={`flex-1 ${selectedCards.has(expandedCard)
                    ? 'bg-red-600 hover:bg-red-700'
                    : 'bg-blue-600 hover:bg-blue-700'
                    } text-white`}
                >
                  {selectedCards.has(expandedCard) ? 'Deselect Card' : 'Select Card'}
                </Button>
                <Button
                  onClick={() => setExpandedCard(null)}
                  className="flex-1 bg-gray-600 hover:bg-gray-700 text-white"
                >
                  Close
                </Button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
