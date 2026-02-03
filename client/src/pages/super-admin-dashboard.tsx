import { useState } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import { useToast } from "@/hooks/use-toast";
import { DollarSign, Users, Calendar, TrendingUp, Download, RefreshCw, XCircle, Filter, User, Plus, Edit, Settings } from "lucide-react";
import { queryClient } from "@/lib/queryClient";

const formatCurrency = (amount: string | number) => {
  const num = typeof amount === 'string' ? parseFloat(amount) : amount;
  return new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency: 'ETB',
    minimumFractionDigits: 2,
  }).format(num);
};

interface SuperAdminRevenue {
  id: number;
  amount: string;
  adminId: number;
  adminName: string;
  gameId: number;
  dateEAT: string;
  createdAt: string;
}

interface DailyRevenueSummary {
  id: number;
  date: string;
  totalSuperAdminRevenue: string;
  totalAdminRevenue: string;
  totalGamesPlayed: number;
  totalPlayersRegistered: number;
  createdAt: string;
  updatedAt: string;
}

interface CreditLoad {
  id: number;
  adminId: number;
  amount: string;
  paymentMethod: string;
  referenceNumber?: string;
  transferScreenshot?: string;
  adminAccountNumber?: string;
  notes?: string;
  status: string;
  processedBy?: number;
  processedAt?: string;
  requestedAt: string;
  admin?: {
    id: number;
    name: string;
    username: string;
    accountNumber: string;
  };
}

interface WithdrawalRequest {
  id: number;
  adminId: number;
  amount: string;
  bankAccount: string;
  type: string;
  status: string;
  processedBy?: number;
  processedAt?: string;
  rejectionReason?: string;
  createdAt: string;
  adminName?: string;
}

interface SuperAdminDashboardProps {
  onLogout?: () => void;
}

