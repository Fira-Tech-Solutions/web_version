/**
 * Device Settings Component
 * Displays Machine ID and provides development-only reset functionality
 */
import { useState, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useToast } from "@/hooks/use-toast";
import { apiRequest } from "@/lib/queryClient";
import { Copy, Check, RefreshCw, Shield } from "lucide-react";
import { getMachineIdSync, resetDevMachineId, getDeviceInfo } from "@/lib/device-info";

export default function DeviceSettings() {
  const [machineId, setMachineId] = useState<string>("");
  const [copied, setCopied] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [isResetting, setIsResetting] = useState(false);
  const { toast } = useToast();
  const [deviceInfo, setDeviceInfo] = useState<any>(null);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const res = await apiRequest("GET", "/api/license/machine-id");
        const data = await res.json();
        if (!cancelled) {
          setMachineId(data.machineId || "");
          setDeviceInfo(getDeviceInfo());
        }
      } catch {
        if (!cancelled) {
          // Fallback to client-side machine ID
          setMachineId(getMachineIdSync());
          setDeviceInfo(getDeviceInfo());
        }
      } finally {
        if (!cancelled) setIsLoading(false);
      }
    })();
    return () => { cancelled = true; };
  }, [toast]);

  const handleCopy = async () => {
    if (!machineId) return;
    try {
      await navigator.clipboard.writeText(machineId);
      setCopied(true);
      toast({ title: "Machine ID copied to clipboard" });
      setTimeout(() => setCopied(false), 2000);
    } catch {
      toast({ title: "Failed to copy", variant: "destructive" });
    }
  };

  const handleResetDeviceId = async () => {
    if (!deviceInfo?.isDevelopment) {
      toast({ 
        title: "Access Denied", 
        description: "Device ID reset is only available in development mode",
        variant: "destructive" 
      });
      return;
    }

    setIsResetting(true);
    try {
      const success = resetDevMachineId();
      if (success) {
        // Refresh the machine ID
        const newMachineId = getMachineIdSync();
        setMachineId(newMachineId);
        toast({ 
          title: "Device ID Reset", 
          description: "Development machine ID has been reset successfully" 
        });
      } else {
        toast({ 
          title: "Reset Failed", 
          description: "Failed to reset device ID",
          variant: "destructive" 
        });
      }
    } catch (error) {
      toast({ 
        title: "Reset Error", 
        description: "An error occurred while resetting device ID",
        variant: "destructive" 
      });
    } finally {
      setIsResetting(false);
    }
  };

  return (
    <div className="space-y-6">
      {/* Device Information Card */}
      <Card>
        <CardHeader>
          <div className="flex items-center gap-2">
            <Shield className="h-6 w-6 text-blue-500" />
            <CardTitle>Device Information</CardTitle>
          </div>
          <CardDescription>
            Hardware-bound licensing information for this device
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-6">
          {/* Machine ID */}
          <div className="space-y-2">
            <Label className="text-sm font-medium">Machine ID</Label>
            <div className="flex gap-2">
              <Input
                readOnly
                value={machineId || (isLoading ? "Loading..." : "")}
                className="font-mono text-sm bg-muted"
                placeholder="Machine ID will appear here"
              />
              <Button
                variant="outline"
                size="icon"
                onClick={handleCopy}
                disabled={!machineId}
                title="Copy Machine ID"
              >
                {copied ? <Check className="h-4 w-4 text-green-500" /> : <Copy className="h-4 w-4" />}
              </Button>
            </div>
            <p className="text-xs text-muted-foreground">
              This unique identifier binds your license to this device. Share this ID with your administrator to receive an activation file.
            </p>
          </div>

          {/* Environment Info */}
          {deviceInfo && (
            <div className="grid grid-cols-2 gap-4 p-4 bg-muted/50 rounded-lg">
              <div>
                <Label className="text-xs font-medium text-muted-foreground">Environment</Label>
                <p className="text-sm font-semibold capitalize">{deviceInfo.environment}</p>
              </div>
              <div>
                <Label className="text-xs font-medium text-muted-foreground">Development Mode</Label>
                <p className="text-sm font-semibold">{deviceInfo.isDevelopment ? "Yes" : "No"}</p>
              </div>
            </div>
          )}

          {/* Development-only Reset Button */}
          {deviceInfo?.isDevelopment && (
            <div className="pt-4 border-t">
              <div className="flex items-center justify-between">
                <div>
                  <Label className="text-sm font-medium">Development Tools</Label>
                  <p className="text-xs text-muted-foreground">
                    Reset the development machine ID for testing purposes
                  </p>
                </div>
                <Button
                  variant="destructive"
                  size="sm"
                  onClick={handleResetDeviceId}
                  disabled={isResetting}
                  className="flex items-center gap-2"
                >
                  <RefreshCw className={`h-4 w-4 ${isResetting ? 'animate-spin' : ''}`} />
                  {isResetting ? "Resetting..." : "Reset Device ID"}
                </Button>
              </div>
            </div>
          )}
        </CardContent>
      </Card>

      {/* License Status Card */}
      <Card>
        <CardHeader>
          <CardTitle className="text-lg">License Status</CardTitle>
          <CardDescription>
            Current activation and licensing information
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-2 gap-4">
            <div>
              <Label className="text-xs font-medium text-muted-foreground">Device Binding</Label>
              <p className="text-sm font-semibold text-green-600">Active</p>
            </div>
            <div>
              <Label className="text-xs font-medium text-muted-foreground">License Type</Label>
              <p className="text-sm font-semibold">Hardware-Bound</p>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
