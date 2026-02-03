import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Eye, RefreshCw } from "lucide-react";
import { format } from "date-fns";

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
}

export function AdminCreditLoadHistory() {
  const [selectedLoad, setSelectedLoad] = useState<CreditLoad | null>(null);
  const [isImageLoading, setIsImageLoading] = useState(false);

  const { data: creditLoads = [], isLoading, refetch } = useQuery({
    queryKey: ['/api/credit/loads/admin'],
    enabled: true,
    staleTime: 0,
    cacheTime: 0,
  });

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'confirmed':
        return 'bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-300';
      case 'rejected':
        return 'bg-red-100 text-red-800 dark:bg-red-900 dark:text-red-300';
      case 'pending':
        return 'bg-yellow-100 text-yellow-800 dark:bg-yellow-900 dark:text-yellow-300';
      default:
        return 'bg-gray-100 text-gray-800 dark:bg-gray-800 dark:text-gray-300';
    }
  };

  const formatAmount = (amount: string) => {
    return new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency: 'ETB',
      minimumFractionDigits: 2,
    }).format(parseFloat(amount));
  };

  const handleImageLoad = () => {
    setIsImageLoading(false);
  };

  const handleImageError = () => {
    setIsImageLoading(false);
  };

  if (isLoading) {
    return (
      <Card className="w-full">
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <RefreshCw className="h-4 w-4 animate-spin" />
            Loading Credit Load History...
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

  return (
    <Card className="w-full">
      <CardHeader>
        <CardTitle className="flex items-center justify-between">
          My Credit Load Requests
          <Button 
            variant="outline" 
            size="sm" 
            onClick={() => refetch()}
            className="flex items-center gap-2"
          >
            <RefreshCw className="h-4 w-4" />
            Refresh
          </Button>
        </CardTitle>
      </CardHeader>
      <CardContent>
        {(!Array.isArray(creditLoads) || creditLoads.length === 0) ? (
          <div className="text-center py-8 text-gray-500 dark:text-gray-400">
            No credit load requests found.
            <div className="text-xs mt-2">
              Data type: {typeof creditLoads}, Length: {Array.isArray(creditLoads) ? creditLoads.length : 'Not array'}
            </div>
          </div>
        ) : (
          <div className="space-y-4">
            {(creditLoads as CreditLoad[]).map((load: CreditLoad) => (
              <div
                key={load.id}
                className="border rounded-lg p-4 bg-white dark:bg-gray-800 shadow-sm"
              >
                <div className="flex items-center justify-between mb-3">
                  <div className="flex items-center gap-3">
                    <Badge className={getStatusColor(load.status)}>
                      {load.status.charAt(0).toUpperCase() + load.status.slice(1)}
                    </Badge>
                    <span className="font-semibold text-lg">
                      {formatAmount(load.amount)}
                    </span>
                  </div>
                  {load.transferScreenshot && (
                    <Dialog>
                      <DialogTrigger asChild>
                        <Button 
                          variant="outline" 
                          size="sm"
                          onClick={() => {
                            setSelectedLoad(load);
                            setIsImageLoading(true);
                          }}
                          className="flex items-center gap-2"
                        >
                          <Eye className="h-4 w-4" />
                          View Screenshot
                        </Button>
                      </DialogTrigger>
                      <DialogContent className="max-w-3xl">
                        <DialogHeader>
                          <DialogTitle>
                            Payment Screenshot - {formatAmount(load.amount)}
                          </DialogTitle>
                        </DialogHeader>
                        <div className="mt-4">
                          {isImageLoading && (
                            <div className="flex items-center justify-center py-8">
                              <RefreshCw className="h-6 w-6 animate-spin" />
                              <span className="ml-2">Loading image...</span>
                            </div>
                          )}
                          {load.transferScreenshot.startsWith('data:') ? (
                            <img
                              src={load.transferScreenshot}
                              alt="Payment Screenshot"
                              className="w-full h-auto rounded-lg border"
                              onLoad={handleImageLoad}
                              onError={handleImageError}
                              style={{ display: isImageLoading ? 'none' : 'block' }}
                            />
                          ) : (
                            <div className="p-6 bg-gray-100 rounded-lg border-2 border-dashed text-center">
                              <p className="text-sm text-gray-600 font-medium">Screenshot Reference</p>
                              <p className="text-xs text-gray-500 mt-1">{load.transferScreenshot}</p>
                              <p className="text-xs text-gray-400 mt-2">Unable to display - screenshot not in proper image format</p>
                            </div>
                          )}
                        </div>
                      </DialogContent>
                    </Dialog>
                  )}
                </div>
                
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-sm">
                  <div>
                    <span className="font-medium text-gray-600 dark:text-gray-400">Payment Method:</span>
                    <div className="mt-1">{load.paymentMethod}</div>
                  </div>
                  
                  {load.referenceNumber && (
                    <div>
                      <span className="font-medium text-gray-600 dark:text-gray-400">Reference:</span>
                      <div className="mt-1 font-mono text-sm">{load.referenceNumber}</div>
                    </div>
                  )}
                  
                  {load.adminAccountNumber && (
                    <div>
                      <span className="font-medium text-gray-600 dark:text-gray-400">Account Number:</span>
                      <div className="mt-1 font-mono text-sm">{load.adminAccountNumber}</div>
                    </div>
                  )}
                  
                  <div>
                    <span className="font-medium text-gray-600 dark:text-gray-400">Requested:</span>
                    <div className="mt-1">{format(new Date(load.requestedAt), "MMM d, yyyy 'at' h:mm a")}</div>
                  </div>
                  
                  {load.processedAt && (
                    <div>
                      <span className="font-medium text-gray-600 dark:text-gray-400">Processed:</span>
                      <div className="mt-1">{format(new Date(load.processedAt), "MMM d, yyyy 'at' h:mm a")}</div>
                    </div>
                  )}
                  
                  {load.notes && (
                    <div className="md:col-span-2">
                      <span className="font-medium text-gray-600 dark:text-gray-400">Notes:</span>
                      <div className="mt-1 p-2 bg-gray-50 dark:bg-gray-700 rounded text-sm">
                        {load.notes}
                      </div>
                    </div>
                  )}
                </div>
              </div>
            ))}
          </div>
        )}
      </CardContent>
    </Card>
  );
}