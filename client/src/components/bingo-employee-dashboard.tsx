import { useState, useEffect, useRef } from "react";
import React from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useToast } from "@/hooks/use-toast";
import { useAuth } from "@/hooks/use-auth";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Upload, X, Settings, Trophy, Eye, EyeOff, Edit, Trash2, Sparkles } from "lucide-react";
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
  const [speed, setSpeed] = useState(7);
  const [isAutoPlay, setIsAutoPlay] = useState(false);
  const [checkCardInput, setCheckCardInput] = useState("");
  const [wasAutoCalling, setWasAutoCalling] = useState(false);
  const [isManual, setIsManual] = useState(false);
  const [selectedCards, setSelectedCards] = useState<Set<number>>(new Set());
  const [topUpFee, setTopUpFee] = useState("10");
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
  const calledNumbersRef = useRef<number[]>([]);

  // Cartela Management state
  const [showCartelaManagement, setShowCartelaManagement] = useState(false);
  const [cartelaSearchTerm, setCartelaSearchTerm] = useState("");
  const [currentPage, setCurrentPage] = useState(1);
  const [manualCartelaGrid, setManualCartelaGrid] = useState<number[][]>([]);
  const [csvFile, setCsvFile] = useState<File | null>(null);
  const [activeTab, setActiveTab] = useState<'import' | 'manual' | 'table'>('import');
  const [importProgress, setImportProgress] = useState<number>(0);
  const [isImporting, setIsImporting] = useState(false);
  const [editingCartela, setEditingCartela] = useState<any>(null);
  const [isEditingPreview, setIsEditingPreview] = useState(false);
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
  const [cartelaToDelete, setCartelaToDelete] = useState<any>(null);
  const [showCelebration, setShowCelebration] = useState(false);
  const [winnerInfo, setWinnerInfo] = useState<{ cartelaNumber: number; pattern: string } | null>(null);

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
      // Check if import was successful (has imported field and no critical errors)
      if (data.imported !== undefined || data.total !== undefined) {
        let message = `Successfully processed ${data.total || 0} cartelas`;
        
        if (data.imported > 0) {
          message += ` - ${data.imported} imported/updated`;
        }
        
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
        
        // Refresh cartelas data to show latest imports
        refetch();
        
        // Close cartela management dialog after successful import
        setTimeout(() => {
          setShowCartelaManagement(false);
        }, 2000);
        
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

  // Save Manual Cartela mutation
  const saveManualCartelaMutation = useMutation({
    mutationFn: async (grid: number[][]) => {
      const response = await fetch('/api/cartelas/manual', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ grid })
      });
      if (!response.ok) throw new Error('Failed to save manual cartela');
      return response.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/cartelas'] });
      toast({
        title: "Success",
        description: "Manual cartela saved successfully",
      });
    },
    onError: (error) => {
      toast({
        title: "Error",
        description: "Failed to save manual cartela",
        variant: "destructive"
      });
    }
  });

  // Update Cartela mutation
  const updateCartelaMutation = useMutation({
    mutationFn: async ({ id, cartelaNumber, name, pattern }: { id: number; cartelaNumber: number; name: string; pattern: number[][] }) => {
      const response = await fetch(`/api/cartelas/${id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ cartelaNumber, name, pattern: JSON.stringify(pattern) })
      });
      if (!response.ok) throw new Error('Failed to update cartela');
      return response.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/cartelas'] });
      setIsEditingPreview(false);
      setEditingCartela(null);
      setPreviewCard(null);
      toast({
        title: "Success",
        description: "Cartela updated successfully",
      });
    },
    onError: (error) => {
      toast({
        title: "Error",
        description: "Failed to update cartela",
        variant: "destructive"
      });
    }
  });

  // Delete Cartela mutation
  const deleteCartelaMutation = useMutation({
    mutationFn: async (id: number) => {
      const response = await fetch(`/api/cartelas/${id}`, {
        method: 'DELETE'
      });
      if (!response.ok) throw new Error('Failed to delete cartela');
      return response.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/cartelas'] });
      setShowDeleteConfirm(false);
      setCartelaToDelete(null);
      toast({
        title: "Success",
        description: "Cartela deleted successfully",
      });
    },
    onError: (error) => {
      toast({
        title: "Error",
        description: "Failed to delete cartela",
        variant: "destructive"
      });
    }
  });

  // Handle CSV Import
  const handleCSVImport = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      setCsvFile(file);
    }
  };

  // Handle Top Up File
  const handleTopUpFile = (e: React.ChangeEvent<HTMLInputElement>) => {
    console.log('File input changed', e.target.files);
    const file = e.target.files?.[0];
    if (file) {
      console.log('Processing file:', file.name, file.size);
      setRechargeFile(file);
      processTopUpFile(file);
    } else {
      console.log('No file selected');
    }
  };

  // Process Top Up File
  const processTopUpFile = async (file: File) => {
    console.log('Starting to process top-up file:', file.name);
    
    // Validate file type
    if (!file.name.endsWith('.enc')) {
      console.log('Invalid file type:', file.name);
      toast({
        title: "Invalid File Type",
        description: "Please upload a valid .enc file",
        variant: "destructive"
      });
      return;
    }

    // Validate file size (max 1MB)
    if (file.size > 1024 * 1024) {
      console.log('File too large:', file.size);
      toast({
        title: "File Too Large",
        description: "File size must be less than 1MB",
        variant: "destructive"
      });
      return;
    }

    console.log('File validation passed, reading file...');
    const reader = new FileReader();
    
    reader.onload = async (e) => {
      const encryptedData = e.target?.result as string;
      
      console.log('File read complete. Data length:', encryptedData?.length);
      console.log('File read complete. Data preview:', encryptedData?.substring(0, 200));
      
      if (!encryptedData) {
        console.log('No encrypted data found');
        toast({
          title: "File Read Error",
          description: "Failed to read the uploaded file. Please try again.",
          variant: "destructive"
        });
        return;
      }

      // Validate encrypted data format
      if (encryptedData.length < 50) {
        console.log('File too short:', encryptedData.length);
        toast({
          title: "Invalid File Format",
          description: "The uploaded file appears to be corrupted or incomplete.",
          variant: "destructive"
        });
        return;
      }

      try {
        console.log('Sending POST request to /api/recharge/topup');
        console.log('Encrypted data length:', encryptedData.length);
        console.log('Encrypted data preview:', encryptedData.substring(0, 100) + '...');
        
        toast({
          title: "Processing File",
          description: "Verifying encrypted balance file...",
        });

        const response = await fetch('/api/recharge/topup', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({ encryptedData }),
        });

        console.log('Response status:', response.status);
        const result = await response.json();
        console.log('Response result:', result);

        if (!response.ok) {
          console.log('Error response:', result);
          // Handle specific error types based on error codes
          if (result.error === 'INVALID_FILE_DATA') {
            throw new Error("Invalid file data. Please upload a valid .enc balance file.");
          } else if (result.error === 'INVALID_JSON_FORMAT') {
            throw new Error("Invalid file format. The file appears to be corrupted or not a valid balance file.");
          } else if (result.error === 'MISSING_REQUIRED_FIELDS') {
            throw new Error("Invalid balance file structure. Missing required payload or signature data.");
          } else if (result.error === 'MISSING_TRANSACTION_DATA') {
            throw new Error("Invalid balance file data. Missing transaction ID or amount information.");
          } else if (result.error === 'INVALID_AMOUNT') {
            throw new Error("Invalid amount. The amount must be a positive number.");
          } else if (result.error === 'INVALID_TRANSACTION_ID') {
            throw new Error("Invalid transaction ID. The transaction ID must be a non-empty string.");
          } else if (result.error === 'INVALID_ACCOUNT_NUMBER') {
            throw new Error("Invalid employee account number format in the balance file.");
          } else if (result.error === 'WRONG_ACCOUNT') {
            throw new Error("This balance file is for a different account. Please use your own balance file.");
          } else if (result.message?.includes('already been used') || result.message?.includes('already been redeemed')) {
            throw new Error("This balance file has already been used. Each file can only be used once.");
          } else if (result.message?.includes('signature') || result.message?.includes('tampered')) {
            throw new Error("Invalid signature. The file may have been tampered with or is not authentic.");
          } else if (result.message?.includes('decrypt') || result.message?.includes('corrupted')) {
            throw new Error("Invalid or corrupted balance file. The file may be damaged or not properly encrypted.");
          } else if (result.message?.includes('expired')) {
            throw new Error("This balance file has expired. Please contact support for a new file.");
          } else {
            throw new Error(result.message || 'Failed to process balance file');
          }
        }

        toast({
          title: "Success!",
          description: `Balance topped up successfully! Amount: ${result.amount} ETB`,
        });

        // Refresh user data to get updated balance
        queryClient.invalidateQueries({ queryKey: ['/api/auth/me'] });
        
      } catch (error: any) {
        console.error('Top-up error:', error);
        console.error('Error message:', error.message);
        console.error('Error stack:', error.stack);
        
        let errorMessage = "Failed to process balance file";
        
        // Provide specific error messages based on error type
        if (error.message?.includes('Failed to fetch')) {
          errorMessage = "Network error. Please check your connection and try again.";
        } else if (error.message?.includes('decrypt')) {
          errorMessage = "Invalid encryption. The file is not properly encrypted or is corrupted.";
        } else if (error.message?.includes('signature')) {
          errorMessage = "Invalid signature. The file may be tampered with or not authentic.";
        } else if (error.message?.includes('already been used')) {
          errorMessage = "This balance file has already been used. Each file can only be used once.";
        } else if (error.message?.includes('another account')) {
          errorMessage = "This balance file is for a different account. Please use your own balance file.";
        } else if (error.message) {
          errorMessage = error.message;
        }
        
        console.log('Final error message to show:', errorMessage);
        
        toast({
          title: "Top-Up Failed",
          description: errorMessage,
          variant: "destructive"
        });
      }
    };

    reader.onerror = () => {
      toast({
        title: "File Read Error",
        description: "Failed to read the uploaded file. Please try again.",
        variant: "destructive"
      });
    };

    reader.readAsText(file);
  };

  // Process CSV file (separate from file input handler)
  const processCSVImport = () => {
    if (!csvFile) return;

    setIsImporting(true);
    setImportProgress(0);

    // Debug: log the raw file content first
    const reader = new FileReader();
    reader.onload = (e) => {
      const rawContent = e.target?.result as string;
      console.log('Raw CSV content:', rawContent);
      console.log('File size:', csvFile.size);
      console.log('File type:', csvFile.type);
      
      // Parse with PapaParse
      Papa.parse(csvFile, {
        header: true,
        skipEmptyLines: true,
        dynamicTyping: false, // Keep everything as strings for manual parsing
        complete: (results) => {
          console.log('PapaParse results:', JSON.stringify(results, null, 2));
          console.log('Data length:', results.data.length);
          console.log('First row:', JSON.stringify(results.data[0], null, 2));
          console.log('Errors:', JSON.stringify(results.errors, null, 2));
          console.log('Meta:', JSON.stringify(results.meta, null, 2));
          
          try {
            const totalRows = results.data.length;
            let processedCount = 0;

            const cartelaData = results.data.map((row: any) => {
            
            // Parse CSV row according to format: cno,user_id,card_no,b,i,n,g,o
            const cno = parseInt(row.cno);
            const userId = user?.id || 1; // Override with current logged-in user ID
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
              user_id: userId, // Override with current logged-in user ID
              card_no: cardNo,
              // Send raw B,I,N,G,O columns for server-side processing
              b: row.b,
              i: row.i,
              n: row.n,
              g: row.g,
              o: row.o
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
        console.error('PapaParse error:', error);
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
    reader.readAsText(csvFile);
  };

  // Handle Save Manual Cartela
  const handleSaveManualCartela = () => {
    // Validate grid structure
    if (manualCartelaGrid.length !== 5 || manualCartelaGrid.some(row => row.length !== 5)) {
      toast({
        title: "Invalid Grid",
        description: "Please fill in all 25 cells of the bingo grid",
        variant: "destructive"
      });
      return;
    }

    // Check if center cell (N3) is 0 (free space)
    if (manualCartelaGrid[2][2] !== 0) {
      toast({
        title: "Invalid Grid",
        description: "The center cell (N3) must be 0 (Free Space)",
        variant: "destructive"
      });
      return;
    }

    // Validate column ranges and duplicates
    const columnRanges = [
      { name: 'B', min: 1, max: 15, col: 0 },
      { name: 'I', min: 16, max: 30, col: 1 },
      { name: 'N', min: 31, max: 45, col: 2 },
      { name: 'G', min: 46, max: 60, col: 3 },
      { name: 'O', min: 61, max: 75, col: 4 }
    ];

    for (const column of columnRanges) {
      const columnValues = [];
      for (let row = 0; row < 5; row++) {
        // Skip center cell for N column
        if (column.name === 'N' && row === 2) continue;
        
        const value = manualCartelaGrid[row][column.col];
        if (!value || value === 0) {
          toast({
            title: "Invalid Grid",
            description: `Column ${column.name} has empty cells`,
            variant: "destructive"
          });
          return;
        }
        
        // Check range
        if (value < column.min || value > column.max) {
          toast({
            title: "Invalid Range",
            description: `Column ${column.name} must contain numbers between ${column.min}-${column.max}`,
            variant: "destructive"
          });
          return;
        }
        
        columnValues.push(value);
      }

      // Check for duplicates in column
      const uniqueValues = new Set(columnValues);
      if (uniqueValues.size !== columnValues.length) {
        toast({
          title: "Duplicate Numbers",
          description: `Column ${column.name} contains duplicate numbers`,
          variant: "destructive"
        });
        return;
      }
    }

    // Check for unique card number by comparing with existing cartelas
    if (cartelas && cartelas.length > 0) {
      const existingCardNumbers = new Set(cartelas.map(c => c.cardNo || c.cartelaNumber));
      const newCardNumber = Math.max(...cartelas.map(c => c.cardNo || c.cartelaNumber)) + 1;
      
      if (existingCardNumbers.has(newCardNumber)) {
        toast({
          title: "Duplicate Card Number",
          description: `Card number ${newCardNumber} already exists. Please use a unique card number.`,
          variant: "destructive"
        });
        return;
      }
    }

    saveManualCartelaMutation.mutate(manualCartelaGrid);
  };

  // Handle Manual Cartela Change
  const handleManualCartelaChange = (row: number, col: number, value: string) => {
    const numValue = value === '' ? 0 : parseInt(value);
    
    // Create a new grid to avoid direct mutation
    const newGrid = [...manualCartelaGrid];
    
    // Ensure the row exists
    if (!newGrid[row]) {
      newGrid[row] = [];
    }
    
    // Update the cell value
    newGrid[row][col] = numValue;
    
    setManualCartelaGrid(newGrid);
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

  // Game history query
  const { data: gameHistory } = useQuery({
    queryKey: ['/api/game-history', user?.id],
    queryFn: async () => {
      if (!user?.id) return [];
      const response = await fetch(`/api/game-history/${user.id}`);
      if (!response.ok) return [];
      return response.json();
    },
    enabled: !!user?.id,
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
      // Don't invalidate active game query to prevent race conditions
      // Local state is the source of truth
    },
    onError: (error: any) => {
      console.error('Failed to save called numbers:', error);
      toast({
        title: "Warning",
        description: "Number called but not saved to server",
        variant: "destructive"
      });
    },
  });

  // Handle Edit Cartela (opens preview modal in edit mode)
  const handleEditCartela = (cartela: any) => {
    setEditingCartela({
      ...cartela,
      pattern: cartela.pattern || []
    });
    setIsEditingPreview(true);
    setPreviewCard(cartela);
  };

  // Handle Update Cartela
  const handleUpdateCartela = () => {
    if (!editingCartela) return;
    
    updateCartelaMutation.mutate({
      id: editingCartela.id,
      cartelaNumber: editingCartela.cartelaNumber,
      name: editingCartela.name,
      pattern: editingCartela.pattern
    });
  };

  // Handle Delete Cartela
  const handleDeleteCartela = (cartela: any) => {
    setCartelaToDelete(cartela);
    setShowDeleteConfirm(true);
  };

  // Confirm Delete
  const confirmDelete = () => {
    if (cartelaToDelete) {
      deleteCartelaMutation.mutate(cartelaToDelete.id);
    }
  };

  // Handle Cartela Grid Change in Edit
  const handleEditCartelaChange = (row: number, col: number, value: string) => {
    const numValue = value === '' ? 0 : parseInt(value);
    const newGrid = [...editingCartela.pattern];
    
    if (!newGrid[row]) {
      newGrid[row] = [];
    }
    
    newGrid[row][col] = numValue;
    setEditingCartela({
      ...editingCartela,
      pattern: newGrid
    });
  };

// Initialize called numbers from backend when component mounts or game changes
  useEffect(() => {
    if (activeGame && (activeGame as any)?.calledNumbers && Array.isArray((activeGame as any).calledNumbers) && calledNumbers.length === 0) {
      // Only initialize if we don't have any local numbers yet
      const backendNumbers = (activeGame as any).calledNumbers.map((n: any) => typeof n === 'string' ? parseInt(n) : n);
      setCalledNumbers(backendNumbers);
      if (backendNumbers.length > 0) {
        setCurrentNumber(backendNumbers[backendNumbers.length - 1]);
      }
    }
  }, [activeGame]);

  // Sync calledNumbersRef with calledNumbers state
  useEffect(() => {
    calledNumbersRef.current = calledNumbers;
  }, [calledNumbers]);

  // Helper function to get letter for number
  const { data: cartelas, isLoading: cartelasQueryLoading, refetch } = useQuery({
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
      case "N": return "bg-gray-400 text-black"; // Gray with black text
      case "G": return "bg-green-600 text-white"; // Green
      case "O": return "bg-yellow-400 text-black"; // Yellow
      default: return "bg-gray-600 text-white";
    }
  };

  // Get ball gradient color
  const getBallGradient = (num: number): string => {
    if (num >= 1 && num <= 15) return "from-blue-500 to-blue-700";
    if (num >= 16 && num <= 30) return "from-red-500 to-red-700";
    if (num >= 31 && num <= 45) return "from-white to-gray-200"; // White background for N column in game floor
    if (num >= 46 && num <= 60) return "from-green-500 to-green-700";
    if (num >= 61 && num <= 75) return "from-yellow-500 to-yellow-700";
    return "from-gray-600 to-gray-800";
  };

  // Call number handler with voice synthesis
  const handleCallNumber = async () => {
    const availableNumbers = Array.from({ length: 75 }, (_, i) => i + 1)
      .filter(n => !calledNumbersRef.current.includes(n));

    if (availableNumbers.length === 0) {
      // Stop auto-calling if all numbers are called
      stopAutoCalling();
      return;
    }

    const randomIndex = Math.floor(Math.random() * availableNumbers.length);
    const newNumber = availableNumbers[randomIndex];

    setIsCallingNumber(true);

    // Update UI state immediately using functional update
    setCurrentNumber(newNumber);
    const newCalledNumbers = [...calledNumbersRef.current, newNumber];
    setCalledNumbers(prev => [...prev, newNumber]);
    
    // Save to backend if there's an active game
    if ((activeGame as any)?.id) {
      updateCalledNumbersMutation.mutate({
        gameId: (activeGame as any).id,
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
    
    // Pause the game when shuffling
    const wasAutoCalling = isAutoCalling;
    if (isAutoCalling) {
      setWasAutoCalling(true);
      stopAutoCalling();
    } else {
      setWasAutoCalling(false);
    }
    
    setIsShuffling(true);
    
    // Get shuffle audio duration and sync with animation
    try {
      const audio = new Audio('/voices/common/shuffle.mp3');
      
      audio.addEventListener('loadedmetadata', () => {
        const audioDuration = audio.duration * 1000; // Convert to milliseconds
        const animationDuration = Math.max(audioDuration, 3000); // Use audio duration or 3s minimum
        
        // Play shuffle sound
        customBingoVoice.playShuffle().catch(error => {
          console.warn('Error playing shuffle sound:', error);
        });
        
        // Stop shuffling when audio completes (synchronized)
        setTimeout(() => {
          setIsShuffling(false);
          // Resume auto-calling if it was active before
          if (wasAutoCalling) {
            setWasAutoCalling(false);
            startAutoCalling();
          }
        }, animationDuration);
      });
      
      audio.addEventListener('error', () => {
        console.warn('Could not load shuffle audio, using default 3s duration');
        
        // Play shuffle sound anyway
        customBingoVoice.playShuffle().catch(error => {
          console.warn('Error playing shuffle sound:', error);
        });
        
        // Use default 3-second duration
        setTimeout(() => {
          setIsShuffling(false);
          if (wasAutoCalling) {
            setWasAutoCalling(false);
            startAutoCalling();
          }
        }, 3000);
      });
      
      // Load the audio to get duration
      audio.load();
      
    } catch (error) {
      console.warn('Error setting up shuffle audio:', error);
      
      // Fallback: play sound and use default 3s duration
      customBingoVoice.playShuffle().catch(error => {
        console.warn('Error playing shuffle sound:', error);
      });
      
      setTimeout(() => {
        setIsShuffling(false);
        if (wasAutoCalling) {
          setWasAutoCalling(false);
          startAutoCalling();
        }
      }, 3000);
    }
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
    console.log('handleCheckCard called, checkCardInput:', checkCardInput, 'gameState:', gameState);
    
    // Pause the game when checking card
    if (isAutoCalling) {
      setWasAutoCalling(true);
      stopAutoCalling();
    } else {
      setWasAutoCalling(false);
    }
    
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
    const resultData = {
      cartelaNumber,
      isWinner: result.isWinner,
      pattern: result.pattern,
      cardNumbers
    };
    console.log('Setting checkedCardResult to:', resultData);
    setCheckedCardResult(resultData);
    
    // Force re-render
    forceUpdate({});
    
    // Play appropriate audio immediately (non-blocking)
    if (result.isWinner) {
      // Trigger celebration for winners
      setWinnerInfo({ cartelaNumber, pattern: result.pattern || 'Unknown Pattern' });
      setShowCelebration(true);
      
      // Hide celebration after 5 seconds
      setTimeout(() => {
        setShowCelebration(false);
        setWinnerInfo(null);
      }, 5000);
      
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

    const cardFee = parseInt(topUpFee);
    const totalCollected = selectedCards.size * cardFee;
    
    // Calculate deduction based on number of cards (not card fee)
    let deductionAmount;
    if (selectedCards.size <= 1) {
      deductionAmount = 0; // 0 or 1 cards: no deduction
    } else if (selectedCards.size >= 2 && selectedCards.size <= 5) {
      deductionAmount = 10; // 2-5 cards: 10 ETB deduction
    } else if (selectedCards.size >= 6 && selectedCards.size <= 12) {
      deductionAmount = 20; // 6-12 cards: 20 ETB deduction
    } else {
      deductionAmount = 30; // 13+ cards: 30 ETB deduction
    }

    // Calculate winner reward: total collected - deduction
    // But winner gets 0 if 0 or 1 cards registered
    let winnerReward;
    if (selectedCards.size <= 1) {
      winnerReward = 0; // 0 or 1 cards = 0 ETB reward
    } else {
      winnerReward = totalCollected - deductionAmount;
    }

    const remainingBalance = (user as any)?.balance || 0;

    // Check if employee has sufficient balance (only if deduction > 0)
    if (deductionAmount > 0 && remainingBalance < deductionAmount) {
      toast({
        title: "Insufficient Balance",
        description: `Required: ${deductionAmount} ETB for game fee. Available: ${remainingBalance.toFixed(2)} ETB. Please recharge to continue.`,
        variant: "destructive"
      });
      return;
    }

    try {
      // Only deduct game fee if deduction amount > 0
      if (deductionAmount > 0) {
        const response = await fetch('/api/games/deduct-balance', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            amount: deductionAmount.toFixed(2),
            cardCount: selectedCards.size,
            cardFee: cardFee,
            totalCollected: totalCollected.toFixed(2),
            winnerReward: winnerReward.toFixed(2),
            description: `Game fee for ${selectedCards.size} cards at ${cardFee} ETB each. Total: ${totalCollected} ETB, Fee: ${deductionAmount} ETB, Winner reward: ${winnerReward} ETB`
          })
        });

        if (!response.ok) {
          throw new Error('Failed to deduct balance');
        }

        // Refresh user balance
        queryClient.invalidateQueries({ queryKey: ['/api/auth/me'] });
      }

      toast({
        title: "Game Started",
        description: deductionAmount > 0 ? `Game fee ${deductionAmount} ETB deducted. Winner will receive ${winnerReward} ETB` : `Game started. Winner will receive ${winnerReward} ETB`,
        variant: "default"
      });

    } catch (error) {
      toast({
        title: "Error",
        description: "Failed to deduct balance. Please try again.",
        variant: "destructive"
      });
      return;
    }

    // Announce game start (non-blocking)
    customBingoVoice.announceGameStart().catch(error => {
      console.error('Error announcing game start:', error);
    });
    
    setGameState('PLAYING');
    // Game started toast removed as requested
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

  // Celebration Component
  const Celebration = () => {
    if (!showCelebration) return null;

    return (
      <div className="fixed inset-0 pointer-events-none z-50">
        {/* Confetti/Flares Animation */}
        {[...Array(20)].map((_, i) => (
          <div
            key={i}
            className="absolute animate-bounce"
            style={{
              left: `${Math.random() * 100}%`,
              top: `${Math.random() * 100}%`,
              animationDelay: `${Math.random() * 2}s`,
              animationDuration: `${2 + Math.random() * 2}s`
            }}
          >
            <div className={`text-4xl ${i % 3 === 0 ? 'text-yellow-400' : i % 3 === 1 ? 'text-red-500' : 'text-blue-500'}`}>
              {i % 4 === 0 ? '✨' : i % 4 === 1 ? '🎉' : i % 4 === 2 ? '🌟' : '🎊'}
            </div>
          </div>
        ))}
        
        {/* Winner Message */}
        <div className="absolute inset-0 flex items-center justify-center">
          <div className="bg-gradient-to-r from-yellow-400 to-orange-500 text-white px-8 py-6 rounded-2xl shadow-2xl animate-pulse">
            <div className="text-center">
              <div className="text-3xl font-bold mb-2 flex items-center justify-center gap-2">
                <Sparkles className="w-8 h-8" />
                WINNER!
                <Sparkles className="w-8 h-8" />
              </div>
              <div className="text-xl">
                Card #{winnerInfo?.cartelaNumber}
              </div>
              <div className="text-lg mt-1">
                {winnerInfo?.pattern}
              </div>
            </div>
          </div>
        </div>
      </div>
    );
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
      {/* Celebration Component */}
      <Celebration />
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
                  {(user as any)?.balance || 0} ETB
                </div>
                <Button 
                  className="bg-green-600 hover:bg-green-700 text-white"
                  onClick={() => document.getElementById('topup-file-input')?.click()}
                >
                  <Upload className="w-4 h-4 mr-2" />
                  Top Up Balance (.enc file)
                </Button>
                <input
                  id="topup-file-input"
                  type="file"
                  accept=".enc"
                  onChange={handleTopUpFile}
                  className="hidden"
                />
              </div>

              {/* Machine ID Section */}
              <div className="mb-6 bg-purple-50 rounded-lg p-6">
                <h3 className="text-xl font-bold mb-4">Machine Information</h3>
                <div className="space-y-4">
                  {/* Base Machine ID */}
                  <div className="bg-white rounded-lg p-4 border border-purple-200">
                    <div className="flex items-center justify-between mb-2">
                      <span className="text-gray-700 font-medium">Base Machine ID:</span>
                      <div className="flex items-center gap-2">
                        <span className="text-sm font-mono font-bold text-blue-600">
                          {(user as any)?.machineId?.split('-USR')[0] || 'Not Assigned'}
                        </span>
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => {
                            const baseMachineId = (user as any)?.machineId?.split('-USR')[0] || '';
                            if (baseMachineId) {
                              navigator.clipboard.writeText(baseMachineId);
                              toast({
                                title: "Copied!",
                                description: "Base Machine ID copied to clipboard",
                              });
                            } else {
                              toast({
                                title: "No Machine ID",
                                description: "Base Machine ID is not assigned",
                                variant: "destructive"
                              });
                            }
                          }}
                          className="border-blue-300 text-blue-600 hover:bg-blue-100"
                        >
                          Copy
                        </Button>
                      </div>
                    </div>
                    <div className="text-xs text-gray-500">System hardware fingerprint</div>
                  </div>

                  {/* User-Specific Machine ID */}
                  <div className="bg-white rounded-lg p-4 border border-purple-200">
                    <div className="flex items-center justify-between mb-2">
                      <span className="text-gray-700 font-medium">Your Machine ID:</span>
                      <div className="flex items-center gap-2">
                        <span className="text-sm font-mono font-bold text-purple-600">
                          {(user as any)?.machineId || 'Not Assigned'}
                        </span>
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => {
                            const machineId = (user as any)?.machineId || '';
                            if (machineId) {
                              navigator.clipboard.writeText(machineId);
                              toast({
                                title: "Copied!",
                                description: "Your Machine ID copied to clipboard",
                              });
                            } else {
                              toast({
                                title: "No Machine ID",
                                description: "Machine ID is not assigned",
                                variant: "destructive"
                              });
                            }
                          }}
                          className="border-purple-300 text-purple-600 hover:bg-purple-100 mr-2"
                        >
                          Copy
                        </Button>
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={async () => {
                            const machineId = (user as any)?.machineId || '';
                            if (machineId) {
                              try {
                                const response = await fetch('/api/auth/verify-machine-id', {
                                  method: 'POST',
                                  headers: {
                                    'Content-Type': 'application/json',
                                  },
                                  body: JSON.stringify({ machineId }),
                                });
                                
                                const result = await response.json();
                              
                              if (result.valid) {
                                toast({
                                  title: "✅ Machine ID Verified",
                                  description: "This machine ID is valid for the current system",
                                });
                              } else {
                                toast({
                                  title: "❌ Invalid Machine ID",
                                  description: "This machine ID is not valid for the current system",
                                  variant: "destructive"
                                });
                              }
                            } catch (error) {
                              toast({
                                title: "Verification Failed",
                                description: "Failed to verify machine ID",
                                variant: "destructive"
                              });
                            }
                          } else {
                            toast({
                              title: "No Machine ID",
                              description: "Machine ID is not assigned",
                              variant: "destructive"
                            });
                          }
                        }}
                        className="border-green-300 text-green-600 hover:bg-green-100"
                      >
                        Verify
                      </Button>
                    </div>
                  </div>

                  {/* Account Info */}
                  <div className="flex items-center justify-between">
                    <span className="text-gray-600 font-medium">Account Number:</span>
                    <span className="text-lg font-mono font-bold text-purple-600">
                      {(user as any)?.accountNumber || 'N/A'}
                    </span>
                  </div>
                  <div className="flex items-center justify-between">
                    <span className="text-gray-600 font-medium">Employee Name:</span>
                    <span className="text-lg font-bold text-purple-600">
                      {(user as any)?.name || 'N/A'}
                    </span>
                  </div>
                </div>
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
                      {gameHistory?.map((game: any, index: number) => (
                        <tr key={game.id || index} className="border-b border-gray-200">
                          <td className="px-4 py-3">Round {index + 1}</td>
                          <td className="px-4 py-3">{new Date(game.createdAt || game.startTime).toLocaleDateString()}</td>
                          <td className="px-4 py-3">{game.totalPlayers || game.players?.length || 0}</td>
                          <td className="px-4 py-3">{game.prizePool || game.totalCollected || 0} ETB</td>
                          <td className="px-4 py-3">{game.winnerName || game.winner || '-'}</td>
                          <td className="px-4 py-3">
                            <span className={`px-2 py-1 rounded text-sm ${
                              game.status === 'completed' 
                                ? 'bg-green-100 text-green-800'
                                : game.status === 'active'
                                  ? 'bg-blue-100 text-blue-800'
                                  : 'bg-gray-100 text-gray-800'
                            }`}>
                              {game.status === 'completed' ? 'Completed' : game.status === 'active' ? 'Active' : 'Paused'}
                            </span>
                          </td>
                        </tr>
                      ))}
                      {(!gameHistory || gameHistory.length === 0) && (
                        <tr>
                          <td colSpan={6} className="px-4 py-8 text-center text-gray-500">
                            No game history available
                          </td>
                        </tr>
                      )}
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
        </div>
      )}

      {/* Registration Workflow */}
      {gameState === 'REGISTERING' && (
        <div className="fixed inset-0 bg-black bg-opacity-70 flex items-center justify-center z-50 p-4">
          <div className="bg-white text-black rounded-lg shadow-2xl max-w-6xl w-full max-h-[90vh] overflow-hidden flex flex-col">
            {/* Header */}
            <div className="bg-gray-800 text-white px-6 py-3 flex justify-between items-center">
              <h2 className="text-xl font-bold">Register Cards</h2>
              <div className="flex items-center gap-4">
                <div className="text-sm font-bold text-green-400">
                  Balance: {(user as any)?.balance || 0} ETB
                </div>
                <button onClick={() => setGameState('SETTING')} className="hover:text-red-400">
                  <X className="w-6 h-6" />
                </button>
              </div>
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
                                  // In edit mode, open preview modal in edit mode
                                  const cartela = cartelas.find((c: any) => c.cardNo === cardNum);
                                  if (cartela) {
                                    handleEditCartela(cartela);
                                  }
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
                  <div className="flex justify-between items-center">
                    <div className="text-sm text-gray-200 font-semibold">Total: {selectedCards.size * parseInt(topUpFee)} ETB</div>
                    <div className="text-sm text-green-400 font-semibold">
                      Winners Reward: {selectedCards.size <= 1 ? 0 : (selectedCards.size * parseInt(topUpFee)) - (selectedCards.size >= 2 && selectedCards.size <= 5 ? 10 : selectedCards.size >= 6 && selectedCards.size <= 12 ? 20 : 30)} ETB
                    </div>
                  </div>
                </div>

                <Button
                  onClick={handleStartGame}
                  className="w-full bg-blue-600 hover:bg-blue-700 text-white py-3"
                  disabled={selectedCards.size === 0 || ((user as any)?.balance || 0) < 50}
                >
                  Start Game
                </Button>
                
                {/* Balance Warning */}
                {((user as any)?.balance || 0) < 50 && (
                  <div className="mt-2 p-2 bg-yellow-50 border border-yellow-200 rounded-md">
                    <p className="text-xs text-yellow-800 text-center">
                      ⚠️ Insufficient balance (minimum 50 ETB required to start a game)
                    </p>
                  </div>
                )}
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
                      <div className={`text-4xl font-bold ${(currentNumber >= 31 && currentNumber <= 45) || (currentNumber >= 61 && currentNumber <= 75)
                        ? 'text-black'
                        : 'text-white'}
                      `}>

                        {currentNumber}
                      </div>
                      <div className={`text-xl font-bold mt-1 ${(currentNumber >= 31 && currentNumber <= 45) || (currentNumber >= 61 && currentNumber <= 75)
                        ? 'text-black'
                        : 'text-white'}
                      `}>
                        {getLetterForNumber(currentNumber)}
                      </div>
                    </>
                  )}
                </div>
              </div>
            </div>

            {/* 5x5 Pattern Preview */}
            <div className="bg-gray-800 rounded-lg p-2">
              <div className="relative w-full h-full group">
                <img 
                  src="/bingo_hd.jpg" 
                  alt="Bingo Card Pattern" 
                  className="w-full h-full object-contain rounded-lg shadow-2xl transition-transform duration-300 group-hover:scale-105 border-2 border-yellow-500/50"
                />
                {/* Overlay effect */}
                <div className="absolute inset-0 bg-gradient-to-t from-black/20 to-transparent rounded-lg pointer-events-none" />
                {/* Shine effect */}
                <div className="absolute inset-0 rounded-lg pointer-events-none">
                  <div className="absolute top-1 left-1 right-1 h-px bg-gradient-to-r from-transparent via-yellow-400 to-transparent opacity-60" />
                  <div className="absolute top-1 left-1 bottom-1 w-px bg-gradient-to-b from-transparent via-yellow-400 to-transparent opacity-60" />
                </div>
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
                          <span className={`font-bold text-xl ${(num >= 31 && num <= 45) || (num >= 61 && num <= 75)
                            ? 'text-black'
                            : 'text-white'}
                          `}>
                            {num}
                          </span>
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
              <div className="text-6xl font-bold mb-2">ደራሽ</div>
              <div className="bg-blue-700 rounded-lg p-4">
                <div className="text-5xl font-bold text-yellow-400">{topUpFee}</div>
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
                        ? `bg-gradient-to-br ${getBallGradient(num)} shadow-lg ${(num >= 31 && num <= 45) || (num >= 61 && num <= 75)
                            ? 'text-black'
                            : 'text-white'}`
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
              placeholder="Enter Card Number"
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
        </div>
      )}

      {/* Checked Card Result Display - Centered overlay */}
      {gameState === 'PLAYING' && checkedCardResult && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-30 p-4">
          <div className="bg-gray-800 rounded-xl p-6 border-2 border-yellow-500 max-w-2xl w-full max-h-[90vh] overflow-y-auto">
              {checkedCardResult.cardNumbers.length === 0 ? (
                // Not registered message - small popup above check button
                <div className="flex items-center justify-between">
                  <span className="text-white font-bold">
                    Card #{checkedCardResult.cartelaNumber} Not Registered
                  </span>
                  <div className="flex gap-2">
                    {wasAutoCalling && (
                      <Button
                        onClick={() => {
                          setCheckedCardResult(null);
                          setWasAutoCalling(false);
                          startAutoCalling();
                        }}
                        className="bg-green-600 hover:bg-green-700 text-white px-4 py-2 text-sm"
                      >
                        Resume Game
                      </Button>
                    )}
                    <Button
                      onClick={() => {
                        setCheckedCardResult(null);
                        setWasAutoCalling(false);
                      }}
                      variant="ghost"
                      size="sm"
                      className="text-white hover:bg-gray-700"
                    >
                      <X className="w-4 h-4" />
                    </Button>
                  </div>
                </div>
              ) : (
                // Registered card - show full card layout
                <>
                  <div className="flex justify-between items-center mb-4">
                    <h3 className={`text-lg font-bold ${checkedCardResult.isWinner ? 'text-yellow-400 animate-pulse' : 'text-white'}`}>
                      Card #{checkedCardResult.cartelaNumber} - {checkedCardResult.isWinner ? '🎉 WINNER! 🎉' : 'NOT A WINNER'}
                    </h3>
                    <div className="flex gap-2">
                      {wasAutoCalling && (
                        <Button
                          onClick={() => {
                            setCheckedCardResult(null);
                            setWasAutoCalling(false);
                            startAutoCalling();
                          }}
                          className="bg-green-600 hover:bg-green-700 text-white px-4 py-2 text-sm"
                        >
                          Resume Game
                        </Button>
                      )}
                      <Button
                        onClick={() => {
                          setCheckedCardResult(null);
                          setWasAutoCalling(false);
                        }}
                        variant="ghost"
                        size="sm"
                        className="text-white hover:bg-gray-700"
                      >
                        <X className="w-4 h-4" />
                      </Button>
                    </div>
                  </div>
                  
                  {/* Card Layout - Bigger */}
                  <div className="border-2 rounded-lg overflow-hidden">
                    {/* BINGO Header */}
                    <div className="grid grid-cols-5 gap-1 bg-gray-700">
                      {['B', 'I', 'N', 'G', 'O'].map((letter) => (
                        <div 
                          key={letter} 
                          className={`text-center py-3 font-bold text-white text-lg ${getLetterColor(letter)}`}
                        >
                          {letter}
                        </div>
                      ))}
                    </div>
                    {/* Card Numbers - Bigger cells */}
                    {checkedCardResult.cardNumbers.map((row, rowIndex) => (
                      <div key={rowIndex} className="grid grid-cols-5 gap-1">
                        {row.map((num, colIndex) => {
                          const isCalled = num < 0;
                          const displayNum = Math.abs(num);
                          const isFreeSpace = num === 0;
                          const letter = ['B', 'I', 'N', 'G', 'O'][colIndex];
                          
                          // Get appropriate colors for called numbers based on column
                          const getCalledNumberColors = (letter: string) => {
                            switch (letter) {
                              case "B": return 'bg-blue-900 text-white';
                              case "I": return 'bg-red-600 text-white';
                              case "N": return 'bg-gray-400 text-white'; // Dark background with white text for visibility
                              case "G": return 'bg-green-600 text-white';
                              case "O": return 'bg-yellow-500 text-black';
                              default: return 'bg-yellow-400 text-black';
                            }
                          };
                          
                          return (
                            <div 
                              key={colIndex}
                              className={`h-14 flex items-center justify-center text-lg font-bold border transition-all duration-300 ${
                                isCalled 
                                  ? getCalledNumberColors(letter)
                                  : 'bg-white text-black hover:bg-gray-100'
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
                    <div className="mt-3 text-center">
                      <p className="text-yellow-400 font-bold text-lg animate-pulse">
                        🏆 Pattern: {checkedCardResult.pattern} 🏆
                      </p>
                    </div>
                  )}
                  
                  {/* Winner Action Buttons */}
                  {checkedCardResult.isWinner && (
                    <div className="mt-6 flex gap-4 justify-center">
                      <Button
                        onClick={() => {
                          // Stop auto-calling
                          stopAutoCalling();
                          // Reset game state
                          setCalledNumbers([]);
                          setCurrentNumber(null);
                          setGameState('SETTING');
                          setCheckedCardResult(null);
                          setWasAutoCalling(false);
                        }}
                        className="bg-green-600 hover:bg-green-700 text-white px-6 py-3 font-bold"
                      >
                        New Game
                      </Button>
                      <Button
                        onClick={() => {
                          // Stop auto-calling
                          stopAutoCalling();
                          // Reset game state
                          setCalledNumbers([]);
                          setCurrentNumber(null);
                          setGameState('SETTING');
                          setCheckedCardResult(null);
                          setWasAutoCalling(false);
                        }}
                        className="bg-red-600 hover:bg-red-700 text-white px-6 py-3 font-bold"
                      >
                        Quit Game
                      </Button>
                    </div>
                  )}
                </>
              )}
            </div>
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
        <div className="fixed inset-0 bg-black bg-opacity-80 backdrop-blur-sm flex items-center justify-center z-[70] p-4">
          <div className="bg-gray-900 text-white rounded-2xl shadow-2xl max-w-6xl w-full max-h-[95vh] overflow-hidden flex flex-col border border-gray-700">
            {/* Header */}
            <div className="bg-gradient-to-r from-blue-600 to-purple-600 px-8 py-5 flex justify-between items-center border-b border-gray-700">
              <h2 className="text-2xl font-bold text-white flex items-center">
                <div className="w-8 h-8 bg-white bg-opacity-20 rounded-lg flex items-center justify-center mr-3">
                  <svg className="w-5 h-5 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 11H5m14 0a2 2 0 012 2v6a2 2 0 01-2 2H5a2 2 0 01-2-2v-6a2 2 0 012-2h14m-7 4l7 7m0 0l-7-7" />
                  </svg>
                </div>
                Cartela Management
              </h2>
              <button 
                onClick={() => setShowCartelaManagement(false)}
                className="text-gray-300 hover:text-white transition-colors p-2 hover:bg-white hover:bg-opacity-10 rounded-lg"
              >
                <X className="w-6 h-6" />
              </button>
            </div>

            {/* Tab Navigation */}
            <div className="bg-gray-800 px-8 py-4 border-b border-gray-700">
              <div className="flex space-x-1">
                <button
                  onClick={() => setActiveTab('import')}
                  className={`px-6 py-3 rounded-t-lg font-medium transition-all ${
                    activeTab === 'import' 
                      ? 'bg-blue-600 text-white shadow-lg' 
                      : 'text-gray-400 hover:text-white hover:bg-gray-700'
                  }`}
                >
                  <div className="flex items-center">
                    <Upload className="w-4 h-4 mr-2" />
                    Import CSV
                  </div>
                </button>
                <button
                  onClick={() => setActiveTab('manual')}
                  className={`px-6 py-3 rounded-t-lg font-medium transition-all ${
                    activeTab === 'manual' 
                      ? 'bg-purple-600 text-white shadow-lg' 
                      : 'text-gray-400 hover:text-white hover:bg-gray-700'
                  }`}
                >
                  <div className="flex items-center">
                    <svg className="w-4 h-4 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H8m8 8l-4-4m0 0l4 4m-4-4v8" />
                    </svg>
                    Manual Add
                  </div>
                </button>
                <button
                  onClick={() => setActiveTab('table')}
                  className={`px-6 py-3 rounded-t-lg font-medium transition-all ${
                    activeTab === 'table' 
                      ? 'bg-green-600 text-white shadow-lg' 
                      : 'text-gray-400 hover:text-white hover:bg-gray-700'
                  }`}
                >
                  <div className="flex items-center">
                    <svg className="w-4 h-4 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 10h18M3 14h18m-9-4h10a1 1 0 011 1v4a1 1 0 01-1 1H6a1 1 0 01-1-1v-4a1 1 0 011-1h10z" />
                    </svg>
                    View Table
                  </div>
                </button>
              </div>
            </div>

            {/* Content Area */}
            <div className="flex-1 overflow-y-auto p-8 bg-gray-900">
              {activeTab === 'import' && (
                <div className="max-w-4xl mx-auto">
                  <div className="bg-gray-800 rounded-xl p-8 border border-gray-700 shadow-xl">
                    <div className="mb-8">
                      <h3 className="text-2xl font-bold text-white mb-4 flex items-center">
                        <div className="w-10 h-10 bg-blue-600 rounded-lg flex items-center justify-center mr-3">
                          <Upload className="w-5 h-5 text-white" />
                        </div>
                        CSV Import
                      </h3>
                      <p className="text-gray-300 mb-6">
                        Import cartelas from a CSV file with format: <code className="bg-gray-700 px-2 py-1 rounded text-blue-400">cno,user_id,card_no,b,i,n,g,o</code>
                      </p>
                    </div>
                    
                    <div className="space-y-6">
                      <div>
                        <label className="block text-sm font-medium text-gray-300 mb-3">Select CSV File</label>
                        <div className="relative">
                          <input
                            type="file"
                            accept=".csv"
                            onChange={handleCSVImport}
                            className="w-full px-4 py-3 bg-gray-700 border border-gray-600 rounded-lg text-white file:mr-4 file:py-3 file:px-4 file:rounded-lg file:border-0 file:text-gray-300 file:bg-gray-700 hover:bg-gray-600 focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                          />
                        </div>
                      </div>

                      {importProgress > 0 && (
                        <div className="mb-6">
                          <div className="space-y-4">
                            <div className="flex justify-between text-sm text-gray-300 mb-2">
                              <span>Import Progress</span>
                              <span>{importProgress}%</span>
                            </div>
                            <div className="w-full bg-gray-700 rounded-full h-3">
                              <div 
                                className="bg-gradient-to-r from-blue-500 to-blue-600 h-3 rounded-full transition-all duration-300"
                                style={{ width: `${importProgress}%` }}
                              />
                            </div>
                            {isImporting && (
                              <div className="text-center text-sm text-blue-400">
                                {importProgress < 50 ? 'Reading CSV file...' : 
                                 importProgress < 90 ? 'Processing cartela data...' : 
                                 'Saving to database...'}
                              </div>
                            )}
                          </div>
                        </div>
                      )}

                      <Button 
                        className="w-full bg-gradient-to-r from-blue-600 to-blue-700 hover:from-blue-700 hover:to-blue-800 text-white font-medium py-4 shadow-lg transition-all duration-200"
                        disabled={!csvFile || csvImportMutation.isPending || isImporting}
                        onClick={processCSVImport}
                      >
                        {csvImportMutation.isPending || isImporting ? (
                          <div className="flex items-center">
                            <svg className="animate-spin h-5 w-5 mr-3" viewBox="0 0 24 24">
                              <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" fill="none" />
                              <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8 8 8 0 01-8 8z" />
                            </svg>
                            Importing Cartelas...
                          </div>
                        ) : (
                          <div className="flex items-center">
                            <Upload className="w-5 h-5 mr-3" />
                            Import CSV File
                          </div>
                        )}
                      </Button>
                    </div>
                  </div>
                </div>
              )}

              {activeTab === 'manual' && (
                <div className="max-w-4xl mx-auto">
                  <div className="bg-gray-800 rounded-xl p-8 border border-gray-700 shadow-xl">
                    <div className="mb-8">
                      <h3 className="text-2xl font-bold text-white mb-4 flex items-center">
                        <div className="w-10 h-10 bg-purple-600 rounded-lg flex items-center justify-center mr-3">
                          <svg className="w-5 h-5 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
                          </svg>
                        </div>
                        Manual Cartela Builder
                      </h3>
                      <p className="text-gray-300">
                        Create a new cartela manually by filling in the bingo grid below.
                      </p>
                    </div>

                    <div className="flex justify-center">
                      <div className="bg-blue-50 rounded-lg p-4">
                        <div className="text-center mb-3 text-lg font-bold text-gray-800">Manual Cartela Builder</div>
                        <div className="flex justify-center">
                          <div className="bg-white rounded-lg p-3 inline-block shadow-lg">
                            <div className="grid grid-cols-5 gap-1 mb-2">
                              <div className="font-bold text-blue-900 text-center text-sm">B</div>
                              <div className="font-bold text-red-900 text-center text-sm">I</div>
                              <div className="font-bold text-gray-900 text-center text-sm">N</div>
                              <div className="font-bold text-green-900 text-center text-sm">G</div>
                              <div className="font-bold text-yellow-900 text-center text-sm">O</div>
                            </div>
                            <div className="grid grid-cols-5 gap-1">
                              {['B', 'I', 'N', 'G', 'O'].map((letter, colIdx) => (
                                <div key={letter} className="flex flex-col gap-1">
                                  {[0, 1, 2, 3, 4].map((rowIdx) => {
                                    const isCenter = letter === 'N' && rowIdx === 2;
                                    const value = manualCartelaGrid[rowIdx]?.[colIdx] || '';
                                    
                                    return (
                                      <div
                                        key={rowIdx}
                                        className={`w-10 h-10 border-2 rounded flex items-center justify-center font-bold text-sm transition-all ${
                                          isCenter 
                                            ? 'bg-yellow-400 text-yellow-900 border-yellow-600' 
                                            : letter === 'B'
                                              ? 'bg-red-100 text-red-900 border-red-300 hover:bg-red-200'
                                              : letter === 'I'
                                                ? 'bg-orange-100 text-orange-900 border-orange-300 hover:bg-orange-200'
                                                : letter === 'N'
                                                  ? 'bg-yellow-100 text-yellow-900 border-yellow-300 hover:bg-yellow-200'
                                                  : letter === 'G'
                                                    ? 'bg-green-100 text-green-900 border-green-300 hover:bg-green-200'
                                                    : 'bg-blue-100 text-blue-900 border-blue-300 hover:bg-blue-200'
                                        }`}
                                      >
                                        {isCenter ? (
                                          <span className="text-lg">★</span>
                                        ) : (
                                          <input
                                            type="number"
                                            value={value}
                                            onChange={(e) => handleManualCartelaChange(rowIdx, colIdx, e.target.value)}
                                            className={`w-full h-full text-center font-bold bg-transparent outline-none ${
                                              letter === 'B' ? 'text-red-900' :
                                              letter === 'I' ? 'text-orange-900' :
                                              letter === 'N' ? 'text-yellow-900' :
                                              letter === 'G' ? 'text-green-900' :
                                              'text-blue-900'
                                            }`}
                                            placeholder=""
                                            min={letter === 'B' ? 1 : letter === 'I' ? 16 : letter === 'N' ? 31 : letter === 'G' ? 46 : 61}
                                            max={letter === 'B' ? 15 : letter === 'I' ? 30 : letter === 'N' ? 45 : letter === 'G' ? 60 : 75}
                                            disabled={isCenter}
                                          />
                                        )}
                                      </div>
                                    );
                                  })}
                                </div>
                              ))}
                            </div>
                          </div>
                        </div>
                      </div>
                    </div>

                    <div className="text-center mt-6">
                      <Button 
                        className="bg-gradient-to-r from-purple-600 to-purple-700 hover:from-purple-700 hover:to-purple-800 text-white font-medium py-4 px-8 shadow-lg transition-all duration-200"
                        disabled={saveManualCartelaMutation.isPending}
                        onClick={handleSaveManualCartela}
                      >
                        {saveManualCartelaMutation.isPending ? (
                          <div className="flex items-center">
                            <svg className="animate-spin h-5 w-5 mr-3" viewBox="0 0 24 24">
                              <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" fill="none" />
                              <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8 8 8 0 018 8 8 8 0 01-8 8z" />
                            </svg>
                            Saving Cartela...
                          </div>
                        ) : (
                          <div className="flex items-center">
                            <svg className="w-5 h-5 mr-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 7H5a2 2 0 00-2 2v10a2 2 0 002 2h14a2 2 0 002-2V9a2 2 0 00-2-2h-3m-1 4l-3-3m0 0l3 3m-3-3v4" />
                            </svg>
                            Save Manual Cartela
                          </div>
                        )}
                      </Button>
                    </div>
                  </div>
                </div>
              )}

              {activeTab === 'table' && (
                <div className="max-w-6xl mx-auto">
                  <div className="bg-gray-800 rounded-xl p-8 border border-gray-700 shadow-xl">
                    <div className="mb-8">
                      <div className="flex items-center justify-between mb-4">
                      <h3 className="text-2xl font-bold text-white flex items-center">
                        <div className="w-10 h-10 bg-green-600 rounded-lg flex items-center justify-center mr-3">
                          <svg className="w-5 h-5 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 10h18M3 14h18m-9-4h10a1 1 0 011 1v4a1 1 0 01-1 1H6a1 1 0 01-1-1v-4a1 1 0 011-1h10z" />
                          </svg>
                        </div>
                        Cartela Table
                      </h3>
                      <Button
                        onClick={() => refetch()}
                        disabled={cartelasQueryLoading}
                        className="bg-blue-600 hover:bg-blue-700 text-white px-4 py-2 rounded-lg flex items-center"
                      >
                        <svg className="w-4 h-4 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5.586a2 2 0 011.414 1.414l5 5a2 2 0 011.414 0l5-5A2 2 0 0118 9.586V4a2 2 0 00-2-2H6a2 2 0 00-2 2z" />
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 9l3 3m0 0l-3-3m3 3v-6" />
                        </svg>
                        Refresh
                      </Button>
                    </div>
                      <p className="text-gray-300 mb-6">
                        View and manage all imported cartelas in the system.
                      </p>
                    </div>

                    <div className="overflow-x-auto">
                      <table className="w-full bg-gray-800 rounded-lg overflow-hidden">
                        <thead className="bg-gray-700">
                          <tr>
                            <th className="px-6 py-4 text-left text-xs font-medium text-gray-300 uppercase tracking-wider">Card #</th>
                            <th className="px-6 py-4 text-left text-xs font-medium text-gray-300 uppercase tracking-wider">User ID</th>
                            <th className="px-6 py-4 text-left text-xs font-medium text-gray-300 uppercase tracking-wider">B Column</th>
                            <th className="px-6 py-4 text-left text-xs font-medium text-gray-300 uppercase tracking-wider">I Column</th>
                            <th className="px-6 py-4 text-left text-xs font-medium text-gray-300 uppercase tracking-wider">N Column</th>
                            <th className="px-6 py-4 text-left text-xs font-medium text-gray-300 uppercase tracking-wider">G Column</th>
                            <th className="px-6 py-4 text-left text-xs font-medium text-gray-300 uppercase tracking-wider">O Column</th>
                            <th className="px-6 py-4 text-left text-xs font-medium text-gray-300 uppercase tracking-wider">Actions</th>
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-gray-700">
                          {cartelasQueryLoading ? (
                            <tr>
                              <td colSpan={8} className="px-6 py-12 text-center text-gray-400">
                                <div className="flex flex-col items-center">
                                  <svg className="animate-spin h-8 w-8 text-gray-500 mb-3" viewBox="0 0 24 24">
                                    <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" fill="none" />
                                    <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8 8 8 0 018 8 8 8 0 01-8 8z" />
                                  </svg>
                                  <span className="text-lg font-medium">Loading cartelas...</span>
                                </div>
                              </td>
                            </tr>
                          ) : cartelas && cartelas.length > 0 ? (
                            cartelas.map((cartela, index) => (
                              <tr key={cartela.id} className="hover:bg-gray-700 transition-colors">
                                <td className="px-6 py-4 whitespace-nowrap text-sm font-bold text-blue-400">{cartela.cardNo || cartela.cartelaNumber}</td>
                                <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-300">{cartela.employeeId}</td>
                                <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-300">
                                  {cartela.pattern ? cartela.pattern.map(row => row[0]).join(', ') : '-'}
                                </td>
                                <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-300">
                                  {cartela.pattern ? cartela.pattern.map(row => row[1]).join(', ') : '-'}
                                </td>
                                <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-300">
                                  {cartela.pattern ? cartela.pattern.map(row => row[2]).join(', ') : '-'}
                                </td>
                                <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-300">
                                  {cartela.pattern ? cartela.pattern.map(row => row[3]).join(', ') : '-'}
                                </td>
                                <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-300">
                                  {cartela.pattern ? cartela.pattern.map(row => row[4]).join(', ') : '-'}
                                </td>
                                <td className="px-6 py-4 whitespace-nowrap text-sm">
                                  <div className="flex gap-2">
                                    <button 
                                      onClick={() => setPreviewCard(cartela)}
                                      className="text-blue-400 hover:text-blue-300 transition-colors flex items-center gap-1"
                                    >
                                      <Eye className="w-4 h-4" />
                                      View
                                    </button>
                                    <button 
                                      onClick={() => handleEditCartela(cartela)}
                                      className="text-green-400 hover:text-green-300 transition-colors flex items-center gap-1"
                                    >
                                      <Edit className="w-4 h-4" />
                                      Edit
                                    </button>
                                    <button 
                                      onClick={() => handleDeleteCartela(cartela)}
                                      className="text-red-400 hover:text-red-300 transition-colors flex items-center gap-1"
                                    >
                                      <Trash2 className="w-4 h-4" />
                                      Delete
                                    </button>
                                  </div>
                                </td>
                              </tr>
                            ))
                          ) : (
                            <tr>
                              <td colSpan={8} className="px-6 py-12 text-center text-gray-400">
                                <div className="flex flex-col items-center">
                                  <svg className="w-12 h-12 text-gray-500 mb-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V6a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.707.293H17a2 2 0 012 2v6a2 2 0 01-2 2H7a2 2 0 01-2-2V6a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.707.293z" />
                                  </svg>
                                  <span className="text-lg font-medium">No cartelas found</span>
                                  <p className="text-sm text-gray-400 mt-2">
                                    Import cartelas using the CSV Import tab or create them manually to see them here
                                  </p>
                                </div>
                              </td>
                            </tr>
                          )}
                        </tbody>
                      </table>
                    </div>

                    {cartelas && cartelas.length > 0 && (
                      <div className="mt-6 p-4 bg-gray-700 rounded-lg border border-gray-600">
                        <div className="text-sm text-green-400">
                          Showing <span className="font-bold text-green-300">{cartelas.length}</span> cartelas in the system
                        </div>
                      </div>
                    )}
                  </div>
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      {/* Card Preview Modal */}
      {previewCard && (
        <div className="fixed inset-0 bg-black bg-opacity-70 flex items-center justify-center z-[80] p-4">
          <div className="bg-white text-black rounded-lg shadow-2xl max-w-md w-full">
            {/* Header */}
            <div className={`${isEditingPreview ? 'bg-blue-600' : 'bg-white'} px-4 py-3 rounded-t-lg flex justify-between items-center border-b`}>
              <h2 className={`text-xl font-bold ${isEditingPreview ? 'text-white' : 'text-black'}`}>
                {isEditingPreview ? 'Edit' : 'View'} Card #{previewCard.cardNo}
              </h2>
              <div className="flex gap-2">
                {!isEditingPreview && (
                  <button
                    onClick={() => handleEditCartela(previewCard)}
                    className="text-blue-600 hover:text-blue-800 font-medium text-sm"
                  >
                    Edit
                  </button>
                )}
                <button
                  onClick={() => {
                    setPreviewCard(null);
                    setIsEditingPreview(false);
                    setEditingCartela(null);
                  }}
                  className={`${isEditingPreview ? 'text-white hover:text-gray-200' : 'text-gray-600 hover:text-gray-800'}`}
                >
                  <X className="w-5 h-5" />
                </button>
              </div>
            </div>

            {/* Card Content */}
            <div className="p-6 bg-gray-50">
              {!isEditingPreview && (
                <div className="text-center mb-4">
                  <h3 className="text-lg font-semibold text-gray-700">Card Layout</h3>
                </div>
              )}

              {isEditingPreview && (
                <div className="mb-4">
                  <label className="block text-sm font-medium text-gray-700 mb-2">Cartela Number</label>
                  <Input
                    type="number"
                    value={editingCartela?.cartelaNumber || previewCard.cartelaNumber}
                    onChange={(e) => setEditingCartela({
                      ...editingCartela,
                      cartelaNumber: parseInt(e.target.value)
                    })}
                    className="w-full mb-3"
                  />
                  <label className="block text-sm font-medium text-gray-700 mb-2">Name</label>
                  <Input
                    type="text"
                    value={editingCartela?.name || previewCard.name || ''}
                    onChange={(e) => setEditingCartela({
                      ...editingCartela,
                      name: e.target.value
                    })}
                    className="w-full"
                  />
                </div>
              )}
              
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
                    
                    const cardNumbers = isEditingPreview ? editingCartela?.pattern : (cartela.pattern || []);
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

                          if (isEditingPreview && !isFreeSpace) {
                            return (
                              <Input
                                key={col}
                                type="number"
                                value={number || ''}
                                onChange={(e) => handleEditCartelaChange(row, col, e.target.value)}
                                className="w-full text-center text-sm"
                              />
                            );
                          }

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

              {/* Action Buttons for Edit Mode */}
              {isEditingPreview && (
                <div className="flex gap-3 justify-end mt-6">
                  <Button
                    onClick={() => {
                      setIsEditingPreview(false);
                      setEditingCartela(null);
                    }}
                    variant="outline"
                    className="px-6"
                  >
                    Cancel
                  </Button>
                  <Button
                    onClick={handleUpdateCartela}
                    disabled={updateCartelaMutation.isPending}
                    className="bg-blue-600 hover:bg-blue-700 text-white px-6"
                  >
                    {updateCartelaMutation.isPending ? 'Saving...' : 'Save Changes'}
                  </Button>
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      {/* Delete Confirmation Modal */}
      {showDeleteConfirm && cartelaToDelete && (
        <div className="fixed inset-0 bg-black bg-opacity-70 flex items-center justify-center z-[80] p-4">
          <div className="bg-white text-black rounded-lg shadow-2xl max-w-md w-full">
            {/* Header */}
            <div className="bg-red-600 px-4 py-3 rounded-t-lg">
              <h2 className="text-xl font-bold text-white">Confirm Delete</h2>
            </div>

            {/* Content */}
            <div className="p-6 bg-gray-50">
              <div className="text-center mb-6">
                <Trash2 className="w-12 h-12 text-red-500 mx-auto mb-4" />
                <p className="text-lg text-gray-700 mb-2">
                  Are you sure you want to delete this cartela?
                </p>
                <div className="bg-gray-200 rounded-lg p-3">
                  <p className="font-bold text-gray-800">Cartela #{cartelaToDelete.cartelaNumber || cartelaToDelete.cardNo}</p>
                  <p className="text-sm text-gray-600">{cartelaToDelete.name || 'Unnamed Cartela'}</p>
                </div>
              </div>

              {/* Action Buttons */}
              <div className="flex gap-3">
                <Button
                  onClick={() => setShowDeleteConfirm(false)}
                  variant="outline"
                  className="flex-1"
                >
                  Cancel
                </Button>
                <Button
                  onClick={confirmDelete}
                  disabled={deleteCartelaMutation.isPending}
                  className="bg-red-600 hover:bg-red-700 text-white flex-1"
                >
                  {deleteCartelaMutation.isPending ? 'Deleting...' : 'Delete'}
                </Button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
