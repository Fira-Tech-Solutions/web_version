/**
 * Activation File Generator
 * Generates encrypted .enc activation files for license activation
 */
import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useToast } from "@/hooks/use-toast";
import { apiRequest } from "@/lib/queryClient";
import { 
  Shield, 
  Download, 
  Monitor, 
  Calendar,
  AlertTriangle,
  CheckCircle,
  Key
} from "lucide-react";

interface ActivationGeneratorProps {
  privateKey: string;
}

export default function ActivationGenerator({ privateKey }: ActivationGeneratorProps) {
  const [machineId, setMachineId] = useState("");
  const [expiryDays, setExpiryDays] = useState("365");
  const [isGenerating, setIsGenerating] = useState(false);
  const [generatedFile, setGeneratedFile] = useState<any>(null);
  const { toast } = useToast();

  const handleGenerateActivation = async () => {
    if (!privateKey.trim()) {
      toast({
        title: "Private Key Required",
        description: "Please upload your private key in Security settings first.",
        variant: "destructive",
      });
      return;
    }

    if (!machineId.trim()) {
      toast({
        title: "Machine ID Required", 
        description: "Please enter the target machine ID.",
        variant: "destructive",
      });
      return;
    }

    setIsGenerating(true);
    try {
      const response = await apiRequest("POST", "/api/license/generate-activation", {
        privateKey: privateKey.trim(),
        machineId: machineId.trim(),
        expiryDays: parseInt(expiryDays) || 365
      });

      const data = await response.json();
      
      if (data.success) {
        setGeneratedFile(data);
        
        // Create downloadable file
        const blob = new Blob([data.encryptedData], { type: 'application/octet-stream' });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = data.filename;
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
        URL.revokeObjectURL(url);

        toast({
          title: "Activation File Generated",
          description: `Successfully generated ${data.filename}`,
        });
      } else {
        throw new Error(data.message || "Generation failed");
      }
    } catch (error: any) {
      console.error("Activation generation error:", error);
      toast({
        title: "Generation Failed",
        description: error.message || "Failed to generate activation file",
        variant: "destructive",
      });
    } finally {
      setIsGenerating(false);
    }
  };

  const getCurrentMachineId = async () => {
    try {
      const response = await apiRequest("GET", "/api/license/machine-id");
      const data = await response.json();
      setMachineId(data.machineId);
      toast({
        title: "Machine ID Retrieved",
        description: "Current machine ID has been populated.",
      });
    } catch (error) {
      toast({
        title: "Failed to Get Machine ID",
        description: "Could not retrieve current machine ID",
        variant: "destructive",
      });
    }
  };

  return (
    <Card className="w-full max-w-2xl mx-auto">
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Shield className="h-5 w-5" />
          Activation File Generator
        </CardTitle>
        <CardDescription>
          Generate encrypted activation files for license activation. These files are machine-specific and use your uploaded private key.
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-6">
        {/* Private Key Status */}
        <div className="space-y-2">
          <Label className="flex items-center gap-2">
            <Key className="h-4 w-4" />
            Private Key Status
          </Label>
          <div className={`p-3 rounded-lg border ${
            privateKey.trim() 
              ? 'bg-green-50 border-green-200 text-green-800' 
              : 'bg-red-50 border-red-200 text-red-800'
          }`}>
            <div className="flex items-center gap-2">
              {privateKey.trim() ? (
                <>
                  <CheckCircle className="h-4 w-4" />
                  <span className="font-medium">Private key loaded and ready</span>
                </>
              ) : (
                <>
                  <AlertTriangle className="h-4 w-4" />
                  <span className="font-medium">No private key uploaded</span>
                </>
              )}
            </div>
            {!privateKey.trim() && (
              <p className="text-sm mt-1">Please upload your private key in the Security tab first.</p>
            )}
          </div>
        </div>

        {/* Machine ID Input */}
        <div className="space-y-2">
          <Label htmlFor="machine-id" className="flex items-center gap-2">
            <Monitor className="h-4 w-4" />
            Target Machine ID
          </Label>
          <div className="flex gap-2">
            <Input
              id="machine-id"
              placeholder="Enter the target machine ID..."
              value={machineId}
              onChange={(e) => setMachineId(e.target.value)}
              className="font-mono"
            />
            <Button
              type="button"
              variant="outline"
              onClick={getCurrentMachineId}
              disabled={isGenerating}
            >
              Use Current
            </Button>
          </div>
        </div>

        {/* Expiry Days */}
        <div className="space-y-2">
          <Label htmlFor="expiry-days" className="flex items-center gap-2">
            <Calendar className="h-4 w-4" />
            Validity Period (Days)
          </Label>
          <Input
            id="expiry-days"
            type="number"
            min="1"
            max="3650"
            placeholder="365"
            value={expiryDays}
            onChange={(e) => setExpiryDays(e.target.value)}
          />
        </div>

        {/* Generation Button */}
        <Button
          onClick={handleGenerateActivation}
          disabled={isGenerating || !privateKey.trim() || !machineId.trim()}
          className="w-full"
        >
          {isGenerating ? (
            <>
              <Shield className="mr-2 h-4 w-4 animate-spin" />
              Generating...
            </>
          ) : (
            <>
              <Download className="mr-2 h-4 w-4" />
              Generate Activation File
            </>
          )}
        </Button>

        {/* Success Display */}
        {generatedFile && (
          <div className="mt-6 p-4 bg-green-50 border border-green-200 rounded-lg">
            <div className="flex items-start gap-3">
              <CheckCircle className="h-5 w-5 text-green-600 mt-0.5" />
              <div className="flex-1">
                <h4 className="font-semibold text-green-800">File Generated Successfully</h4>
                <div className="mt-2 space-y-1 text-sm text-green-700">
                  <p><strong>Filename:</strong> {generatedFile.filename}</p>
                  <p><strong>Machine ID:</strong> {generatedFile.payload.machineId}</p>
                  <p><strong>Expires:</strong> {new Date(generatedFile.payload.expiryDate).toLocaleDateString()}</p>
                  <p><strong>Type:</strong> {generatedFile.payload.type}</p>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* Warning */}
        <div className="mt-4 p-4 bg-amber-50 border border-amber-200 rounded-lg">
          <div className="flex items-start gap-3">
            <AlertTriangle className="h-5 w-5 text-amber-600 mt-0.5" />
            <div className="flex-1">
              <h4 className="font-semibold text-amber-800">Security Notice</h4>
              <ul className="mt-2 text-sm text-amber-700 list-disc list-inside space-y-1">
                <li>Activation files are machine-specific and will only work on the target machine</li>
                <li>Your private key is securely stored in memory and cleared on logout</li>
                <li>Each activation file has an expiry date for security</li>
                <li>Generate files only for authorized machines</li>
              </ul>
            </div>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
