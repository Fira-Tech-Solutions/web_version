import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { PlayerRegistration } from "./player-registration";
import { useAuth } from "@/hooks/use-auth";
import { apiRequest } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import { PlayIcon, XIcon, RotateCcwIcon, TrophyIcon } from "lucide-react";
import { Game, GamePlayer } from "@/types/game";

interface GameManagementProps {
  activeGame?: Game;
  players: GamePlayer[];
  onGameUpdate: () => void;
  onPlayerUpdate: () => void;
}

export function GameManagement({ 
  activeGame, 
  players, 
  onGameUpdate, 
  onPlayerUpdate 
}: GameManagementProps) {
  const { user } = useAuth();
  const { toast } = useToast();

  const handleCreateGame = async () => {
    if (!user?.shopId) return;

    try {
      await apiRequest("POST", "/api/games", {
        shopId: user.shopId,
        employeeId: user.id,
        status: 'waiting',
        entryFee: "30.00",
      });
      
      toast({
        title: "Success",
        description: "New game created successfully",
      });
      onGameUpdate();
    } catch (error) {
      toast({
        title: "Error",
        description: "Failed to create game",
        variant: "destructive",
      });
    }
  };

  const handleStartGame = async () => {
    if (!activeGame) return;

    if (players.length < 2) {
      toast({
        title: "Cannot start game",
        description: "Need at least 2 players to start",
        variant: "destructive",
      });
      return;
    }

    try {
      await apiRequest("POST", `/api/games/${activeGame.id}/start`);
      toast({
        title: "Game Started",
        description: "The bingo game has begun!",
      });
      onGameUpdate();
    } catch (error) {
      toast({
        title: "Error",
        description: "Failed to start game",
        variant: "destructive",
      });
    }
  };

  const handleCancelGame = async () => {
    if (!activeGame) return;

    try {
      await apiRequest("PATCH", `/api/games/${activeGame.id}`, {
        status: 'cancelled',
      });
      toast({
        title: "Game Cancelled",
        description: "The game has been cancelled",
      });
      onGameUpdate();
    } catch (error) {
      toast({
        title: "Error",
        description: "Failed to cancel game",
        variant: "destructive",
      });
    }
  };

  const handleDeclareWinner = async (winnerId: number) => {
    if (!activeGame) return;

    try {
      await apiRequest("POST", `/api/games/${activeGame.id}/declare-winner`, {
        winnerId,
      });
      toast({
        title: "Winner Declared!",
        description: "Game completed successfully",
      });
      onGameUpdate();
    } catch (error) {
      toast({
        title: "Error",
        description: "Failed to declare winner",
        variant: "destructive",
      });
    }
  };

  const getStatusBadge = (status: string) => {
    const variants = {
      waiting: "secondary" as const,
      active: "default" as const,
      completed: "outline" as const,
      cancelled: "destructive" as const,
    };
    
    const labels = {
      waiting: "Waiting for Players",
      active: "Game Active",
      completed: "Completed",
      cancelled: "Cancelled",
    };

    return (
      <Badge variant={variants[status as keyof typeof variants]}>
        {labels[status as keyof typeof labels]}
      </Badge>
    );
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle>Game Management</CardTitle>
      </CardHeader>
      <CardContent>
        {/* Game Status */}
        {activeGame ? (
          <div className="mb-6">
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-md font-medium text-gray-900">Current Game Status</h3>
              {getStatusBadge(activeGame.status)}
            </div>
            <div className="bg-gray-50 rounded-lg p-4">
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <p className="text-sm text-gray-600">Players Registered</p>
                  <p className="text-xl font-semibold text-gray-900">{players.length}</p>
                </div>
                <div>
                  <p className="text-sm text-gray-600">Prize Pool</p>
                  <p className="text-xl font-semibold text-green-600">${activeGame.prizePool}</p>
                </div>
              </div>
            </div>
          </div>
        ) : (
          <div className="mb-6 text-center py-8">
            <p className="text-gray-500 mb-4">No active game</p>
            <Button onClick={handleCreateGame}>
              Create New Game
            </Button>
          </div>
        )}

        {/* Player Registration */}
        {activeGame && activeGame.status === 'waiting' && (
          <div className="mb-6">
            <PlayerRegistration 
              gameId={activeGame.id}
              onPlayerRegistered={onPlayerUpdate}
            />
          </div>
        )}

        {/* Game Controls */}
        {activeGame && (
          <div className="space-y-3">
            {activeGame.status === 'waiting' && (
              <Button
                onClick={handleStartGame}
                disabled={players.length < 2}
                className="w-full"
                size="lg"
              >
                <PlayIcon className="h-4 w-4 mr-2" />
                Start Game
              </Button>
            )}

            {activeGame.status === 'active' && (
              <div className="space-y-3">
                <div>
                  <h4 className="text-sm font-medium text-gray-700 mb-2">Declare Winner</h4>
                  <div className="space-y-2">
                    {players.map((player) => (
                      <Button
                        key={player.id}
                        onClick={() => handleDeclareWinner(player.id)}
                        variant="outline"
                        className="w-full justify-start"
                      >
                        <TrophyIcon className="h-4 w-4 mr-2" />
                        {player.playerName}
                      </Button>
                    ))}
                  </div>
                </div>
              </div>
            )}

            {(activeGame.status === 'waiting' || activeGame.status === 'active') && (
              <div className="flex gap-3">
                <Button
                  onClick={handleCancelGame}
                  variant="destructive"
                  className="flex-1"
                >
                  <XIcon className="h-4 w-4 mr-2" />
                  Cancel Game
                </Button>
                <Button
                  onClick={handleCreateGame}
                  variant="outline"
                  className="flex-1"
                >
                  <RotateCcwIcon className="h-4 w-4 mr-2" />
                  New Game
                </Button>
              </div>
            )}
          </div>
        )}
      </CardContent>
    </Card>
  );
}