export default function SuperAdminDashboard({ onLogout }: SuperAdminDashboardProps) {
  const { toast } = useToast();
  const [activeTab, setActiveTab] = useState("overview");
  const [dateFrom, setDateFrom] = useState("");
  const [dateTo, setDateTo] = useState("");
  const [selectedAdminFilter, setSelectedAdminFilter] = useState("");
  const [showLowCreditOnly, setShowLowCreditOnly] = useState(false);
  const [selectedScreenshot, setSelectedScreenshot] = useState<string | null>(null);
  const [showAddAdmin, setShowAddAdmin] = useState(false);
  const [editingAdmin, setEditingAdmin] = useState<any>(null);

  // Get current EAT date
  const { data: currentDate } = useQuery({
    queryKey: ["/api/super-admin/current-eat-date"],
  });

  // Get admins with credit balances
  const { data: admins = [], isLoading: adminsLoading, refetch: refetchAdmins } = useQuery({
    queryKey: ["/api/super-admin/admins"],
    queryFn: async () => {
      const response = await fetch("/api/super-admin/admins");
      if (!response.ok) throw new Error("Failed to fetch admins");
      return response.json();
    },
  });

  // Get Super Admin revenues with date and admin filtering
  const { data: revenues = [], isLoading: revenuesLoading, refetch: refetchRevenues } = useQuery({
    queryKey: ["/api/super-admin/revenues", dateFrom, dateTo, selectedAdminFilter],
    queryFn: async () => {
      const params = new URLSearchParams();
      if (dateFrom) params.append("dateFrom", dateFrom);
      if (dateTo) params.append("dateTo", dateTo);
      if (selectedAdminFilter) params.append("adminId", selectedAdminFilter);
      
      const response = await fetch(`/api/super-admin/revenues?${params}`);
      if (!response.ok) throw new Error("Failed to fetch revenues");
      return response.json();
    },
  });

  // Get total revenue
  const { data: totalRevenue } = useQuery({
    queryKey: ["/api/super-admin/revenue-total", dateFrom, dateTo],
    queryFn: async () => {
      const params = new URLSearchParams();
      if (dateFrom) params.append("dateFrom", dateFrom);
      if (dateTo) params.append("dateTo", dateTo);
      
      const response = await fetch(`/api/super-admin/revenue-total?${params}`);
      if (!response.ok) throw new Error("Failed to fetch total revenue");
      return response.json();
    },
  });

  // Get daily summaries
  const { data: dailySummaries = [] } = useQuery({
    queryKey: ["/api/super-admin/daily-summaries", dateFrom, dateTo],
    queryFn: async () => {
      const params = new URLSearchParams();
      if (dateFrom) params.append("dateFrom", dateFrom);
      if (dateTo) params.append("dateTo", dateTo);
      
      const response = await fetch(`/api/super-admin/daily-summaries?${params}`);
      if (!response.ok) throw new Error("Failed to fetch daily summaries");
      return response.json();
    },
  });

  // Get pending credit requests
  const { data: creditRequests = [], isLoading: creditRequestsLoading, refetch: refetchCreditRequests } = useQuery({
    queryKey: ["/api/admin/credit-loads"],
    queryFn: async () => {
      const response = await fetch("/api/admin/credit-loads");
      if (!response.ok) throw new Error("Failed to fetch credit requests");
      return response.json();
    },
  });

  // Get withdrawal requests
  const { data: withdrawalRequests = [], isLoading: withdrawalsLoading, refetch: refetchWithdrawals } = useQuery({
    queryKey: ["/api/withdrawal-requests"],
    queryFn: async () => {
      const response = await fetch("/api/withdrawal-requests");
      if (!response.ok) throw new Error("Failed to fetch withdrawal requests");
      return response.json();
    },
  });

  // Filter handling functions
  const handleDateFilter = () => {
    refetchRevenues();
    queryClient.invalidateQueries({ queryKey: ["/api/super-admin/revenue-total"] });
    queryClient.invalidateQueries({ queryKey: ["/api/super-admin/daily-summaries"] });
  };

  const clearDateFilter = () => {
    setDateFrom("");
    setDateTo("");
    setSelectedAdminFilter("");
    refetchRevenues();
    queryClient.invalidateQueries({ queryKey: ["/api/super-admin/revenue-total"] });
    queryClient.invalidateQueries({ queryKey: ["/api/super-admin/daily-summaries"] });
  };

  // Daily reset mutation
  const dailyResetMutation = useMutation({
    mutationFn: async () => {
      const response = await fetch("/api/super-admin/daily-reset", {
        method: "POST",
      });
      if (!response.ok) throw new Error("Failed to perform daily reset");
      return response.json();
    },
    onSuccess: () => {
      toast({
        title: "Daily Reset Complete",
        description: "All daily data has been reset successfully.",
      });
      refetchRevenues();
      queryClient.invalidateQueries({ queryKey: ["/api/super-admin/revenue-total"] });
      queryClient.invalidateQueries({ queryKey: ["/api/super-admin/daily-summaries"] });
    },
    onError: (error) => {
      toast({
        title: "Reset Failed",
        description: error.message,
        variant: "destructive",
      });
    },
  });

  // Credit load mutations
  const approveCreditMutation = useMutation({
    mutationFn: async (loadId: number) => {
      const response = await fetch(`/api/admin/credit-loads/${loadId}/approve`, {
        method: "PATCH",
      });
      if (!response.ok) throw new Error("Failed to approve credit load");
      return response.json();
    },
    onSuccess: () => {
      toast({
        title: "Credit Load Approved",
        description: "Credit has been added to admin account.",
      });
      refetchCreditRequests();
      refetchAdmins();
    },
  });

  const rejectCreditMutation = useMutation({
    mutationFn: async (loadId: number) => {
      const response = await fetch(`/api/admin/credit-loads/${loadId}/reject`, {
        method: "PATCH",
      });
      if (!response.ok) throw new Error("Failed to reject credit load");
      return response.json();
    },
    onSuccess: () => {
      toast({
        title: "Credit Load Rejected",
        description: "Credit load request has been rejected.",
      });
      refetchCreditRequests();
    },
  });

  // Withdrawal mutations
  const approveWithdrawalMutation = useMutation({
    mutationFn: async (requestId: number) => {
      const response = await fetch(`/api/withdrawal-requests/${requestId}/approve`, {
        method: "PATCH",
      });
      if (!response.ok) throw new Error("Failed to approve withdrawal");
      return response.json();
    },
    onSuccess: () => {
      toast({
        title: "Withdrawal Approved",
        description: "Withdrawal request has been approved.",
      });
      refetchWithdrawals();
    },
  });

  const rejectWithdrawalMutation = useMutation({
    mutationFn: async (requestId: number) => {
      const response = await fetch(`/api/withdrawal-requests/${requestId}/reject`, {
        method: "PATCH",
      });
      if (!response.ok) throw new Error("Failed to reject withdrawal");
      return response.json();
    },
    onSuccess: () => {
      toast({
        title: "Withdrawal Rejected",
        description: "Withdrawal request has been rejected.",
      });
      refetchWithdrawals();
    },
  });

  // Admin management mutations
  const createAdminMutation = useMutation({
    mutationFn: async (adminData: any) => {
      const response = await fetch("/api/super-admin/admins", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(adminData),
      });
      if (!response.ok) throw new Error("Failed to create admin");
      return response.json();
    },
    onSuccess: () => {
      toast({
        title: "Admin Created",
        description: "New admin has been created successfully.",
      });
      setShowAddAdmin(false);
      refetchAdmins();
    },
  });

  const updateAdminMutation = useMutation({
    mutationFn: async ({ adminId, data }: { adminId: number; data: any }) => {
      const response = await fetch(`/api/super-admin/admins/${adminId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(data),
      });
      if (!response.ok) throw new Error("Failed to update admin");
      return response.json();
    },
    onSuccess: () => {
      toast({
        title: "Admin Updated",
        description: "Admin has been updated successfully.",
      });
      setEditingAdmin(null);
      refetchAdmins();
    },
  });

  const toggleAdminStatusMutation = useMutation({
    mutationFn: async ({ adminId, action }: { adminId: number; action: string }) => {
      const response = await fetch(`/api/super-admin/admins/${adminId}/${action}`, {
        method: "PATCH",
      });
      if (!response.ok) throw new Error(`Failed to ${action} admin`);
      return response.json();
    },
    onSuccess: () => {
      toast({
        title: "Admin Status Updated",
        description: "Admin status has been updated successfully.",
      });
      refetchAdmins();
    },
  });

  const totalRevenueAmount = (totalRevenue as any)?.total || "0";

  // Admin Form Component
  const AdminForm = ({ admin, onSubmit, onCancel, isSubmitting }: {
    admin?: any;
    onSubmit: (data: any) => void;
    onCancel: () => void;
    isSubmitting: boolean;
  }) => {
    const [formData, setFormData] = useState({
      name: admin?.name || '',
      username: admin?.username || '',
      password: '',
      shopName: admin?.shopName || '',
      commissionRate: admin?.commissionRate || '15',
      email: admin?.email || '',
      referredBy: admin?.referredBy || '',
      referralCommissionRate: admin?.referralCommissionRate || '5',
    });

    const handleSubmit = (e: React.FormEvent) => {
      e.preventDefault();
      onSubmit(formData);
    };

    return (
      <form onSubmit={handleSubmit} className="space-y-4">
        <div>
          <Label htmlFor="name">Full Name</Label>
          <Input
            id="name"
            value={formData.name}
            onChange={(e) => setFormData({ ...formData, name: e.target.value })}
            required
          />
        </div>
        <div>
          <Label htmlFor="username">Username</Label>
          <Input
            id="username"
            value={formData.username}
            onChange={(e) => setFormData({ ...formData, username: e.target.value })}
            required
          />
        </div>
        <div>
          <Label htmlFor="password">{admin ? 'New Password (leave empty to keep current)' : 'Password'}</Label>
          <Input
            id="password"
            type="password"
            value={formData.password}
            onChange={(e) => setFormData({ ...formData, password: e.target.value })}
            required={!admin}
          />
        </div>
        <div>
          <Label htmlFor="shopName">Shop Name</Label>
          <Input
            id="shopName"
            value={formData.shopName}
            onChange={(e) => setFormData({ ...formData, shopName: e.target.value })}
            required
          />
        </div>
        <div>
          <Label htmlFor="commissionRate">Commission Rate (%)</Label>
          <Input
            id="commissionRate"
            type="number"
            min="0"
            max="100"
            step="0.01"
            value={formData.commissionRate}
            onChange={(e) => setFormData({ ...formData, commissionRate: e.target.value })}
            required
          />
        </div>
        <div>
          <Label htmlFor="email">Email (Optional)</Label>
          <Input
            id="email"
            type="email"
            value={formData.email}
            onChange={(e) => setFormData({ ...formData, email: e.target.value })}
          />
        </div>
        <div>
          <Label htmlFor="referredBy">Referred By Admin ID (Optional)</Label>
          <select
            id="referredBy"
            value={formData.referredBy}
            onChange={(e) => setFormData({ ...formData, referredBy: e.target.value })}
            className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
          >
            <option value="">No Referrer</option>
            {(admins as any[]).map((admin: any) => (
              <option key={admin.id} value={admin.id.toString()}>
                {admin.name} ({admin.username})
              </option>
            ))}
          </select>
        </div>
        <div>
          <Label htmlFor="referralCommissionRate">Referral Commission Rate (%)</Label>
          <Input
            id="referralCommissionRate"
            type="number"
            min="0"
            max="100"
            step="0.01"
            value={formData.referralCommissionRate}
            onChange={(e) => setFormData({ ...formData, referralCommissionRate: e.target.value })}
            placeholder="5.00"
          />
        </div>
        <div className="flex gap-2 pt-4">
          <Button type="submit" disabled={isSubmitting}>
            {admin ? 'Update Admin' : 'Create Admin'}
          </Button>
          <Button type="button" variant="outline" onClick={onCancel}>
            Cancel
          </Button>
        </div>
      </form>
    );
  };

  return (
    <div className="min-h-screen bg-gray-50 dark:bg-gray-900">
      <div className="bg-white dark:bg-gray-800 shadow-sm border-b">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex justify-between items-center py-4">
            <div>
              <h1 className="text-2xl font-bold text-gray-900 dark:text-white">
                Super Admin Dashboard
              </h1>
              <p className="text-sm text-gray-500 dark:text-gray-400">
                Current EAT Date: {(currentDate as any)?.date || "Loading..."}
              </p>
            </div>
            <div className="flex items-center gap-4">
              <Button
                onClick={() => dailyResetMutation.mutate()}
                disabled={dailyResetMutation.isPending}
                variant="outline"
                size="sm"
              >
                <RefreshCw className="w-4 h-4 mr-2" />
                Daily Reset
              </Button>
              {onLogout && (
                <Button onClick={onLogout} variant="outline" size="sm">
                  Logout
                </Button>
              )}
            </div>
          </div>
        </div>
      </div>

      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {/* Navigation Tabs */}
        <div className="mb-8">
          <div className="border-b border-gray-200 dark:border-gray-700">
            <nav className="-mb-px flex space-x-8">
              {[
                { id: "overview", label: "Overview", icon: TrendingUp },
                { id: "admins", label: "Admin Management", icon: Users },
                { id: "credits", label: "Credit Requests", icon: DollarSign },
                { id: "withdrawals", label: "Withdrawals", icon: Download },
              ].map(({ id, label, icon: Icon }) => (
                <button
                  key={id}
                  onClick={() => setActiveTab(id)}
                  className={`flex items-center gap-2 py-2 px-1 border-b-2 font-medium text-sm ${
                    activeTab === id
                      ? "border-blue-500 text-blue-600"
                      : "border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300"
                  }`}
                >
                  <Icon className="w-4 h-4" />
                  {label}
                </button>
              ))}
            </nav>
          </div>
        </div>

        {activeTab === "overview" && (
          <div className="space-y-6">
            {/* Date Filter Controls */}
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Filter className="w-5 h-5" />
                  Revenue Filters
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
                  <div>
                    <Label htmlFor="dateFrom">From Date</Label>
                    <Input
                      id="dateFrom"
                      type="date"
                      value={dateFrom}
                      onChange={(e) => setDateFrom(e.target.value)}
                    />
                  </div>
                  <div>
                    <Label htmlFor="dateTo">To Date</Label>
                    <Input
                      id="dateTo"
                      type="date"
                      value={dateTo}
                      onChange={(e) => setDateTo(e.target.value)}
                    />
                  </div>
                  <div>
                    <Label htmlFor="adminFilter">Filter by Admin</Label>
                    <select
                      id="adminFilter"
                      value={selectedAdminFilter}
                      onChange={(e) => setSelectedAdminFilter(e.target.value)}
                      className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                    >
                      <option value="">All Admins</option>
                      {(admins as any[]).map((admin: any) => (
                        <option key={admin.id} value={admin.id.toString()}>
                          {admin.name} ({admin.username})
                        </option>
                      ))}
                    </select>
                  </div>
                  <div className="flex items-end gap-2">
                    <Button onClick={handleDateFilter} size="sm">
                      Apply Filter
                    </Button>
                    <Button onClick={clearDateFilter} variant="outline" size="sm">
                      Clear
                    </Button>
                  </div>
                </div>
              </CardContent>
            </Card>

            {/* Summary Cards */}
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
              <Card className="bg-gradient-to-r from-green-500 to-green-600 text-white">
                <CardHeader className="pb-2">
                  <CardTitle className="text-sm font-medium flex items-center gap-2">
                    <DollarSign className="w-4 h-4" />
                    Total Revenue
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="text-2xl font-bold">
                    {formatCurrency(totalRevenueAmount)}
                  </div>
                </CardContent>
              </Card>

              <Card className="bg-gradient-to-r from-blue-500 to-blue-600 text-white">
                <CardHeader className="pb-2">
                  <CardTitle className="text-sm font-medium flex items-center gap-2">
                    <Users className="w-4 h-4" />
                    Total Admins
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="text-2xl font-bold">
                    {(admins as any[]).length}
                  </div>
                </CardContent>
              </Card>

              <Card className="bg-gradient-to-r from-purple-500 to-purple-600 text-white">
                <CardHeader className="pb-2">
                  <CardTitle className="text-sm font-medium flex items-center gap-2">
                    <Calendar className="w-4 h-4" />
                    Revenue Entries
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="text-2xl font-bold">
                    {(revenues as any[]).length}
                  </div>
                </CardContent>
              </Card>

              <Card className="bg-gradient-to-r from-orange-500 to-orange-600 text-white">
                <CardHeader className="pb-2">
                  <CardTitle className="text-sm font-medium flex items-center gap-2">
                    <TrendingUp className="w-4 h-4" />
                    Low Credit Admins
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="text-2xl font-bold">
                    {(admins as any[]).filter((admin: any) => parseFloat(admin.creditBalance || '0') < 100).length}
                  </div>
                </CardContent>
              </Card>
            </div>

            {/* Revenue Logs */}
            <Card>
              <CardHeader>
                <CardTitle>Recent Revenue Logs</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="overflow-x-auto">
                  <table className="w-full text-sm">
                    <thead>
                      <tr className="border-b">
                        <th className="text-left p-2">Date</th>
                        <th className="text-left p-2">Admin</th>
                        <th className="text-left p-2">Game ID</th>
                        <th className="text-left p-2">Amount</th>
                      </tr>
                    </thead>
                    <tbody>
                      {(revenues as any[]).slice(0, 10).map((revenue: any) => (
                        <tr key={revenue.id} className="border-b hover:bg-gray-50">
                          <td className="p-2">{revenue.dateEAT}</td>
                          <td className="p-2">{revenue.adminName}</td>
                          <td className="p-2">#{revenue.gameId}</td>
                          <td className="p-2">{formatCurrency(revenue.amount)}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </CardContent>
            </Card>
          </div>
        )}

        {activeTab === "admins" && (
          <div className="space-y-6">
            <Card>
              <CardHeader>
                <div className="flex justify-between items-center">
                  <CardTitle>Admin Management</CardTitle>
                  <div className="flex items-center gap-4">
                    <Button
                      onClick={() => setShowAddAdmin(true)}
                      size="sm"
                      className="flex items-center gap-2"
                    >
                      <Plus className="w-4 h-4" />
                      Add New Admin
                    </Button>
                    <label className="flex items-center gap-2 text-sm">
                      <input
                        type="checkbox"
                        checked={showLowCreditOnly}
                        onChange={(e) => setShowLowCreditOnly(e.target.checked)}
                        className="rounded"
                      />
                      Show only admins with low credit balance (&lt; 100 ETB)
                    </label>
                  </div>
                </div>
              </CardHeader>
              <CardContent>
                <div className="space-y-4">
                  {(showLowCreditOnly 
                    ? (admins as any[]).filter((admin: any) => parseFloat(admin.creditBalance || '0') < 100)
                    : (admins as any[])
                  ).map((admin: any) => {
                    const creditBalance = parseFloat(admin.creditBalance || '0');
                    const isLowCredit = creditBalance < 100;
                    
                    return (
                      <div key={admin.id} className={`border rounded-lg p-4 ${isLowCredit ? 'border-red-300 bg-red-50' : ''}`}>
                        <div className="flex justify-between items-start">
                          <div className="flex-1">
                            <div className="flex items-center gap-3">
                              <div className="font-medium">{admin.name}</div>
                              <Badge variant={admin.isBlocked ? "destructive" : "default"}>
                                {admin.isBlocked ? "Blocked" : "Active"}
                              </Badge>
                              {isLowCredit && (
                                <Badge variant="destructive" className="text-xs">
                                  Low Credit
                                </Badge>
                              )}
                            </div>
                            <div className="text-sm text-gray-500 mt-1">
                              Username: {admin.username} • Account: {admin.accountNumber}
                            </div>
                            <div className={`text-sm ${isLowCredit ? 'text-red-600 font-semibold' : 'text-gray-500'}`}>
                              Credit Balance: {formatCurrency(admin.creditBalance || '0')}
                            </div>
                            <div className="text-sm text-gray-500">
                              Shop: {admin.shopName || 'No Shop Assigned'}
                            </div>
                            <div className="text-sm text-gray-500">
                              Commission Rate: {admin.commissionRate || '15'}%
                            </div>
                            {admin.email && (
                              <div className="text-sm text-gray-500">Email: {admin.email}</div>
                            )}
                          </div>
                          <div className="flex gap-2">
                            <Button
                              size="sm"
                              variant="outline"
                              onClick={() => setEditingAdmin(admin)}
                            >
                              <Edit className="w-4 h-4 mr-1" />
                              Edit
                            </Button>
                            <Button
                              size="sm"
                              variant={admin.isBlocked ? "default" : "destructive"}
                              onClick={() => toggleAdminStatusMutation.mutate({
                                adminId: admin.id,
                                action: admin.isBlocked ? 'unblock' : 'block'
                              })}
                              disabled={toggleAdminStatusMutation.isPending}
                            >
                              {admin.isBlocked ? 'Unblock' : 'Block'}
                            </Button>
                          </div>
                        </div>
                      </div>
                    );
                  })}
                </div>
              </CardContent>
            </Card>
          </div>
        )}

        {activeTab === "credits" && (
          <div className="space-y-6">
            <Card>
              <CardHeader>
                <CardTitle>Credit Load Requests</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="space-y-4">
                  {(creditRequests as any[]).filter((req: any) => req.status === 'pending').map((request: any) => (
                    <div key={request.id} className="border rounded-lg p-4">
                      <div className="flex justify-between items-start">
                        <div className="flex-1">
                          <div className="font-medium">{request.admin?.name}</div>
                          <div className="text-sm text-gray-500">
                            Amount: {formatCurrency(request.amount)}
                          </div>
                          <div className="text-sm text-gray-500">
                            Method: {request.paymentMethod}
                          </div>
                          {request.referenceNumber && (
                            <div className="text-sm text-gray-500">
                              Reference: {request.referenceNumber}
                            </div>
                          )}
                          {request.transferScreenshot && (
                            <Button
                              size="sm"
                              variant="outline"
                              onClick={() => setSelectedScreenshot(request.transferScreenshot)}
                              className="mt-2"
                            >
                              View Screenshot
                            </Button>
                          )}
                        </div>
                        <div className="flex gap-2">
                          <Button
                            size="sm"
                            onClick={() => approveCreditMutation.mutate(request.id)}
                            disabled={approveCreditMutation.isPending}
                          >
                            Approve
                          </Button>
                          <Button
                            size="sm"
                            variant="destructive"
                            onClick={() => rejectCreditMutation.mutate(request.id)}
                            disabled={rejectCreditMutation.isPending}
                          >
                            Reject
                          </Button>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>
          </div>
        )}

        {activeTab === "withdrawals" && (
          <div className="space-y-6">
            <Card>
              <CardHeader>
                <CardTitle>Withdrawal Requests</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="space-y-4">
                  {(withdrawalRequests as any[]).filter((req: any) => req.status === 'pending').map((request: any) => (
                    <div key={request.id} className="border rounded-lg p-4">
                      <div className="flex justify-between items-start">
                        <div className="flex-1">
                          <div className="font-medium">{request.adminName}</div>
                          <div className="text-sm text-gray-500">
                            Amount: {formatCurrency(request.amount)}
                          </div>
                          <div className="text-sm text-gray-500">
                            Bank Account: {request.bankAccount}
                          </div>
                          <div className="text-sm text-gray-500">
                            Type: {request.type}
                          </div>
                        </div>
                        <div className="flex gap-2">
                          <Button
                            size="sm"
                            onClick={() => approveWithdrawalMutation.mutate(request.id)}
                            disabled={approveWithdrawalMutation.isPending}
                          >
                            Approve
                          </Button>
                          <Button
                            size="sm"
                            variant="destructive"
                            onClick={() => rejectWithdrawalMutation.mutate(request.id)}
                            disabled={rejectWithdrawalMutation.isPending}
                          >
                            Reject
                          </Button>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>
          </div>
        )}

        {/* Admin Form Modal */}
        {(showAddAdmin || editingAdmin) && (
          <div className="fixed inset-0 bg-black bg-opacity-50 z-50 flex items-center justify-center p-4">
            <div className="bg-white dark:bg-gray-800 rounded-lg max-w-md w-full max-h-[90vh] overflow-auto">
              <div className="p-6">
                <h3 className="text-lg font-semibold mb-4">
                  {editingAdmin ? 'Edit Admin' : 'Add New Admin'}
                </h3>
                <AdminForm
                  admin={editingAdmin}
                  onSubmit={(data) => {
                    if (editingAdmin) {
                      updateAdminMutation.mutate({ adminId: editingAdmin.id, data });
                    } else {
                      createAdminMutation.mutate(data);
                    }
                  }}
                  onCancel={() => {
                    setShowAddAdmin(false);
                    setEditingAdmin(null);
                  }}
                  isSubmitting={createAdminMutation.isPending || updateAdminMutation.isPending}
                />
              </div>
            </div>
          </div>
        )}

        {/* Screenshot Modal */}
        {selectedScreenshot && (
          <div className="fixed inset-0 bg-black bg-opacity-50 z-50 flex items-center justify-center p-4">
            <div className="bg-white dark:bg-gray-800 rounded-lg max-w-2xl w-full max-h-[90vh] overflow-auto">
              <div className="flex justify-between items-center p-4 border-b">
                <h3 className="text-lg font-semibold">Transfer Screenshot</h3>
                <Button
                  size="sm"
                  variant="ghost"
                  onClick={() => setSelectedScreenshot(null)}
                >
                  <XCircle className="w-4 h-4" />
                  Close
                </Button>
              </div>
              <div className="p-4">
                <img
                  src={selectedScreenshot}
                  alt="Transfer Screenshot"
                  className="max-w-full h-auto rounded-lg"
                />
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}