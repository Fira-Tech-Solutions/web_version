import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { format } from "date-fns";
import { Calendar, Trophy, Users, Coins } from "lucide-react";

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

interface EnhancedGameHistoryProps {
  shopId: number;
}

function EnhancedGameHistory({ shopId }: EnhancedGameHistoryProps) {
  const [startDate, setStartDate] = useState("");
  const [endDate, setEndDate] = useState("");

  const { data: gameHistory = [], isLoading, refetch } = useQuery({
    queryKey: ['game-history', shopId, startDate, endDate],
    queryFn: async () => {
      const params = new URLSearchParams();
      if (startDate) params.append('startDate', startDate);
      if (endDate) params.append('endDate', endDate);
      
      const response = await fetch(`/api/game-history/${shopId}?${params}`);
      if (!response.ok) throw new Error('Failed to fetch game history');
      return response.json();
    },
    staleTime: 0, // Always fetch fresh data
    refetchOnMount: true
  });

  const totalGames = gameHistory.length;
  const totalRevenue = gameHistory.reduce((sum: number, game: GameHistoryEntry) => 
    sum + parseFloat(game.totalCollected), 0);
  const totalPrizes = gameHistory.reduce((sum: number, game: GameHistoryEntry) => 
    sum + parseFloat(game.prizeAmount), 0);
  const totalProfit = gameHistory.reduce((sum: number, game: GameHistoryEntry) => 
    sum + parseFloat(game.adminProfit), 0);

  if (isLoading) {
    return <div className="flex items-center justify-center p-8">Loading game history...</div>;
  }

  return (
    <div className="space-y-6">
      {/* Summary Cards */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Total Games</CardTitle>
            <Trophy className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{totalGames}</div>
            <p className="text-xs text-muted-foreground">Completed games</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Total Revenue</CardTitle>
            <Coins className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{totalRevenue.toFixed(2)} ETB</div>
            <p className="text-xs text-muted-foreground">From player entries</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Total Prizes</CardTitle>
            <Trophy className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{totalPrizes.toFixed(2)} ETB</div>
            <p className="text-xs text-muted-foreground">Paid to winners</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Net Profit</CardTitle>
            <Coins className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{totalProfit.toFixed(2)} ETB</div>
            <p className="text-xs text-muted-foreground">Your earnings</p>
          </CardContent>
        </Card>
      </div>

      {/* Date Filters */}
      <Card>
        <CardHeader>
          <CardTitle>Filter Games</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="flex gap-4 items-end">
            <div className="grid w-full max-w-sm items-center gap-1.5">
              <Label htmlFor="start-date">Start Date</Label>
              <Input
                type="date"
                id="start-date"
                value={startDate}
                onChange={(e) => setStartDate(e.target.value)}
              />
            </div>
            <div className="grid w-full max-w-sm items-center gap-1.5">
              <Label htmlFor="end-date">End Date</Label>
              <Input
                type="date"
                id="end-date"
                value={endDate}
                onChange={(e) => setEndDate(e.target.value)}
              />
            </div>
            <Button onClick={() => refetch()}>
              <Calendar className="h-4 w-4 mr-2" />
              Apply Filter
            </Button>
            <Button 
              variant="outline" 
              onClick={() => {
                setStartDate("");
                setEndDate("");
                refetch();
              }}
            >
              Clear
            </Button>
          </div>
        </CardContent>
      </Card>

      {/* Game History Table */}
      <Card>
        <CardHeader>
          <CardTitle>Game History</CardTitle>
        </CardHeader>
        <CardContent>
          {gameHistory.length === 0 ? (
            <div className="text-center py-8 text-muted-foreground">
              No games found for the selected period.
            </div>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Game #</TableHead>
                  <TableHead>Winner Cartela</TableHead>
                  <TableHead>Players</TableHead>
                  <TableHead>Collected Birr</TableHead>
                  <TableHead>Winner Prize</TableHead>
                  <TableHead>Your Profit</TableHead>
                  <TableHead>Commission Deducted</TableHead>
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
                        <span className="font-medium text-blue-600">
                          {game.playerCount}
                        </span>
                      </div>
                    </TableCell>
                    <TableCell className="text-lg font-bold text-blue-600">
                      {parseFloat(game.totalCollected).toFixed(2)} ETB
                    </TableCell>
                    <TableCell>
                      <div className="flex items-center gap-1">
                        <Trophy className="h-4 w-4 text-orange-500" />
                        <span className="font-medium text-orange-600">
                          {parseFloat(game.prizeAmount).toFixed(2)} ETB
                        </span>
                      </div>
                    </TableCell>
                    <TableCell className="text-lg font-bold text-green-600">
                      +{parseFloat(game.adminProfit).toFixed(2)} ETB
                    </TableCell>
                    <TableCell className="text-lg font-bold text-red-600">
                      -{parseFloat(game.superAdminCommission).toFixed(2)} ETB
                    </TableCell>
                    <TableCell>
                      <div className="flex flex-col text-sm">
                        <span className="font-medium">
                          {format(new Date(game.completedAt), 'MMM dd, yyyy')}
                        </span>
                        <span className="text-muted-foreground">
                          {format(new Date(game.completedAt), 'HH:mm')}
                        </span>
                      </div>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>
    </div>
  );
}

export { EnhancedGameHistory };