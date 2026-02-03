import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { useToast } from "@/hooks/use-toast";
import { format } from "date-fns";
import { CheckCircle, XCircle, Eye, Clock } from "lucide-react";

interface WithdrawalRequest {
  id: number;
  adminId: number;
  adminName: string;
  amount: string;
  bankAccount: string;
  type: string;
  status: string;
  createdAt: string;
  processedAt?: string;
  processedBy?: number;
  rejectionReason?: string;
}

export function SuperAdminWithdrawalPanel() {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  
  const [showRejectDialog, setShowRejectDialog] = useState(false);
  const [selectedRequest, setSelectedRequest] = useState<WithdrawalRequest | null>(null);
  const [rejectionReason, setRejectionReason] = useState("");

  const { data: withdrawalRequests = [], isLoading } = useQuery({
    queryKey: ['withdrawal-requests'],
    queryFn: async () => {
      const response = await fetch('/api/withdrawal-requests');
      if (!response.ok) throw new Error('Failed to fetch withdrawal requests');
      return response.json();
    }
  });

  const approveMutation = useMutation({
    mutationFn: async (requestId: number) => {
      const response = await fetch(`/api/withdrawal-requests/${requestId}/approve`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
      });
      if (!response.ok) throw new Error('Failed to approve withdrawal request');
      return response.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['withdrawal-requests'] });
      toast({
        title: "Request Approved",
        description: "Withdrawal request has been approved successfully",
      });
    },
    onError: () => {
      toast({
        title: "Error",
        description: "Failed to approve withdrawal request",
        variant: "destructive",
      });
    }
  });

  const rejectMutation = useMutation({
    mutationFn: async ({ requestId, rejectionReason }: { requestId: number; rejectionReason: string }) => {
      const response = await fetch(`/api/withdrawal-requests/${requestId}/reject`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ rejectionReason }),
      });
      if (!response.ok) throw new Error('Failed to reject withdrawal request');
      return response.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['withdrawal-requests'] });
      setShowRejectDialog(false);
      setSelectedRequest(null);
      setRejectionReason("");
      toast({
        title: "Request Rejected",
        description: "Withdrawal request has been rejected",
      });
    },
    onError: () => {
      toast({
        title: "Error",
        description: "Failed to reject withdrawal request",
        variant: "destructive",
      });
    }
  });

  const pendingRequests = withdrawalRequests.filter((req: WithdrawalRequest) => req.status === 'pending');
  const processedRequests = withdrawalRequests.filter((req: WithdrawalRequest) => req.status !== 'pending');

  const getStatusBadge = (status: string) => {
    switch (status) {
      case 'pending':
        return <Badge variant="default"><Clock className="w-3 h-3 mr-1" />Pending</Badge>;
      case 'approved':
        return <Badge variant="secondary"><CheckCircle className="w-3 h-3 mr-1" />Approved</Badge>;
      case 'rejected':
        return <Badge variant="destructive"><XCircle className="w-3 h-3 mr-1" />Rejected</Badge>;
      default:
        return <Badge variant="outline">{status}</Badge>;
    }
  };

  const getTypeBadge = (type: string) => {
    switch (type) {
      case 'referral_commission':
        return <Badge variant="outline">Referral Commission</Badge>;
      case 'credit_balance':
        return <Badge variant="outline">Credit Balance</Badge>;
      default:
        return <Badge variant="outline">{type}</Badge>;
    }
  };

  if (isLoading) {
    return <div className="flex items-center justify-center p-8">Loading withdrawal requests...</div>;
  }

  return (
    <div className="space-y-6">
      {/* Pending Requests */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Clock className="w-5 h-5" />
            Pending Withdrawal Requests ({pendingRequests.length})
          </CardTitle>
        </CardHeader>
        <CardContent>
          {pendingRequests.length === 0 ? (
            <div className="text-center py-8 text-muted-foreground">
              No pending withdrawal requests
            </div>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Date</TableHead>
                  <TableHead>Admin</TableHead>
                  <TableHead>Type</TableHead>
                  <TableHead>Amount</TableHead>
                  <TableHead>Bank Account</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead>Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {pendingRequests.map((request: WithdrawalRequest) => (
                  <TableRow key={request.id}>
                    <TableCell>
                      {format(new Date(request.createdAt), 'MMM dd, yyyy HH:mm')}
                    </TableCell>
                    <TableCell className="font-medium">{request.adminName}</TableCell>
                    <TableCell>{getTypeBadge(request.type)}</TableCell>
                    <TableCell className="font-medium">{parseFloat(request.amount).toFixed(2)} ETB</TableCell>
                    <TableCell className="font-mono text-sm">{request.bankAccount}</TableCell>
                    <TableCell>{getStatusBadge(request.status)}</TableCell>
                    <TableCell>
                      <div className="flex gap-2">
                        <Button
                          size="sm"
                          onClick={() => approveMutation.mutate(request.id)}
                          disabled={approveMutation.isPending}
                          className="bg-green-600 hover:bg-green-700"
                        >
                          <CheckCircle className="w-4 h-4 mr-1" />
                          Approve
                        </Button>
                        
                        <Dialog open={showRejectDialog && selectedRequest?.id === request.id} onOpenChange={(open) => {
                          setShowRejectDialog(open);
                          if (!open) setSelectedRequest(null);
                        }}>
                          <DialogTrigger asChild>
                            <Button
                              size="sm"
                              variant="destructive"
                              onClick={() => setSelectedRequest(request)}
                            >
                              <XCircle className="w-4 h-4 mr-1" />
                              Reject
                            </Button>
                          </DialogTrigger>
                          <DialogContent>
                            <DialogHeader>
                              <DialogTitle>Reject Withdrawal Request</DialogTitle>
                              <DialogDescription>
                                Please provide a reason for rejecting this withdrawal request
                              </DialogDescription>
                            </DialogHeader>
                            <div className="space-y-4">
                              <div>
                                <Label htmlFor="rejectionReason">Rejection Reason</Label>
                                <Textarea
                                  id="rejectionReason"
                                  placeholder="Enter reason for rejection..."
                                  value={rejectionReason}
                                  onChange={(e) => setRejectionReason(e.target.value)}
                                  rows={3}
                                />
                              </div>
                              <Button
                                onClick={() => rejectMutation.mutate({ 
                                  requestId: request.id, 
                                  rejectionReason 
                                })}
                                disabled={rejectMutation.isPending || !rejectionReason.trim()}
                                variant="destructive"
                                className="w-full"
                              >
                                {rejectMutation.isPending ? "Rejecting..." : "Reject Request"}
                              </Button>
                            </div>
                          </DialogContent>
                        </Dialog>
                      </div>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>

      {/* Processed Requests */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Eye className="w-5 h-5" />
            Recent Processed Requests ({processedRequests.length})
          </CardTitle>
        </CardHeader>
        <CardContent>
          {processedRequests.length === 0 ? (
            <div className="text-center py-8 text-muted-foreground">
              No processed requests yet
            </div>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Date</TableHead>
                  <TableHead>Admin</TableHead>
                  <TableHead>Type</TableHead>
                  <TableHead>Amount</TableHead>
                  <TableHead>Bank Account</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead>Processed</TableHead>
                  <TableHead>Reason</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {processedRequests.slice(0, 10).map((request: WithdrawalRequest) => (
                  <TableRow key={request.id}>
                    <TableCell>
                      {format(new Date(request.createdAt), 'MMM dd, yyyy HH:mm')}
                    </TableCell>
                    <TableCell className="font-medium">{request.adminName}</TableCell>
                    <TableCell>{getTypeBadge(request.type)}</TableCell>
                    <TableCell className="font-medium">{parseFloat(request.amount).toFixed(2)} ETB</TableCell>
                    <TableCell className="font-mono text-sm">{request.bankAccount}</TableCell>
                    <TableCell>{getStatusBadge(request.status)}</TableCell>
                    <TableCell>
                      {request.processedAt ? format(new Date(request.processedAt), 'MMM dd, yyyy HH:mm') : '-'}
                    </TableCell>
                    <TableCell>
                      {request.rejectionReason ? (
                        <span className="text-sm text-red-600">{request.rejectionReason}</span>
                      ) : (
                        '-'
                      )}
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