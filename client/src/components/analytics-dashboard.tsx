import { useState, useEffect } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { useQuery } from "@tanstack/react-query";
import { useAuth } from "@/hooks/use-auth";
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, BarChart, Bar, PieChart, Pie, Cell, Area, AreaChart } from "recharts";
import { TrendingUp, TrendingDown, DollarSign, Users, Calendar, Download, Filter } from "lucide-react";

interface AnalyticsDashboardProps {
  shopId?: number;
}

export default function AnalyticsDashboard({ shopId }: AnalyticsDashboardProps) {
  const { user } = useAuth();
  const [selectedShop, setSelectedShop] = useState<string>(shopId?.toString() || "");
  const [dateRange, setDateRange] = useState("week");
  const [startDate, setStartDate] = useState("");
  const [endDate, setEndDate] = useState("");
  const [activeTab, setActiveTab] = useState("overview");

  // Get shops list for super admin
  const { data: shops } = useQuery({
    queryKey: ['/api/shops'],
    enabled: user?.role === 'super_admin'
  });

  // Get comprehensive shop analytics
  const { data: shopAnalytics, refetch: refetchShopAnalytics } = useQuery({
    queryKey: ['/api/analytics/shop', selectedShop || user?.shopId, { startDate, endDate }],
    enabled: !!(selectedShop || user?.shopId)
  });

  // Get profit distribution (super admin only)
  const { data: profitDistribution } = useQuery({
    queryKey: ['/api/analytics/profit-distribution', { startDate, endDate }],
    enabled: user?.role === 'super_admin'
  });

  // Get financial trends
  const { data: trends } = useQuery({
    queryKey: ['/api/analytics/trends', { shopId: selectedShop, period: dateRange }],
    enabled: !!(selectedShop || user?.shopId)
  });

  // Get employee performance
  const { data: employeePerformance } = useQuery({
    queryKey: ['/api/analytics/employee-performance', { shopId: selectedShop, startDate, endDate }],
    enabled: !!(selectedShop || user?.shopId)
  });

  // Export data
  const handleExport = async () => {
    try {
      const response = await fetch(`/api/analytics/export?shopId=${selectedShop}&startDate=${startDate}&endDate=${endDate}&type=games`);
      const data = await response.json();
      
      // Create CSV content
      const csvContent = "data:text/csv;charset=utf-8," + 
        "Game ID,Date,Total Collected,Prize Amount,Admin Profit,Super Admin Commission,Player Count,Winner\n" +
        data.data.map((game: any) => 
          `${game.gameId},${new Date(game.completedAt).toLocaleDateString()},${game.totalCollected},${game.prizeAmount},${game.adminProfit},${game.superAdminCommission},${game.playerCount},${game.winnerName || 'N/A'}`
        ).join("\n");

      const encodedUri = encodeURI(csvContent);
      const link = document.createElement("a");
      link.setAttribute("href", encodedUri);
      link.setAttribute("download", `analytics_export_${new Date().toISOString().split('T')[0]}.csv`);
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
    } catch (error) {
      console.error("Export failed:", error);
    }
  };

  // Apply date filter
  const applyDateFilter = () => {
    refetchShopAnalytics();
  };

  // Chart colors
  const COLORS = ['#0088FE', '#00C49F', '#FFBB28', '#FF8042', '#8884D8'];

  // Format currency
  const formatCurrency = (amount: string | number) => {
    return `${parseFloat(amount.toString()).toFixed(2)} Birr`;
  };

  return (
    <div className="space-y-6">
      {/* Header with Filters */}
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
        <div>
          <h2 className="text-2xl font-bold">Analytics Dashboard</h2>
          <p className="text-gray-600">Comprehensive reporting and profit analysis</p>
        </div>
        
        <div className="flex flex-wrap gap-2">
          {user?.role === 'super_admin' && (
            <Select value={selectedShop} onValueChange={setSelectedShop}>
              <SelectTrigger className="w-48">
                <SelectValue placeholder="Select Shop" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="">All Shops</SelectItem>
                {shops?.map((shop: any) => (
                  <SelectItem key={shop.id} value={shop.id.toString()}>
                    {shop.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          )}
          
          <Select value={dateRange} onValueChange={setDateRange}>
            <SelectTrigger className="w-32">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="week">Week</SelectItem>
              <SelectItem value="month">Month</SelectItem>
              <SelectItem value="quarter">Quarter</SelectItem>
              <SelectItem value="year">Year</SelectItem>
            </SelectContent>
          </Select>
          
          <Button onClick={handleExport} variant="outline" size="sm">
            <Download className="w-4 h-4 mr-2" />
            Export
          </Button>
        </div>
      </div>

      {/* Custom Date Range Filter */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Filter className="w-5 h-5" />
            Date Range Filter
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="flex flex-wrap gap-4 items-end">
            <div className="flex-1 min-w-40">
              <label className="block text-sm font-medium mb-1">Start Date</label>
              <Input
                type="date"
                value={startDate}
                onChange={(e) => setStartDate(e.target.value)}
              />
            </div>
            <div className="flex-1 min-w-40">
              <label className="block text-sm font-medium mb-1">End Date</label>
              <Input
                type="date"
                value={endDate}
                onChange={(e) => setEndDate(e.target.value)}
              />
            </div>
            <Button onClick={applyDateFilter}>Apply Filter</Button>
          </div>
        </CardContent>
      </Card>

      <Tabs value={activeTab} onValueChange={setActiveTab}>
        <TabsList className="grid w-full grid-cols-4">
          <TabsTrigger value="overview">Overview</TabsTrigger>
          <TabsTrigger value="profits">Profit Analysis</TabsTrigger>
          <TabsTrigger value="employees">Employee Performance</TabsTrigger>
          <TabsTrigger value="trends">Trends</TabsTrigger>
        </TabsList>

        {/* Overview Tab */}
        <TabsContent value="overview" className="space-y-6">
          {/* Key Metrics Cards */}
          {shopAnalytics && (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
              <Card>
                <CardContent className="p-6">
                  <div className="flex items-center justify-between">
                    <div>
                      <p className="text-sm font-medium text-gray-600">Total Revenue</p>
                      <p className="text-2xl font-bold text-green-600">
                        {formatCurrency(shopAnalytics.profitBreakdown.totalRevenue)}
                      </p>
                    </div>
                    <DollarSign className="w-8 h-8 text-green-600" />
                  </div>
                </CardContent>
              </Card>

              <Card>
                <CardContent className="p-6">
                  <div className="flex items-center justify-between">
                    <div>
                      <p className="text-sm font-medium text-gray-600">Total Games</p>
                      <p className="text-2xl font-bold text-blue-600">{shopAnalytics.totalGames}</p>
                    </div>
                    <Calendar className="w-8 h-8 text-blue-600" />
                  </div>
                </CardContent>
              </Card>

              <Card>
                <CardContent className="p-6">
                  <div className="flex items-center justify-between">
                    <div>
                      <p className="text-sm font-medium text-gray-600">Profit Margin</p>
                      <p className="text-2xl font-bold text-purple-600">
                        {shopAnalytics.profitBreakdown.profitMargin}%
                      </p>
                    </div>
                    <TrendingUp className="w-8 h-8 text-purple-600" />
                  </div>
                </CardContent>
              </Card>

              <Card>
                <CardContent className="p-6">
                  <div className="flex items-center justify-between">
                    <div>
                      <p className="text-sm font-medium text-gray-600">Active Employees</p>
                      <p className="text-2xl font-bold text-orange-600">
                        {shopAnalytics.employeePerformance.length}
                      </p>
                    </div>
                    <Users className="w-8 h-8 text-orange-600" />
                  </div>
                </CardContent>
              </Card>
            </div>
          )}

          {/* Revenue Breakdown Chart */}
          {shopAnalytics && (
            <Card>
              <CardHeader>
                <CardTitle>Revenue Breakdown</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="h-80">
                  <ResponsiveContainer width="100%" height="100%">
                    <PieChart>
                      <Pie
                        data={[
                          { name: 'Admin Profit', value: parseFloat(shopAnalytics.profitBreakdown.adminProfit), color: '#0088FE' },
                          { name: 'Prize Amount', value: parseFloat(shopAnalytics.profitBreakdown.totalPrizes), color: '#00C49F' },
                          { name: 'Super Admin Commission', value: parseFloat(shopAnalytics.profitBreakdown.superAdminCommission), color: '#FFBB28' }
                        ]}
                        cx="50%"
                        cy="50%"
                        innerRadius={60}
                        outerRadius={120}
                        dataKey="value"
                        label={({ name, percent }) => `${name}: ${(percent * 100).toFixed(1)}%`}
                      >
                        {[0, 1, 2].map((index) => (
                          <Cell key={`cell-${index}`} fill={COLORS[index]} />
                        ))}
                      </Pie>
                      <Tooltip formatter={(value) => formatCurrency(value)} />
                    </PieChart>
                  </ResponsiveContainer>
                </div>
              </CardContent>
            </Card>
          )}

          {/* Recent Games */}
          {shopAnalytics?.gameHistory && (
            <Card>
              <CardHeader>
                <CardTitle>Recent Games</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="overflow-x-auto">
                  <table className="w-full text-sm">
                    <thead>
                      <tr className="border-b">
                        <th className="text-left p-2">Game ID</th>
                        <th className="text-left p-2">Date</th>
                        <th className="text-left p-2">Revenue</th>
                        <th className="text-left p-2">Prize</th>
                        <th className="text-left p-2">Profit</th>
                        <th className="text-left p-2">Players</th>
                        <th className="text-left p-2">Winner</th>
                      </tr>
                    </thead>
                    <tbody>
                      {shopAnalytics.gameHistory.map((game: any) => (
                        <tr key={game.gameId} className="border-b hover:bg-gray-50">
                          <td className="p-2">#{game.gameId}</td>
                          <td className="p-2">{new Date(game.completedAt).toLocaleDateString()}</td>
                          <td className="p-2 text-green-600">{formatCurrency(game.totalCollected)}</td>
                          <td className="p-2 text-blue-600">{formatCurrency(game.prizeAmount)}</td>
                          <td className="p-2 text-purple-600">{formatCurrency(game.adminProfit)}</td>
                          <td className="p-2">{game.playerCount}</td>
                          <td className="p-2">
                            <Badge variant="secondary">{game.winnerName || 'N/A'}</Badge>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </CardContent>
            </Card>
          )}
        </TabsContent>

        {/* Profit Analysis Tab */}
        <TabsContent value="profits" className="space-y-6">
          {shopAnalytics && (
            <>
              {/* Detailed Profit Breakdown */}
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                <Card>
                  <CardHeader>
                    <CardTitle className="text-lg">Admin Profit</CardTitle>
                  </CardHeader>
                  <CardContent>
                    <p className="text-3xl font-bold text-green-600">
                      {formatCurrency(shopAnalytics.profitBreakdown.adminProfit)}
                    </p>
                    <p className="text-sm text-gray-600 mt-2">
                      {shopAnalytics.profitBreakdown.profitMargin}% of total revenue
                    </p>
                  </CardContent>
                </Card>

                <Card>
                  <CardHeader>
                    <CardTitle className="text-lg">Prize Payouts</CardTitle>
                  </CardHeader>
                  <CardContent>
                    <p className="text-3xl font-bold text-blue-600">
                      {formatCurrency(shopAnalytics.profitBreakdown.totalPrizes)}
                    </p>
                    <p className="text-sm text-gray-600 mt-2">
                      {shopAnalytics.profitBreakdown.prizePercentage}% of total revenue
                    </p>
                  </CardContent>
                </Card>

                <Card>
                  <CardHeader>
                    <CardTitle className="text-lg">Super Admin Commission</CardTitle>
                  </CardHeader>
                  <CardContent>
                    <p className="text-3xl font-bold text-purple-600">
                      {formatCurrency(shopAnalytics.profitBreakdown.superAdminCommission)}
                    </p>
                    <p className="text-sm text-gray-600 mt-2">
                      Commission from admin profits
                    </p>
                  </CardContent>
                </Card>
              </div>

              {/* Profit Margin Analysis */}
              <Card>
                <CardHeader>
                  <CardTitle>Profit Distribution Analysis</CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="space-y-4">
                    <div className="flex justify-between items-center">
                      <span>Revenue to Prize Ratio</span>
                      <Badge variant={parseFloat(shopAnalytics.profitBreakdown.prizePercentage) > 70 ? "destructive" : "default"}>
                        {shopAnalytics.profitBreakdown.prizePercentage}%
                      </Badge>
                    </div>
                    <div className="flex justify-between items-center">
                      <span>Profit Efficiency</span>
                      <Badge variant={parseFloat(shopAnalytics.profitBreakdown.profitMargin) > 20 ? "default" : "secondary"}>
                        {shopAnalytics.profitBreakdown.profitMargin}%
                      </Badge>
                    </div>
                    <div className="flex justify-between items-center">
                      <span>Average Game Value</span>
                      <span className="font-semibold">
                        {formatCurrency(parseFloat(shopAnalytics.profitBreakdown.totalRevenue) / shopAnalytics.totalGames)}
                      </span>
                    </div>
                  </div>
                </CardContent>
              </Card>
            </>
          )}

          {/* System-wide Profit Distribution (Super Admin Only) */}
          {user?.role === 'super_admin' && profitDistribution && (
            <Card>
              <CardHeader>
                <CardTitle>System-wide Profit Distribution</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                  <div>
                    <h4 className="font-semibold mb-2">System Totals</h4>
                    <div className="space-y-2">
                      <div className="flex justify-between">
                        <span>Total Revenue</span>
                        <span className="font-semibold">{formatCurrency(profitDistribution.systemTotals.totalRevenue)}</span>
                      </div>
                      <div className="flex justify-between">
                        <span>Admin Profits</span>
                        <span className="font-semibold">{formatCurrency(profitDistribution.systemTotals.totalAdminProfits)}</span>
                      </div>
                      <div className="flex justify-between">
                        <span>Super Admin Commissions</span>
                        <span className="font-semibold">{formatCurrency(profitDistribution.systemTotals.totalSuperAdminCommissions)}</span>
                      </div>
                    </div>
                  </div>
                  
                  <div>
                    <h4 className="font-semibold mb-2">Top Performing Shops</h4>
                    <div className="space-y-2">
                      {profitDistribution.shopAnalytics
                        .sort((a: any, b: any) => parseFloat(b.totalRevenue) - parseFloat(a.totalRevenue))
                        .slice(0, 5)
                        .map((shop: any) => (
                          <div key={shop.shop.id} className="flex justify-between">
                            <span>{shop.shop.name}</span>
                            <span className="font-semibold">{formatCurrency(shop.totalRevenue)}</span>
                          </div>
                        ))}
                    </div>
                  </div>
                </div>
              </CardContent>
            </Card>
          )}
        </TabsContent>

        {/* Employee Performance Tab */}
        <TabsContent value="employees" className="space-y-6">
          {employeePerformance && (
            <div className="grid grid-cols-1 gap-4">
              {employeePerformance.map((emp: any) => (
                <Card key={emp.employee.id}>
                  <CardHeader>
                    <div className="flex justify-between items-center">
                      <CardTitle className="text-lg">{emp.employee.name}</CardTitle>
                      <Badge variant="outline">@{emp.employee.username}</Badge>
                    </div>
                  </CardHeader>
                  <CardContent>
                    <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                      <div>
                        <p className="text-sm text-gray-600">Total Games</p>
                        <p className="text-xl font-bold">{emp.performance.totalGames}</p>
                      </div>
                      <div>
                        <p className="text-sm text-gray-600">Total Revenue</p>
                        <p className="text-xl font-bold text-green-600">{formatCurrency(emp.performance.totalRevenue)}</p>
                      </div>
                      <div>
                        <p className="text-sm text-gray-600">Avg Game Value</p>
                        <p className="text-xl font-bold text-blue-600">{formatCurrency(emp.performance.averageGameValue)}</p>
                      </div>
                      <div>
                        <p className="text-sm text-gray-600">Efficiency</p>
                        <p className="text-xl font-bold text-purple-600">{emp.performance.efficiency}%</p>
                      </div>
                    </div>
                  </CardContent>
                </Card>
              ))}
            </div>
          )}
        </TabsContent>

        {/* Trends Tab */}
        <TabsContent value="trends" className="space-y-6">
          {trends && (
            <>
              {/* Summary Cards */}
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
                <Card>
                  <CardContent className="p-6">
                    <p className="text-sm font-medium text-gray-600">Period Revenue</p>
                    <p className="text-2xl font-bold text-green-600">{formatCurrency(trends.summary.totalRevenue)}</p>
                  </CardContent>
                </Card>
                <Card>
                  <CardContent className="p-6">
                    <p className="text-sm font-medium text-gray-600">Period Games</p>
                    <p className="text-2xl font-bold text-blue-600">{trends.summary.totalGames}</p>
                  </CardContent>
                </Card>
                <Card>
                  <CardContent className="p-6">
                    <p className="text-sm font-medium text-gray-600">Period Profit</p>
                    <p className="text-2xl font-bold text-purple-600">{formatCurrency(trends.summary.totalProfit)}</p>
                  </CardContent>
                </Card>
                <Card>
                  <CardContent className="p-6">
                    <p className="text-sm font-medium text-gray-600">Avg Daily Revenue</p>
                    <p className="text-2xl font-bold text-orange-600">{formatCurrency(trends.summary.averageDailyRevenue)}</p>
                  </CardContent>
                </Card>
              </div>

              {/* Revenue Trend Chart */}
              <Card>
                <CardHeader>
                  <CardTitle>Revenue Trends</CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="h-80">
                    <ResponsiveContainer width="100%" height="100%">
                      <AreaChart data={trends.trends}>
                        <CartesianGrid strokeDasharray="3 3" />
                        <XAxis dataKey="date" />
                        <YAxis />
                        <Tooltip formatter={(value) => formatCurrency(value)} />
                        <Area type="monotone" dataKey="revenue" stroke="#0088FE" fill="#0088FE" fillOpacity={0.3} />
                      </AreaChart>
                    </ResponsiveContainer>
                  </div>
                </CardContent>
              </Card>

              {/* Games and Profit Trends */}
              <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                <Card>
                  <CardHeader>
                    <CardTitle>Games per Day</CardTitle>
                  </CardHeader>
                  <CardContent>
                    <div className="h-64">
                      <ResponsiveContainer width="100%" height="100%">
                        <BarChart data={trends.trends}>
                          <CartesianGrid strokeDasharray="3 3" />
                          <XAxis dataKey="date" />
                          <YAxis />
                          <Tooltip />
                          <Bar dataKey="games" fill="#00C49F" />
                        </BarChart>
                      </ResponsiveContainer>
                    </div>
                  </CardContent>
                </Card>

                <Card>
                  <CardHeader>
                    <CardTitle>Daily Profit</CardTitle>
                  </CardHeader>
                  <CardContent>
                    <div className="h-64">
                      <ResponsiveContainer width="100%" height="100%">
                        <LineChart data={trends.trends}>
                          <CartesianGrid strokeDasharray="3 3" />
                          <XAxis dataKey="date" />
                          <YAxis />
                          <Tooltip formatter={(value) => formatCurrency(value)} />
                          <Line type="monotone" dataKey="profit" stroke="#FFBB28" strokeWidth={2} />
                        </LineChart>
                      </ResponsiveContainer>
                    </div>
                  </CardContent>
                </Card>
              </div>
            </>
          )}
        </TabsContent>
      </Tabs>
    </div>
  );
}