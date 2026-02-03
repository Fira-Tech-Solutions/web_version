import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useToast } from "@/hooks/use-toast";
import { format } from "date-fns";
import { Banknote, CreditCard } from "lucide-react";

interface ReferralCommission {
  id: number;
  referrerId: number;
  referredId: number;
  sourceType: string;
  sourceId: number;
  sourceAmount: string;
  commissionRate: string;
  commissionAmount: string;
  status: string;
  createdAt: string;
  processedAt?: string;
}

interface AdminReferralCommissionsProps {
  adminId: number;
}

export function AdminReferralCommissions({ adminId }: AdminReferralCommissionsProps) {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  
  // Dialog state management
  const [showWithdrawDialog, setShowWithdrawDialog] = useState(false);
  const [showConvertDialog, setShowConvertDialog] = useState(false);
  const [selectedCommission, setSelectedCommission] = useState<ReferralCommission | null>(null);
  const [withdrawAmount, setWithdrawAmount] = useState("");
  const [bankAccount, setBankAccount] = useState("");
  const [convertAmount, setConvertAmount] = useState("");

  const { data: commissions = [], isLoading } = useQuery({
    queryKey: ['referral-commissions', adminId],
    queryFn: async () => {
      const response = await fetch(`/api/referral-commissions/${adminId}`);
      if (!response.ok) throw new Error('Failed to fetch referral commissions');
      return response.json();
    }
  });

  const { data: withdrawalRequests = [] } = useQuery({
    queryKey: ['withdrawal-requests', adminId],
    queryFn: async () => {
      const response = await fetch(`/api/withdrawal-requests?adminId=${adminId}`);
      if (!response.ok) throw new Error('Failed to fetch withdrawal requests');
      return response.json();
    }
  });

  const { data: systemSettings = {} } = useQuery({
    queryKey: ['admin-system-settings'],
    queryFn: async () => {
      const response = await fetch('/api/admin/system-settings');
      if (!response.ok) throw new Error('Failed to fetch system settings');
      return response.json();
    }
  });

  const withdrawMutation = useMutation({
    mutationFn: async ({ amount, bankAccount }: { amount: string; bankAccount: string }) => {
      const response = await fetch(`/api/referral-commissions/withdraw`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ 
          adminId, 
          amount: parseFloat(amount), 
          bankAccount 
        }),
      });
      if (!response.ok) throw new Error('Failed to submit withdrawal request');
      return response.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['referral-commissions'] });
      queryClient.invalidateQueries({ queryKey: ['withdrawal-requests', adminId] });
      setShowWithdrawDialog(false);
      setWithdrawAmount("");
      setBankAccount("");
      toast({
        title: "Withdrawal Request Submitted",
        description: "Your withdrawal request has been sent to super admin for approval",
      });
    },
    onError: () => {
      toast({
        title: "Error",
        description: "Failed to submit withdrawal request",
        variant: "destructive",
      });
    }
  });

  const convertMutation = useMutation({
    mutationFn: async ({ amount }: { amount: string }) => {
      const response = await fetch(`/api/referral-commissions/convert`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ 
          adminId, 
          amount: parseFloat(amount)
        }),
      });
      if (!response.ok) throw new Error('Failed to convert commission to credit');
      return response.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['referral-commissions'] });
      queryClient.invalidateQueries({ queryKey: ['/api/credit/balance'] });
      setShowConvertDialog(false);
      setConvertAmount("");
      toast({
        title: "Commission Converted",
        description: "Commission successfully converted to credit balance",
      });
    },
    onError: () => {
      toast({
        title: "Error",
        description: "Failed to convert commission to credit",
        variant: "destructive",
      });
    }
  });

  const totalPendingCommissions = commissions
    .filter((c: ReferralCommission) => c.status === 'pending')
    .reduce((sum: number, c: ReferralCommission) => sum + parseFloat(c.commissionAmount), 0);

  const totalEarnedCommissions = commissions
    .reduce((sum: number, c: ReferralCommission) => sum + parseFloat(c.commissionAmount), 0);

  if (isLoading) {
    return <div className="flex items-center justify-center p-8">Loading referral commissions...</div>;
  }

  return (
    <div className="space-y-6">
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium">Total Earned</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{totalEarnedCommissions.toFixed(2)} ETB</div>
            <p className="text-xs text-muted-foreground">All-time referral earnings</p>
          </CardContent>
        </Card>
        
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium">Pending Commissions</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{totalPendingCommissions.toFixed(2)} ETB</div>
            <p className="text-xs text-muted-foreground">Available for withdrawal/conversion</p>
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Referral Commission History</CardTitle>
        </CardHeader>
        <CardContent>
          {commissions.length === 0 ? (
            <div className="text-center py-8 text-muted-foreground">
              No referral commissions yet. Start referring admins to earn {systemSettings.referralCommissionRate || '5'}% commission on their deposits!
            </div>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Date</TableHead>
                  <TableHead>Source</TableHead>
                  <TableHead>Deposit Amount</TableHead>
                  <TableHead>Commission Rate</TableHead>
                  <TableHead>Commission Amount</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead>Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {commissions.map((commission: ReferralCommission) => (
                  <TableRow key={commission.id}>
                    <TableCell>
                      {format(new Date(commission.createdAt), 'MMM dd, yyyy')}
                    </TableCell>
                    <TableCell>
                      <div className="flex flex-col">
                        <span className="font-medium">Admin Deposit</span>
                        <span className="text-xs text-muted-foreground">
                          {commission.sourceType === 'credit_load' ? 'Credit Load' : commission.sourceType}
                        </span>
                      </div>
                    </TableCell>
                    <TableCell>{parseFloat(commission.sourceAmount).toFixed(2)} ETB</TableCell>
                    <TableCell>{commission.commissionRate}%</TableCell>
                    <TableCell className="font-medium">
                      {parseFloat(commission.commissionAmount).toFixed(2)} ETB
                    </TableCell>
                    <TableCell>
                      <Badge 
                        variant={
                          commission.status === 'pending' ? 'default' :
                          commission.status === 'paid' ? 'secondary' :
                          commission.status === 'converted_to_credit' ? 'outline' : 'destructive'
                        }
                      >
                        {commission.status.replace('_', ' ')}
                      </Badge>
                    </TableCell>
                    <TableCell>
                      {commission.status === 'pending' && (
                        <div className="flex gap-2">
                          <Dialog open={showWithdrawDialog && selectedCommission?.id === commission.id} onOpenChange={(open) => {
                            setShowWithdrawDialog(open);
                            if (!open) setSelectedCommission(null);
                          }}>
                            <DialogTrigger asChild>
                              <Button
                                size="sm"
                                variant="outline"
                                onClick={() => setSelectedCommission(commission)}
                              >
                                <Banknote className="w-4 h-4 mr-1" />
                                Withdraw
                              </Button>
                            </DialogTrigger>
                            <DialogContent>
                              <DialogHeader>
                                <DialogTitle>Request Withdrawal</DialogTitle>
                                <DialogDescription>
                                  Submit a withdrawal request to super admin for approval
                                </DialogDescription>
                              </DialogHeader>
                              <div className="space-y-4">
                                <div>
                                  <Label htmlFor="withdrawAmount">Amount (ETB)</Label>
                                  <Input
                                    id="withdrawAmount"
                                    type="number"
                                    placeholder="Enter amount to withdraw"
                                    value={withdrawAmount}
                                    onChange={(e) => setWithdrawAmount(e.target.value)}
                                    max={commission.commissionAmount}
                                  />
                                  <p className="text-xs text-muted-foreground mt-1">
                                    Available: {commission.commissionAmount} ETB
                                  </p>
                                </div>
                                <div>
                                  <Label htmlFor="bankAccount">Bank Account</Label>
                                  <Input
                                    id="bankAccount"
                                    placeholder="Enter your bank account details"
                                    value={bankAccount}
                                    onChange={(e) => setBankAccount(e.target.value)}
                                  />
                                </div>
                                <Button
                                  onClick={() => withdrawMutation.mutate({ amount: withdrawAmount, bankAccount })}
                                  disabled={
                                    withdrawMutation.isPending || 
                                    !withdrawAmount || 
                                    !bankAccount || 
                                    parseFloat(withdrawAmount) > totalPendingCommissions ||
                                    parseFloat(withdrawAmount) <= 0
                                  }
                                  className="w-full"
                                >
                                  {withdrawMutation.isPending ? "Submitting..." : "Submit Withdrawal Request"}
                                </Button>
                              </div>
                            </DialogContent>
                          </Dialog>

                          <Dialog open={showConvertDialog && selectedCommission?.id === commission.id} onOpenChange={(open) => {
                            setShowConvertDialog(open);
                            if (!open) setSelectedCommission(null);
                          }}>
                            <DialogTrigger asChild>
                              <Button
                                size="sm"
                                onClick={() => setSelectedCommission(commission)}
                              >
                                <CreditCard className="w-4 h-4 mr-1" />
                                Convert to Credit
                              </Button>
                            </DialogTrigger>
                            <DialogContent>
                              <DialogHeader>
                                <DialogTitle>Convert to Credit</DialogTitle>
                                <DialogDescription>
                                  Convert commission to your account credit balance
                                </DialogDescription>
                              </DialogHeader>
                              <div className="space-y-4">
                                <div>
                                  <Label htmlFor="convertAmount">Amount (ETB)</Label>
                                  <Input
                                    id="convertAmount"
                                    type="number"
                                    placeholder="Enter amount to convert"
                                    value={convertAmount}
                                    onChange={(e) => setConvertAmount(e.target.value)}
                                    max={commission.commissionAmount}
                                  />
                                  <p className="text-xs text-muted-foreground mt-1">
                                    Available: {commission.commissionAmount} ETB
                                  </p>
                                </div>
                                <Button
                                  onClick={() => convertMutation.mutate({ amount: convertAmount })}
                                  disabled={
                                    convertMutation.isPending || 
                                    !convertAmount || 
                                    parseFloat(convertAmount) > totalPendingCommissions ||
                                    parseFloat(convertAmount) <= 0
                                  }
                                  className="w-full"
                                >
                                  {convertMutation.isPending ? "Converting..." : "Convert to Credit"}
                                </Button>
                              </div>
                            </DialogContent>
                          </Dialog>
                        </div>
                      )}
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>

      {/* Withdrawal Requests History */}
      <Card>
        <CardHeader>
          <CardTitle>Withdrawal Request History</CardTitle>
        </CardHeader>
        <CardContent>
          {withdrawalRequests.length === 0 ? (
            <div className="text-center py-8 text-muted-foreground">
              No withdrawal requests yet.
            </div>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Date</TableHead>
                  <TableHead>Amount</TableHead>
                  <TableHead>Bank Account</TableHead>
                  <TableHead>Type</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead>Processed Date</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {withdrawalRequests.map((request: any) => (
                  <TableRow key={request.id}>
                    <TableCell>
                      {format(new Date(request.createdAt), 'MMM dd, yyyy HH:mm')}
                    </TableCell>
                    <TableCell className="font-medium">
                      {parseFloat(request.amount).toFixed(2)} ETB
                    </TableCell>
                    <TableCell>{request.bankAccount}</TableCell>
                    <TableCell>
                      <Badge variant="outline">
                        {request.type.replace('_', ' ').toUpperCase()}
                      </Badge>
                    </TableCell>
                    <TableCell>
                      <Badge 
                        variant={
                          request.status === 'approved' ? 'default' : 
                          request.status === 'rejected' ? 'destructive' : 'secondary'
                        }
                      >
                        {request.status.toUpperCase()}
                      </Badge>
                    </TableCell>
                    <TableCell>
                      {request.processedAt ? 
                        format(new Date(request.processedAt), 'MMM dd, yyyy HH:mm') : 
                        'Pending'
                      }
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