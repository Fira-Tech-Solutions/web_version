/**
 * First-Time Registration Screen
 * Shown when app is not activated. User must upload .enc activation file from Admin.
 */
import { useState, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useToast } from "@/hooks/use-toast";
import { apiRequest } from "@/lib/queryClient";
import { Copy, Check, Upload, Lock } from "lucide-react";

export default function RegistrationPage() {
  const [machineId, setMachineId] = useState<string>("");
  const [copied, setCopied] = useState(false);
  const [fileContent, setFileContent] = useState<string>("");
  const [isLoading, setIsLoading] = useState(false);
  const [isActivating, setIsActivating] = useState(false);
  const { toast } = useToast();

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const res = await apiRequest("GET", "/api/license/machine-id");
        const data = await res.json();
        if (!cancelled) setMachineId(data.machineId || "");
      } catch {
        if (!cancelled) toast({ title: "Failed to load Machine ID", variant: "destructive" });
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
      toast({ title: "Copied to clipboard" });
      setTimeout(() => setCopied(false), 2000);
    } catch {
      toast({ title: "Failed to copy", variant: "destructive" });
    }
  };

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = (ev) => {
      const text = ev.target?.result as string;
      setFileContent(text?.trim() || "");
    };
    reader.readAsText(file);
  };

  const handleActivate = async () => {
    if (!fileContent) {
      toast({ title: "Please select an activation file (.enc)", variant: "destructive" });
      return;
    }
    setIsActivating(true);
    try {
      const res = await apiRequest("POST", "/api/activate", { encryptedData: fileContent });
      const data = await res.json();
      if (!res.ok) throw new Error(data.message || "Activation failed");
      toast({ title: "Activation successful", description: "You can now use the application." });
      window.location.href = "/";
    } catch (err: any) {
      toast({ title: "Activation failed", description: err.message || "Invalid file", variant: "destructive" });
    } finally {
      setIsActivating(false);
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-slate-950 p-4">
      <Card className="w-full max-w-lg border-slate-800 bg-slate-900 text-slate-100">
        <CardHeader>
          <div className="flex items-center gap-2">
            <Lock className="h-6 w-6 text-amber-500" />
            <CardTitle className="text-xl">First-Time Registration</CardTitle>
          </div>
          <CardDescription className="text-slate-400">
            This application is locked until activated. Upload the activation file (.enc) provided by your Administrator.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-6">
          {/* Machine ID - share with Admin */}
          <div className="space-y-2">
            <Label className="text-slate-300">Your Machine ID (share with Admin)</Label>
            <div className="flex gap-2">
              <Input
                readOnly
                value={machineId || (isLoading ? "Loading..." : "")}
                className="font-mono text-sm bg-slate-800 border-slate-700"
              />
              <Button
                variant="outline"
                size="icon"
                onClick={handleCopy}
                disabled={!machineId}
                className="border-slate-600 shrink-0"
              >
                {copied ? <Check className="h-4 w-4 text-green-500" /> : <Copy className="h-4 w-4" />}
              </Button>
            </div>
            <p className="text-xs text-slate-500">
              Copy this ID and send it to your Administrator (e.g. via USB). They will create an activation file for this computer.
            </p>
          </div>

          {/* Upload activation file */}
          <div className="space-y-2">
            <Label className="text-slate-300">Activation File (.enc)</Label>
            <div className="flex gap-2">
              <label className="flex-1 cursor-pointer">
                <div className="flex items-center justify-center gap-2 rounded-md border border-slate-600 bg-slate-800 px-4 py-3 text-sm hover:bg-slate-700 transition-colors">
                  <Upload className="h-4 w-4" />
                  {fileContent ? "File selected" : "Choose .enc file"}
                </div>
                <input
                  type="file"
                  className="hidden"
                  accept=".enc,.txt"
                  onChange={handleFileChange}
                />
              </label>
              <Button
                onClick={handleActivate}
                disabled={!fileContent || isActivating}
                className="bg-amber-600 hover:bg-amber-700"
              >
                {isActivating ? "Activating..." : "Activate"}
              </Button>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
