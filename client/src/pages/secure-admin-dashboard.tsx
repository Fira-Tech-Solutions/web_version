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

interface SecureAdminDashboardProps {
  onLogout: () => void;
}

export default function SecureAdminDashboard({ onLogout }: SecureAdminDashboardProps) {
  const { user } = useAuth();
  const queryClient = useQueryClient();
  const { toast } = useToast();
  const [activeTab, setActiveTab] = useState("security");
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
  };

  const handleFileGenerated = (type: 'user' | 'recharge', data: any) => {
    setGeneratedFiles(prev => [...prev, { type, data, timestamp: new Date() }]);
    toast({
      title: "File Generated",
      description: `${type === 'user' ? 'User' : 'Recharge'} file has been created and downloaded`
    });
  };

  const handleExportData = () => {
    if (transactions.length === 0) {
      toast({
        title: "No Data",
        description: "No transaction data available to export",
        variant: "destructive"
      });
      return;
    }

    const exportData = {
      employees: employees || [],
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
              You don't have permission to access the admin dashboard.
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
              <div className="bg-slate-800 px-4 py-2 rounded-lg border border-slate-700">
                <p className="text-xs text-slate-500 uppercase tracking-wider font-bold">Admin Account</p>
                <p className="font-mono text-sm text-white">{userAccountNumber}</p>
              </div>
              <Button 
                variant="outline" 
                onClick={onLogout}
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
                <TrendingUp className="w-4 h-4" />
                Total Employees
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold text-white">{employees?.length || 0}</div>
              <p className="text-xs text-green-400 mt-1 font-medium">Registered accounts</p>
            </CardContent>
          </Card>

          <Card className="border-l-4 border-l-blue-500 bg-slate-900 border-slate-800">
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-medium text-slate-400 uppercase flex items-center gap-2">
                <DollarSign className="w-4 h-4" />
                Total Revenue
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold text-white">ETB {transactions.reduce((acc, curr) => acc + parseFloat(curr.amount), 0).toFixed(2)}</div>
              <p className="text-xs text-blue-400 mt-1 font-medium">All time total</p>
            </CardContent>
          </Card>

          <Card className="border-l-4 border-l-amber-500 bg-slate-900 border-slate-800">
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-medium text-slate-400 uppercase flex items-center gap-1">
                <Key className="w-3 h-3" />
                Security Status
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold text-white flex items-center gap-2">
                {privateKey ? (
                  <>
                    <div className="w-3 h-3 bg-green-500 rounded-full"></div>
                    Secured
                  </>
                ) : (
                  <>
                    <div className="w-3 h-3 bg-red-500 rounded-full"></div>
                    No Key
                  </>
                )}
              </div>
              <p className="text-xs text-amber-400 mt-1 font-medium">
                {privateKey ? 'Private key loaded' : 'Upload private key to enable signing'}
              </p>
            </CardContent>
          </Card>
        </div>

        {/* Main Tabs */}
        <Tabs value={activeTab} onValueChange={setActiveTab} className="space-y-6">
          <TabsList className="grid w-full grid-cols-6 bg-slate-800 p-1 rounded-xl border border-slate-700 h-14">
            <TabsTrigger value="security" className="data-[state=active]:bg-slate-700 data-[state=active]:text-white h-10 text-slate-400">
              <Key className="w-4 h-4 mr-2" />
              Security
            </TabsTrigger>
            <TabsTrigger value="employees" className="data-[state=active]:bg-slate-700 data-[state=active]:text-white h-10 text-slate-400">
              <Users className="w-4 h-4 mr-2" />
              Employees
            </TabsTrigger>
            <TabsTrigger value="provision" className="data-[state=active]:bg-slate-700 data-[state=active]:text-white h-10 text-slate-400">
              <UserPlus className="w-4 h-4 mr-2" />
              Provision
            </TabsTrigger>
            <TabsTrigger value="financial" className="data-[state=active]:bg-slate-700 data-[state=active]:text-white h-10 text-slate-400">
              <DollarSign className="w-4 h-4 mr-2" />
              Financial
            </TabsTrigger>
            <TabsTrigger value="recharge" className="data-[state=active]:bg-slate-700 data-[state=active]:text-white h-10 text-slate-400">
              <Download className="w-4 h-4 mr-2" />
              Recharge
            </TabsTrigger>
            <TabsTrigger value="settings" className="data-[state=active]:bg-slate-700 data-[state=active]:text-white h-10 text-slate-400">
              <Settings className="w-4 h-4 mr-2" />
              Settings
            </TabsTrigger>
          </TabsList>

          {/* Security Tab */}
          <TabsContent value="security" className="space-y-6">
            <SecuritySettings onPrivateKeyChange={handlePrivateKeyChange} />
          </TabsContent>

          {/* Employees Tab */}
          <TabsContent value="employees" className="space-y-6">
            <EmployeeManagement 
              employees={employees || []}
              onEmployeeUpdated={() => refetchEmployees()}
            />
          </TabsContent>

          {/* Provisioning Tab */}
          <TabsContent value="provision" className="space-y-6">
            <UserProvisioning 
              privateKey={privateKey}
              employees={employees || []}
              onFileGenerated={handleFileGenerated}
            />
          </TabsContent>

          {/* Financial Tab */}
          <TabsContent value="financial" className="space-y-6">
            <FinancialMonitor 
              employees={employees || []}
              onExportData={handleExportData}
            />
          </TabsContent>

          {/* Quick Recharge Tab */}
          <TabsContent value="recharge" className="space-y-6">
            <Card className="bg-slate-900 border-slate-800">
              <CardHeader>
                <CardTitle className="text-white flex items-center gap-2">
                  <Download className="h-5 w-5 text-green-400" />
                  Quick Recharge Generation
                </CardTitle>
                <CardDescription className="text-slate-400">
                  Generate recharge files for employees with one-click functionality
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="text-center py-8">
                  <div className="text-6xl mb-4 text-slate-600">
                    <Download className="h-16 w-16 mx-auto" />
                  </div>
                  <h3 className="text-xl font-semibold text-white mb-2">Quick Recharge</h3>
                  <p className="text-slate-400 mb-6">
                    Use the Provision tab for advanced recharge file generation with full control over employee selection and machine ID binding.
                  </p>
                  <Button 
                    onClick={() => setActiveTab('provision')}
                    className="bg-green-600 hover:bg-green-700 text-white"
                    size="lg"
                  >
                    Go to Provision Tab
                  </Button>
                </div>
              </CardContent>
            </Card>
          </TabsContent>

          {/* Settings Tab */}
          <TabsContent value="settings" className="space-y-6">
            <Card className="bg-slate-900 border-slate-800">
              <CardHeader>
                <CardTitle className="text-white flex items-center gap-2">
                  <Settings className="h-5 w-5 text-blue-400" />
                  Admin Settings
                </CardTitle>
                <CardDescription className="text-slate-400">
                  Configure system settings and preferences
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                  <div className="space-y-4">
                    <h4 className="text-lg font-semibold text-white mb-3">System Information</h4>
                    <div className="space-y-2">
                      <div className="flex justify-between">
                        <span className="text-slate-400">Version:</span>
                        <span className="text-white font-mono">v2.0.0</span>
                      </div>
                      <div className="flex justify-between">
                        <span className="text-slate-400">Environment:</span>
                        <Badge variant="secondary" className="bg-blue-600 text-white">
                          Production
                        </Badge>
                      </div>
                      <div className="flex justify-between">
                        <span className="text-slate-400">Shop ID:</span>
                        <span className="text-white font-mono">{user?.shopId}</span>
                      </div>
                    </div>
                  </div>
                  <div className="space-y-4">
                    <h4 className="text-lg font-semibold text-white mb-3">Security Settings</h4>
                    <div className="space-y-2">
                      <div className="flex justify-between items-center">
                        <span className="text-slate-400">Private Key:</span>
                        <Badge variant={privateKey ? "default" : "destructive"} className="bg-green-600 text-white">
                          {privateKey ? 'Loaded' : 'Not Loaded'}
                        </Badge>
                      </div>
                      <div className="flex justify-between">
                        <span className="text-slate-400">Auto Logout:</span>
                        <Badge variant="secondary">15 min</Badge>
                      </div>
                      <div className="flex justify-between">
                        <span className="text-slate-400">Session Timeout:</span>
                        <Badge variant="secondary">30 min</Badge>
                      </div>
                    </div>
                  </div>
                </div>
                
                <div className="pt-6 border-t border-slate-700">
                  <div className="flex items-center justify-between">
                    <div>
                      <h4 className="text-lg font-semibold text-white">Data Management</h4>
                      <p className="text-sm text-slate-400">Export or backup your admin data</p>
                    </div>
                    <Button onClick={handleExportData} variant="outline" className="border-slate-600 text-slate-300">
                      <Download className="h-4 w-4 mr-2" />
                      Export All Data
                    </Button>
                  </div>
                </div>
              </CardContent>
            </Card>
          </TabsContent>
        </Tabs>
      </div>
    </div>
  );
}
