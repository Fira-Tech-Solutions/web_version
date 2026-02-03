import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { apiRequest } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import { UserPlusIcon } from "lucide-react";

interface PlayerRegistrationProps {
  gameId: number;
  onPlayerRegistered: () => void;
}

export function PlayerRegistration({ gameId, onPlayerRegistered }: PlayerRegistrationProps) {
  const { toast } = useToast();
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [formData, setFormData] = useState({
    playerName: "",
    cartelaNumbers: "",
    entryFee: "30.00",
  });

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsSubmitting(true);

    try {
      // Parse cartela numbers
      const numbers = formData.cartelaNumbers
        .split(",")
        .map(n => parseInt(n.trim()))
        .filter(n => !isNaN(n) && n >= 1 && n <= 75);

      if (numbers.length === 0) {
        toast({
          title: "Invalid cartela numbers",
          description: "Please enter valid numbers between 1-75",
          variant: "destructive",
        });
        return;
      }

      await apiRequest("POST", `/api/games/${gameId}/players`, {
        playerName: formData.playerName,
        cartelaNumbers: numbers,
        entryFee: formData.entryFee,
      });

      toast({
        title: "Player registered",
        description: `${formData.playerName} has been registered successfully`,
      });

      // Reset form
      setFormData({
        playerName: "",
        cartelaNumbers: "",
        entryFee: "30.00",
      });

      onPlayerRegistered();
    } catch (error) {
      toast({
        title: "Registration failed",
        description: error instanceof Error ? error.message : "Failed to register player",
        variant: "destructive",
      });
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setFormData({
      ...formData,
      [e.target.name]: e.target.value,
    });
  };

  return (
    <div>
      <h3 className="text-md font-medium text-gray-900 mb-3">Register New Player</h3>
      <form onSubmit={handleSubmit} className="space-y-3">
        <div>
          <Label htmlFor="playerName">Player Name</Label>
          <Input
            id="playerName"
            name="playerName"
            type="text"
            required
            value={formData.playerName}
            onChange={handleInputChange}
            placeholder="Enter player name"
          />
        </div>
        <div>
          <Label htmlFor="cartelaNumbers">Cartela Numbers</Label>
          <Input
            id="cartelaNumbers"
            name="cartelaNumbers"
            type="text"
            required
            value={formData.cartelaNumbers}
            onChange={handleInputChange}
            placeholder="e.g., 1, 15, 23, 47, 52"
          />
          <p className="text-xs text-gray-500 mt-1">
            Enter numbers separated by commas (1-75)
          </p>
        </div>
        <div>
          <Label htmlFor="entryFee">Entry Fee</Label>
          <Input
            id="entryFee"
            name="entryFee"
            type="number"
            step="0.01"
            min="0"
            required
            value={formData.entryFee}
            onChange={handleInputChange}
          />
        </div>
        <Button
          type="submit"
          disabled={isSubmitting}
          className="w-full"
        >
          <UserPlusIcon className="h-4 w-4 mr-2" />
          {isSubmitting ? "Registering..." : "Register Player"}
        </Button>
      </form>
    </div>
  );
}
