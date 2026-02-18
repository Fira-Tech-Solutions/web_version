/**
 * Financial Monitor Component
 * Real-time financial data with employee management
 */
import { useState, useMemo } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent } from "@/components/ui/tabs";
import { useToast } from "@/hooks/use-toast";
import { useQuery } from "@tanstack/react-query";
import { 
  TrendingUp, 
  DollarSign, 
  Users, 
  Download,
  Eye,
  EyeOff,
  Copy,
  Search,
  Filter,
  Calendar,
  Shield
} from "lucide-react";

interface FinancialMonitorProps {
  employees: any[];
  onExportData: () => void;
}

export default function FinancialMonitor({ onExportData }: FinancialMonitorProps) {
  const [searchTerm, setSearchTerm] = useState("");
  const [showPasswords, setShowPasswords] = useState<Record<number, boolean>>({});
  const [selectedPeriod, setSelectedPeriod] = useState<'all' | 'today' | 'week' | 'month'>('all');
  const { toast } = useToast();

  // Fetch admin tracking data (separate from employee system)
  const { data: trackingData, isLoading: trackingLoading } = useQuery({
    queryKey: ["/api/admin/tracking-data"],
    enabled: true,
    staleTime: 300000 // Cache for 5 minutes
  });

  const employees = trackingData?.users || [];
  const financials = trackingData?.financials || {};

  const togglePasswordVisibility = (employeeId: number) => {
    setShowPasswords(prev => ({
      ...prev,
      [employeeId]: !prev[employeeId]
    }));
  };

  const copyToClipboard = async (text: string, type: string) => {
    try {
      await navigator.clipboard.writeText(text);
      toast({
        title: "Copied",
        description: `${type} copied to clipboard`
      });
    } catch {
      toast({
        title: "Copy Failed",
        description: `Failed to copy ${type}`,
        variant: "destructive"
      });
    }
  };

  // Memoize filtered employees to prevent excessive re-calculations
  const filteredEmployees = useMemo(() => {
    if (!employees || employees.length === 0) return [];
    
    return employees.filter(employee => {
      const matchesSearch = !searchTerm || 
        employee.name?.toLowerCase().includes(searchTerm.toLowerCase()) ||
        employee.username?.toLowerCase().includes(searchTerm.toLowerCase()) ||
        employee.accountNumber?.toLowerCase().includes(searchTerm.toLowerCase());
      
      return matchesSearch;
    });
  }, [employees, searchTerm]);

  // Use admin financial data directly
  const totalRevenue = useMemo(() => {
    const revenue = parseFloat(financials.totalAdminBalance || "0");
    return revenue;
  }, [financials]);

  const totalBalance = useMemo(() => {
    const balance = parseFloat(financials.totalAdminBalance || "0");
    return balance;
  }, [financials]);

  const totalCollected = useMemo(() => {
    const collected = parseFloat(financials.totalEmployeePaid || "0");
    return collected;
  }, [financials]);

  const maskPassword = (password: string) => {
    if (!password || password.length <= 2) return '•••••••••';
    return password.substring(0, 2) + '••••••••';
  };

  // Show loading state
  if (trackingLoading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600 border-t-transparent"></div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Revenue Overview */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-6">
        <Card className="border-l-4 border-l-green-500 bg-slate-900 border-slate-800">
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-slate-400 uppercase flex items-center gap-2">
              <TrendingUp className="w-4 h-4" />
              Total Revenue
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-white">${totalRevenue.toFixed(2)}</div>
            <p className="text-xs text-green-400 mt-1 font-medium">
              Generated balances (×10 multiplier)
            </p>
          </CardContent>
        </Card>

        <Card className="border-l-4 border-l-blue-500 bg-slate-900 border-slate-800">
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-slate-400 uppercase flex items-center gap-2">
              <DollarSign className="w-4 h-4" />
              Total Balance
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-white">${totalBalance.toFixed(2)}</div>
            <p className="text-xs text-blue-400 mt-1 font-medium">Admin-generated balances</p>
          </CardContent>
        </Card>

        <Card className="border-l-4 border-l-amber-500 bg-slate-900 border-slate-800">
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-slate-400 uppercase flex items-center gap-2">
              <DollarSign className="w-4 h-4" />
              Total Collected
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-white">${totalCollected.toFixed(2)}</div>
            <p className="text-xs text-amber-400 mt-1 font-medium">Employee payments received</p>
          </CardContent>
        </Card>

        <Card className="border-l-4 border-l-purple-500 bg-slate-900 border-slate-800">
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-slate-400 uppercase flex items-center gap-2">
              <Users className="w-3 h-3" />
              Active Staff
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-white">{employees.length}</div>
            <p className="text-xs text-purple-400 mt-1 font-medium">Registered accounts</p>
          </CardContent>
        </Card>
      </div>

      {/* Period Filter */}
      <Card className="bg-slate-900 border-slate-800">
        <CardHeader>
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <Calendar className="h-5 w-5 text-blue-500" />
              <CardTitle>Revenue Tracking</CardTitle>
            </div>
            <div className="flex gap-2">
              <Button
                variant={selectedPeriod === 'today' ? 'default' : 'outline'}
                size="sm"
                onClick={() => setSelectedPeriod('today')}
              >
                Today
              </Button>
              <Button
                variant={selectedPeriod === 'week' ? 'default' : 'outline'}
                size="sm"
                onClick={() => setSelectedPeriod('week')}
              >
                Week
              </Button>
              <Button
                variant={selectedPeriod === 'month' ? 'default' : 'outline'}
                size="sm"
                onClick={() => setSelectedPeriod('month')}
              >
                Month
              </Button>
              <Button
                variant={selectedPeriod === 'all' ? 'default' : 'outline'}
                size="sm"
                onClick={() => setSelectedPeriod('all')}
              >
                All Time
              </Button>
            </div>
          </div>
        </CardHeader>
        <CardContent>
          <div className="flex items-center gap-4">
            <div className="flex items-center gap-2">
              <Search className="h-4 w-4 text-slate-400" />
              <Input
                placeholder="Search employees..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="bg-slate-800 border-slate-700 text-white placeholder:text-slate-400"
              />
            </div>
            {onExportData && (
              <Button onClick={onExportData} variant="outline" size="sm">
                <Download className="h-4 w-4 mr-2" />
                Export Data
              </Button>
            )}
          </div>
        </CardContent>
      </Card>

      {/* Employee Management */}
      <Card className="bg-slate-900 border-slate-800">
        <CardHeader>
          <CardTitle className="text-white">Employee Management</CardTitle>
          <CardDescription className="text-slate-400">
            Manage employee accounts with secure password handling
          </CardDescription>
        </CardHeader>
        <CardContent>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Name</TableHead>
                <TableHead>Account Number</TableHead>
                <TableHead>Admin Balance</TableHead>
                <TableHead>Employee Paid</TableHead>
                <TableHead>Status</TableHead>
                <TableHead>Password</TableHead>
                <TableHead>Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {filteredEmployees.slice(0, 10).map((emp) => (
                <TableRow key={emp.id}>
                  <TableCell className="font-medium">{emp.name}</TableCell>
                  <TableCell className="font-mono text-sm">{emp.accountNumber}</TableCell>
                  <TableCell className="text-blue-600 font-bold">${emp.adminGeneratedBalance || '0.00'}</TableCell>
                  <TableCell className="text-green-600 font-bold">${emp.employeePaidAmount || '0.00'}</TableCell>
                  <TableCell>
                    <Badge variant={emp.isBlocked ? "destructive" : "secondary"}>
                      {emp.isBlocked ? "Blocked" : "Active"}
                    </Badge>
                  </TableCell>
                  <TableCell>
                    <div className="flex items-center gap-2">
                      <span className="font-mono text-sm bg-slate-800 px-2 py-1 rounded">
                        {showPasswords[emp.id] ? emp.password || 'N/A' : maskPassword(emp.password || 'N/A')}
                      </span>
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => togglePasswordVisibility(emp.id)}
                        className="h-6 w-6 p-0"
                      >
                        {showPasswords[emp.id] ? <EyeOff className="h-3 w-3" /> : <Eye className="h-3 w-3" />}
                      </Button>
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => copyToClipboard(emp.password || '', 'Password')}
                        className="h-6 w-6 p-0"
                      >
                        <Copy className="h-3 w-3" />
                      </Button>
                    </div>
                  </TableCell>
                  <TableCell>
                    <div className="flex gap-1">
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => copyToClipboard(emp.accountNumber, 'Account Number')}
                        className="border-slate-600 text-slate-300"
                      >
                        <Copy className="h-3 w-3" />
                      </Button>
                    </div>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
          
          {filteredEmployees.length > 10 && (
            <div className="text-center mt-4 text-slate-400">
              Showing 10 of {filteredEmployees.length} employees
            </div>
          )}
        </CardContent>
      </Card>

      {/* Security Notice */}
      <Card className="border-amber-200 bg-amber-50">
        <CardHeader>
          <div className="flex items-center gap-2">
            <Shield className="h-5 w-5 text-amber-600" />
            <CardTitle className="text-amber-800">Security Notice</CardTitle>
          </div>
        </CardHeader>
        <CardContent>
          <div className="space-y-2 text-sm text-amber-700">
            <p>• Passwords are masked for security</p>
            <p>• Copy functionality available for sensitive data</p>
            <p>• All changes are logged for audit purposes</p>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
