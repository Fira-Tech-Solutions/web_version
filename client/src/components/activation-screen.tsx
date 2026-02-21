/**
 * Activation Screen Component - Dark Mode, Vibrant, Minimal
 */
import { useState, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useToast } from "@/hooks/use-toast";
import { apiRequest } from "@/lib/queryClient";
import { 
  Shield, 
  Upload, 
  Copy,
  Lock,
  CheckCircle
} from "lucide-react";

interface ActivationScreenProps {
  onActivationSuccess?: () => void;
}

export default function ActivationScreen({ onActivationSuccess }: ActivationScreenProps) {
  const [machineId, setMachineId] = useState("");
  const [activationFile, setActivationFile] = useState("");
  const [isActivating, setIsActivating] = useState(false);
  const [isActivated, setIsActivated] = useState(false);
  const [activationError, setActivationError] = useState<string | null>(null);
  const { toast } = useToast();

  useEffect(() => {
    fetchMachineId();
  }, []);

  const fetchMachineId = async () => {
    try {
      console.log("Fetching machine ID from /api/license/machine-id...");
      const response = await apiRequest("GET", "/api/license/machine-id");
      console.log("Response status:", response.status);
      const data = await response.json();
      console.log("Machine ID data:", data);
      setMachineId(data.machineId || "Failed to get ID");
    } catch (error) {
      console.error("Failed to get machine ID:", error);
      setMachineId("Error loading machine ID");
    }
  };

  const handleFileUpload = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;

    if (!file.name.endsWith('.enc')) {
      setActivationError("Please upload a valid .enc activation file");
      toast({
        title: "Invalid File",
        description: "Please upload a .enc file",
        variant: "destructive",
      });
      return;
    }

    // Clear any previous errors
    setActivationError(null);

    const reader = new FileReader();
    reader.onload = (e) => {
      const content = e.target?.result as string;
      setActivationFile(content);
    };
    reader.readAsText(file);
  };

  const handleActivation = async () => {
    if (!activationFile.trim()) {
      setActivationError("Please upload an activation file");
      toast({
        title: "File Required",
        description: "Please upload activation file",
        variant: "destructive",
      });
      return;
    }

    // Clear any previous errors
    setActivationError(null);
    setIsActivating(true);
    
    try {
      const response = await apiRequest("POST", "/api/activate", {
        encryptedData: activationFile.trim()
      });

      const data = await response.json();
      
      if (data.success) {
        setIsActivated(true);
        setActivationError(null);
        toast({
          title: "Activated!",
          description: "Application activated successfully",
        });
        
        setTimeout(() => {
          onActivationSuccess?.();
        }, 1500);
      } else {
        throw new Error(data.message || "Activation failed");
      }
    } catch (error: any) {
      console.error("Activation error:", error);
      
      // Set detailed error message
      let errorMessage = "Failed to activate application";
      
      if (error.message) {
        if (error.message.includes("MachineID mismatch")) {
          errorMessage = "This activation file is not for this machine. Please generate a new activation file for this machine.";
        } else if (error.message.includes("Invalid signature")) {
          errorMessage = "Invalid activation file signature. The file may be corrupted or tampered with.";
        } else if (error.message.includes("expired")) {
          errorMessage = "This activation file has expired. Please generate a new one.";
        } else if (error.message.includes("already activated")) {
          errorMessage = "This activation file has already been used.";
        } else {
          errorMessage = error.message;
        }
      }
      
      setActivationError(errorMessage);
      
      toast({
        title: "Activation Failed",
        description: errorMessage,
        variant: "destructive",
      });
    } finally {
      setIsActivating(false);
    }
  };

  const copyToClipboard = () => {
    navigator.clipboard.writeText(machineId).then(() => {
      toast({
        title: "Copied!",
        description: "Machine ID copied",
      });
    });
  };

  if (isActivated) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-black via-gray-900 to-black flex items-center justify-center p-4">
        <div className="w-full max-w-md">
          <div className="bg-black/80 backdrop-blur-lg rounded-2xl p-8 border border-green-500/30 shadow-2xl">
            <div className="text-center">
              <div className="mx-auto w-20 h-20 bg-gradient-to-br from-green-500 to-emerald-600 rounded-full flex items-center justify-center mb-6 shadow-lg">
                <CheckCircle className="h-10 w-10 text-white" />
              </div>
              <h1 className="text-2xl font-bold text-white mb-2">Activated!</h1>
              <p className="text-gray-300 mb-6">Application ready</p>
              <Button 
                onClick={() => onActivationSuccess?.()}
                className="w-full bg-gradient-to-r from-green-600 to-emerald-600 hover:from-green-700 hover:to-emerald-700 text-white font-semibold py-3 rounded-lg transition-all shadow-lg"
              >
                Continue
              </Button>
            </div>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen flex">
      {/* Left Side - Brand Image */}
      <div className="hidden lg:flex lg:w-1/2 relative">
        <div className="absolute inset-0 bg-gradient-to-br from-blue-900/20 to-purple-900/20"></div>
        <img 
          src="/brand_image.png" 
          alt="Go Bingo" 
          className="w-full h-full object-cover"
        />
        <div className="absolute inset-0 bg-gradient-to-r from-black/50 via-transparent to-transparent"></div>
      
      </div>

      {/* Right Side - Activation Form */}
      <div className="w-full lg:w-1/2 bg-gradient-to-br from-black via-gray-900 to-black flex items-center justify-center p-4">
        <div className="w-full max-w-md">
          <div className="bg-black/60 backdrop-blur-lg rounded-2xl p-8 border border-blue-500/30 shadow-2xl">
            {/* Mobile Logo */}
            <div className="lg:hidden text-center mb-8">
              <img 
                src="/brand_image.png" 
                alt="Go Bingo" 
                className="w-24 h-24 mx-auto rounded-xl shadow-2xl mb-4"
              />
              <h1 className="text-2xl font-bold text-white mb-2 bg-gradient-to-r from-blue-400 to-purple-400 bg-clip-text text-transparent">
                Go Bingo
              </h1>
            </div>

            {/* Desktop Header */}
            <div className="text-center mb-8">
              <div className="w-20 h-20 bg-gradient-to-br from-blue-500 to-purple-600 rounded-full flex items-center justify-center shadow-lg mx-auto">
                <Lock className="h-10 w-10 text-white" />
              </div>
              <h2 className="text-2xl font-bold text-white mb-2">Activation Required</h2>
              <p className="text-gray-400 text-sm">Upload activation file to continue</p>
            </div>

            {/* Machine ID Section */}
            <div className="mb-6">
              <Label className="text-gray-400 text-sm font-medium mb-2 block">Machine ID</Label>
              <div className="flex gap-2">
                <Input
                  value={machineId}
                  readOnly
                  className="bg-gray-900/50 border-blue-500/30 text-gray-100 font-mono text-sm"
                  placeholder="Loading..."
                />
                <Button
                  type="button"
                  variant="outline"
                  onClick={copyToClipboard}
                  disabled={!machineId}
                  className="bg-blue-600/20 border-blue-500/50 text-blue-300 hover:bg-blue-600/30"
                >
                  <Copy className="h-4 w-4" />
                </Button>
              </div>
            </div>

            {/* File Upload Section */}
            <div className="mb-6">
              <Label className="text-gray-400 text-sm font-medium mb-2 block">Activation File</Label>
              <div className="relative">
                <Input
                  type="file"
                  accept=".enc"
                  onChange={handleFileUpload}
                  className="bg-gray-900/50 border-blue-500/30 text-gray-100 file:mr-4 file:py-2 file:px-4 file:rounded-lg file:border-0 file:text-sm file:font-medium file:bg-blue-600/20 file:text-blue-300 hover:file:bg-blue-600/30"
                />
                {activationFile && (
                  <div className="absolute right-2 top-1/2 -translate-y-1/2">
                    <CheckCircle className="h-4 w-4 text-green-400" />
                  </div>
                )}
              </div>
            </div>

            {/* Error Display Section */}
            {activationError && (
              <div className="mb-6 p-4 bg-red-900/50 border border-red-500/30 rounded-lg">
                <div className="flex items-start gap-3">
                  <div className="flex-shrink-0">
                    <svg className="h-5 w-5 text-red-400" fill="currentColor" viewBox="0 0 20 20">
                      <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 0116 0zm-1 1a1 1 0 00-1 1v3a1 1 0 002 0v3a1 1 0 002 0v3a1 1 0 00-1-1zm0 4a2 2 0 100-4 2 2 0 014 0 2 2 0 014 0zm-2 8a2 2 0 100-4 2 2 0 014 0 2 2 0 014 0z" clipRule="evenodd"/>
                    </svg>
                  </div>
                  <div>
                    <h4 className="text-red-400 font-medium text-sm mb-1">Activation Failed</h4>
                    <p className="text-red-300 text-sm">{activationError}</p>
                  </div>
                </div>
              </div>
            )}

            {/* Activate Button */}
            <Button
              onClick={handleActivation}
              disabled={!activationFile.trim() || isActivating}
              className="w-full bg-gradient-to-r from-blue-600 to-purple-600 hover:from-blue-700 hover:to-purple-700 text-white font-semibold py-3 rounded-lg shadow-lg"
            >
              {isActivating ? (
                <>
                  <Shield className="mr-2 h-4 w-4" />
                  Activating...
                </>
              ) : (
                <>
                  <Shield className="mr-2 h-4 w-4" />
                  Activate
                </>
              )}
            </Button>

            {/* Contact Section */}
            <div className="mt-8 pt-6 border-t border-gray-800">
              <div className="text-center">
                <p className="text-gray-500 text-xs mb-3">Need this software for your business?</p>
                <div className="flex items-center justify-center gap-4 mb-3">
                  <a 
                    href="tel:+251912345678" 
                    className="text-blue-400 hover:text-blue-300 transition-colors flex items-center gap-1"
                  >
                    <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 20 20">
                      <path d="M2 3a1 1 0 011-1h2.153a1 1 0 01.986.836l.74 4.435a1 1 0 01-.54 1.06l-1.548.773a11.037 11.037 0 006.105 6.105l.774-1.548a1 1 0 011.059-.54l4.435.74a1 1 0 01.836.986V17a1 1 0 01-1 1h-2C7.82 18 2 12.18 2 5V3z"/>
                    </svg>
                    <span className="text-sm">+251 912 345 678</span>
                  </a>
                  <a 
                    href="mailto:info@gobingo.com" 
                    className="text-blue-400 hover:text-blue-300 transition-colors flex items-center gap-1"
                  >
                    <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 20 20">
                      <path d="M2.003 5.884L10 9.882l7.997-3.998A2 2 0 0016 4H4a2 2 0 00-1.997 1.884z"/>
                      <path d="M18 8.118l-8 4-8-4V14a2 2 0 002 2h12a2 2 0 002-2V8.118z"/>
                    </svg>
                    <span className="text-sm">info@gobingo.com</span>
                  </a>
                </div>
                <p className="text-gray-600 text-xs">© 2024 Go Bingo. All rights reserved.</p>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
