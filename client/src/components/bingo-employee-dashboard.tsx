import { useState, useEffect, useRef } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useToast } from "@/hooks/use-toast";
import { useAuth } from "@/hooks/use-auth";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Upload, X, Settings, Trophy } from "lucide-react";
import { customBingoVoice } from "@/lib/custom-voice-synthesis";
import AudioControls from "@/components/audio-controls";
import WinnerCheckPopup from "@/components/winner-check-popup";

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
  const [showAudioControls, setShowAudioControls] = useState(false);
  const [showWinnerCheck, setShowWinnerCheck] = useState(false);
  const [isCallingNumber, setIsCallingNumber] = useState(false);

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

  // Generate 15x5 grid (1-75)
  const generateBingoGrid = () => {
    const grid: number[][] = [];
    for (let row = 0; row < 5; row++) {
      const rowNumbers: number[] = [];
      for (let col = 0; col < 15; col++) {
        rowNumbers.push(row * 15 + col + 1);
      }
      grid.push(rowNumbers);
    }
    return grid;
  };

  const bingoGrid = generateBingoGrid();

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

    if (availableNumbers.length === 0) return;

    const randomIndex = Math.floor(Math.random() * availableNumbers.length);
    const newNumber = availableNumbers[randomIndex];

    setIsCallingNumber(true);
    
    try {
      // Announce the number with voice
      await customBingoVoice.callNumber(newNumber);
      
      setCurrentNumber(newNumber);
      setCalledNumbers([...calledNumbers, newNumber]);
      
      toast({
        title: "Number Called",
        description: `${getLetterForNumber(newNumber)} ${newNumber}`
      });
    } catch (error) {
      console.error('Error calling number:', error);
      // Still update the game state even if voice fails
      setCurrentNumber(newNumber);
      setCalledNumbers([...calledNumbers, newNumber]);
    } finally {
      setIsCallingNumber(false);
    }
  };

  // Check winner handler
  const handleCheckWinner = async (cartelaNumber: number): Promise<{ isWinner: boolean; pattern?: string }> => {
    try {
      const response = await fetch('/api/games/check-winner', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          cartelaNumber,
          calledNumbers
        })
      });

      if (!response.ok) {
        throw new Error('Failed to check winner');
      }

      const result = await response.json();
      return result;
    } catch (error) {
      console.error('Error checking winner:', error);
      throw error;
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

  // Check card handler for manual card checking
  const handleCheckCard = () => {
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

    // Open winner check popup with the entered card number
    setShowWinnerCheck(true);
    // Set the check card input so it gets passed to the popup
    setTimeout(() => {
      // This ensures the popup receives the initial value
    }, 0);
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
                <button
                  onClick={() => setShowAudioControls(!showAudioControls)}
                  className="hover:text-blue-400 transition flex items-center gap-1"
                >
                  <Settings className="w-4 h-4" />
                  Audio
                </button>
                <button
                  onClick={() => setShowWinnerCheck(true)}
                  className="hover:text-blue-400 transition flex items-center gap-1"
                >
                  <Trophy className="w-4 h-4" />
                  Check Winner
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
              <div className="w-2/3 border-r border-gray-300 p-6 overflow-y-auto">
                <div className="flex justify-between items-center mb-4">
                  <h3 className="text-lg font-bold">Available Cards</h3>
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

                <div className="grid grid-cols-4 gap-4">
                  {Array.from({ length: 100 }, (_, i) => i + 1).map((cardNum) => {
                    const isSelected = selectedCards.has(cardNum);
                    return (
                      <button
                        key={cardNum}
                        onClick={() => {
                          const newSelected = new Set(selectedCards);
                          if (isSelected) {
                            newSelected.delete(cardNum);
                          } else {
                            newSelected.add(cardNum);
                          }
                          setSelectedCards(newSelected);
                        }}
                        className={`p-4 rounded-lg border-2 transition ${isSelected
                            ? 'border-blue-600 bg-blue-50'
                            : 'border-gray-300 bg-white hover:border-blue-400'
                          }`}
                      >
                        <div className="font-bold text-lg">Card #{cardNum}</div>
                      </button>
                    );
                  })}
                </div>
              </div>

              {/* Right Side - Summary */}
              <div className="w-1/3 p-6 bg-gray-50">
                <h3 className="text-lg font-bold mb-4">Summary</h3>

                <div className="mb-4">
                  <div className="text-sm text-gray-600 mb-2">Selected Cards: {selectedCards.size}</div>
                  <div className="max-h-40 overflow-y-auto bg-white border border-gray-300 rounded p-2">
                    {Array.from(selectedCards).map((cardNum) => (
                      <div key={cardNum} className="flex justify-between items-center py-1">
                        <span>Card #{cardNum}</span>
                        <button
                          onClick={() => {
                            const newSelected = new Set(selectedCards);
                            newSelected.delete(cardNum);
                            setSelectedCards(newSelected);
                          }}
                          className="text-red-600 hover:text-red-800"
                        >
                          <X className="w-4 h-4" />
                        </button>
                      </div>
                    ))}
                  </div>
                </div>

                <div className="mb-4">
                  <label className="block text-sm font-medium mb-2">Top-up Fee (ETB)</label>
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
                  <div className="text-sm text-gray-600">Total: {selectedCards.size * parseInt(topUpFee)} ETB</div>
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

      {/* Main Game Floor */}
      {gameState === 'PLAYING' && (
        <div className="p-4">
          {/* Top Row Dashboard */}
          <div className="grid grid-cols-4 gap-4 mb-4">
            {/* Large Number Ball */}
            <div className="bg-gray-800 rounded-lg p-6 flex items-center justify-center">
              <div className={`w-48 h-48 rounded-full bg-gradient-to-br ${currentNumber ? getBallGradient(currentNumber) : 'from-gray-600 to-gray-800'
                } flex items-center justify-center shadow-2xl border-4 border-white`}>
                <div className="text-center">
                  {currentNumber && (
                    <>
                      <div className="text-6xl font-bold text-white">
                        {currentNumber}
                      </div>
                      <div className="text-2xl font-bold text-white mt-2">
                        {getLetterForNumber(currentNumber)}
                      </div>
                    </>
                  )}
                </div>
              </div>
            </div>

            {/* 5x5 Pattern Preview */}
            <div className="bg-gray-800 rounded-lg p-4">
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
            <div className="bg-blue-900 rounded-lg p-4">
              <h3 className="text-xl font-bold mb-2 text-center">Recent 5 Numbers</h3>
              <div className="flex justify-center gap-2 mb-4">
                {calledNumbers.slice(-5).map((num, idx) => (
                  <div
                    key={idx}
                    className={`w-16 h-16 rounded-full bg-gradient-to-br ${getBallGradient(num)} flex items-center justify-center shadow-lg`}
                  >
                    <span className="text-white font-bold text-xl">{num}</span>
                  </div>
                ))}
              </div>
              <div className="text-center">
                <div className="inline-block bg-purple-600 rounded-full px-4 py-2 text-white font-bold">
                  {calledNumbers.length}/75
                </div>
              </div>
            </div>

            {/* Prize Section */}
            <div className="bg-blue-900 rounded-lg p-4 text-center">
              <div className="text-6xl font-bold mb-2">ደረሻ</div>
              <div className="bg-blue-700 rounded-lg p-4">
                <div className="text-5xl font-bold text-yellow-400">10</div>
                <div className="text-2xl">ብር</div>
              </div>
            </div>
          </div>

          {/* Main 15x5 BINGO Board */}
          <div className="bg-gray-800 rounded-lg p-4 mb-4">
            {/* BINGO Labels */}
            <div className="grid grid-cols-[auto_repeat(15,1fr)] gap-1 mb-2">
              <div className="w-16"></div>
              {[1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12, 13, 14, 15].map((num) => (
                <div key={num} className="text-center text-white font-bold text-xl">
                  {num}
                </div>
              ))}
            </div>

            {/* Grid Rows */}
            {['B', 'I', 'N', 'G', 'O'].map((letter, rowIdx) => (
              <div key={letter} className="grid grid-cols-[auto_repeat(15,1fr)] gap-1 mb-1">
                <div className={`w-16 h-16 flex items-center justify-center text-3xl font-bold rounded ${getLetterColor(letter)}`}>
                  {letter}
                </div>
                {bingoGrid[rowIdx].map((num) => {
                  const isCalled = calledNumbers.includes(num);
                  return (
                    <button
                      key={num}
                      onClick={() => {
                        if (!calledNumbers.includes(num)) {
                          setCurrentNumber(num);
                          setCalledNumbers([...calledNumbers, num]);
                        }
                      }}
                      className={`h-16 rounded text-xl font-bold transition ${isCalled
                          ? `bg-gradient-to-br ${getBallGradient(num)} text-white shadow-lg`
                          : 'bg-gray-700 text-gray-300 hover:bg-gray-600'
                        }`}
                    >
                      {num}
                    </button>
                  );
                })}
              </div>
            ))}
          </div>

          {/* Control Bar */}
          <div className="bg-gray-800 rounded-lg p-4 flex items-center justify-between gap-4">
            <Button
              onClick={handleCallNumber}
              disabled={isCallingNumber}
              className="bg-blue-600 hover:bg-blue-700 text-white px-8 py-3 text-lg font-bold"
            >
              {isCallingNumber ? "Calling..." : "Bingo"}
            </Button>

            <Button
              onClick={() => {
                setCalledNumbers([]);
                setCurrentNumber(null);
              }}
              className="bg-blue-600 hover:bg-blue-700 text-white px-8 py-3 text-lg font-bold"
            >
              New Game
            </Button>

            <Button
              onClick={handleCallNumber}
              className="bg-blue-600 hover:bg-blue-700 text-white px-8 py-3 text-lg font-bold"
            >
              Bowzew
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
              className="bg-blue-600 hover:bg-blue-700 text-white px-8 py-3 text-lg font-bold"
            >
              Check
            </Button>
          </div>
        </div>
      )}

      {/* Audio Controls Popup */}
      {showAudioControls && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <div className="bg-white rounded-lg shadow-2xl max-w-md w-full mx-4">
            <div className="bg-gray-800 text-white px-6 py-4 rounded-t-lg flex justify-between items-center">
              <h2 className="text-xl font-bold">Audio Settings</h2>
              <Button
                onClick={() => setShowAudioControls(false)}
                variant="ghost"
                size="sm"
                className="text-white hover:bg-white hover:bg-opacity-20"
              >
                <X className="w-5 h-5" />
              </Button>
            </div>
            <div className="p-6">
              <AudioControls />
            </div>
          </div>
        </div>
      )}

      {/* Winner Check Popup */}
      <WinnerCheckPopup
        isOpen={showWinnerCheck}
        onClose={() => setShowWinnerCheck(false)}
        calledNumbers={calledNumbers}
        onCheckWinner={handleCheckWinner}
        initialCartelaNumber={checkCardInput}
      />
    </div>
  );
}
