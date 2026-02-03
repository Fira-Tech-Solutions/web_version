import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Plus, Edit2, Trash2, Grid3X3 } from "lucide-react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { apiRequest } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import type { CustomCartela } from "@shared/schema";

interface CustomCartelaBuilderProps {
  shopId: number;
  adminId: number;
}

export default function CustomCartelaBuilder({ shopId, adminId }: CustomCartelaBuilderProps) {
  const [isBuilderOpen, setIsBuilderOpen] = useState(false);
  const [editingCartela, setEditingCartela] = useState<CustomCartela | null>(null);
  const [cartelaName, setCartelaName] = useState("");
  const [cartelaNumber, setCartelaNumber] = useState("");
  const [pattern, setPattern] = useState<number[][]>(
    Array(5).fill(null).map(() => Array(5).fill(0))
  );

  const { toast } = useToast();
  const queryClient = useQueryClient();

  const { data: customCartelas = [], refetch } = useQuery({
    queryKey: ["/api/custom-cartelas", shopId],
    queryFn: async () => {
      const response = await fetch(`/api/custom-cartelas/${shopId}`);
      return response.json();
    },
  });

  const createMutation = useMutation({
    mutationFn: async (data: any) => {
      const response = await fetch("/api/custom-cartelas", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(data),
      });
      return response.json();
    },
    onSuccess: () => {
      toast({ title: "Custom cartela created successfully!" });
      queryClient.invalidateQueries({ queryKey: ["/api/custom-cartelas", shopId] });
      resetForm();
      setIsBuilderOpen(false);
    },
    onError: () => {
      toast({ title: "Failed to create custom cartela", variant: "destructive" });
    },
  });

  const updateMutation = useMutation({
    mutationFn: async ({ id, data }: { id: number; data: any }) => {
      const response = await fetch(`/api/custom-cartelas/${id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(data),
      });
      return response.json();
    },
    onSuccess: () => {
      toast({ title: "Custom cartela updated successfully!" });
      queryClient.invalidateQueries({ queryKey: ["/api/custom-cartelas", shopId] });
      resetForm();
      setIsBuilderOpen(false);
    },
    onError: () => {
      toast({ title: "Failed to update custom cartela", variant: "destructive" });
    },
  });

  const deleteMutation = useMutation({
    mutationFn: async (id: number) => {
      const response = await fetch(`/api/custom-cartelas/${id}`, {
        method: "DELETE",
      });
      return response.json();
    },
    onSuccess: () => {
      toast({ title: "Custom cartela deleted successfully!" });
      queryClient.invalidateQueries({ queryKey: ["/api/custom-cartelas", shopId] });
    },
    onError: () => {
      toast({ title: "Failed to delete custom cartela", variant: "destructive" });
    },
  });

  const resetForm = () => {
    setCartelaName("");
    setCartelaNumber("");
    setPattern(Array(5).fill(null).map(() => Array(5).fill(0)));
    setEditingCartela(null);
  };

  const openBuilder = (cartela?: CustomCartela) => {
    if (cartela) {
      setEditingCartela(cartela);
      setCartelaName(cartela.name);
      setCartelaNumber(cartela.cartelaNumber.toString());
      setPattern(cartela.pattern);
    } else {
      resetForm();
    }
    setIsBuilderOpen(true);
  };

  const handleCellChange = (row: number, col: number, value: string) => {
    const numValue = parseInt(value) || 0;

    // Validate BINGO column ranges
    const columnRanges = {
      0: [1, 15],    // B column: 1-15
      1: [16, 30],   // I column: 16-30
      2: [31, 45],   // N column: 31-45
      3: [46, 60],   // G column: 46-60
      4: [61, 75],   // O column: 61-75
    };

    // Center cell (N column) should be 0 (FREE)
    if (row === 2 && col === 2) {
      return; // Don't allow changing the center cell
    }

    const [min, max] = columnRanges[col as keyof typeof columnRanges];
    if (numValue < min || numValue > max) {
      toast({
        title: `Invalid number for ${['B', 'I', 'N', 'G', 'O'][col]} column`,
        description: `Must be between ${min}-${max}`,
        variant: "destructive"
      });
      return;
    }

    const newPattern = [...pattern];
    newPattern[row] = [...newPattern[row]];
    newPattern[row][col] = numValue;
    setPattern(newPattern);
  };

  const generateRandomPattern = () => {
    const newPattern = Array(5).fill(null).map(() => Array(5).fill(0));

    // Column ranges for BINGO
    const columnRanges = [
      [1, 15],   // B
      [16, 30],  // I
      [31, 45],  // N
      [46, 60],  // G
      [61, 75],  // O
    ];

    for (let col = 0; col < 5; col++) {
      const [min, max] = columnRanges[col];
      const usedNumbers = new Set();

      for (let row = 0; row < 5; row++) {
        // Center cell is FREE (0)
        if (row === 2 && col === 2) {
          newPattern[row][col] = 0;
          continue;
        }

        let randomNum;
        do {
          randomNum = Math.floor(Math.random() * (max - min + 1)) + min;
        } while (usedNumbers.has(randomNum));

        usedNumbers.add(randomNum);
        newPattern[row][col] = randomNum;
      }
    }

    setPattern(newPattern);
  };

  const handleSave = () => {
    if (!cartelaName.trim() || !cartelaNumber.trim()) {
      toast({ title: "Please fill in all required fields", variant: "destructive" });
      return;
    }

    const cartelaData = {
      adminId,
      shopId,
      cartelaNumber: parseInt(cartelaNumber),
      name: cartelaName.trim(),
      pattern,
      isActive: true,
    };

    if (editingCartela) {
      updateMutation.mutate({ id: editingCartela.id, data: cartelaData });
    } else {
      createMutation.mutate(cartelaData);
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h3 className="text-lg font-semibold">Custom Cartelas</h3>
          <p className="text-sm text-muted-foreground">Create and manage custom cartela patterns for your shop</p>
        </div>
        <Dialog open={isBuilderOpen} onOpenChange={setIsBuilderOpen}>
          <DialogTrigger asChild>
            <Button onClick={() => openBuilder()}>
              <Plus className="w-4 h-4 mr-2" />
              Create Cartela
            </Button>
          </DialogTrigger>
          <DialogContent className="max-w-4xl">
            <DialogHeader>
              <DialogTitle className="flex items-center gap-2">
                <Grid3X3 className="w-5 h-5" />
                {editingCartela ? "Edit Custom Cartela" : "Create Custom Cartela"}
              </DialogTitle>
            </DialogHeader>

            <div className="space-y-6">
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <Label htmlFor="cartela-name">Cartela Name</Label>
                  <Input
                    id="cartela-name"
                    value={cartelaName}
                    onChange={(e) => setCartelaName(e.target.value)}
                    placeholder="Enter cartela name"
                  />
                </div>
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
              </div>

              <div className="flex justify-between items-center">
                <h4 className="text-sm font-medium">Number Pattern</h4>
                <Button variant="outline" size="sm" onClick={generateRandomPattern}>
                  Generate Random
                </Button>
              </div>

              <div className="space-y-2">
                {/* BINGO Headers */}
                <div className="grid grid-cols-5 gap-2 mb-2">
                  {['B', 'I', 'N', 'G', 'O'].map((letter, index) => (
                    <div key={letter} className={`
                      text-center font-bold py-2 text-white rounded-md
                      ${index === 0 ? 'bg-blue-500' : ''}
                      ${index === 1 ? 'bg-red-500' : ''}
                      ${index === 2 ? 'bg-green-500' : ''}
                      ${index === 3 ? 'bg-yellow-500' : ''}
                      ${index === 4 ? 'bg-purple-500' : ''}
                    `}>
                      {letter}
                    </div>
                  ))}
                </div>

                {/* Number Grid */}
                <div className="grid grid-cols-5 gap-2">
                  {pattern.map((row, rowIndex) =>
                    row.map((cell, colIndex) => (
                      <Input
                        key={`${rowIndex}-${colIndex}`}
                        type={rowIndex === 2 && colIndex === 2 ? "text" : "number"}
                        value={rowIndex === 2 && colIndex === 2 ? "FREE" : cell || ""}
                        onChange={(e) => handleCellChange(rowIndex, colIndex, e.target.value)}
                        disabled={rowIndex === 2 && colIndex === 2}
                        className={`
                          text-center h-12 font-semibold
                          ${rowIndex === 2 && colIndex === 2 ? 'bg-gray-100 cursor-not-allowed' : ''}
                        `}
                        placeholder={rowIndex === 2 && colIndex === 2 ? "FREE" : "0"}
                      />
                    ))
                  )}
                </div>

                <div className="text-xs text-muted-foreground grid grid-cols-5 gap-2 text-center">
                  <div>B: 1-15</div>
                  <div>I: 16-30</div>
                  <div>N: 31-45</div>
                  <div>G: 46-60</div>
                  <div>O: 61-75</div>
                </div>
              </div>

              <div className="flex justify-end gap-2">
                <Button variant="outline" onClick={() => setIsBuilderOpen(false)}>
                  Cancel
                </Button>
                <Button
                  onClick={handleSave}
                  disabled={createMutation.isPending || updateMutation.isPending}
                >
                  {editingCartela ? "Update" : "Create"} Cartela
                </Button>
              </div>
            </div>
          </DialogContent>
        </Dialog>
      </div>

      {/* Cartela List */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        {customCartelas.map((cartela: CustomCartela) => (
          <Card key={cartela.id} className="relative">
            <CardHeader className="pb-2">
              <CardTitle className="text-sm flex items-center justify-between">
                <span>{cartela.name}</span>
                <span className="text-xs text-muted-foreground">#{cartela.cartelaNumber}</span>
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-3">
              {/* Mini BINGO grid preview */}
              <div className="space-y-1">
                <div className="grid grid-cols-5 gap-1 text-xs">
                  {['B', 'I', 'N', 'G', 'O'].map(letter => (
                    <div key={letter} className="text-center font-bold text-[10px]">{letter}</div>
                  ))}
                </div>
                <div className="grid grid-cols-5 gap-1">
                  {cartela.pattern.map((row, rowIndex) =>
                    row.map((cell, colIndex) => (
                      <div
                        key={`${rowIndex}-${colIndex}`}
                        className="aspect-square bg-gray-100 rounded text-[10px] flex items-center justify-center font-medium"
                      >
                        {rowIndex === 2 && colIndex === 2 ? "★" : cell}
                      </div>
                    ))
                  )}
                </div>
              </div>

              <div className="flex justify-end gap-1">
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => openBuilder(cartela)}
                >
                  <Edit2 className="w-3 h-3" />
                </Button>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => deleteMutation.mutate(cartela.id)}
                >
                  <Trash2 className="w-3 h-3" />
                </Button>
              </div>
            </CardContent>
          </Card>
        ))}
      </div>

      {customCartelas.length === 0 && (
        <Card className="p-8 text-center">
          <Grid3X3 className="w-12 h-12 mx-auto mb-4 text-muted-foreground" />
          <h3 className="text-lg font-semibold mb-2">No Custom Cartelas</h3>
          <p className="text-muted-foreground mb-4">Create your first custom cartela pattern to get started</p>
          <Button onClick={() => openBuilder()}>
            <Plus className="w-4 h-4 mr-2" />
            Create Your First Cartela
          </Button>
        </Card>
      )}
    </div>
  );
}