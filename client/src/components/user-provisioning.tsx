/**
 * User Provisioning Component
 * Generates encrypted .enc files for user accounts and recharge
 */
import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useToast } from "@/hooks/use-toast";
import { UserPlus, Download, Shield, Key, Users, DollarSign } from "lucide-react";

interface UserProvisioningProps {
  privateKey: string;
  employees: any[];
  onFileGenerated: (type: 'user' | 'recharge', data: any) => void;
}

export default function UserProvisioning({ privateKey, employees, onFileGenerated }: UserProvisioningProps) {
  const [activeTab, setActiveTab] = useState<'user' | 'recharge'>('user');
  const [isGenerating, setIsGenerating] = useState(false);
  const { toast } = useToast();

  // User provisioning state
  const [fullName, setFullName] = useState("");
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [initialBalance, setInitialBalance] = useState("0");

  // Recharge provisioning state
  const [selectedEmployee, setSelectedEmployee] = useState("");
  const [machineId, setMachineId] = useState("");
  const [rechargeAmount, setRechargeAmount] = useState("");

  const generateUserFile = async () => {
    if (!privateKey) {
      toast({
        title: "Private Key Required",
        description: "Please upload your private key first",
        variant: "destructive"
      });
      return;
    }

    if (!fullName || !username || !password) {
      toast({
        title: "Missing Information",
        description: "Please fill in all user fields",
        variant: "destructive"
      });
      return;
    }

    setIsGenerating(true);
    try {
      const response = await fetch('/api/admin/employees/generate-account-file', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          fullName,
          username,
          password,
          initialBalance,
          privateKey // Send private key for signing
        })
      });

      if (!response.ok) {
        throw new Error('Failed to generate user file');
      }

      const data = await response.json();
      
      // Download the file
      const blob = new Blob([data.encryptedData], { type: "application/octet-stream" });
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = data.filename;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      window.URL.revokeObjectURL(url);

      onFileGenerated('user', data);
      
      // Reset form
      setFullName("");
      setUsername("");
      setPassword("");
      setInitialBalance("0");

      toast({
        title: "User File Generated",
        description: `Account file for ${username} has been downloaded`
      });
    } catch (error) {
      toast({
        title: "Generation Failed",
        description: "Failed to generate user provisioning file",
        variant: "destructive"
      });
    } finally {
      setIsGenerating(false);
    }
  };

  const generateRechargeFile = async () => {
    if (!privateKey) {
      toast({
        title: "Private Key Required",
        description: "Please upload your private key first",
        variant: "destructive"
      });
      return;
    }

    if (!selectedEmployee || !machineId || !rechargeAmount) {
      toast({
        title: "Missing Information",
        description: "Please fill in all recharge fields",
        variant: "destructive"
      });
      return;
    }
    console.log(`selectedEmployee: ${selectedEmployee}`);
    setIsGenerating(true);
    try {
      const response = await fetch('/api/admin/recharge/generate-file', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          employeeAccountNumber: selectedEmployee,
          machineId,
          amount: rechargeAmount,
          privateKey // Send private key for signing
        })
      });

      if (!response.ok) {
        throw new Error('Failed to generate recharge file');
      }

      const data = await response.json();
      
      // Download the file
      const blob = new Blob([data.encryptedData], { type: "application/octet-stream" });
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = data.filename;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      window.URL.revokeObjectURL(url);

      onFileGenerated('recharge', data);

      // Reset form
      setSelectedEmployee("");
      setMachineId("");
      setRechargeAmount("");

      toast({
        title: "Recharge File Generated",
        description: `Recharge file for ${rechargeAmount} ETB has been downloaded`
      });
    } catch (error) {
      toast({
        title: "Generation Failed",
        description: "Failed to generate recharge file",
        variant: "destructive"
      });
    } finally {
      setIsGenerating(false);
    }
  };

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader>
          <div className="flex items-center gap-2">
            <Users className="h-6 w-6 text-purple-500" />
            <CardTitle>User & Recharge Provisioning</CardTitle>
          </div>
          <CardDescription>
            Generate encrypted .enc files for user accounts and balance recharges with cryptographic signing
          </CardDescription>
        </CardHeader>
        <CardContent>
          {/* Tab Selection */}
          <div className="flex space-x-1 mb-6 bg-gray-100 p-1 rounded-lg">
            <Button
              variant={activeTab === 'user' ? 'default' : 'ghost'}
              onClick={() => setActiveTab('user')}
              className="flex-1"
            >
              <UserPlus className="h-4 w-4 mr-2" />
              User Account
            </Button>
            <Button
              variant={activeTab === 'recharge' ? 'default' : 'ghost'}
              onClick={() => setActiveTab('recharge')}
              className="flex-1"
            >
              <DollarSign className="h-4 w-4 mr-2" />
              Balance Recharge
            </Button>
          </div>

          {/* User Account Provisioning */}
          {activeTab === 'user' && (
            <div className="space-y-4">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="fullName">Full Name</Label>
                  <Input
                    id="fullName"
                    value={fullName}
                    onChange={(e) => setFullName(e.target.value)}
                    placeholder="John Doe"
                    className="bg-gray-900 border-gray-700 text-white placeholder:text-gray-400"
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="username">Username</Label>
                  <Input
                    id="username"
                    value={username}
                    onChange={(e) => setUsername(e.target.value)}
                    placeholder="johndoe"
                    className="bg-gray-900 border-gray-700 text-white placeholder:text-gray-400"
                  />
                </div>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="password">Password</Label>
                  <Input
                    id="password"
                    type="password"
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    placeholder="••••••••••"
                    className="bg-gray-900 border-gray-700 text-white placeholder:text-gray-400"
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="initialBalance">Initial Balance (ETB)</Label>
                  <Input
                    id="initialBalance"
                    type="number"
                    value={initialBalance}
                    onChange={(e) => setInitialBalance(e.target.value)}
                    placeholder="0.00"
                    className="bg-gray-900 border-gray-700 text-white placeholder:text-gray-400"
                  />
                </div>
              </div>

              <div className="flex justify-between items-center pt-4">
                <div className="text-sm text-gray-400">
                  <Shield className="h-4 w-4 inline mr-1" />
                  Encrypted with RSA-256
                </div>
                <Button
                  onClick={generateUserFile}
                  disabled={isGenerating || !privateKey}
                  className="bg-purple-600 hover:bg-purple-700 text-white"
                >
                  <Download className="h-4 w-4 mr-2" />
                  {isGenerating ? 'Generating...' : 'Generate User File'}
                </Button>
              </div>
            </div>
          )}

          {/* Recharge Provisioning */}
          {activeTab === 'recharge' && (
            <div className="space-y-4">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label>Select Employee</Label>
                  <Select value={selectedEmployee} onValueChange={setSelectedEmployee}>
                    <SelectTrigger className="bg-gray-900 border-gray-700 text-white">
                      <SelectValue placeholder="Choose employee" />
                    </SelectTrigger>
                    <SelectContent>
                      {employees.map(emp => (
                        <SelectItem key={emp.id} value={emp.accountNumber}>
                          {emp.name} ({emp.accountNumber})
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-2">
                  <Label htmlFor="machineId">Machine ID</Label>
                  <Input
                    id="machineId"
                    value={machineId}
                    onChange={(e) => setMachineId(e.target.value)}
                    placeholder="BNG-XXXXXXXXXXXX (from employee's system)"
                    className="bg-gray-900 border-gray-700 text-white placeholder:text-gray-400 font-mono text-sm"
                  />
                  <p className="text-xs text-gray-500">
                    Enter the machine ID from the employee's report tab
                  </p>
                </div>
              </div>

              <div className="space-y-2">
                <Label htmlFor="rechargeAmount">Recharge Amount (ETB)</Label>
                <Input
                  id="rechargeAmount"
                  type="number"
                  value={rechargeAmount}
                  onChange={(e) => setRechargeAmount(e.target.value)}
                  placeholder="500.00"
                  className="bg-gray-900 border-gray-700 text-white placeholder:text-gray-400"
                />
              </div>

              <div className="flex justify-between items-center pt-4">
                <div className="text-sm text-gray-400">
                  <Key className="h-4 w-4 inline mr-1" />
                  One-time use with unique nonce
                </div>
                <Button
                  onClick={generateRechargeFile}
                  disabled={isGenerating || !privateKey}
                  className="bg-green-600 hover:bg-green-700 text-white"
                >
                  <Download className="h-4 w-4 mr-2" />
                  {isGenerating ? 'Generating...' : 'Generate Recharge File'}
                </Button>
              </div>

              <div className="p-4 bg-blue-50 rounded-lg border border-blue-200">
                <p className="text-sm text-blue-700">
                  <strong>Security Features:</strong> Each recharge file includes a unique nonce, timestamp, and machine ID binding to prevent reuse and unauthorized access.
                </p>
              </div>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
