/**
 * Security Settings Component
 * Manages private key upload and security configuration
 */
import { useState, useRef } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useToast } from "@/hooks/use-toast";
import { Key, Shield, Eye, EyeOff, Upload, AlertTriangle } from "lucide-react";

interface SecuritySettingsProps {
  onPrivateKeyChange: (key: string) => void;
}

export default function SecuritySettings({ onPrivateKeyChange }: SecuritySettingsProps) {
  const [privateKey, setPrivateKey] = useState<string>("");
  const [showKey, setShowKey] = useState(false);
  const [isKeyLoaded, setIsKeyLoaded] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const { toast } = useToast();

  const handleFileUpload = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;

    if (file.type !== 'application/x-pem-file' && !file.name.endsWith('.pem')) {
      toast({
        title: "Invalid File Format",
        description: "Please upload a valid .pem private key file",
        variant: "destructive"
      });
      return;
    }

    const reader = new FileReader();
    reader.onload = (e) => {
      const content = e.target?.result as string;
      if (content.includes('-----BEGIN PRIVATE KEY-----') && content.includes('-----END PRIVATE KEY-----')) {
        setPrivateKey(content);
        setIsKeyLoaded(true);
        onPrivateKeyChange(content);
      } else {
        toast({
          title: "Invalid Private Key",
          description: "The uploaded file is not a valid private key",
          variant: "destructive"
        });
      }
    };
    reader.readAsText(file);
  };

  const handleRemoveKey = () => {
    setPrivateKey("");
    setIsKeyLoaded(false);
    setShowKey(false);
    onPrivateKeyChange("");
    if (fileInputRef.current) {
      fileInputRef.current.value = '';
    }
    toast({
      title: "Private Key Removed",
      description: "Private key has been cleared from memory",
    });
  };

  return (
    <div className="space-y-6">
      {/* Private Key Management */}
      <Card>
        <CardHeader>
          <div className="flex items-center gap-2">
            <Key className="h-6 w-6 text-amber-500" />
            <CardTitle>Private Key Management</CardTitle>
          </div>
          <CardDescription>
            Upload your private key to authorize .enc file generation. The key is stored in memory only and cleared when you log out.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          {!isKeyLoaded ? (
            <div className="space-y-4">
              <div className="border-2 border-dashed border-gray-300 rounded-lg p-8 text-center">
                <Upload className="h-12 w-12 text-gray-400 mx-auto mb-4" />
                <Label className="text-lg font-medium text-gray-700 cursor-pointer">
                  Click to upload private_key.pem
                </Label>
                <p className="text-sm text-gray-500 mt-2">
                  Supported format: PEM (.pem) files only
                </p>
                <input
                  ref={fileInputRef}
                  type="file"
                  accept=".pem"
                  onChange={handleFileUpload}
                  className="hidden"
                />
                <Button
                  onClick={() => fileInputRef.current?.click()}
                  className="mt-4"
                  variant="outline"
                >
                  <Upload className="h-4 w-4 mr-2" />
                  Select Private Key File
                </Button>
              </div>
            </div>
          ) : (
            <div className="space-y-4">
              <div className="flex items-center justify-between p-4 bg-green-50 border border-green-200 rounded-lg">
                <div className="flex items-center gap-2">
                  <Shield className="h-5 w-5 text-green-600" />
                  <span className="text-sm font-medium text-green-800">Private Key Loaded</span>
                </div>
                <Button
                  onClick={handleRemoveKey}
                  variant="destructive"
                  size="sm"
                >
                  Remove
                </Button>
              </div>

              <div className="space-y-2">
                <Label className="text-sm font-medium">Private Key Preview</Label>
                <div className="relative">
                  <Input
                    type={showKey ? "text" : "password"}
                    value={privateKey}
                    readOnly
                    className="font-mono text-xs bg-gray-50 pr-10"
                    placeholder="Private key will appear here"
                  />
                  <Button
                    type="button"
                    variant="ghost"
                    size="sm"
                    className="absolute right-2 top-1/2 -translate-y-1/2 h-6 w-6 p-0"
                    onClick={() => setShowKey(!showKey)}
                  >
                    {showKey ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                  </Button>
                </div>
              </div>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Security Information */}
      <Card>
        <CardHeader>
          <div className="flex items-center gap-2">
            <Shield className="h-6 w-6 text-blue-500" />
            <CardTitle>Security Information</CardTitle>
          </div>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="p-4 bg-blue-50 rounded-lg border border-blue-200">
              <h4 className="font-semibold text-blue-800 mb-2">Key Storage</h4>
              <p className="text-sm text-blue-700">Memory Only</p>
              <p className="text-xs text-blue-600 mt-1">Cleared on logout</p>
            </div>
            <div className="p-4 bg-green-50 rounded-lg border border-green-200">
              <h4 className="font-semibold text-green-800 mb-2">File Signing</h4>
              <p className="text-sm text-green-700">RSA-256</p>
              <p className="text-xs text-green-600 mt-1">Cryptographic signatures</p>
            </div>
          </div>

          <div className="p-4 bg-amber-50 rounded-lg border border-amber-200">
            <div className="flex items-start gap-2">
              <AlertTriangle className="h-5 w-5 text-amber-600 mt-0.5" />
              <div>
                <h4 className="font-semibold text-amber-800 mb-1">Security Notice</h4>
                <p className="text-sm text-amber-700">
                  Never share your private key file. Anyone with access to your private key can generate valid recharge files for your system.
                </p>
              </div>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
