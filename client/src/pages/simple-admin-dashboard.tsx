import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { NavigationHeader } from "@/components/navigation-header";
import { EmployeeCreationForm } from "@/components/employee-creation-form";
import { SystemSettings } from "@/components/system-settings";
import { FileUpload } from "@/components/file-upload";
import { AdminCreditLoadHistory } from "@/components/admin-credit-load-history";
import { AdminReferralCommissions } from "@/components/admin-referral-commissions";
import { AdminCreditTransferHistory } from "@/components/admin-credit-transfer-history";
import { EnhancedGameHistory } from "@/components/enhanced-game-history";
import { ErrorDisplay, LoadingState } from "@/components/error-display";
import { useAuth } from "@/hooks/use-auth";
import { apiRequest } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import { useSocket } from "@/lib/websocket";
import { Building2, Users, DollarSign, GamepadIcon, BarChart3, UserPlus, CreditCard, Plus, ArrowRight, History, AlertCircle, Gift, Settings, Lock, Percent, Grid3X3, TrendingUp } from "lucide-react";
import CustomCartelaBuilder from "@/components/custom-cartela-builder";
import UnifiedCartelaManager from "@/components/unified-cartela-manager";

interface SimpleAdminDashboardProps {
  onLogout: () => void;
}

export default function SimpleAdminDashboard({ onLogout }: SimpleAdminDashboardProps) {
  const { user, isLoading, refetch: refetchAuth } = useAuth();
  const queryClient = useQueryClient();
  const { toast } = useToast();
  const [activeTab, setActiveTab] = useState("overview");

  const [rechargeAmount, setRechargeAmount] = useState("");
  const [rechargeRecipient, setRechargeRecipient] = useState("");
  const [loadCreditAmount, setLoadCreditAmount] = useState("");

  const { data: employees, refetch: refetchEmployees } = useQuery({
    queryKey: ["/api/admin/employees", user?.shopId],
    enabled: !!user?.shopId,
  });

  const { data: shopStats } = useQuery({
    queryKey: [`/api/shops/${user?.shopId}`],
    enabled: !!user?.shopId,
  });

  const { data: masterFloatData, refetch: refetchMasterFloat } = useQuery({
    queryKey: ["/api/admin/master-float"],
    enabled: !!user?.shopId,
  });

  // Socket.io integration for real-time updates
  useSocket((message) => {
    if (message.type === 'global_balance_update') {
      refetchMasterFloat();
      toast({
        title: "Balance Updated",
        description: "System total float has been updated.",
      });
    } else if (message.type === 'game_completed') {
      refetchMasterFloat();
      queryClient.invalidateQueries({ queryKey: ["/api/admin/game-history"] });
      toast({
        title: "Game Completed",
        description: `Game ${message.gameId} has been completed.`,
      });
    }
  });

  // Load Credit Mutation
  const loadCreditMutation = useMutation({
    mutationFn: async (amount: string) => {
      const response = await apiRequest("POST", "/api/admin/load-credit", { amount });
      return response.json();
    },
    onSuccess: (data) => {
      refetchMasterFloat();
      queryClient.invalidateQueries({ queryKey: [`/api/shops/${user?.shopId}`] });
      toast({
        title: "Credit Loaded Successfully",
        description: `ETB ${amount} has been added to the system.`,
      });
      setLoadCreditAmount("");
    },
    onError: (error: any) => {
      toast({
        title: "Error",
        description: error.message || "Failed to load credit",
        variant: "destructive",
      });
    },
  });

  const generateRechargeFileMutation = useMutation({
    mutationFn: async (data: { employeeAccountNumber: string; amount: string }) => {
      const response = await apiRequest("POST", "/api/admin/recharge/generate-file", data);
      return response.json();
    },
    onSuccess: (data) => {
      const blob = new Blob([data.fileData], { type: "application/octet-stream" });
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = data.filename;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      window.URL.revokeObjectURL(url);

      toast({
        title: "Recharge File Generated",
        description: `The recharge file for ${rechargeRecipient} has been downloaded. Send this file to the employee.`,
      });
      setRechargeAmount("");
      setRechargeRecipient("");
    },
    onError: (error: any) => {
      toast({
        title: "Error",
        description: error.message || "Failed to generate recharge file",
        variant: "destructive",
      });
    },
  });

  // Show loading state while authentication is being checked
  if (isLoading) {
    return <LoadingState message="Checking authentication..." />;
  }

  // Redirect non-admin users
  if (!user || user.role !== 'admin') {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50">
        <Card className="w-96">
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-red-600">
              <AlertCircle className="h-5 w-5" />
              Access Denied
            </CardTitle>
            <CardDescription>
              You don't have permission to access the admin dashboard.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <p className="text-sm text-gray-600">
              This page is restricted to admin users only.
            </p>
            <Button
              onClick={() => window.location.href = '/'}
              className="w-full"
            >
              Return to Login
            </Button>
          </CardContent>
        </Card>
      </div>
    );
  }

  const handleEmployeeCreated = () => {
    refetchEmployees();
  };

  const handleLoadCredit = () => {
    if (!loadCreditAmount || parseFloat(loadCreditAmount) <= 0) {
      toast({
        title: "Invalid Amount",
        description: "Please provide a valid credit amount",
        variant: "destructive",
      });
      return;
    }
    loadCreditMutation.mutate(loadCreditAmount);
  };

  const handleGenerateRechargeFile = () => {
    if (!rechargeAmount || !rechargeRecipient) {
      toast({
        title: "Error",
        description: "Please provide employee account number and amount",
        variant: "destructive",
      });
      return;
    }
    generateRechargeFileMutation.mutate({
      employeeAccountNumber: rechargeRecipient,
      amount: rechargeAmount
    });
  };

  const employeeList = employees as any[] || [];
  const userAccountNumber = (user as any).accountNumber || `BGO${String(user.id).padStart(9, '0')}`;

  return (
    <div className="min-h-screen bg-gray-50 pb-12">
      <NavigationHeader user={user} onLogout={onLogout} />

      <div className="container mx-auto px-6 py-8">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 mb-8">
          <div>
            <h1 className="text-3xl font-bold text-gray-900">Admin Control Center</h1>
            <p className="text-gray-600">Managing Shop: <span className="font-semibold">{shopStats?.shopName || 'Main Bingo Hall'}</span></p>
          </div>
          <div className="bg-white px-4 py-2 rounded-lg border shadow-sm">
            <p className="text-xs text-gray-500 uppercase tracking-wider font-bold">Your Account</p>
            <p className="font-mono text-sm">{userAccountNumber}</p>
          </div>
        </div>

        <Tabs value={activeTab} onValueChange={setActiveTab} className="space-y-6">
          <TabsList className="grid w-full grid-cols-5 bg-white p-1 rounded-xl shadow-sm border h-14">
            <TabsTrigger value="overview" className="data-[state=active]:bg-blue-50 data-[state=active]:text-blue-700 h-10">
              <BarChart3 className="w-4 h-4 mr-2" />
              Overview
            </TabsTrigger>
            <TabsTrigger value="employees" className="data-[state=active]:bg-blue-50 data-[state=active]:text-blue-700 h-10">
              <Users className="w-4 h-4 mr-2" />
              Employees
            </TabsTrigger>
            <TabsTrigger value="recharge" className="data-[state=active]:bg-blue-50 data-[state=active]:text-blue-700 h-10">
              <CreditCard className="w-4 h-4 mr-2" />
              Recharge File
            </TabsTrigger>
            <TabsTrigger value="cartelas" className="data-[state=active]:bg-blue-50 data-[state=active]:text-blue-700 h-10">
              <Grid3X3 className="w-4 h-4 mr-2" />
              Cards
            </TabsTrigger>
            <TabsTrigger value="settings" className="data-[state=active]:bg-blue-50 data-[state=active]:text-blue-700 h-10">
              <Settings className="w-4 h-4 mr-2" />
              Settings
            </TabsTrigger>
          </TabsList>

          <TabsContent value="overview" className="space-y-6">
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-5 gap-6">
              <Card className="border-l-4 border-l-blue-500">
                <CardHeader className="pb-2">
                  <CardTitle className="text-sm font-medium text-gray-500 uppercase">Total Revenue</CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="text-2xl font-bold text-gray-900">ETB {shopStats?.totalRevenue || '0.00'}</div>
                  <p className="text-xs text-green-600 mt-1 font-medium">↑ All time total</p>
                </CardContent>
              </Card>

              <Card className="border-l-4 border-l-emerald-500">
                <CardHeader className="pb-2">
                  <CardTitle className="text-sm font-medium text-gray-500 uppercase flex items-center gap-1">
                    <TrendingUp className="w-3 h-3" />
                    Master Float
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="text-2xl font-bold text-gray-900">ETB {masterFloatData?.masterFloat || '0.00'}</div>
                  <p className="text-xs text-emerald-600 mt-1 font-medium">System total balance</p>
                </CardContent>
              </Card>

              <Card className="border-l-4 border-l-purple-500">
                <CardHeader className="pb-2">
                  <CardTitle className="text-sm font-medium text-gray-500 uppercase">Active Staff</CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="text-2xl font-bold text-gray-900">{employeeList.length}</div>
                  <p className="text-xs text-gray-400 mt-1 font-medium">Registered employees</p>
                </CardContent>
              </Card>

              <Card className="border-l-4 border-l-orange-500">
                <CardHeader className="pb-2">
                  <CardTitle className="text-sm font-medium text-gray-500 uppercase">Games Played</CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="text-2xl font-bold text-gray-900">{shopStats?.totalGames || 0}</div>
                  <p className="text-xs text-gray-400 mt-1 font-medium">Across all employees</p>
                </CardContent>
              </Card>

              <Card className="border-l-4 border-l-green-500">
                <CardHeader className="pb-2">
                  <CardTitle className="text-sm font-medium text-gray-500 uppercase">Latest Entry</CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="text-xl font-bold text-gray-900 truncate">
                    {employeeList[0]?.name || 'N/A'}
                  </div>
                  <p className="text-xs text-gray-400 mt-1 font-medium">Newest staff member</p>
                </CardContent>
              </Card>
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
              <Card>
                <CardHeader>
                  <CardTitle className="flex items-center gap-2">
                    <CreditCard className="w-5 h-5" />
                    Load System Credit
                  </CardTitle>
                  <CardDescription>Add credit to the system master float</CardDescription>
                </CardHeader>
                <CardContent className="space-y-4">
                  <div>
                    <Label htmlFor="loadCreditAmount">Amount (ETB)</Label>
                    <Input
                      id="loadCreditAmount"
                      type="number"
                      placeholder="Enter amount"
                      value={loadCreditAmount}
                      onChange={(e) => setLoadCreditAmount(e.target.value)}
                    />
                  </div>
                  <Button 
                    onClick={handleLoadCredit}
                    disabled={loadCreditMutation.isPending}
                    className="w-full"
                  >
                    {loadCreditMutation.isPending ? "Loading..." : "Load Credit"}
                  </Button>
                </CardContent>
              </Card>

              <Card>
                <CardHeader>
                  <CardTitle>Recent Game Activity</CardTitle>
                </CardHeader>
                <CardContent>
                  <EnhancedGameHistory shopId={user.shopId} />
                </CardContent>
              </Card>
            </div>
          </TabsContent>

          <TabsContent value="employees" className="space-y-6">
            <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
              <div className="lg:col-span-1">
                <EmployeeCreationForm onSuccess={handleEmployeeCreated} />
              </div>
              <div className="lg:col-span-2">
                <Card>
                  <CardHeader>
                    <CardTitle>Staff Management</CardTitle>
                    <CardDescription>Manage existing accounts and view balances</CardDescription>
                  </CardHeader>
                  <CardContent>
                    <Table>
                      <TableHeader>
                        <TableRow>
                          <TableHead>Name</TableHead>
                          <TableHead>Account #</TableHead>
                          <TableHead>Current Balance</TableHead>
                          <TableHead>Status</TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {employeeList.map((emp) => (
                          <TableRow key={emp.id}>
                            <TableCell className="font-medium">{emp.name}</TableCell>
                            <TableCell className="font-mono text-xs">{emp.accountNumber}</TableCell>
                            <TableCell className="text-blue-600 font-bold">ETB {emp.balance || '0.00'}</TableCell>
                            <TableCell>
                              <Badge variant={emp.isBlocked ? "destructive" : "secondary"}>
                                {emp.isBlocked ? "Blocked" : "Active"}
                              </Badge>
                            </TableCell>
                          </TableRow>
                        ))}
                      </TableBody>
                    </Table>
                  </CardContent>
                </Card>
              </div>
            </div>
          </TabsContent>

          <TabsContent value="recharge" className="space-y-6">
            <div className="max-w-xl mx-auto">
              <Card>
                <CardHeader>
                  <CardTitle className="flex items-center gap-2">
                    <Plus className="w-5 h-5 text-blue-600" />
                    Generate Recharge File
                  </CardTitle>
                  <CardDescription>
                    Create an encrypted balance file for an employee. They must upload this file to receive the credits.
                  </CardDescription>
                </CardHeader>
                <CardContent className="space-y-4">
                  <div className="space-y-2">
                    <Label>Select Employee</Label>
                    <Select onValueChange={setRechargeRecipient} value={rechargeRecipient}>
                      <SelectTrigger>
                        <SelectValue placeholder="Choose an employee" />
                      </SelectTrigger>
                      <SelectContent>
                        {employeeList.map(emp => (
                          <SelectItem key={emp.id} value={emp.accountNumber}>
                            {emp.name} ({emp.accountNumber})
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="amount">Recharge Amount (ETB)</Label>
                    <Input
                      id="amount"
                      type="number"
                      placeholder="e.g. 500"
                      value={rechargeAmount}
                      onChange={(e) => setRechargeAmount(e.target.value)}
                    />
                  </div>
                  <Button
                    variant="default"
                    className="w-full h-12 text-lg shadow-md"
                    onClick={handleGenerateRechargeFile}
                    disabled={generateRechargeFileMutation.isPending}
                  >
                    {generateRechargeFileMutation.isPending ? "Generating..." : "Download Recharge File"}
                  </Button>
                </CardContent>
                <div className="p-4 bg-blue-50 rounded-b-lg border-t text-xs text-blue-700">
                  <strong>Security Note:</strong> Recharge files are cryptographically signed. They can only be used once and only by the specified recipient.
                </div>
              </Card>
            </div>
          </TabsContent>

          <TabsContent value="cartelas" className="space-y-6">
            <UnifiedCartelaManager />
          </TabsContent>

          <TabsContent value="settings" className="space-y-6">
            <SystemSettings />
          </TabsContent>
        </Tabs>
      </div>
    </div>
  );
}