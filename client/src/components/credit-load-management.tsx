import { useState } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { useToast } from "@/hooks/use-toast";
import { queryClient } from "@/lib/queryClient";
import { CheckCircle, XCircle, Eye, DollarSign, Calendar, User, FileText, Image } from "lucide-react";

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
  requestedAt: string;
  processedAt?: string;
  processedBy?: number;
  admin?: {
    id: number;
    name: string;
    username: string;
    accountNumber?: string;
  };
}

interface CreditLoadManagementProps {
  userRole: 'super_admin' | 'admin';
}

export function CreditLoadManagement({ userRole }: CreditLoadManagementProps) {
  const { toast } = useToast();
  const [selectedLoad, setSelectedLoad] = useState<CreditLoad | null>(null);
  const [showDetailsDialog, setShowDetailsDialog] = useState(false);
  const [processingNotes, setProcessingNotes] = useState("");

  const { data: creditLoads = [], refetch } = useQuery({
    queryKey: ["/api/admin/credit-loads"],
    enabled: userRole === 'super_admin',
  });

  const processCreditLoadMutation = useMutation({
    mutationFn: async ({ loadId, status, notes }: { loadId: number; status: string; notes?: string }) => {
      const response = await fetch(`/api/admin/credit-loads/${loadId}/process`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ status, notes }),
      });
      
      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.message || "Failed to process credit load");
      }
      
      return response.json();
    },
    onSuccess: (data, variables) => {
      queryClient.invalidateQueries({ queryKey: ["/api/admin/credit-loads"] });
      setShowDetailsDialog(false);
      setSelectedLoad(null);
      setProcessingNotes("");
      
      toast({
        title: "Credit Load Processed",
        description: `Credit load request has been ${variables.status}.`,
      });
    },
    onError: (error: any) => {
      toast({
        title: "Error",
        description: error.message || "Failed to process credit load",
        variant: "destructive",
      });
    },
  });

  const handleViewDetails = (load: CreditLoad) => {
    setSelectedLoad(load);
    setShowDetailsDialog(true);
  };

  const handleProcessLoad = (status: 'confirmed' | 'rejected') => {
    if (!selectedLoad) return;

    processCreditLoadMutation.mutate({
      loadId: selectedLoad.id,
      status,
      notes: processingNotes,
    });
  };

  const getStatusBadge = (status: string) => {
    switch (status) {
      case 'pending':
        return <Badge variant="outline" className="bg-yellow-50 text-yellow-700 border-yellow-200">Pending</Badge>;
      case 'confirmed':
        return <Badge variant="outline" className="bg-green-50 text-green-700 border-green-200">Confirmed</Badge>;
      case 'rejected':
        return <Badge variant="outline" className="bg-red-50 text-red-700 border-red-200">Rejected</Badge>;
      default:
        return <Badge variant="outline">{status}</Badge>;
    }
  };

  if (userRole !== 'super_admin') {
    return (
      <Card>
        <CardContent className="p-6">
          <p className="text-center text-muted-foreground">Access denied. Super admin privileges required.</p>
        </CardContent>
      </Card>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h2 className="text-2xl font-bold">Credit Load Requests</h2>
        <div className="flex gap-2">
          <Badge variant="outline" className="bg-yellow-50 text-yellow-700">
            {creditLoads.filter((load: CreditLoad) => load.status === 'pending').length} Pending
          </Badge>
        </div>
      </div>

      <div className="grid gap-4">
        {creditLoads.length === 0 ? (
          <Card>
            <CardContent className="p-6">
              <p className="text-center text-muted-foreground">No credit load requests found.</p>
            </CardContent>
          </Card>
        ) : (
          creditLoads.map((load: CreditLoad) => (
            <Card key={load.id} className="hover:shadow-md transition-shadow">
              <CardHeader className="pb-3">
                <div className="flex items-center justify-between">
                  <CardTitle className="text-lg">
                    Credit Load Request #{load.id}
                  </CardTitle>
                  {getStatusBadge(load.status)}
                </div>
              </CardHeader>
              <CardContent>
                <div className="grid md:grid-cols-2 lg:grid-cols-4 gap-4 mb-4">
                  <div className="flex items-center gap-2">
                    <DollarSign className="w-4 h-4 text-green-600" />
                    <div>
                      <p className="text-sm text-muted-foreground">Amount</p>
                      <p className="font-semibold">ETB {load.amount}</p>
                    </div>
                  </div>
                  
                  <div className="flex items-center gap-2">
                    <User className="w-4 h-4 text-blue-600" />
                    <div>
                      <p className="text-sm text-muted-foreground">Admin</p>
                      <p className="font-semibold">{load.admin?.name || `ID: ${load.adminId}`}</p>
                    </div>
                  </div>
                  
                  <div className="flex items-center gap-2">
                    <Calendar className="w-4 h-4 text-gray-600" />
                    <div>
                      <p className="text-sm text-muted-foreground">Requested</p>
                      <p className="font-semibold">
                        {new Date(load.requestedAt).toLocaleDateString()}
                      </p>
                    </div>
                  </div>
                  
                  <div className="flex items-center gap-2">
                    <FileText className="w-4 h-4 text-purple-600" />
                    <div>
                      <p className="text-sm text-muted-foreground">Method</p>
                      <p className="font-semibold capitalize">{load.paymentMethod.replace('_', ' ')}</p>
                    </div>
                  </div>
                </div>

                {load.transferScreenshot && (
                  <div className="mb-4 p-3 bg-blue-50 rounded-lg">
                    <div className="flex items-center gap-2 mb-2">
                      <Image className="w-4 h-4 text-blue-600" />
                      <span className="text-sm font-medium text-blue-800">Transfer Screenshot Provided</span>
                    </div>
                    <p className="text-xs text-blue-600">Admin has submitted bank transfer proof for verification</p>
                  </div>
                )}

                <div className="flex justify-end">
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => handleViewDetails(load)}
                  >
                    <Eye className="w-4 h-4 mr-2" />
                    View Details
                  </Button>
                </div>
              </CardContent>
            </Card>
          ))
        )}
      </div>

      <Dialog open={showDetailsDialog} onOpenChange={setShowDetailsDialog}>
        <DialogContent className="max-w-2xl max-h-[80vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Credit Load Request Details</DialogTitle>
            <DialogDescription>
              Review and process admin credit load request
            </DialogDescription>
          </DialogHeader>
          
          {selectedLoad && (
            <div className="space-y-6">
              <div className="grid md:grid-cols-2 gap-4">
                <div>
                  <Label className="text-sm font-medium">Request ID</Label>
                  <p className="text-lg font-semibold">#{selectedLoad.id}</p>
                </div>
                <div>
                  <Label className="text-sm font-medium">Status</Label>
                  <div className="mt-1">{getStatusBadge(selectedLoad.status)}</div>
                </div>
              </div>

              <div className="grid md:grid-cols-2 gap-4">
                <div>
                  <Label className="text-sm font-medium">Admin</Label>
                  <p className="font-semibold">{selectedLoad.admin?.name || `ID: ${selectedLoad.adminId}`}</p>
                  <p className="text-sm text-muted-foreground">@{selectedLoad.admin?.username}</p>
                </div>
                <div>
                  <Label className="text-sm font-medium">Amount</Label>
                  <p className="text-2xl font-bold text-green-600">ETB {selectedLoad.amount}</p>
                </div>
              </div>

              <div className="grid md:grid-cols-2 gap-4">
                <div>
                  <Label className="text-sm font-medium">Payment Method</Label>
                  <p className="capitalize">{selectedLoad.paymentMethod.replace('_', ' ')}</p>
                </div>
                <div>
                  <Label className="text-sm font-medium">Admin Account Number</Label>
                  <p className="font-mono">{selectedLoad.adminAccountNumber || 'Not provided'}</p>
                </div>
              </div>

              {selectedLoad.referenceNumber && (
                <div>
                  <Label className="text-sm font-medium">Reference Number</Label>
                  <p className="font-mono">{selectedLoad.referenceNumber}</p>
                </div>
              )}

              {selectedLoad.transferScreenshot && (
                <div>
                  <Label className="text-sm font-medium">Bank Transfer Screenshot</Label>
                  <div className="mt-2 p-4 bg-gray-50 rounded-lg">
                    <div className="flex items-center gap-2 mb-2">
                      <Image className="w-5 h-5 text-blue-600" />
                      <span className="font-medium">Transfer Proof Submitted</span>
                    </div>
                    <div className="mt-3">
                      {selectedLoad.transferScreenshot.startsWith('data:') ? (
                        <img 
                          src={selectedLoad.transferScreenshot} 
                          alt="Bank Transfer Screenshot" 
                          className="max-w-full h-auto max-h-96 rounded border border-gray-200 shadow-sm"
                          onError={(e) => {
                            console.error('Image load error:', e);
                            e.currentTarget.style.display = 'none';
                          }}
                        />
                      ) : (
                        <div className="p-4 bg-gray-100 rounded border-2 border-dashed">
                          <p className="text-sm text-gray-600">Screenshot reference: {selectedLoad.transferScreenshot}</p>
                          <p className="text-xs text-gray-500 mt-1">Unable to display - not in proper image format</p>
                        </div>
                      )}
                    </div>
                  </div>
                </div>
              )}

              {selectedLoad.notes && (
                <div>
                  <Label className="text-sm font-medium">Admin Notes</Label>
                  <p className="mt-1 p-3 bg-gray-50 rounded">{selectedLoad.notes}</p>
                </div>
              )}

              <div>
                <Label className="text-sm font-medium">Requested At</Label>
                <p>{new Date(selectedLoad.requestedAt).toLocaleString()}</p>
              </div>

              {selectedLoad.status === 'pending' && (
                <div className="space-y-4 border-t pt-4">
                  <div>
                    <Label htmlFor="processingNotes">Processing Notes (Optional)</Label>
                    <Textarea
                      id="processingNotes"
                      placeholder="Add notes about your decision..."
                      value={processingNotes}
                      onChange={(e) => setProcessingNotes(e.target.value)}
                      className="mt-1"
                    />
                  </div>
                  
                  <div className="flex gap-3">
                    <Button
                      onClick={() => handleProcessLoad('confirmed')}
                      disabled={processCreditLoadMutation.isPending}
                      className="bg-green-600 hover:bg-green-700"
                    >
                      <CheckCircle className="w-4 h-4 mr-2" />
                      Confirm & Add Credits
                    </Button>
                    <Button
                      variant="destructive"
                      onClick={() => handleProcessLoad('rejected')}
                      disabled={processCreditLoadMutation.isPending}
                    >
                      <XCircle className="w-4 h-4 mr-2" />
                      Reject Request
                    </Button>
                  </div>
                </div>
              )}

              {selectedLoad.status !== 'pending' && selectedLoad.processedAt && (
                <div className="border-t pt-4">
                  <Label className="text-sm font-medium">Processed At</Label>
                  <p>{new Date(selectedLoad.processedAt).toLocaleString()}</p>
                </div>
              )}
            </div>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}