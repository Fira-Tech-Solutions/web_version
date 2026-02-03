import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { useAuth } from "@/hooks/use-auth";
import { Calendar, FileText } from "lucide-react";

export function RetailReport() {
  const { user } = useAuth();
  const [dateFrom, setDateFrom] = useState(new Date().toISOString().split('T')[0]);
  const [dateTo, setDateTo] = useState(new Date().toISOString().split('T')[0]);
  const [sortBy, setSortBy] = useState("stake");
  const [order, setOrder] = useState("DESC");

  const { data: reportData = [], refetch } = useQuery({
    queryKey: ["/api/reports/retail", user?.shopId, dateFrom, dateTo, sortBy, order],
    enabled: !!user?.shopId,
  });

  const { data: summary } = useQuery({
    queryKey: ["/api/reports/summary", user?.shopId, dateFrom, dateTo],
    enabled: !!user?.shopId,
  });

  const loadReport = () => {
    refetch();
  };

  const formatCurrency = (amount: string | number) => {
    return `Br ${parseFloat(amount.toString()).toFixed(2)}`;
  };

  // Calculate summary totals
  const netBalance = summary?.netBalance || 0;
  const totalTickets = reportData.length;
  const grossStake = reportData.reduce((sum: number, item: any) => sum + parseFloat(item.stakeAmount || "0"), 0);
  const claimedWinning = reportData.reduce((sum: number, item: any) => sum + parseFloat(item.claimedAmount || "0"), 0);

  return (
    <div className="min-h-screen bg-gray-50 p-4">
      {/* Header */}
      <div className="flex items-center justify-between mb-6">
        <h1 className="text-xl font-semibold flex items-center gap-2">
          <FileText className="h-5 w-5" />
          Retail Report
        </h1>
      </div>

      {/* Filter Section */}
      <Card className="mb-6">
        <CardHeader>
          <CardTitle className="text-sm text-gray-600">FILTER</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          {/* Date Filters */}
          <div className="space-y-2">
            <Label className="text-sm font-medium">Date</Label>
            <div className="flex items-center gap-2 text-sm">
              <span>Today</span>
              <Calendar className="h-4 w-4 text-gray-400" />
            </div>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label className="text-sm">From</Label>
              <Input
                type="date"
                value={dateFrom}
                onChange={(e) => setDateFrom(e.target.value)}
                className="text-sm"
              />
            </div>
            <div className="space-y-2">
              <Label className="text-sm">To</Label>
              <Input
                type="date"
                value={dateTo}
                onChange={(e) => setDateTo(e.target.value)}
                className="text-sm"
              />
            </div>
          </div>

          {/* Sort Options */}
          <div className="space-y-2">
            <Label className="text-sm">Sort By</Label>
            <Select value={sortBy} onValueChange={setSortBy}>
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="stake">Stake</SelectItem>
                <SelectItem value="date">Date</SelectItem>
                <SelectItem value="winnings">Winnings</SelectItem>
              </SelectContent>
            </Select>
          </div>

          <div className="space-y-2">
            <Label className="text-sm">Order</Label>
            <Select value={order} onValueChange={setOrder}>
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="DESC">DESC</SelectItem>
                <SelectItem value="ASC">ASC</SelectItem>
              </SelectContent>
            </Select>
          </div>

          <Button 
            onClick={loadReport}
            className="w-full bg-teal-600 hover:bg-teal-700 text-white"
          >
            Load Report
          </Button>
        </CardContent>
      </Card>

      {/* Summary Cards */}
      <div className="space-y-3 mb-6">
        {/* Net Balance */}
        <Card className="bg-teal-600 text-white">
          <CardContent className="p-4">
            <div className="flex items-center justify-between">
              <span className="text-sm font-medium">● NET BALANCE</span>
              <span className="text-lg font-bold">{formatCurrency(netBalance)}</span>
            </div>
          </CardContent>
        </Card>

        {/* Tickets */}
        <Card className="bg-gray-200">
          <CardContent className="p-4">
            <div className="flex items-center justify-between">
              <span className="text-sm font-medium text-gray-700">● TICKETS</span>
              <span className="text-lg font-bold text-gray-900">{totalTickets}</span>
            </div>
          </CardContent>
        </Card>

        {/* Gross Stake */}
        <Card className="bg-gray-200">
          <CardContent className="p-4">
            <div className="flex items-center justify-between">
              <span className="text-sm font-medium text-gray-700">$ GROSS STAKE</span>
              <span className="text-lg font-bold text-gray-900">{formatCurrency(grossStake)}</span>
            </div>
          </CardContent>
        </Card>

        {/* Claimed Winning */}
        <Card className="bg-gray-200">
          <CardContent className="p-4">
            <div className="flex items-center justify-between">
              <span className="text-sm font-medium text-gray-700">$ CLAIMED WINNING</span>
              <span className="text-lg font-bold text-gray-900">{formatCurrency(claimedWinning)}</span>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Report Table */}
      <Card>
        <CardContent className="p-0">
          <div className="overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow className="bg-gray-100 text-xs">
                  <TableHead className="p-2 font-medium">No</TableHead>
                  <TableHead className="p-2 font-medium">Shop Name</TableHead>
                  <TableHead className="p-2 font-medium">Game Stake</TableHead>
                  <TableHead className="p-2 font-medium">Tickets Amount</TableHead>
                  <TableHead className="p-2 font-medium">Winning Count</TableHead>
                  <TableHead className="p-2 font-medium">Winning</TableHead>
                  <TableHead className="p-2 font-medium">Claimed Count</TableHead>
                  <TableHead className="p-2 font-medium">Claimed Amount</TableHead>
                  <TableHead className="p-2 font-medium">Unclaimed Count</TableHead>
                  <TableHead className="p-2 font-medium">Unclaimed Amount</TableHead>
                  <TableHead className="p-2 font-medium">Pending Count</TableHead>
                  <TableHead className="p-2 font-medium">Pending Amount</TableHead>
                  <TableHead className="p-2 font-medium">Net Balance</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {reportData.length > 0 ? (
                  reportData.map((item: any, index: number) => (
                    <TableRow key={index} className="text-xs">
                      <TableCell className="p-2">{index + 1}</TableCell>
                      <TableCell className="p-2">{item.shopName || user?.name || 'Shop'}</TableCell>
                      <TableCell className="p-2">Br 0.00</TableCell>
                      <TableCell className="p-2">{formatCurrency(item.entryFee || 0)}</TableCell>
                      <TableCell className="p-2">0</TableCell>
                      <TableCell className="p-2">{formatCurrency(item.prizePool || 0)}</TableCell>
                      <TableCell className="p-2">0</TableCell>
                      <TableCell className="p-2">Br 0.00</TableCell>
                      <TableCell className="p-2">0</TableCell>
                      <TableCell className="p-2">Br 0.00</TableCell>
                      <TableCell className="p-2">0</TableCell>
                      <TableCell className="p-2">Br 0.00</TableCell>
                      <TableCell className="p-2">{formatCurrency(item.netBalance || 0)}</TableCell>
                    </TableRow>
                  ))
                ) : (
                  Array.from({ length: 12 }, (_, index) => (
                    <TableRow key={index} className="text-xs">
                      <TableCell className="p-2">{index + 1}</TableCell>
                      <TableCell className="p-2">
                        {index === 0 ? 'Shop' : 
                         index === 1 ? 'Sonic' : 
                         index === 2 ? 'primeval' : 
                         index === 3 ? 'Minilete' : 
                         index === 4 ? 'Harnett' : 
                         index === 5 ? 'change' : 
                         index === 6 ? 'Shop' : 
                         index === 7 ? 'Jennings' : 
                         index === 8 ? 'Possis' : 
                         index === 9 ? 'Daniela' : 
                         index === 10 ? 'unknown' : 
                         index === 11 ? 'robert' : 'Marysue'}
                      </TableCell>
                      <TableCell className="p-2">Br 0.00</TableCell>
                      <TableCell className="p-2">Br 0.00</TableCell>
                      <TableCell className="p-2">0</TableCell>
                      <TableCell className="p-2">Br 0.00</TableCell>
                      <TableCell className="p-2">0</TableCell>
                      <TableCell className="p-2">Br 0.00</TableCell>
                      <TableCell className="p-2">0</TableCell>
                      <TableCell className="p-2">Br 0.00</TableCell>
                      <TableCell className="p-2">0</TableCell>
                      <TableCell className="p-2">Br 0.00</TableCell>
                      <TableCell className="p-2">Br 0.00</TableCell>
                    </TableRow>
                  ))
                )}
              </TableBody>
            </Table>
          </div>
        </CardContent>
      </Card>

      {/* Page Info */}
      <div className="mt-4 text-xs text-gray-500">
        Page 1
      </div>
    </div>
  );
}