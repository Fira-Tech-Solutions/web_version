import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Plus, Edit2, Trash2, Upload, Grid3X3, Save, X } from "lucide-react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useToast } from "@/hooks/use-toast";
import type { Cartela } from "@shared/schema";

interface UnifiedCartelaManagerProps {
  shopId: number;
  adminId: number;
}

export default function UnifiedCartelaManager({ shopId, adminId }: UnifiedCartelaManagerProps) {
  const [isCreateOpen, setIsCreateOpen] = useState(false);
  const [editingCartela, setEditingCartela] = useState<Cartela | null>(null);
  const [cartelaName, setCartelaName] = useState("");
  const [cartelaNumber, setCartelaNumber] = useState("");
  const [pattern, setPattern] = useState<number[][]>(
    Array(5).fill(null).map(() => Array(5).fill(0))
  );

  const { toast } = useToast();
  const queryClient = useQueryClient();

  // Load all cartelas for this shop
  const { data: cartelas = [], refetch, isLoading } = useQuery({
    queryKey: ["/api/cartelas", shopId],
    queryFn: async () => {
      const response = await fetch(`/api/cartelas/${shopId}`);
      if (!response.ok) throw new Error("Failed to load cartelas");
      const data = await response.json();
      console.log('Fetched cartelas:', data.length, 'items');
      return data;
    },
  });

  // Create or update cartela
  const saveCartelaMutation = useMutation({
    mutationFn: async (data: any) => {
      const url = editingCartela ? `/api/cartelas/${editingCartela.id}` : "/api/cartelas";
      const method = editingCartela ? "PUT" : "POST";

      const response = await fetch(url, {
        method,
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(data),
      });
      if (!response.ok) throw new Error("Failed to save cartela");
      return response.json();
    },
    onSuccess: () => {
      toast({ title: editingCartela ? "Cartela updated successfully!" : "Cartela created successfully!" });
      queryClient.invalidateQueries({ queryKey: ["/api/cartelas", shopId] });
      resetForm();
    },
    onError: (error: any) => {
      toast({ title: "Error", description: error.message, variant: "destructive" });
    },
  });

  // Delete cartela
  const deleteCartelaMutation = useMutation({
    mutationFn: async (cartelaId: number) => {
      const response = await fetch(`/api/cartelas/${cartelaId}`, {
        method: "DELETE",
      });
      if (!response.ok) throw new Error("Failed to delete cartela");
    },
    onSuccess: () => {
      toast({ title: "Cartela deleted successfully!" });
      queryClient.invalidateQueries({ queryKey: ["/api/cartelas", shopId] });
    },
    onError: (error: any) => {
      toast({ title: "Error", description: error.message, variant: "destructive" });
    },
  });


  const handleExportCSV = () => {
    if (!cartelas.length) {
      toast({ title: "No cartelas to export", variant: "destructive" });
      return;
    }

    try {
      // Header matching the import format: cno,user_id,card_no,b,i,n,g,o
      const header = "cno,user_id,card_no,b,i,n,g,o";
      
      const rows = cartelas.map((c: Cartela) => {
        // Validation: Ensure numbers exist and are an array
        const nums = Array.isArray(c.numbers) ? c.numbers : [];
        if (nums.length !== 25) return null;

        // Group into columns: B, I, N, G, O
        // Flat array indices:
        // Row 0: 0, 1, 2, 3, 4
        // Row 1: 5, 6, 7, 8, 9
        // ...
        // Col 0 (B): 0, 5, 10, 15, 20
        const cols: any[][] = [[], [], [], [], []];

        for (let row = 0; row < 5; row++) {
          for (let col = 0; col < 5; col++) {
            const index = row * 5 + col;
            const val = nums[index];
            // Center cell (row 2, col 2) is typically 0 for free
            cols[col].push(val === 0 ? 'free' : val);
          }
        }

        const b = `"${cols[0].join(',')}"`;
        const i = `"${cols[1].join(',')}"`;
        const n = `"${cols[2].join(',')}"`;
        const g = `"${cols[3].join(',')}"`;
        const o = `"${cols[4].join(',')}"`;

        // Using id as cno, adminId/shopId as user_id
        return `${c.id},${c.shopId},${c.cartelaNumber},${b},${i},${n},${g},${o}`;
      }).filter(Boolean); // Filter out invalid rows

      if (rows.length === 0) {
        toast({ title: "Error generating CSV", description: "No valid cartela data found.", variant: "destructive" });
        return;
      }

      const csvContent = [header, ...rows].join('\n');
      const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
      const url = URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = url;
      link.setAttribute('download', `cartelas_shop_${shopId}_export.csv`);
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      
      toast({ title: "Export Successful", description: `Exported ${rows.length} cartelas.` });
    } catch (err) {
      console.error("Export error:", err);
      toast({ title: "Export Failed", description: "An error occurred while exporting.", variant: "destructive" });
    }
  };

  const resetForm = () => {
    setCartelaName("");
    setCartelaNumber("");
    setPattern(Array(5).fill(null).map(() => Array(5).fill(0)));
    setEditingCartela(null);
    setIsCreateOpen(false);
  };

  const handleEdit = (cartela: Cartela) => {
    setEditingCartela(cartela);
    setCartelaName(cartela.name || "");
    setCartelaNumber(cartela.cartelaNumber?.toString() || "");
    setPattern(cartela.pattern || Array(5).fill(null).map(() => Array(5).fill(0)));
    setIsCreateOpen(true);
  };

  const handleSave = () => {
    if (!cartelaName.trim() || !cartelaNumber.trim()) {
      toast({ title: "Error", description: "Please fill in all fields", variant: "destructive" });
      return;
    }

    // Validate pattern has exactly one "free" space (center should be 0)
    const flatNumbers = pattern.flat();
    const freeCount = flatNumbers.filter(n => n === 0).length;
    if (freeCount !== 1 || pattern[2][2] !== 0) {
      toast({ title: "Error", description: "Pattern must have exactly one FREE space in the center", variant: "destructive" });
      return;
    }

    // Validate we have 24 valid numbers
    const validNumbers = flatNumbers.filter(n => n > 0);
    if (validNumbers.length !== 24) {
      toast({ title: "Error", description: "Pattern must have exactly 24 numbers and 1 FREE space", variant: "destructive" });
      return;
    }

    saveCartelaMutation.mutate({
      shopId,
      adminId,
      cartelaNumber: parseInt(cartelaNumber),
      name: cartelaName,
      pattern,
      numbers: flatNumbers,
    });
  };

  const formatCartelaDisplay = (cartela: Cartela) => {
    const numbers = cartela.numbers || [];
    return `${cartela.cartelaNumber}: ${Array.isArray(numbers) ? numbers.join(",") : "No numbers"}`;
  };

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center">
        <h3 className="text-xl font-semibold flex items-center gap-2">
          <Grid3X3 className="h-5 w-5" />
          Cartela Preview & Management
        </h3>
        <div className="flex gap-2">
          <Button
            onClick={() => {
              fetch(`/api/cartelas/initialize/${shopId}`, { method: 'POST' })
                .then(res => res.json())
                .then(data => {
                  if (data.loaded) {
                    toast({ title: "Success", description: "Default cartelas loaded successfully" });
                    queryClient.invalidateQueries({ queryKey: ["/api/cartelas", shopId] });
                  } else {
                    toast({ title: "Info", description: "Cartelas already exist for this shop" });
                  }
                })
                .catch(() => {
                  toast({ title: "Error", description: "Failed to load default cartelas", variant: "destructive" });
                });
            }}
            variant="outline"
          >
            Load Default Cartelas
          </Button>

          <Button variant="outline" onClick={handleExportCSV}>
            <Upload className="h-4 w-4 mr-2 rotate-180" />
            Export CSV
          </Button>

          <Dialog open={isCreateOpen} onOpenChange={(open) => {
            if (!open) resetForm();
            setIsCreateOpen(open);
          }}>
            <DialogTrigger asChild>
              <Button>
                <Plus className="h-4 w-4 mr-2" />
                Add Cartela
              </Button>
            </DialogTrigger>
            <DialogContent className="max-w-4xl">
              <DialogHeader>
                <DialogTitle>{editingCartela ? "Edit Cartela" : "Create New Cartela"}</DialogTitle>
              </DialogHeader>
              <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                <div className="space-y-4">
                  <div>
                    <Label htmlFor="cartela-number">Cartela Number</Label>
                    <Input
                      id="cartela-number"
                      type="number"
                      value={cartelaNumber}
                      onChange={(e) => setCartelaNumber(e.target.value)}
                      placeholder="Enter cartela number"
                    />
                  </div>
                  <div>
                    <Label htmlFor="cartela-name">Cartela Name</Label>
                    <Input
                      id="cartela-name"
                      value={cartelaName}
                      onChange={(e) => setCartelaName(e.target.value)}
                      placeholder="Enter cartela name"
                    />
                  </div>
                </div>
                <div>
                  <Label>Cartela Pattern (5x5 Grid)</Label>
                  <div className="mt-2">
                    <div className="grid grid-cols-5 gap-1 mb-2">
                      <div className="text-center font-bold text-sm bg-blue-100 p-1 rounded">B</div>
                      <div className="text-center font-bold text-sm bg-red-100 p-1 rounded">I</div>
                      <div className="text-center font-bold text-sm bg-green-100 p-1 rounded">N</div>
                      <div className="text-center font-bold text-sm bg-yellow-100 p-1 rounded">G</div>
                      <div className="text-center font-bold text-sm bg-purple-100 p-1 rounded">O</div>
                    </div>
                    <div className="grid grid-cols-5 gap-1">
                      {pattern.map((row, rowIndex) =>
                        row.map((value, colIndex) => (
                          <Input
                            key={`${rowIndex}-${colIndex}`}
                            type={rowIndex === 2 && colIndex === 2 ? "text" : "number"}
                            min="0"
                            max="75"
                            value={rowIndex === 2 && colIndex === 2 ? "FREE" : value || ""}
                            onChange={(e) => {
                              if (rowIndex === 2 && colIndex === 2) return; // Keep center as FREE
                              const newPattern = [...pattern];
                              newPattern[rowIndex][colIndex] = parseInt(e.target.value) || 0;
                              setPattern(newPattern);
                            }}
                            disabled={rowIndex === 2 && colIndex === 2}
                            className={`text-center h-10 text-sm ${rowIndex === 2 && colIndex === 2
                              ? "bg-green-100 font-bold"
                              : colIndex === 0
                                ? "border-blue-300"
                                : colIndex === 1
                                  ? "border-red-300"
                                  : colIndex === 2
                                    ? "border-green-300"
                                    : colIndex === 3
                                      ? "border-yellow-300"
                                      : "border-purple-300"
                              }`}
                            placeholder={rowIndex === 2 && colIndex === 2 ? "FREE" : "0"}
                          />
                        ))
                      )}
                    </div>
                  </div>
                  <p className="text-sm text-gray-600 mt-2">
                    Enter numbers 1-75. Center cell is automatically set to FREE.
                  </p>
                </div>
              </div>
              <div className="flex justify-end gap-2 mt-6">
                <Button variant="outline" onClick={resetForm}>
                  <X className="h-4 w-4 mr-2" />
                  Cancel
                </Button>
                <Button
                  onClick={handleSave}
                  disabled={saveCartelaMutation.isPending}
                >
                  <Save className="h-4 w-4 mr-2" />
                  {saveCartelaMutation.isPending ? "Saving..." : "Save"}
                </Button>
              </div>
            </DialogContent>
          </Dialog>
        </div>
      </div>

      {/* Cartelas List */}
      <div className="space-y-4">
        {cartelas.length === 0 ? (
          <Card>
            <CardContent className="text-center py-8">
              <p className="text-gray-500">No cartelas found. Create your first cartela or load hardcoded ones.</p>
            </CardContent>
          </Card>
        ) : (
          cartelas.map((cartela: Cartela) => (
            <Card key={cartela.id} className="p-4">
              <div className="flex justify-between items-start">
                <div className="flex-1">
                  <div className="flex items-center gap-2 mb-2">
                    <h4 className="font-medium">{cartela.name}</h4>
                    {cartela.isHardcoded && (
                      <span className="px-2 py-1 bg-blue-100 text-blue-800 text-xs rounded">
                        Originally Hardcoded
                      </span>
                    )}
                  </div>
                  <div className="mt-2">
                    <p className="text-sm text-gray-600 font-mono mb-2">
                      {formatCartelaDisplay(cartela)}
                    </p>
                    <div className="grid grid-cols-5 gap-1 text-xs">
                      {(cartela.pattern || []).map((row, rowIndex) =>
                        (row || []).map((value, colIndex) => (
                          <div
                            key={`${rowIndex}-${colIndex}`}
                            className={`text-center p-1 rounded ${rowIndex === 2 && colIndex === 2
                              ? "bg-green-100 font-bold"
                              : colIndex === 0
                                ? "bg-blue-50"
                                : colIndex === 1
                                  ? "bg-red-50"
                                  : colIndex === 2
                                    ? "bg-green-50"
                                    : colIndex === 3
                                      ? "bg-yellow-50"
                                      : "bg-purple-50"
                              }`}
                          >
                            {rowIndex === 2 && colIndex === 2 ? "FREE" : value}
                          </div>
                        ))
                      )}
                    </div>
                  </div>
                </div>
                <div className="flex gap-2">
                  <Button
                    size="sm"
                    variant="outline"
                    onClick={() => handleEdit(cartela)}
                  >
                    <Edit2 className="h-4 w-4" />
                  </Button>
                  <Button
                    size="sm"
                    variant="outline"
                    onClick={() => {
                      if (confirm(`Are you sure you want to delete cartela ${cartela.cartelaNumber}?`)) {
                        deleteCartelaMutation.mutate(cartela.id);
                      }
                    }}
                    disabled={deleteCartelaMutation.isPending}
                  >
                    <Trash2 className="h-4 w-4" />
                  </Button>
                </div>
              </div>
            </Card>
          ))
        )}
      </div>
    </div>
  );
}