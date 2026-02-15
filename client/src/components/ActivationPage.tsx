import { useState, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Upload, Copy, Lock, Shield, CheckCircle, AlertCircle } from "lucide-react";
import { useToast } from "@/hooks/use-toast";

interface ActivationPageProps {
  onActivationSuccess: () => void;
}

export default function ActivationPage({ onActivationSuccess }: ActivationPageProps) {
  const { toast } = useToast();
  const [machineId, setMachineId] = useState<string>("");
  const [isUploading, setIsUploading] = useState(false);
  const [dragActive, setDragActive] = useState(false);
  const [licenseStatus, setLicenseStatus] = useState<'idle' | 'valid' | 'invalid' | 'expired'>('idle');
  const [errorMessage, setErrorMessage] = useState<string>("");
  const [licenseInfo, setLicenseInfo] = useState<any>(null);

  // Fetch machine ID on component mount
  useEffect(() => {
    fetchMachineId();
    checkExistingLicense();
  }, []);

  const fetchMachineId = async () => {
    try {
      const response = await fetch("/api/license/machine-id");
      const data = await response.json();
      if (data.machineId) {
        setMachineId(data.machineId);
      }
    } catch (error) {
      console.error("Failed to fetch machine ID:", error);
      toast({
        title: "Error",
        description: "Failed to get machine ID",
        variant: "destructive",
      });
    }
  };

  const checkExistingLicense = async () => {
    try {
      const response = await fetch("/api/license/verify");
      const data = await response.json();
      
      if (data.hasValidLicense) {
        setLicenseStatus('valid');
        setLicenseInfo(data.licenseInfo);
        // Auto-redirect if license is valid
        setTimeout(() => {
          onActivationSuccess();
        }, 1000);
      }
    } catch (error) {
      console.error("Failed to check license:", error);
    }
  };

  const copyToClipboard = async () => {
    try {
      await navigator.clipboard.writeText(machineId);
      toast({
        title: "Copied!",
        description: "Machine ID copied to clipboard",
      });
    } catch (error) {
      console.error("Failed to copy:", error);
      toast({
        title: "Error",
        description: "Failed to copy to clipboard",
        variant: "destructive",
      });
    }
  };

  const handleDrag = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    if (e.type === "dragenter" || e.type === "dragover") {
      setDragActive(true);
    } else if (e.type === "dragleave") {
      setDragActive(false);
    }
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setDragActive(false);
    
    if (e.dataTransfer.files && e.dataTransfer.files[0]) {
      handleFileUpload(e.dataTransfer.files[0]);
    }
  };

  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files[0]) {
      handleFileUpload(e.target.files[0]);
    }
  };

  const handleFileUpload = async (file: File) => {
    // Check file extension
    if (!file.name.endsWith('.enc')) {
      setErrorMessage("Please upload a .enc license file");
      setLicenseStatus('invalid');
      return;
    }

    setIsUploading(true);
    setErrorMessage("");
    setLicenseStatus('idle');

    try {
      const fileContent = await file.text();
      
      const response = await fetch("/api/license/activate", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ licenseData: fileContent }),
      });

      const result = await response.json();

      if (response.ok) {
        setLicenseStatus('valid');
        setLicenseInfo(result.licenseInfo);
        toast({
          title: "Success!",
          description: "License activated successfully",
        });
        
        // Redirect after successful activation
        setTimeout(() => {
          onActivationSuccess();
        }, 1500);
      } else {
        setErrorMessage(result.message || "Failed to activate license");
        setLicenseStatus('invalid');
        toast({
          title: "Activation Failed",
          description: result.message || "Invalid license file",
          variant: "destructive",
        });
      }
    } catch (error) {
      console.error("License upload error:", error);
      setErrorMessage("Failed to process license file");
      setLicenseStatus('invalid');
      toast({
        title: "Error",
        description: "Failed to process license file",
        variant: "destructive",
      });
    } finally {
      setIsUploading(false);
    }
  };

  const getStatusIcon = () => {
    switch (licenseStatus) {
      case 'valid':
        return <CheckCircle className="w-6 h-6 text-green-500" />;
      case 'invalid':
      case 'expired':
        return <AlertCircle className="w-6 h-6 text-red-500" />;
      default:
        return <Lock className="w-6 h-6 text-gray-500" />;
    }
  };

  const getStatusMessage = () => {
    switch (licenseStatus) {
      case 'valid':
        return "License Activated Successfully";
      case 'invalid':
        return "Invalid License";
      case 'expired':
        return "License Expired";
      default:
        return "Software Not Activated";
    }
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-gray-900 via-blue-900 to-gray-900 flex items-center justify-center p-4">
      <div className="max-w-2xl w-full space-y-8">
        {/* Header */}
        <div className="text-center space-y-4">
          <div className="flex justify-center">
            <div className="p-4 bg-blue-600 rounded-full">
              <Shield className="w-12 h-12 text-white" />
            </div>
          </div>
          <h1 className="text-4xl font-bold text-white">BingoMaster</h1>
          <p className="text-xl text-gray-300">Software Activation Required</p>
        </div>

        {/* Status Card */}
        <Card className="bg-gray-800 border-gray-700">
          <CardHeader>
            <CardTitle className="flex items-center gap-3 text-white">
              {getStatusIcon()}
              {getStatusMessage()}
            </CardTitle>
            <CardDescription className="text-gray-400">
              {licenseStatus === 'valid' 
                ? "Your software is activated and ready to use"
                : "Please activate your software to continue"
              }
            </CardDescription>
          </CardHeader>
          
          {licenseStatus === 'valid' && licenseInfo && (
            <CardContent className="space-y-3">
              <div className="grid grid-cols-2 gap-4 text-sm">
                <div>
                  <span className="text-gray-400">License Type:</span>
                  <p className="text-white capitalize">{licenseInfo.licenseType}</p>
                </div>
                {licenseInfo.expiresAt && (
                  <div>
                    <span className="text-gray-400">Expires:</span>
                    <p className="text-white">
                      {new Date(licenseInfo.expiresAt).toLocaleDateString()}
                    </p>
                  </div>
                )}
              </div>
            </CardContent>
          )}
        </Card>

        {/* Machine ID Card */}
        <Card className="bg-gray-800 border-gray-700">
          <CardHeader>
            <CardTitle className="text-white">Machine Identification</CardTitle>
            <CardDescription className="text-gray-400">
              Share this Machine ID with your administrator to receive a license file
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="flex items-center gap-3">
              <Input
                value={machineId}
                readOnly
                className="bg-gray-700 border-gray-600 text-white font-mono text-sm"
                placeholder="Loading Machine ID..."
              />
              <Button
                onClick={copyToClipboard}
                disabled={!machineId}
                variant="outline"
                size="icon"
                className="border-gray-600 text-gray-300 hover:bg-gray-700"
              >
                <Copy className="w-4 h-4" />
              </Button>
            </div>
            <p className="text-xs text-gray-500">
              This unique identifier is generated from your hardware configuration
            </p>
          </CardContent>
        </Card>

        {/* License Upload Card */}
        {licenseStatus !== 'valid' && (
          <Card className="bg-gray-800 border-gray-700">
            <CardHeader>
              <CardTitle className="text-white">Upload License File</CardTitle>
              <CardDescription className="text-gray-400">
                Upload your .enc license file provided by the administrator
              </CardDescription>
            </CardHeader>
            <CardContent>
              <div
                className={`border-2 border-dashed rounded-lg p-8 text-center transition-colors ${
                  dragActive
                    ? "border-blue-500 bg-blue-500/10"
                    : "border-gray-600 bg-gray-700/50 hover:border-gray-500"
                }`}
                onDragEnter={handleDrag}
                onDragLeave={handleDrag}
                onDragOver={handleDrag}
                onDrop={handleDrop}
              >
                <Upload className="w-12 h-12 mx-auto mb-4 text-gray-400" />
                <p className="text-white mb-2">
                  {isUploading ? "Processing..." : "Drop your .enc license file here"}
                </p>
                <p className="text-gray-400 text-sm mb-4">or</p>
                <input
                  type="file"
                  accept=".enc"
                  onChange={handleFileSelect}
                  disabled={isUploading}
                  className="hidden"
                  id="license-upload"
                />
                <Button
                  asChild
                  disabled={isUploading}
                  className="bg-blue-600 hover:bg-blue-700"
                >
                  <label htmlFor="license-upload" className="cursor-pointer">
                    {isUploading ? "Processing..." : "Browse Files"}
                  </label>
                </Button>
              </div>

              {errorMessage && (
                <Alert className="mt-4 border-red-600 bg-red-600/10">
                  <AlertCircle className="h-4 w-4 text-red-500" />
                  <AlertDescription className="text-red-400">
                    {errorMessage}
                  </AlertDescription>
                </Alert>
              )}
            </CardContent>
          </Card>
        )}

        {/* Help Section */}
        <Card className="bg-gray-800 border-gray-700">
          <CardHeader>
            <CardTitle className="text-white">Need Help?</CardTitle>
          </CardHeader>
          <CardContent className="space-y-3 text-gray-300">
            <div className="flex items-start gap-3">
              <div className="w-6 h-6 rounded-full bg-blue-600 flex items-center justify-center text-white text-sm font-bold">1</div>
              <div>
                <p className="font-medium text-white">Copy your Machine ID</p>
                <p className="text-sm text-gray-400">Share this ID with your system administrator</p>
              </div>
            </div>
            <div className="flex items-start gap-3">
              <div className="w-6 h-6 rounded-full bg-blue-600 flex items-center justify-center text-white text-sm font-bold">2</div>
              <div>
                <p className="font-medium text-white">Receive License File</p>
                <p className="text-sm text-gray-400">Get a .enc license file from your administrator</p>
              </div>
            </div>
            <div className="flex items-start gap-3">
              <div className="w-6 h-6 rounded-full bg-blue-600 flex items-center justify-center text-white text-sm font-bold">3</div>
              <div>
                <p className="font-medium text-white">Upload and Activate</p>
                <p className="text-sm text-gray-400">Upload the file to activate your software</p>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
