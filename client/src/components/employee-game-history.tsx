import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { format } from "date-fns";
import { Trophy, Users, Coins, Clock } from "lucide-react";

interface GameHistoryEntry {
  id: number;
  gameId: number;
  shopId: number;
  employeeId: number;
  totalCollected: string;
  prizeAmount: string;
  adminProfit: string;
  superAdminCommission: string;
  playerCount: number;
  winnerName: string;
  completedAt: string;
  winnerId: number;
  winningCartela: string;
}

interface EmployeeGameHistoryProps {
  employeeId: number;
}

export function EmployeeGameHistory({ employeeId }: EmployeeGameHistoryProps) {
  const { data: gameHistory = [], isLoading } = useQuery<GameHistoryEntry[]>({
    queryKey: ["/api/employee/game-history", employeeId],
  });

  if (isLoading) {
    return (
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Trophy className="h-5 w-5" />
            My Game History
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="text-center py-8 text-muted-foreground">
            Loading game history...
          </div>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Trophy className="h-5 w-5" />
          My Game History
        </CardTitle>
      </CardHeader>
      <CardContent>
        {gameHistory.length === 0 ? (
          <div className="text-center py-8 text-muted-foreground">
            <Trophy className="h-12 w-12 mx-auto mb-4 opacity-50" />
            <p>No completed games yet.</p>
            <p className="text-sm">Start your first bingo game to see history here.</p>
          </div>
        ) : (
          <div className="space-y-4">
            {/* Summary Stats */}
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-6">
              <div className="text-center">
                <div className="text-2xl font-bold text-primary">{gameHistory.length}</div>
                <div className="text-sm text-muted-foreground">Total Games</div>
              </div>
              <div className="text-center">
                <div className="text-2xl font-bold text-green-600">
                  {gameHistory.reduce((sum, game) => sum + parseInt(game.playerCount.toString()), 0)}
                </div>
                <div className="text-sm text-muted-foreground">Total Players</div>
              </div>
              <div className="text-center">
                <div className="text-2xl font-bold text-blue-600">
                  {gameHistory.reduce((sum, game) => sum + parseFloat(game.totalCollected), 0).toFixed(2)} ETB
                </div>
                <div className="text-sm text-muted-foreground">Total Collected</div>
              </div>
              <div className="text-center">
                <div className="text-2xl font-bold text-orange-600">
                  {gameHistory.reduce((sum, game) => sum + parseFloat(game.prizeAmount), 0).toFixed(2)} ETB
                </div>
                <div className="text-sm text-muted-foreground">Total Prizes</div>
              </div>
            </div>

            {/* Games Table */}
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Game #</TableHead>
                  <TableHead>Winner Cartela</TableHead>
                  <TableHead>Players</TableHead>
                  <TableHead>Collected</TableHead>
                  <TableHead>Prize Won</TableHead>
                  <TableHead>Date/Time</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {gameHistory.map((game: GameHistoryEntry) => (
                  <TableRow key={game.id}>
                    <TableCell>
                      <Badge variant="outline" className="font-mono">
                        #{game.gameId}
                      </Badge>
                    </TableCell>
                    <TableCell>
                      {game.winningCartela ? (
                        <Badge variant="secondary" className="text-lg font-bold bg-green-100 text-green-800">
                          {game.winningCartela}
                        </Badge>
                      ) : (
                        <span className="text-muted-foreground text-sm">N/A</span>
                      )}
                    </TableCell>
                    <TableCell>
                      <div className="flex items-center gap-1">
                        <Users className="h-4 w-4 text-blue-500" />
                        <span className="font-medium">{game.playerCount}</span>
                      </div>
                    </TableCell>
                    <TableCell>
                      <div className="flex items-center gap-1">
                        <Coins className="h-4 w-4 text-blue-500" />
                        <span className="font-medium text-blue-600">
                          {parseFloat(game.totalCollected).toFixed(2)} ETB
                        </span>
                      </div>
                    </TableCell>
                    <TableCell>
                      <div className="flex items-center gap-1">
                        <Trophy className="h-4 w-4 text-orange-500" />
                        <span className="font-medium text-orange-600">
                          {parseFloat(game.prizeAmount).toFixed(2)} ETB
                        </span>
                      </div>
                    </TableCell>
                    <TableCell>
                      <div className="flex items-center gap-1">
                        <Clock className="h-4 w-4 text-gray-500" />
                        <div>
                          <div className="text-sm">
                            {format(new Date(game.completedAt), "MMM dd, yyyy")}
                          </div>
                          <div className="text-xs text-muted-foreground">
                            {format(new Date(game.completedAt), "HH:mm")}
                          </div>
                        </div>
                      </div>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
        )}
      </CardContent>
    </Card>
  );
}