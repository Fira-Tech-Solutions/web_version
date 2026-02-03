import { useState, useEffect, useRef } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { useAuth } from "@/hooks/use-auth";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { Checkbox } from "@/components/ui/checkbox";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { apiRequest } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import { Upload } from "lucide-react";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";

interface BingoNewEmployeeDashboardProps {
  onLogout: () => void;
}

export default function BingoNewEmployeeDashboard({ onLogout }: BingoNewEmployeeDashboardProps) {
  const { user } = useAuth();
  const { toast } = useToast();
  const queryClient = useQueryClient();

  const [calledNumbers, setCalledNumbers] = useState<number[]>([]);
  const [currentNumber, setCurrentNumber] = useState<number | null>(null);
  const [gameActive, setGameActive] = useState(false);
  const [gameAmount, setGameAmount] = useState("30");
  const [autoplaySpeed, setAutoplaySpeed] = useState("4"); // Default balanced for all voices with dynamic audio speed
  const [showCartelaSelector, setShowCartelaSelector] = useState(false);
  const [selectedCartelas, setSelectedCartelas] = useState<Set<number>>(new Set());
  const [bookedCartelas, setBookedCartelas] = useState<Set<number>>(new Set());
  const [autoCallInterval, setAutoCallInterval] = useState<NodeJS.Timeout | null>(null);
  const [gameFinished, setGameFinished] = useState(false);
  const [currentGame, setCurrentGame] = useState<any>(null);
  const [showWinnerChecker, setShowWinnerChecker] = useState(false);
  const [winnerCartelaNumber, setWinnerCartelaNumber] = useState("");
  const [showWinnerModal, setShowWinnerModal] = useState(false);
  const [winnerResult, setWinnerResult] = useState<{ isWinner: boolean, cartelaNumber: number } | null>(null);
  const [isShuffling, setIsShuffling] = useState(false);
  const [isBulkOpen, setIsBulkOpen] = useState(false);
  const [bulkInput, setBulkInput] = useState("");

  // Use ref to track game state for reliable interval access
  const gameStateRef = useRef({
    active: false,
    finished: false,
    calledNumbers: [] as number[]
  });

  // Get active game
  const { data: activeGame, refetch: refetchActiveGame } = useQuery({
    queryKey: ['/api/games/active'],
    enabled: !!user
  });

  // Get admin commission rate from user profile or system settings
  const { data: adminSettings } = useQuery({
    queryKey: ['/api/admin/shop-stats'],
    enabled: !!user,
    refetchInterval: 5000 // Update every 5 seconds
  });

  // Calculate total collected and prize amount with live admin margin
  const totalCollected = bookedCartelas.size * parseFloat(gameAmount || "0");
  const adminProfitMargin = adminSettings?.commissionRate ? parseFloat((adminSettings as any).commissionRate) : 30;
  const prizeAmount = totalCollected * (1 - adminProfitMargin / 100); // Prize = Total - Admin Profit

  // Get game players
  const { data: gamePlayers, refetch: refetchPlayers } = useQuery({
    queryKey: ['/api/games', currentGame?.id, 'players'],
    enabled: !!currentGame?.id
  });

  // Create game mutation
  const createGameMutation = useMutation({
    mutationFn: (data: { entryFee: string }) => apiRequest(`/api/games`, {
      method: 'POST',
      body: JSON.stringify(data)
    }),
    onSuccess: (game) => {
      setCurrentGame(game);
      queryClient.invalidateQueries({ queryKey: ['/api/games/active'] });
      toast({
        title: "Game Created",
        description: "New bingo game has been created successfully"
      });
    }
  });

  // Add players mutation
  const addPlayersMutation = useMutation({
    mutationFn: (data: { gameId: number; playerName: string; cartelas: number[]; entryFee: string }) =>
      apiRequest(`/api/games/${data.gameId}/players`, {
        method: 'POST',
        body: JSON.stringify({
          playerName: data.playerName,
          cartelas: data.cartelas,
          entryFee: data.entryFee
        })
      }),
    onSuccess: () => {
      refetchPlayers();
      toast({
        title: "Players Added",
        description: `${selectedCartelas.size} cartelas have been booked successfully`
      });
    }
  });

  // Start game mutation
  const startGameMutation = useMutation({
    mutationFn: (gameId: number) => apiRequest(`/api/games/${gameId}/start`, {
      method: 'PATCH'
    }),
    onSuccess: () => {
      setGameActive(true);
      queryClient.invalidateQueries({ queryKey: ['/api/games/active'] });
      toast({
        title: "Game Started",
        description: "Bingo game has started successfully"
      });
    }
  });

  // Update called numbers mutation
  const updateNumbersMutation = useMutation({
    mutationFn: (data: { gameId: number; calledNumbers: string[] }) =>
      apiRequest(`/api/games/${data.gameId}/numbers`, {
        method: 'PATCH',
        body: JSON.stringify({ calledNumbers: data.calledNumbers })
      }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/games/active'] });
    }
  });

  // Check winner mutation
  const checkWinnerMutation = useMutation({
    mutationFn: async (data: { gameId: number; cartelaNumber: number; calledNumbers: number[] }) => {
      console.log('Sending check winner request:', data);
      const response = await fetch(`/api/games/${data.gameId}/check-winner`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          cartelaNumber: data.cartelaNumber,
          calledNumbers: data.calledNumbers
        }),
        credentials: 'include'
      });

      if (!response.ok) {
        const errorText = await response.text();
        console.error('Check winner error response:', errorText);
        throw new Error(`HTTP ${response.status}: ${errorText}`);
      }

      const result = await response.json();
      console.log('Check winner success response:', result);
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
      console.error('Check winner mutation error:', error);
      toast({
        title: "Error Checking Winner",
        description: `Failed to check winner: ${error.message}`,
        variant: "destructive"
      });
    }
  });

  // Bulk import cartelas mutation
  const bulkImportMutation = useMutation({
    mutationFn: async (bulkData: string) => {
      const response = await fetch("/api/cartelas/bulk-import", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ shopId: user?.shopId, adminId: user?.id, bulkData }),
      });
      if (!response.ok) throw new Error("Failed to import cartelas");
      return response.json();
    },
    onSuccess: (result) => {
      toast({
        title: "Bulk import completed!",
        description: `${result.updated} updated, ${result.added} added, ${result.skipped} skipped`
      });
      queryClient.invalidateQueries({ queryKey: ["/api/cartelas", user?.shopId] });
      setBulkInput("");
      setIsBulkOpen(false);
    },
    onError: (error: any) => {
      toast({ title: "Error", description: error.message, variant: "destructive" });
    },
  });

  const handleBulkImport = () => {
    if (!bulkInput.trim()) {
      toast({ title: "Error", description: "Please enter or upload cartela data", variant: "destructive" });
      return;
    }
    bulkImportMutation.mutate(bulkInput);
  };
  const completeGameMutation = useMutation({
    mutationFn: (data: { gameId: number; winnerId: number; winnerName: string; winningCartela: string; prizeAmount: string }) =>
      apiRequest(`/api/games/${data.gameId}/complete`, {
        method: 'PATCH',
        body: JSON.stringify(data)
      }),
    onSuccess: () => {
      setGameActive(false);
      setGameFinished(true);
      setCurrentGame(null);
      queryClient.invalidateQueries({ queryKey: ['/api/games/active'] });
      toast({
        title: "Game Completed",
        description: "Game has been completed and winner has been recorded"
      });
    }
  });

  // Play Amharic audio for number announcements
  const playAmharicAudio = (number: number) => {
    try {
      const letter = getLetterForNumber(number);
      const audioFile = `${letter}${number}.mp3`;
      const audio = new Audio(`/attached_assets/${audioFile}`);
      audio.volume = 0.9;
      audio.play().catch((error) => {
        console.error(`Failed to play audio file ${audioFile}:`, error);
      });
    } catch (error) {
      console.error(`Error loading audio file for ${getLetterForNumber(number)}${number}:`, error);
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

  // Update ref when state changes
  useEffect(() => {
    gameStateRef.current.active = gameActive;
    gameStateRef.current.finished = gameFinished;
    gameStateRef.current.calledNumbers = calledNumbers;
  }, [gameActive, gameFinished, calledNumbers]);

  // Generate next random number
  const callNumber = () => {
    if (!gameStateRef.current.active || gameStateRef.current.finished) {
      return;
    }

    const allNumbers = Array.from({ length: 75 }, (_, i) => i + 1);
    const availableNumbers = allNumbers.filter(num => !gameStateRef.current.calledNumbers.includes(num));

    if (availableNumbers.length === 0) {
      setGameActive(false);
      setGameFinished(true);
      stopAutoCalling();
      return;
    }

    const randomIndex = Math.floor(Math.random() * availableNumbers.length);
    const newNumber = availableNumbers[randomIndex];

    setCurrentNumber(newNumber);
    playAmharicAudio(newNumber);

    const updated = [...gameStateRef.current.calledNumbers, newNumber];
    setCalledNumbers(updated);

    // Update backend
    if (currentGame?.id) {
      updateNumbersMutation.mutate({
        gameId: currentGame.id,
        calledNumbers: updated.map(n => n.toString())
      });
    }

    if (updated.length === 75) {
      setGameActive(false);
      setGameFinished(true);
      stopAutoCalling();
    }
  };

  // Start automatic calling
  const startAutoCalling = () => {
    if (autoCallInterval) {
      clearInterval(autoCallInterval);
    }

    const interval = setInterval(() => {
      callNumber();
    }, parseInt(autoplaySpeed) * 1000);
    setAutoCallInterval(interval);
  };

  // Stop automatic calling
  const stopAutoCalling = () => {
    if (autoCallInterval) {
      clearInterval(autoCallInterval);
      setAutoCallInterval(null);
    }
  };

  // Create new game
  const createNewGame = () => {
    createGameMutation.mutate({ entryFee: gameAmount });
  };

  // Start game
  const startGame = () => {
    if (bookedCartelas.size === 0) {
      toast({
        title: "No Cartelas Booked",
        description: "Please book at least one cartela before starting the game",
        variant: "destructive"
      });
      return;
    }

    if (!currentGame) {
      createNewGame();
      return;
    }

    if (autoCallInterval) {
      clearInterval(autoCallInterval);
      setAutoCallInterval(null);
    }

    setCalledNumbers([]);
    setCurrentNumber(null);
    setGameFinished(false);
    setGameActive(true);

    // Start the game in backend
    startGameMutation.mutate(currentGame.id);

    // Start auto calling
    startAutoCalling();
  };

  // Pause game function
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

  // Resume game function  
  const resumeGame = () => {
    setGameActive(true);
    startAutoCalling();
  };

  // Reset game
  const resetGame = () => {
    stopAutoCalling();
    setCalledNumbers([]);
    setCurrentNumber(null);
    setGameActive(false);
    setGameFinished(false);
    setBookedCartelas(new Set());
    setCurrentGame(null);
  };

  // Fixed cartela patterns
  const getFixedCartelaCard = (cartelaNum: number) => {
    const createFixedPattern = (num: number): number[][] => {
      let seed = num * 12345;
      const seededRandom = () => {
        seed = (seed * 9301 + 49297) % 233280;
        return seed / 233280;
      };

      const card: number[][] = [[], [], [], [], []];
      const ranges = [
        [1, 15],   // B column
        [16, 30],  // I column  
        [31, 45],  // N column
        [46, 60],  // G column
        [61, 75]   // O column
      ];

      for (let col = 0; col < 5; col++) {
        const [min, max] = ranges[col];
        const columnNumbers = Array.from({ length: max - min + 1 }, (_, i) => min + i);

        for (let i = columnNumbers.length - 1; i > 0; i--) {
          const j = Math.floor(seededRandom() * (i + 1));
          [columnNumbers[i], columnNumbers[j]] = [columnNumbers[j], columnNumbers[i]];
        }

        for (let row = 0; row < 5; row++) {
          if (col === 2 && row === 2) {
            card[row].push(0); // FREE space in center
          } else {
            const numberIndex = row < 2 ? row : row - 1;
            card[row].push(columnNumbers[numberIndex]);
          }
        }
      }

      return card;
    };

    return createFixedPattern(cartelaNum);
  };

  // Toggle cartela selection (multiple selection)
  const toggleCartelaSelection = (cartelaNum: number) => {
    setSelectedCartelas(prev => {
      const newSelection = new Set(prev);
      if (newSelection.has(cartelaNum)) {
        newSelection.delete(cartelaNum);
      } else {
        newSelection.add(cartelaNum);
      }
      console.log(`Toggled cartela ${cartelaNum}, total selected: ${newSelection.size}`);
      return newSelection;
    });
  };

  // Book selected cartelas
  const bookSelectedCartelas = () => {
    console.log(`Booking cartelas, selected count: ${selectedCartelas.size}`);
    console.log(`Selected cartelas:`, Array.from(selectedCartelas));

    if (selectedCartelas.size === 0) {
      toast({
        title: "No Cartelas Selected",
        description: "Please select at least one cartela to book",
        variant: "destructive"
      });
      return;
    }

    if (!currentGame) {
      // Create game first
      createGameMutation.mutate({ entryFee: gameAmount });
      return;
    }

    // Add players for selected cartelas
    addPlayersMutation.mutate({
      gameId: currentGame.id,
      playerName: "Player",
      cartelas: Array.from(selectedCartelas),
      entryFee: gameAmount
    });

    // Update booked cartelas
    setBookedCartelas(prev => {
      const newBooked = new Set([...Array.from(prev), ...Array.from(selectedCartelas)]);
      console.log(`Updated booked cartelas:`, Array.from(newBooked));
      return newBooked;
    });

    // Don't clear selected cartelas - keep them visible in the display
    setShowCartelaSelector(false);
  };

  // Clear selected cartelas
  const clearSelectedCartelas = () => {
    setSelectedCartelas(new Set());
  };

  // Shuffle animation function
  const shuffleNumbers = () => {
    setIsShuffling(true);
    // Play shuffle sound effect (placeholder)
    console.log("Playing shuffle sound effect...");

    setTimeout(() => {
      setIsShuffling(false);
    }, 2000);
  };

  // Restart game function
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
    toast({
      title: "Game Restarted",
      description: "Ready to start a new game",
    });
  };

  // Check winner cartela
  const checkWinnerCartela = () => {
    // Pause the game immediately when checking for winner
    if (gameActive) {
      pauseGame();
      toast({
        title: "Game Paused",
        description: "Game paused for winner verification",
      });
    }

    const cartelaNum = parseInt(winnerCartelaNumber);
    if (!cartelaNum || cartelaNum < 1 || cartelaNum > 100) {
      toast({
        title: "Invalid Cartela",
        description: "Please enter a valid cartela number between 1-100",
        variant: "destructive"
      });
      return;
    }

    // Check if cartela is in booked cartelas
    if (!bookedCartelas.has(cartelaNum)) {
      toast({
        title: "Invalid Cartela",
        description: `Cartela #${cartelaNum} is not selected/booked in this game`,
        variant: "destructive"
      });
      return;
    }

    if (!currentGame?.id) {
      toast({
        title: "No Active Game",
        description: "Please start a game first",
        variant: "destructive"
      });
      return;
    }

    checkWinnerMutation.mutate({
      gameId: currentGame.id,
      cartelaNumber: cartelaNum,
      calledNumbers
    });
  };

  // Clean up interval on component unmount
  useEffect(() => {
    return () => {
      if (autoCallInterval) {
        clearInterval(autoCallInterval);
      }
    };
  }, [autoCallInterval]);

  // Initialize active game
  useEffect(() => {
    if (activeGame) {
      setCurrentGame(activeGame);
      if (activeGame.calledNumbers) {
        setCalledNumbers(activeGame.calledNumbers.map((n: string) => parseInt(n)));
      }
      if (activeGame.status === 'active') {
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
            <h1 className="text-2xl font-semibold text-gray-900">Employee Dashboard</h1>
            <p className="text-gray-600">Welcome, {user?.name || user?.username}</p>
            {currentGame && (
              <Badge variant="secondary" className="mt-1">
                Game ID: {currentGame.id} | Status: {currentGame.status}
              </Badge>
            )}
          </div>
          <div className="flex gap-2">
            <Dialog open={isBulkOpen} onOpenChange={setIsBulkOpen}>
              <DialogTrigger asChild>
                <Button variant="outline" className="flex items-center gap-2">
                  <Upload className="h-4 w-4" />
                  Import Cartelas
                </Button>
              </DialogTrigger>
              <DialogContent className="max-w-2xl">
                <Tabs defaultValue="csv">
                  <DialogHeader>
                    <DialogTitle>Import Cartelas</DialogTitle>
                    <DialogDescription>
                      Upload the CSV file provided by your admin to add or update cartelas for this shop.
                    </DialogDescription>
                  </DialogHeader>
                  <TabsList className="grid w-full grid-cols-2 mb-4">
                    <TabsTrigger value="csv">CSV File Import</TabsTrigger>
                    <TabsTrigger value="text">Text Import</TabsTrigger>
                  </TabsList>

                  <TabsContent value="csv" className="space-y-4">
                    <div className="border-2 border-dashed border-gray-200 rounded-lg p-8 text-center bg-gray-50">
                      <input
                        type="file"
                        id="csv-upload-employee"
                        accept=".csv"
                        className="hidden"
                        onChange={(e) => {
                          const file = e.target.files?.[0];
                          if (file) {
                            const reader = new FileReader();
                            reader.onload = (event) => {
                              const csv = event.target?.result as string;
                              const lines = csv.split(/\r?\n/).filter(l => l.trim());

                              const startIdx = lines[0].toLowerCase().includes('cno') ? 1 : 0;
                              const rows = lines.slice(startIdx);

                              const formattedData = rows.map(line => {
                                const regex = /,(?=(?:(?:[^"]*"){2})*[^"]*$)/;
                                const parts = line.split(regex).map(p => p.trim().replace(/^"|"$/g, ''));

                                if (parts.length < 8) return null;

                                const cardNumber = parts[2];
                                const bNums = parts[3].split(',').map(n => n.trim());
                                const iNums = parts[4].split(',').map(n => n.trim());
                                const nNums = parts[5].split(',').map(n => n.trim());
                                const gNums = parts[6].split(',').map(n => n.trim());
                                const oNums = parts[7].split(',').map(n => n.trim());

                                if (bNums.length !== 5 || iNums.length !== 5 || nNums.length !== 5 || gNums.length !== 5 || oNums.length !== 5) {
                                  return null;
                                }

                                const allNumbers = [];
                                for (let r = 0; r < 5; r++) {
                                  allNumbers.push(bNums[r], iNums[r], nNums[r], gNums[r], oNums[r]);
                                }

                                return `${cardNumber}:${allNumbers.join(',')}`;
                              }).filter(Boolean).join('\n');

                              if (formattedData) {
                                setBulkInput(formattedData);
                                toast({ title: "CSV Parsed", description: "File successfully parsed. Click Import to save." });
                              } else {
                                toast({
                                  title: "Error",
                                  description: "Could not parse CSV. Please check the file format.",
                                  variant: "destructive"
                                });
                              }
                            };
                            reader.readAsText(file);
                          }
                        }}
                      />
                      <Label htmlFor="csv-upload-employee" className="cursor-pointer">
                        <div className="flex flex-col items-center">
                          <Upload className="h-12 w-12 text-gray-400 mb-4" />
                          <span className="text-blue-600 font-medium">Click to upload admin's CSV file</span>
                          <p className="text-sm text-gray-500 mt-1">Accepts cno, user_id, card_no format</p>
                        </div>
                      </Label>
                    </div>
                    {bulkInput && (
                      <div className="mt-4">
                        <Label className="text-xs text-gray-500">Preview (first 2 cards):</Label>
                        <pre className="mt-1 p-2 bg-gray-50 rounded text-[10px] overflow-auto max-h-24">
                          {bulkInput.split('\n').slice(0, 2).join('\n')}
                        </pre>
                      </div>
                    )}
                    <div className="flex justify-end gap-2">
                      <Button variant="outline" onClick={() => setIsBulkOpen(false)}>Cancel</Button>
                      <Button onClick={handleBulkImport} disabled={bulkImportMutation.isPending || !bulkInput}>
                        {bulkImportMutation.isPending ? "Importing..." : "Import CSV"}
                      </Button>
                    </div>
                  </TabsContent>

                  <TabsContent value="text" className="space-y-4">
                    <div>
                      <Label htmlFor="bulk-input-employee">Cartela Data (Format: ID:n1,n2...)</Label>
                      <Textarea
                        id="bulk-input-employee"
                        value={bulkInput}
                        onChange={(e) => setBulkInput(e.target.value)}
                        placeholder="1:5,12,14,8,2,26,28,29,22,19,38,40,0,34,36..."
                        rows={6}
                        className="font-mono text-xs"
                      />
                    </div>
                    <div className="flex justify-end gap-2">
                      <Button variant="outline" onClick={() => setIsBulkOpen(false)}>Cancel</Button>
                      <Button onClick={handleBulkImport} disabled={bulkImportMutation.isPending}>
                        {bulkImportMutation.isPending ? "Importing..." : "Import Text"}
                      </Button>
                    </div>
                  </TabsContent>
                </Tabs>
              </DialogContent>
            </Dialog>
            <Button onClick={onLogout} variant="outline">
              Logout
            </Button>
          </div>
        </div>
      </div>

      <div className="max-w-7xl mx-auto px-6 py-8">
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
          {/* Left Panel - Game Settings */}
          <div className="space-y-6">
            <Card>
              <CardHeader>
                <CardTitle>Game Settings</CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Game Amount (Birr)
                  </label>
                  <Input
                    type="number"
                    value={gameAmount}
                    onChange={(e) => setGameAmount(e.target.value)}
                    disabled={gameActive}
                    className="w-full"
                  />
                  <p className="text-sm text-gray-500 mt-1">
                    Current: {gameAmount} Birr per card
                  </p>
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Autoplay Speed (seconds)
                  </label>
                  <Select value={autoplaySpeed} onValueChange={setAutoplaySpeed}>
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="1">1 second</SelectItem>
                      <SelectItem value="2">2 seconds</SelectItem>
                      <SelectItem value="3">3 seconds</SelectItem>
                      <SelectItem value="4">4 seconds</SelectItem>
                      <SelectItem value="5">5 seconds</SelectItem>
                    </SelectContent>
                  </Select>
                </div>

                {/* Selected Cartelas Display */}
                <div className="pt-4 border-t">
                  <div className="flex justify-between items-center mb-2">
                    <p className="text-sm font-medium text-gray-700">
                      Selected Cartelas ({selectedCartelas.size})
                    </p>
                    {selectedCartelas.size > 0 && (
                      <Button
                        onClick={clearSelectedCartelas}
                        variant="ghost"
                        size="sm"
                        className="text-xs h-6 px-2"
                      >
                        Clear All
                      </Button>
                    )}
                  </div>
                  {bookedCartelas.size > 0 ? (
                    <>
                      <div className="flex flex-wrap gap-1 max-h-20 overflow-y-auto">
                        {Array.from(bookedCartelas).sort((a, b) => a - b).map(num => (
                          <Badge
                            key={num}
                            variant="default"
                            className="text-xs bg-green-600 text-white"
                          >
                            #{num}
                          </Badge>
                        ))}
                      </div>
                      <p className="text-xs text-gray-500 mt-1">
                        Total: {(bookedCartelas.size * parseFloat(gameAmount || "0")).toFixed(2)} Birr
                      </p>
                    </>
                  ) : (
                    <p className="text-xs text-gray-500">No cartelas booked yet</p>
                  )}

                  {selectedCartelas.size > 0 && (
                    <div className="mt-2 pt-2 border-t border-gray-200">
                      <p className="text-xs text-blue-600 font-medium mb-1">Ready to book:</p>
                      <div className="flex flex-wrap gap-1">
                        {Array.from(selectedCartelas).sort((a, b) => a - b).map(num => (
                          <Badge
                            key={num}
                            variant="outline"
                            className="text-xs cursor-pointer hover:bg-blue-100 border-blue-300"
                            onClick={() => toggleCartelaSelection(num)}
                          >
                            #{num}
                          </Badge>
                        ))}
                      </div>
                    </div>
                  )}
                </div>

                <div className="pt-4 border-t">
                  <div className="text-center space-y-2">
                    <div>
                      <p className="text-sm font-medium text-gray-700">Total Collected</p>
                      <p className="text-2xl font-bold text-blue-600">{totalCollected.toFixed(2)} Birr</p>
                      <p className="text-sm text-gray-500">{bookedCartelas.size} cards × {gameAmount} Birr</p>
                    </div>
                    {totalCollected > 0 && (
                      <div className="pt-2 border-t">
                        <p className="text-sm font-medium text-gray-700">Winner Gets</p>
                        <p className="text-xl font-bold text-green-600">{prizeAmount.toFixed(2)} Birr</p>
                        <p className="text-xs text-gray-500">{(100 - adminProfitMargin).toFixed(0)}% of total collected</p>
                      </div>
                    )}
                  </div>
                </div>
              </CardContent>
            </Card>

            {/* Control Buttons */}
            <div className="space-y-3">
              {!gameActive && !gameFinished ? (
                <Button
                  onClick={startGame}
                  disabled={createGameMutation.isPending || bookedCartelas.size === 0}
                  className="w-full bg-green-600 hover:bg-green-700 text-white"
                  size="lg"
                >
                  {createGameMutation.isPending ? "Creating Game..." : "Start Game"}
                </Button>
              ) : gameActive ? (
                <Button
                  onClick={pauseGame}
                  className="w-full bg-yellow-600 hover:bg-yellow-700 text-white"
                  size="lg"
                >
                  Pause Game
                </Button>
              ) : (
                <Button
                  onClick={resumeGame}
                  disabled={gameFinished}
                  className="w-full bg-green-600 hover:bg-green-700 text-white"
                  size="lg"
                >
                  Resume Game
                </Button>
              )}

              <Dialog open={showCartelaSelector} onOpenChange={setShowCartelaSelector}>
                <DialogTrigger asChild>
                  <Button
                    variant="outline"
                    className="w-full bg-blue-600 hover:bg-blue-700 text-white border-blue-600"
                    size="lg"
                  >
                    Select Multiple Cartelas
                  </Button>
                </DialogTrigger>
                <DialogContent className="max-w-6xl max-h-[90vh] overflow-y-auto">
                  <DialogHeader>
                    <DialogTitle>Select Multiple Cartelas (1-100)</DialogTitle>
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
                            className={`h-12 w-12 ${isBooked
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

              {/* Winner Checker */}
              <Dialog open={showWinnerChecker} onOpenChange={setShowWinnerChecker}>
                <DialogTrigger asChild>
                  <Button
                    variant="outline"
                    className="w-full bg-purple-600 hover:bg-purple-700 text-white border-purple-600"
                    size="lg"
                    disabled={!gameActive}
                  >
                    Check Winner Cartela
                  </Button>
                </DialogTrigger>
                <DialogContent>
                  <DialogHeader>
                    <DialogTitle>Check Winner Cartela</DialogTitle>
                    <DialogDescription>
                      Enter the cartela number to check if it's a valid winner based on called numbers.
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

              <Button
                onClick={resetGame}
                variant="outline"
                className="w-full"
                size="lg"
              >
                Reset Game
              </Button>
            </div>
          </div>

          {/* Center Panel - Let's Play BINGO! */}
          <div className="flex flex-col justify-center items-center">
            <div className="w-64 h-64 bg-blue-500 rounded-full flex items-center justify-center text-white text-center">
              <div>
                <p className="text-lg font-medium">Let's Play</p>
                <p className="text-2xl font-bold">BINGO!</p>
              </div>
            </div>

            {currentNumber && (
              <div className="mt-8 text-center">
                <div className="text-6xl font-bold text-blue-600 mb-2">
                  {getLetterForNumber(currentNumber)}{currentNumber}
                </div>
                <p className="text-lg text-gray-600">Latest Called Number</p>
              </div>
            )}

            <div className="mt-6 text-center">
              <p className="text-lg font-semibold">{calledNumbers.length} / 75 numbers called</p>
              {gameActive && (
                <p className="text-green-600 font-medium">Game Active</p>
              )}
              {gameFinished && (
                <p className="text-red-600 font-medium">Game Finished</p>
              )}
            </div>

            {/* Game Players Display */}
            {gamePlayers && gamePlayers.length > 0 && (
              <div className="mt-6 w-full max-w-md">
                <Card>
                  <CardHeader>
                    <CardTitle className="text-center">Booked Cartelas</CardTitle>
                  </CardHeader>
                  <CardContent>
                    <div className="flex flex-wrap gap-2 justify-center">
                      {gamePlayers.map((player: any) => (
                        <Badge key={player.id} variant="secondary">
                          #{player.cartelaNumbers[0]}
                        </Badge>
                      ))}
                    </div>
                  </CardContent>
                </Card>
              </div>
            )}
          </div>

          {/* Right Panel - Called Numbers */}
          <div>
            <Card>
              <CardHeader>
                <CardTitle>Called Numbers</CardTitle>
              </CardHeader>
              <CardContent>
                {/* BINGO Headers */}
                <div className="grid grid-cols-5 gap-2 mb-4">
                  <div className="text-center font-bold text-white bg-red-500 py-2 rounded">B</div>
                  <div className="text-center font-bold text-white bg-blue-500 py-2 rounded">I</div>
                  <div className="text-center font-bold text-white bg-green-500 py-2 rounded">N</div>
                  <div className="text-center font-bold text-white bg-yellow-500 py-2 rounded">G</div>
                  <div className="text-center font-bold text-white bg-purple-500 py-2 rounded">O</div>
                </div>

                {/* Numbers Grid */}
                <div className="grid grid-cols-5 gap-1 text-sm">
                  {Array.from({ length: 15 }, (_, row) =>
                    Array.from({ length: 5 }, (_, col) => {
                      const num = (col * 15) + row + 1;
                      const isCalled = calledNumbers.includes(num);
                      return (
                        <div
                          key={num}
                          className={`p-2 text-center rounded transition-colors ${isCalled
                              ? 'bg-gray-800 text-white font-bold'
                              : 'bg-gray-200 text-gray-700'
                            }`}
                        >
                          {num}
                        </div>
                      );
                    })
                  ).flat()}
                </div>
              </CardContent>
            </Card>
          </div>
        </div>
      </div>
    </div>
  );
}