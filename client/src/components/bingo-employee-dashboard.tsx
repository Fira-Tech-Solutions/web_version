import { useState, useEffect, useRef } from "react";
import React from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useToast } from "@/hooks/use-toast";
import { useAuth } from "@/hooks/use-auth";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Upload, X, Settings, Trophy, Eye, EyeOff, Edit } from "lucide-react";
import { customBingoVoice } from "@/lib/custom-voice-synthesis";
import Papa from 'papaparse';

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
  const [previewCard, setPreviewCard] = useState<any | null>(null);
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

  // Cartela Management state
  const [showCartelaManagement, setShowCartelaManagement] = useState(false);
  const [cartelaSearchTerm, setCartelaSearchTerm] = useState("");
  const [currentPage, setCurrentPage] = useState(1);
  const [manualCartelaGrid, setManualCartelaGrid] = useState<number[][]>([]);
  const [csvFile, setCsvFile] = useState<File | null>(null);
  const [activeTab, setActiveTab] = useState<'import' | 'manual' | 'builder' | 'table'>('import');
  const [importProgress, setImportProgress] = useState<number>(0);
  const [isImporting, setIsImporting] = useState(false);

  // CSV Import mutation
  const csvImportMutation = useMutation({
    mutationFn: async (cartelaData: any[]) => {
      const response = await fetch('/api/cartelas/import', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ cartelas: cartelaData }),
      });
      
      if (!response.ok) {
        throw new Error('Failed to import cartelas');
      }
      
      return response.json();
    },
    onSuccess: (data) => {
      // Reset progress state
      setImportProgress(100);
      setIsImporting(false);
      
      // Show detailed import status
      if (data.success) {
        let message = data.imported > 0 
          ? `Successfully imported ${data.imported} cartelas`
          : "No cartelas were imported";
        
        if (data.errors && data.errors.length > 0) {
          message += ` (${data.errors.length} failed)`;
        }
        
        toast({
          title: "CSV Import Complete",
          description: message,
          variant: "default"
        });
        
        // Show error details in console for debugging
        if (data.errors && data.errors.length > 0) {
          console.log('Import errors:', data.errors);
        }
      } else {
        toast({
          title: "CSV Import Failed",
          description: "Failed to import cartelas",
          variant: "destructive"
        });
      }
      
      // Reset form after short delay
      setTimeout(() => {
        setCsvFile(null);
        setImportProgress(0);
      }, 1000);
      
      // Refresh cartelas list
      queryClient.invalidateQueries({ queryKey: ['/api/cartelas'] });
    },
    onError: (error) => {
      setImportProgress(0);
      setIsImporting(false);
      toast({
        title: "CSV Import Failed",
        description: error.message || "Failed to import cartelas. Please check the file format.",
        variant: "destructive"
      });
    },
  });

  // Handle CSV Import
  const handleCSVImport = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      setCsvFile(file);
    }
  };

  // Process CSV file (separate from file input handler)
  const processCSVImport = () => {
    if (!csvFile) return;

    setIsImporting(true);
    setImportProgress(0);

    Papa.parse(csvFile, {
      header: true,
      skipEmptyLines: true,
      step: function(row: any) {
        // Update progress during parsing
        const totalRows = 100; // Estimate for percentage
        const currentProgress = Math.min(50, Math.floor((row.meta.cursor / csvFile.size) * 50));
        setImportProgress(currentProgress);
      },
      complete: (results) => {
        try {
          const totalRows = results.data.length;
          let processedCount = 0;

          const cartelaData = results.data.map((row: any) => {
            // Parse CSV row according to format: cno,user_id,card_no,b,i,n,g,o
            const cno = parseInt(row.cno);
            const userId = parseInt(row.user_id);
            const cardNo = parseInt(row.card_no);
            
            // Parse B,I,N,G,O columns from string arrays to number arrays
            // Each column contains all values for that column (column-based format)
            const b = row.b ? row.b.split(',').map((n: string) => parseInt(n.trim())) : [];
            const i = row.i ? row.i.split(',').map((n: string) => parseInt(n.trim())) : [];
            const n = row.n ? row.n.split(',').map((n: string) => parseInt(n.trim())) : [];
            const g = row.g ? row.g.split(',').map((n: string) => parseInt(n.trim())) : [];
            const o = row.o ? row.o.split(',').map((n: string) => parseInt(n.trim())) : [];
            
            // Combine into 5x5 grid (5 rows x 5 columns)
            // Each array contains all values for that column
            const grid: number[][] = [];
            for (let rowIndex = 0; rowIndex < 5; rowIndex++) {
              grid[rowIndex] = [
                b[rowIndex] || 0,  // B column value for this row
                i[rowIndex] || 0,  // I column value for this row
                n[rowIndex] || 0,  // N column value for this row
                g[rowIndex] || 0,  // G column value for this row
                o[rowIndex] || 0   // O column value for this row
              ];
            }

            // Update progress during processing
            processedCount++;
            const processingProgress = 50 + Math.floor((processedCount / totalRows) * 50);
            setImportProgress(Math.min(99, processingProgress));

            return {
              cno,
              userId,
              cardNo,
              grid: JSON.stringify(grid)
            };
          });

          // Final progress update before API call
          setImportProgress(99);

          csvImportMutation.mutate(cartelaData);
        } catch (error) {
          setIsImporting(false);
          setImportProgress(0);
          toast({
            title: "CSV Parse Error",
            description: "Failed to parse CSV file. Please check the format.",
            variant: "destructive"
          });
        }
      },
      error: (error) => {
        setIsImporting(false);
        setImportProgress(0);
        toast({
          title: "CSV Read Error",
          description: "Failed to read CSV file",
          variant: "destructive"
        });
      }
    });
  };

  // Save Manual Cartela mutation
  const saveManualCartelaMutation = useMutation({
    mutationFn: async (grid: number[][]) => {
      const response = await fetch('/api/cartelas/manual', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ grid }),
      });
      
      if (!response.ok) {
        throw new Error('Failed to save manual cartela');
      }
      
      return response.json();
    },
    onSuccess: (data) => {
      toast({
        title: "Manual Cartela Saved",
        description: `Successfully saved cartela with serial ${data.cno}`
      });
      setManualCartelaGrid([]);
      queryClient.invalidateQueries({ queryKey: ['/api/cartelas'] });
    },
    onError: (error) => {
      toast({
        title: "Save Failed",
        description: error.message,
        variant: "destructive"
      });
    }
  });

  // Handle Save Manual Cartela
  const handleSaveManualCartela = () => {
    // Validate the grid
    if (manualCartelaGrid.length !== 5 || manualCartelaGrid.some(row => row.length !== 5)) {
      toast({
        title: "Invalid Grid",
        description: "Please fill in all 25 cells of the bingo grid",
        variant: "destructive"
      });
      return;
    }

    // Check if the center cell (N3) is 0 (free space)
    if (manualCartelaGrid[2][2] !== 0) {
      toast({
        title: "Invalid Grid",
        description: "The center cell (N3) must be 0 (Free Space)",
        variant: "destructive"
      });
      return;
    }

    saveManualCartelaMutation.mutate(manualCartelaGrid);
  };

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

  // Update called numbers mutation
  const updateCalledNumbersMutation = useMutation({
    mutationFn: async ({ gameId, calledNumbers }: { gameId: number; calledNumbers: number[] }) => {
      const response = await fetch(`/api/games/${gameId}/numbers`, {
        method: 'PATCH',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ calledNumbers }),
      });
      
      if (!response.ok) {
        throw new Error('Failed to update called numbers');
      }
      
      return response.json();
    },
    onSuccess: () => {
      // Refresh the active game data
      queryClient.invalidateQueries({ queryKey: ['/api/games/active'] });
    },
    onError: (error) => {
      console.error('Failed to save called numbers:', error);
      toast({
        title: "Warning",
        description: "Number called but not saved to server",
        variant: "destructive"
      });
    }
  });

  // Sync called numbers from backend when active game changes
  useEffect(() => {
    if (activeGame?.calledNumbers && Array.isArray(activeGame.calledNumbers)) {
      const backendNumbers = activeGame.calledNumbers.map(n => typeof n === 'string' ? parseInt(n) : n);
      setCalledNumbers(backendNumbers);
      if (backendNumbers.length > 0) {
        setCurrentNumber(backendNumbers[backendNumbers.length - 1]);
      }
    }
  }, [activeGame]);

  // Helper function to get letter for number
  const { data: cartelas, isLoading: cartelasQueryLoading } = useQuery({
    queryKey: ['/api/cartelas', user?.id],
    queryFn: async () => {
      if (!user?.id) return [];
      const response = await fetch(`/api/cartelas/${user.id}`);
      if (!response.ok) return [];
      return response.json();
    },
    enabled: !!user?.id, // Only enabled when user is logged in
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
    if (num >= 61 && num <= 75) return "from-yellow-500 to-yellow-700";
    return "from-gray-500 to-gray-700";
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

    // Save to backend if there's an active game
    if (activeGame?.id) {
      updateCalledNumbersMutation.mutate({
        gameId: activeGame.id,
        calledNumbers: newCalledNumbers
      });
    }

    // Play voice announcement immediately (non-blocking)
    customBingoVoice.callNumber(newNumber).catch(error => {
      console.error('Error calling number:', error);
      // Voice error doesn't affect the game state
    });
    
    setIsCallingNumber(false);
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
    
    // Play shuffle sound (non-blocking)
    customBingoVoice.playShuffle().catch(error => {
      console.warn('Error playing shuffle sound:', error);
    });
    
    // Stop shuffling after 3 seconds
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
      
      // Play "not registered" audio (non-blocking)
      customBingoVoice.playNotRegistered().catch(error => {
        console.warn('Error playing not registered audio:', error);
      });
      
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
    
    // Play appropriate audio immediately (non-blocking)
    if (result.isWinner) {
      customBingoVoice.announceWinner(cartelaNumber, true).catch(error => {
        console.warn('Error playing winner audio:', error);
      });
    } else {
      customBingoVoice.announceWinner(cartelaNumber, false).catch(error => {
        console.warn('Error playing not winner audio:', error);
      });
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

    // Announce game start (non-blocking)
    customBingoVoice.announceGameStart().catch(error => {
      console.error('Error announcing game start:', error);
    });
    
    setGameState('PLAYING');
    toast({
      title: "Game Started",
      description: `Playing with ${selectedCards.size} cards`
    });
  };

  // Render card grid for preview
  const renderCardGrid = (card: any) => {
    const cardNumbers = card.pattern;
    if (!cardNumbers || !Array.isArray(cardNumbers)) {
      return (
        <div className="col-span-5 text-center text-gray-500 py-8">
          No card data available
        </div>
      );
    }

    // Create rows of 5 cells each
    return Array.from({ length: 5 }, (_, row) => (
      <div key={row} className="grid grid-cols-5 gap-1 mb-1">
        {Array.from({ length: 5 }, (_, col) => {
          const isFreeSpace = row === 2 && col === 2; // Center space
          const number = cardNumbers[row]?.[col];

          return (
            <div
              key={col}
              className={`w-12 h-12 border-2 flex items-center justify-center text-lg font-bold rounded ${
                isFreeSpace 
                  ? 'bg-yellow-400 text-black border-yellow-600' 
                  : number && number > 0
                    ? 'bg-white border-gray-300 text-gray-800'
                    : 'bg-gray-100 border-gray-200 text-gray-400'
              }`}
            >
              {isFreeSpace ? '★' : (number || '')}
            </div>
          );
        })}
      </div>
    ));
  };

  // Generate bingo card numbers for display
  const generateCardNumbers = (cardNum: number): number[][] => {
    // First try to get grid pattern from cartelas
    const masterCartela = cartelas?.find((c: any) => c.cardNo === cardNum);
    if (masterCartela && masterCartela.pattern) {
      try {
        return typeof masterCartela.pattern === 'string' ? JSON.parse(masterCartela.pattern) : masterCartela.pattern;
      } catch (error) {
        console.error('Error parsing cartela pattern:', error);
      }
    }

    // Fallback to generated grid if master cartela not found
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
                    <Button 
                      className="bg-green-600 hover:bg-green-700 text-white"
                      onClick={() => setShowCartelaManagement(true)}
                    >
                        <Upload className="w-4 h-4 mr-2" />
                        Cartela Management
                      </Button>
                  </div>
                </div>

                {/* Circular Card Grid */}
                <div className="p-4">
                  {cartelasQueryLoading ? (
                    <div className="text-center py-8">
                      <div className="text-white">Loading cartelas...</div>
                    </div>
                  ) : cartelas && cartelas.length > 0 ? (
                    <div className="grid grid-cols-11 gap-2">
                      {cartelas.map((cartela: any) => {
                        const cardNum = cartela.cardNo; // Use cardNo instead of cartelaNumber
                        const isSelected = selectedCards.has(cardNum);
                        const isBeingEdited = editingCard === cardNum;
                        return (
                          <div key={`${cartela.employeeId}-${cardNum}`} className="relative">
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
                  ) : (
                    <div className="text-center py-8">
                      <div className="text-white text-lg mb-4">No stored cartelas available</div>
                      <div className="text-gray-400 text-sm">
                        Please import cartelas using the Cartela Management button above
                      </div>
                    </div>
                  )}
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
                <div className="grid grid-cols-5 gap-1 mb-6">
                  {/* Card Numbers */}
                  {(() => {
                    const cartela = cartelas?.find((c: any) => c.cardNo === expandedCard);
                    if (!cartela) {
                      return (
                        <div className="col-span-5 text-center text-gray-500 py-8">
                          Cartela not found
                        </div>
                      );
                    }
                    return renderCardGrid(cartela);
                  })()}
                </div>
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

      {/* Cartela Management Modal */}
      {showCartelaManagement && (
        <div className="fixed inset-0 bg-black bg-opacity-70 flex items-center justify-center z-[70] p-4">
          <div className="bg-white text-black rounded-lg shadow-2xl max-w-7xl w-full max-h-[95vh] overflow-hidden flex flex-col">
            {/* Header */}
            <div className="bg-gray-800 text-white px-6 py-4 flex justify-between items-center">
              <h2 className="text-2xl font-bold">Cartela Management Panel</h2>
              <button 
                onClick={() => setShowCartelaManagement(false)}
                className="hover:text-red-400 transition-colors"
              >
                <X className="w-6 h-6" />
              </button>
            </div>

            {/* Content */}
            <div className="flex-1 overflow-y-auto p-6">
              {/* Import Section */}
              <div className="mb-8">
                <h3 className="text-xl font-bold mb-4 text-gray-800">Import Features</h3>
                <div className="grid grid-cols-1 gap-6">
                  {/* CSV Import */}
                  <div className="border-2 border-dashed border-gray-300 rounded-lg p-6">
                    <h4 className="text-lg font-semibold mb-3">CSV Import</h4>
                    <p className="text-sm text-gray-600 mb-4">
                      Format: cno,user_id,card_no,b,i,n,g,o
                    </p>
                    <input
                      type="file"
                      accept=".csv"
                      onChange={(e) => setCsvFile(e.target.files?.[0] || null)}
                      className="mb-4 w-full p-2 border rounded"
                    />
                    <Button 
                      className="w-full bg-blue-600 hover:bg-blue-700 text-white"
                      disabled={!csvFile || csvImportMutation.isPending}
                      onClick={processCSVImport}
                    >
                      {csvImportMutation.isPending ? 'Importing...' : 'Import CSV'}
                    </Button>
                  </div>

                  {/* Manual Cartela Builder */}
                  <div className="border-2 border-gray-300 rounded-lg p-6">
                    <h4 className="text-lg font-semibold mb-3">Manual Cartela Builder</h4>
                    <div className="grid grid-cols-5 gap-2 mb-4 max-w-sm mx-auto">
                      {['B', 'I', 'N', 'G', 'O'].map((letter, idx) => (
                        <div key={letter} className="text-center font-bold text-lg">
                          {letter}
                        </div>
                      ))}
                      {Array.from({ length: 25 }, (_, i) => {
                        const row = Math.floor(i / 5);
                        const col = i % 5;
                        const isFreeSpace = row === 2 && col === 2;
                        
                        return (
                          <input
                            key={i}
                            type="number"
                            value={isFreeSpace ? 0 : (manualCartelaGrid[row]?.[col] || '')}
                            disabled={isFreeSpace}
                            placeholder={isFreeSpace ? '★' : ''}
                            className={`w-full p-2 border rounded text-center font-bold ${
                              isFreeSpace 
                                ? 'bg-yellow-400 text-black cursor-not-allowed' 
                                : 'bg-white border-gray-300'
                            }`}
                            onChange={(e) => {
                              const newGrid = [...manualCartelaGrid];
                              if (!newGrid[row]) newGrid[row] = [];
                              newGrid[row][col] = isFreeSpace ? 0 : parseInt(e.target.value) || 0;
                              setManualCartelaGrid(newGrid);
                            }}
                          />
                        );
                      })}
                    </div>
                    <div className="text-center">
                      <Button 
                        className="bg-purple-600 hover:bg-purple-700 text-white"
                        disabled={saveManualCartelaMutation.isPending}
                        onClick={handleSaveManualCartela}
                      >
                        {saveManualCartelaMutation.isPending ? 'Saving...' : 'Save Manual Card'}
                      </Button>
                    </div>
                  </div>
                </div>
              </div>

              {/* Visual Cartela Builder */}
              <div className="mb-8">
                <h3 className="text-xl font-bold mb-4 text-gray-800">Visual Cartela Builder</h3>
                <div className="border-2 border-gray-300 rounded-lg p-6">
                  <div className="grid grid-cols-5 gap-2 mb-4 max-w-sm mx-auto">
                    {['B', 'I', 'N', 'G', 'O'].map((letter, idx) => (
                      <div key={letter} className="text-center font-bold text-lg">
                        {letter}
                      </div>
                    ))}
                    {Array.from({ length: 25 }, (_, i) => {
                      const row = Math.floor(i / 5);
                      const col = i % 5;
                      const isFreeSpace = row === 2 && col === 2;
                      
                      return (
                        <input
                          key={i}
                          type="number"
                          value={isFreeSpace ? 0 : (manualCartelaGrid[row]?.[col] || '')}
                          disabled={isFreeSpace}
                          placeholder={isFreeSpace ? '★' : ''}
                          className={`w-full p-2 border rounded text-center font-bold ${
                            isFreeSpace 
                              ? 'bg-yellow-400 text-black cursor-not-allowed' 
                              : 'bg-white border-gray-300'
                          }`}
                          onChange={(e) => {
                            const newGrid = [...manualCartelaGrid];
                            if (!newGrid[row]) newGrid[row] = [];
                            newGrid[row][col] = isFreeSpace ? 0 : parseInt(e.target.value) || 0;
                            setManualCartelaGrid(newGrid);
                          }}
                        />
                      );
                    })}
                  </div>
                  <div className="text-center">
                    <Button 
                      className="bg-purple-600 hover:bg-purple-700 text-white"
                      disabled={saveManualCartelaMutation.isPending}
                      onClick={handleSaveManualCartela}
                    >
                      {saveManualCartelaMutation.isPending ? 'Saving...' : 'Save Manual Card'}
                    </Button>
                  </div>
                </div>
              </div>

              {/* Master Table View */}
              <div className="mb-8">
                <div className="flex justify-between items-center mb-4">
                  <h3 className="text-xl font-bold text-gray-800">Master Cartela Table</h3>
                  {cartelas && cartelas.length > 0 && (
                    <div className="text-sm text-green-600 bg-green-50 px-3 py-1 rounded-full">
                      {cartelas.length} cartelas available
                    </div>
                  )}
                </div>
                <div className="border-2 border-gray-300 rounded-lg p-6">
                  {/* Search */}
                  <div className="mb-4">
                    <Input
                      placeholder="Search cartelas..."
                      value={cartelaSearchTerm}
                      onChange={(e) => setCartelaSearchTerm(e.target.value)}
                      className="max-w-md"
                    />
                  </div>
                  
                  {/* Table */}
                  <div className="overflow-x-auto">
                    {cartelasQueryLoading ? (
                      <div className="text-center py-8">
                        <div className="text-gray-500">Loading cartelas...</div>
                      </div>
                    ) : cartelas && cartelas.length > 0 ? (
                      <table className="w-full border-collapse">
                        <thead>
                          <tr className="bg-gray-100">
                            <th className="border border-gray-300 px-4 py-2 text-left">Card Number</th>
                            <th className="border border-gray-300 px-4 py-2 text-left">Name</th>
                            <th className="border border-gray-300 px-4 py-2 text-left">Preview</th>
                            <th className="border border-gray-300 px-4 py-2 text-left">Actions</th>
                          </tr>
                        </thead>
                        <tbody>
                          {cartelas.map((cartela: any) => (
                            <tr key={cartela.id} className="hover:bg-gray-50">
                              <td className="border border-gray-300 px-4 py-2 font-semibold">{cartela.cardNo}</td>
                              <td className="border border-gray-300 px-4 py-2">{cartela.name}</td>
                              <td className="border border-gray-300 px-4 py-2">
                                <Button size="sm" variant="outline" onClick={() => setPreviewCard(cartela)}>
                                  <Eye className="w-4 h-4 mr-1" />
                                  Preview
                                </Button>
                              </td>
                              <td className="border border-gray-300 px-4 py-2">
                                <div className="flex gap-2">
                                  <Button size="sm" variant="outline">
                                    <Edit className="w-4 h-4 mr-1" />
                                    Edit
                                  </Button>
                                  <Button size="sm" variant="destructive">
                                    Delete
                                  </Button>
                                </div>
                              </td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    ) : (
                      <div className="text-center py-8">
                        <div className="text-gray-500 mb-2">No cartelas found</div>
                        <div className="text-sm text-gray-400">
                          Import cartelas using the CSV Import tab to see them here
                        </div>
                      </div>
                    )}
                  </div>
                  
                  {/* Status Summary */}
                  {cartelas && cartelas.length > 0 && (
                    <div className="mt-4 p-3 bg-blue-50 rounded-lg">
                      <div className="text-sm text-blue-800">
                        Showing all {cartelas.length} imported cartelas
                      </div>
                    </div>
                  )}
                </div>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Card Preview Modal */}
      {previewCard && (
        <div className="fixed inset-0 bg-black bg-opacity-70 flex items-center justify-center z-[80] p-4">
          <div className="bg-white text-black rounded-lg shadow-2xl max-w-md w-full">
            {/* Header */}
            <div className="bg-white px-4 py-3 rounded-t-lg flex justify-between items-center border-b">
              <h2 className="text-xl font-bold text-black">Card #{previewCard.cardNo}</h2>
              <button
                onClick={() => setPreviewCard(null)}
                className="text-gray-600 hover:text-gray-800"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* Card Content */}
            <div className="p-6 bg-gray-50">
              <div className="text-center mb-4">
                <h3 className="text-lg font-semibold text-gray-700">Card Layout</h3>
              </div>
              
              <div className="bg-white rounded-lg p-4 mx-auto border-2 border-gray-300" style={{ maxWidth: '350px' }}>
                {/* Column Headers */}
                <div className="grid grid-cols-5 gap-2 mb-2">
                  {['B', 'I', 'N', 'G', 'O'].map((letter) => (
                    <div key={letter} className="text-center font-bold text-sm text-gray-700">
                      {letter}
                    </div>
                  ))}
                </div>

                {/* Number Grid */}
                <div className="space-y-1">
                  {(() => {
                    const cartela = cartelas?.find((c: any) => c.cardNo === previewCard.cardNo);
                    if (!cartela) {
                      return (
                        <div className="col-span-5 text-center text-gray-500 py-8">
                          Cartela not found
                        </div>
                      );
                    }
                    
                    const cardNumbers = cartela.pattern;
                    if (!cardNumbers || !Array.isArray(cardNumbers)) {
                      return (
                        <div className="col-span-5 text-center text-gray-500 py-8">
                          No card data available
                        </div>
                      );
                    }

                    // Create rows of 5 cells each
                    return Array.from({ length: 5 }, (_, row) => (
                      <div key={row} className="grid grid-cols-5 gap-1">
                        {Array.from({ length: 5 }, (_, col) => {
                          const isFreeSpace = row === 2 && col === 2; // Center space
                          const number = cardNumbers[row]?.[col];

                          return (
                            <div
                              key={col}
                              className={`w-full aspect-square border-2 flex items-center justify-center text-base font-bold rounded ${
                                isFreeSpace 
                                  ? 'bg-yellow-400 text-black border-yellow-600' 
                                  : number && number > 0
                                    ? 'bg-white border-blue-900 text-blue-900'
                                    : 'bg-gray-100 border-gray-200 text-gray-400'
                              }`}
                            >
                              {isFreeSpace ? '★' : (number || '')}
                            </div>
                          );
                        })}
                      </div>
                    ));
                  })()}
                </div>
              </div>

              {/* Close Button */}
              <div className="mt-6 text-center">
                <Button
                  onClick={() => setPreviewCard(null)}
                  className="bg-blue-600 hover:bg-blue-700 text-white px-8 py-2"
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
