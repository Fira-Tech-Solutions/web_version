/**
 * Secure Admin Dashboard - Offline Signing Station
 * Refactored with private key management and enhanced security
 */
import { useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { useToast } from "@/hooks/use-toast";
import { useAuth } from "@/hooks/use-auth";
import { useAdminRealtime } from "@/hooks/use-admin-realtime";
import { apiRequest } from "@/lib/queryClient";
import { 
  Shield, 
  Key, 
  Users, 
  DollarSign, 
  TrendingUp, 
  Settings, 
  Lock,
  Eye,
  EyeOff,
  Download,
  AlertTriangle,
  UserPlus
} from "lucide-react";

import SecuritySettings from "@/components/security-settings";
import UserProvisioning from "@/components/user-provisioning";
import FinancialMonitor from "@/components/financial-monitor";
import EmployeeManagement from "@/components/employee-management";
import ActivationGenerator from "@/components/activation-generator";

interface SecureAdminDashboardProps {
  onLogout: () => void;
}

export default function SecureAdminDashboard({ onLogout }: SecureAdminDashboardProps) {
  const { user } = useAuth();
  const queryClient = useQueryClient();
  const { toast } = useToast();
  const { isConnected } = useAdminRealtime(); // Add real-time hook
  const [activeTab, setActiveTab] = useState("employees"); // Default to employees tab
  const [privateKey, setPrivateKey] = useState("");
  const [generatedFiles, setGeneratedFiles] = useState<any[]>([]);

  // Data queries
  const { data: employees, refetch: refetchEmployees } = useQuery({
    queryKey: ["/api/admin/employees"],
    enabled: !!user,
  });

  const { data: transactions = [], refetch: refetchTransactions } = useQuery({
    queryKey: ["/api/transactions/admin"],
    enabled: !!user,
  });

  // Admin tracking data for real-time metrics
  const { data: trackingData, refetch: refetchTrackingData } = useQuery({
    queryKey: ["/api/admin/tracking-data"],
    enabled: !!user,
  });

  // Mock recharge history - in real app, this would come from API
  const rechargeHistory = [
    {
      createdAt: new Date().toISOString(),
      employeeName: "John Doe",
      employeeAccountNumber: "BGO0000001",
      amount: "500.00",
      machineId: "DEV-ABC12345",
      transactionId: "TRX123456789"
    },
    {
      createdAt: new Date(Date.now() - 86400000).toISOString(),
      employeeName: "Jane Smith", 
      employeeAccountNumber: "BGO0000002",
      amount: "250.00",
      machineId: "DEV-DEF67890"
    }
  ];

  const handlePrivateKeyChange = (key: string) => {
    setPrivateKey(key);
    toast({
      title: "Private Key Updated",
      description: "Your private key has been securely loaded"
    });
  };

  const handleLogout = () => {
    // Clear private key on logout
    setPrivateKey("");
    toast({
      title: "Logged Out",
      description: "Private key has been cleared for security"
    });
    onLogout();
  };

  const handleFileGenerated = (fileData: any) => {
    setGeneratedFiles(prev => [fileData, ...prev]);
    toast({
      title: "File Generated",
      description: "Account file has been generated successfully"
    });
  };

  const handleExportData = () => {
    if (!trackingData || trackingData.users.length === 0) {
      toast({
        title: "No Data Available",
        description: "No employee data available to export",
        variant: "destructive"
      });
      return;
    }

    const exportData = {
      employees: trackingData.users.filter(user => user.role === 'employee'),
      transactions: transactions,
      exportDate: new Date().toISOString()
    };

    const dataStr = JSON.stringify(exportData, null, 2);
    const dataBlob = new Blob([dataStr], { type: 'application/json' });
    const url = URL.createObjectURL(dataBlob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `bingo-admin-export-${new Date().toISOString().split('T')[0]}.json`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);

    toast({
      title: "Export Successful",
      description: "Admin data exported successfully"
    });
  };

  if (!user || user.role !== 'admin') {
    return (
      <div className="min-h-screen flex items-center justify-center bg-slate-950">
        <Card className="w-96 border-slate-800 bg-slate-900 text-slate-100">
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-red-400">
              <Lock className="h-5 w-5" />
              Access Denied
            </CardTitle>
            <CardDescription className="text-slate-400">
              You need administrator privileges to access this dashboard.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <p className="text-sm text-slate-300">
              This page is restricted to admin users only.
            </p>
            <Button
              onClick={() => window.location.href = '/'}
              className="w-full bg-slate-800 hover:bg-slate-700"
            >
              Return to Login
            </Button>
          </CardContent>
        </Card>
      </div>
    );
  }

  const userAccountNumber = (user as any).accountNumber || `BGO${String(user.id).padStart(9, '0')}`;

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-950 to-slate-900">
      {/* Header */}
      <div className="bg-slate-900/95 backdrop-blur-sm border-b border-slate-800">
        <div className="max-w-7xl mx-auto px-6 py-4">
          <div className="flex justify-between items-center">
            <div>
              <h1 className="text-2xl font-bold text-white flex items-center gap-2">
                <Shield className="h-6 w-6 text-amber-500" />
                Secure Admin Station
              </h1>
              <p className="text-slate-400">
                Admin Dashboard
              </p>
            </div>
            <div className="flex items-center gap-4">
              {/* Real-time connection indicator */}
              <div className={`flex items-center gap-2 px-3 py-2 rounded-lg border ${
                isConnected 
                  ? 'bg-green-900/20 border-green-700' 
                  : 'bg-red-900/20 border-red-700'
              }`}>
                <div className={`w-2 h-2 rounded-full ${
                  isConnected ? 'bg-green-500' : 'bg-red-500'
                }`} />
                <span className={`text-xs font-medium ${
                  isConnected ? 'text-green-400' : 'text-red-400'
                }`}>
                  {isConnected ? 'Live' : 'Offline'}
                </span>
              </div>
              
              <div className="bg-slate-800 px-4 py-2 rounded-lg border border-slate-700">
                <p className="text-xs text-slate-500 uppercase tracking-wider font-bold">Admin Account</p>
                <p className="font-mono text-sm text-white">{userAccountNumber}</p>
              </div>
              <Button 
                variant="outline" 
                onClick={handleLogout}
                className="bg-red-900/20 text-red-400 border-red-800/30 hover:bg-red-900/30"
              >
                Logout
              </Button>
            </div>
          </div>
        </div>
      </div>

      <div className="max-w-7xl mx-auto px-6 py-8">
        {/* Overview Cards */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          <Card className="border-l-4 border-l-green-500 bg-slate-900 border-slate-800">
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-medium text-slate-400 uppercase flex items-center gap-2">
                <Users className="w-4 h-4" />
                Total Employees
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold text-white">{trackingData?.financials?.userCount || 0}</div>
              <p className="text-xs text-green-400 mt-1 font-medium">Registered accounts</p>
            </CardContent>
          </Card>

          <Card className="border-l-4 border-l-amber-500 bg-slate-900 border-slate-800">
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-medium text-slate-400 uppercase flex items-center gap-2">
                <DollarSign className="w-4 h-4" />
                Total Revenue
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold text-white">
                ${parseFloat(trackingData?.financials?.totalAdminBalance || '0').toFixed(2)}
              </div>
              <p className="text-xs text-amber-400 mt-1 font-medium">Sum of all employee balances</p>
            </CardContent>
          </Card>

          <Card className="border-l-4 border-l-blue-500 bg-slate-900 border-slate-800">
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-medium text-slate-400 uppercase flex items-center gap-2">
                <TrendingUp className="w-4 h-4" />
                Total Collected
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold text-white">
                ${parseFloat(trackingData?.financials?.totalEmployeePaid || '0').toFixed(2)}
              </div>
              <p className="text-xs text-blue-400 mt-1 font-medium">Employee payments received</p>
            </CardContent>
          </Card>
        </div>

        {/* Main Content Tabs */}
        <div className="mt-8">
          <Tabs value={activeTab} onValueChange={setActiveTab} className="w-full">
            <TabsList className="grid w-full grid-cols-5 bg-slate-800 border border-slate-700">
              <TabsTrigger value="employees" className="data-[state=active]:bg-slate-700 data-[state=active]:text-white">
                <Users className="w-4 h-4 mr-2" />
                Employees
              </TabsTrigger>
              <TabsTrigger value="security" className="data-[state=active]:bg-slate-700 data-[state=active]:text-white">
                <Shield className="w-4 h-4 mr-2" />
                Security
              </TabsTrigger>
              <TabsTrigger value="provisioning" className="data-[state=active]:bg-slate-700 data-[state=active]:text-white">
                <UserPlus className="w-4 h-4 mr-2" />
                Provisioning
              </TabsTrigger>
              <TabsTrigger value="activation" className="data-[state=active]:bg-slate-700 data-[state=active]:text-white">
                <Key className="w-4 h-4 mr-2" />
                Activation
              </TabsTrigger>
              <TabsTrigger value="monitoring" className="data-[state=active]:bg-slate-700 data-[state=active]:text-white">
                <TrendingUp className="w-4 h-4 mr-2" />
                Monitoring
              </TabsTrigger>
            </TabsList>

            {/* Employees Tab */}
            <TabsContent value="employees" className="space-y-6 mt-6">
              <EmployeeManagement 
                employees={trackingData?.users?.filter(user => user.role === 'employee') || []}
                onEmployeeUpdated={() => {
                  refetchTrackingData();
                  refetchEmployees();
                }}
              />
            </TabsContent>

            {/* Security Tab */}
            <TabsContent value="security" className="space-y-6 mt-6">
              <SecuritySettings onPrivateKeyChange={handlePrivateKeyChange} />
            </TabsContent>

            {/* Provisioning Tab */}
            <TabsContent value="provisioning" className="space-y-6 mt-6">
              <UserProvisioning 
                privateKey={privateKey}
                employees={trackingData?.users?.filter(user => user.role === 'employee') || []}
                onFileGenerated={handleFileGenerated}
              />
            </TabsContent>

            {/* Activation Tab */}
            <TabsContent value="activation" className="space-y-6 mt-6">
              <ActivationGenerator privateKey={privateKey} />
            </TabsContent>

            {/* Monitoring Tab */}
            <TabsContent value="monitoring" className="space-y-6 mt-6">
              <FinancialMonitor 
                employees={trackingData?.users?.filter(user => user.role === 'employee') || []}
                onExportData={handleExportData}
              />
            </TabsContent>
          </Tabs>
        </div>
      </div>
    </div>
  );
}
