import { useQuery } from "@tanstack/react-query";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { ArrowDownLeft, ArrowUpRight, RefreshCw, Filter, TrendingUp, TrendingDown } from "lucide-react";
import { format } from "date-fns";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useState } from "react";

interface CreditTransfer {
  id: number;
  fromAdminId: number;
  toAdminId: number;
  amount: string;
  description?: string;
  status: string;
  createdAt: string;
  fromAdmin?: {
    name: string;
    username: string;
    accountNumber: string;
  };
  toAdmin?: {
    name: string;
    username: string;
    accountNumber: string;
  };
}

interface AdminCreditTransferHistoryProps {
  adminId: number;
}

export function AdminCreditTransferHistory({ adminId }: AdminCreditTransferHistoryProps) {
  const [filterType, setFilterType] = useState<string>("all");
  
  const { data: transfers = [], isLoading, refetch } = useQuery({
    queryKey: ['credit-transfers', adminId],
    queryFn: async () => {
      const response = await fetch(`/api/credit/transfers`);
      if (!response.ok) throw new Error('Failed to fetch credit transfers');
      return response.json();
    }
  });

  // Get current admin info from auth context or props
  const { data: currentAdmin } = useQuery({
    queryKey: ['/api/auth/me'],
    enabled: true
  });

  // Filter transfers based on selected type
  const filteredTransfers = transfers.filter((transfer: CreditTransfer) => {
    if (filterType === "sent") return transfer.fromAdminId === adminId;
    if (filterType === "received") return transfer.toAdminId === adminId;
    return true; // "all"
  });

  // Calculate summary statistics
  const sentTransfers = transfers.filter((t: CreditTransfer) => t.fromAdminId === adminId);
  const receivedTransfers = transfers.filter((t: CreditTransfer) => t.toAdminId === adminId);
  
  const totalSent = sentTransfers.reduce((sum, t) => sum + parseFloat(t.amount), 0);
  const totalReceived = receivedTransfers.reduce((sum, t) => sum + parseFloat(t.amount), 0);
  const netAmount = totalReceived - totalSent;

  const formatAmount = (amount: string) => {
    return new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency: 'ETB',
      minimumFractionDigits: 2,
    }).format(parseFloat(amount));
  };

  const getTransferIcon = (transfer: CreditTransfer) => {
    const isReceived = transfer.toAdminId === adminId;
    return isReceived ? (
      <ArrowDownLeft className="h-4 w-4 text-green-600" />
    ) : (
      <ArrowUpRight className="h-4 w-4 text-red-600" />
    );
  };

  const getTransferLabel = (transfer: CreditTransfer) => {
    const isReceived = transfer.toAdminId === adminId;
    return isReceived ? "Received" : "Sent";
  };

  const getTransferDetails = (transfer: CreditTransfer) => {
    const isReceived = transfer.toAdminId === adminId;
    if (isReceived) {
      return {
        label: "From",
        name: transfer.fromAdmin?.name || "Unknown",
        accountNumber: transfer.fromAdmin?.accountNumber || "N/A"
      };
    } else {
      return {
        label: "To",
        name: transfer.toAdmin?.name || "Unknown",
        accountNumber: transfer.toAdmin?.accountNumber || "N/A"
      };
    }
  };

  if (isLoading) {
    return (
      <Card className="w-full">
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <RefreshCw className="h-4 w-4 animate-spin" />
            Loading Transfer History...
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="space-y-4">
            {[1, 2, 3].map((i) => (
              <div key={i} className="animate-pulse bg-gray-200 dark:bg-gray-800 h-16 rounded"></div>
            ))}
          </div>
        </CardContent>
      </Card>
    );
  }

  const currentAdminName = (currentAdmin as any)?.user?.name || "Unknown Admin";
  const currentAdminAccount = (currentAdmin as any)?.user?.accountNumber || "";

  return (
    <div className="space-y-4">
      {/* Summary Statistics */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <Card className="bg-blue-50 dark:bg-blue-900/20 border-blue-200 dark:border-blue-800">
          <CardContent className="p-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-blue-600 dark:text-blue-400">Total Sent</p>
                <p className="text-2xl font-bold text-blue-800 dark:text-blue-200">
                  {formatAmount(totalSent.toString())}
                </p>
                <p className="text-xs text-blue-600 dark:text-blue-400">{sentTransfers.length} transfers</p>
              </div>
              <TrendingUp className="h-8 w-8 text-blue-600 dark:text-blue-400" />
            </div>
          </CardContent>
        </Card>

        <Card className="bg-green-50 dark:bg-green-900/20 border-green-200 dark:border-green-800">
          <CardContent className="p-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-green-600 dark:text-green-400">Total Received</p>
                <p className="text-2xl font-bold text-green-800 dark:text-green-200">
                  {formatAmount(totalReceived.toString())}
                </p>
                <p className="text-xs text-green-600 dark:text-green-400">{receivedTransfers.length} transfers</p>
              </div>
              <TrendingDown className="h-8 w-8 text-green-600 dark:text-green-400" />
            </div>
          </CardContent>
        </Card>

        <Card className={`${netAmount >= 0 ? 'bg-green-50 dark:bg-green-900/20 border-green-200 dark:border-green-800' : 'bg-red-50 dark:bg-red-900/20 border-red-200 dark:border-red-800'}`}>
          <CardContent className="p-4">
            <div className="flex items-center justify-between">
              <div>
                <p className={`text-sm font-medium ${netAmount >= 0 ? 'text-green-600 dark:text-green-400' : 'text-red-600 dark:text-red-400'}`}>
                  Net Amount
                </p>
                <p className={`text-2xl font-bold ${netAmount >= 0 ? 'text-green-800 dark:text-green-200' : 'text-red-800 dark:text-red-200'}`}>
                  {netAmount >= 0 ? '+' : ''}{formatAmount(netAmount.toString())}
                </p>
                <p className={`text-xs ${netAmount >= 0 ? 'text-green-600 dark:text-green-400' : 'text-red-600 dark:text-red-400'}`}>
                  {netAmount >= 0 ? 'Net gain' : 'Net loss'}
                </p>
              </div>
              <div className={`h-8 w-8 ${netAmount >= 0 ? 'text-green-600 dark:text-green-400' : 'text-red-600 dark:text-red-400'}`}>
                {netAmount >= 0 ? <TrendingUp className="h-8 w-8" /> : <TrendingDown className="h-8 w-8" />}
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      <Card className="w-full">
        <CardHeader>
          <CardTitle className="flex items-center justify-between">
            <div className="flex flex-col">
              <span>Credit Transfer History</span>
              <span className="text-sm font-normal text-muted-foreground">
                Logged in as: {currentAdminName} ({currentAdminAccount})
              </span>
            </div>
            <div className="flex items-center gap-2">
              <Select value={filterType} onValueChange={setFilterType}>
                <SelectTrigger className="w-[140px]">
                  <Filter className="h-4 w-4 mr-2" />
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Transfers</SelectItem>
                  <SelectItem value="sent">Sent Only</SelectItem>
                  <SelectItem value="received">Received Only</SelectItem>
                </SelectContent>
              </Select>
              <Button 
                variant="outline" 
                size="sm" 
                onClick={() => refetch()}
                className="flex items-center gap-2"
              >
                <RefreshCw className="h-4 w-4" />
                Refresh
              </Button>
            </div>
          </CardTitle>
        </CardHeader>
      <CardContent>
        {filteredTransfers.length === 0 ? (
          <div className="text-center py-8 text-gray-500 dark:text-gray-400">
            {transfers.length === 0 ? "No credit transfers found." : `No ${filterType === 'all' ? '' : filterType} transfers found.`}
          </div>
        ) : (
          <div className="space-y-4">
            {filteredTransfers.map((transfer: CreditTransfer) => {
              const details = getTransferDetails(transfer);
              const isReceived = transfer.toAdminId === adminId;
              
              return (
                <div
                  key={transfer.id}
                  className={`border-l-4 rounded-lg p-4 shadow-sm ${
                    isReceived 
                      ? 'border-l-green-500 bg-green-50 dark:bg-green-900/20' 
                      : 'border-l-red-500 bg-red-50 dark:bg-red-900/20'
                  }`}
                >
                  <div className="flex items-center justify-between mb-3">
                    <div className="flex items-center gap-3">
                      {getTransferIcon(transfer)}
                      <Badge className={isReceived ? "bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-300" : "bg-red-100 text-red-800 dark:bg-red-900 dark:text-red-300"}>
                        {getTransferLabel(transfer)}
                      </Badge>
                      <span className={`font-bold text-xl ${isReceived ? 'text-green-600 dark:text-green-400' : 'text-red-600 dark:text-red-400'}`}>
                        {isReceived ? '+' : '-'} {formatAmount(transfer.amount)}
                      </span>
                    </div>
                    <span className="text-sm text-gray-500 dark:text-gray-400">
                      {format(new Date(transfer.createdAt), 'MMM dd, yyyy HH:mm')}
                    </span>
                  </div>
                  
                  <div className="bg-white dark:bg-gray-800 rounded-lg p-3 mb-3">
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-sm">
                      <div className="flex flex-col space-y-1">
                        <span className="text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wide">
                          {details.label}
                        </span>
                        <span className="font-semibold text-gray-900 dark:text-gray-100">{details.name}</span>
                        <span className="font-mono text-xs text-gray-600 dark:text-gray-300 bg-gray-100 dark:bg-gray-700 px-2 py-1 rounded">
                          {details.accountNumber}
                        </span>
                      </div>
                      <div className="flex flex-col space-y-1">
                        <span className="text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wide">
                          Current Admin
                        </span>
                        <span className="font-semibold text-blue-900 dark:text-blue-100">{currentAdminName}</span>
                        <span className="font-mono text-xs text-blue-600 dark:text-blue-300 bg-blue-100 dark:bg-blue-900/30 px-2 py-1 rounded">
                          {currentAdminAccount}
                        </span>
                      </div>
                    </div>
                  </div>
                  
                  {transfer.description && (
                    <div className="mb-2 text-sm bg-gray-50 dark:bg-gray-700 p-2 rounded">
                      <span className="text-gray-600 dark:text-gray-400 font-medium">Note: </span>
                      <span className="text-gray-800 dark:text-gray-200">{transfer.description}</span>
                    </div>
                  )}
                  
                  <div className="flex justify-between items-center text-xs text-gray-500 dark:text-gray-400">
                    <span>Transfer ID: #{transfer.id}</span>
                    <span className={`px-2 py-1 rounded-full ${
                      transfer.status === 'completed' 
                        ? 'bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-300' 
                        : 'bg-yellow-100 text-yellow-800 dark:bg-yellow-900 dark:text-yellow-300'
                    }`}>
                      {transfer.status}
                    </span>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </CardContent>
    </Card>
    </div>
  );
}