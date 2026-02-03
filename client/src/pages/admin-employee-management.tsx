import { useState } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useToast } from "@/hooks/use-toast";
import { queryClient, apiRequest } from "@/lib/queryClient";
import { Users, Settings, Lock, Percent } from "lucide-react";

interface Employee {
  id: number;
  username: string;
  name: string;
  shopId: number;
}

interface Shop {
  id: number;
  name: string;
  adminId: number;
}

interface EmployeeProfitMargin {
  id: number;
  employeeId: number;
  shopId: number;
  profitMargin: string;
  employeeName: string;
  employeeUsername: string;
  shopName: string;
}

export default function AdminEmployeeManagement() {
  const { toast } = useToast();
  const [selectedEmployee, setSelectedEmployee] = useState<Employee | null>(null);
  const [newPassword, setNewPassword] = useState("");
  const [selectedShopForMargin, setSelectedShopForMargin] = useState<number | null>(null);
  const [selectedEmployeeForMargin, setSelectedEmployeeForMargin] = useState<number | null>(null);
  const [newProfitMargin, setNewProfitMargin] = useState("");
  const [passwordDialogOpen, setPasswordDialogOpen] = useState(false);
  const [marginDialogOpen, setMarginDialogOpen] = useState(false);

  // Fetch employees in admin's shops
  const { data: employees = [], isLoading: employeesLoading } = useQuery({
    queryKey: ["/api/users/shop"],
    select: (data: any[]) => data.filter((user: any) => user.role === "employee")
  });

  // Fetch admin's shops
  const { data: shops = [], isLoading: shopsLoading } = useQuery({
    queryKey: ["/api/admin/shops"]
  });

  // Fetch employee profit margins
  const { data: profitMargins = [], isLoading: marginsLoading } = useQuery({
    queryKey: ["/api/admin/employee-profit-margins"]
  });

  // Update employee password mutation
  const updatePasswordMutation = useMutation({
    mutationFn: async ({ employeeId, newPassword }: { employeeId: number; newPassword: string }) => {
      return apiRequest(`/api/admin/employees/${employeeId}/password`, "PATCH", { newPassword });
    },
    onSuccess: () => {
      toast({
        title: "Success",
        description: "Employee password updated successfully",
      });
      setPasswordDialogOpen(false);
      setNewPassword("");
      setSelectedEmployee(null);
    },
    onError: (error: any) => {
      toast({
        title: "Error",
        description: error.message || "Failed to update password",
        variant: "destructive",
      });
    },
  });

  // Set/Update profit margin mutation
  const setProfitMarginMutation = useMutation({
    mutationFn: async (data: { employeeId: number; shopId: number; profitMargin: string }) => {
      return apiRequest("/api/admin/employee-profit-margins", "POST", data);
    },
    onSuccess: () => {
      toast({
        title: "Success",
        description: "Profit margin set successfully",
      });
      setMarginDialogOpen(false);
      setNewProfitMargin("");
      setSelectedShopForMargin(null);
      setSelectedEmployeeForMargin(null);
      queryClient.invalidateQueries({ queryKey: ["/api/admin/employee-profit-margins"] });
    },
    onError: (error: any) => {
      toast({
        title: "Error",
        description: error.message || "Failed to set profit margin",
        variant: "destructive",
      });
    },
  });

  // Update existing profit margin mutation
  const updateProfitMarginMutation = useMutation({
    mutationFn: async ({ marginId, profitMargin }: { marginId: number; profitMargin: string }) => {
      return apiRequest(`/api/admin/employee-profit-margins/${marginId}`, "PATCH", { profitMargin });
    },
    onSuccess: () => {
      toast({
        title: "Success",
        description: "Profit margin updated successfully",
      });
      queryClient.invalidateQueries({ queryKey: ["/api/admin/employee-profit-margins"] });
    },
    onError: (error: any) => {
      toast({
        title: "Error",
        description: error.message || "Failed to update profit margin",
        variant: "destructive",
      });
    },
  });

  const handlePasswordUpdate = () => {
    if (!selectedEmployee || !newPassword.trim()) return;
    if (newPassword.length < 6) {
      toast({
        title: "Error",
        description: "Password must be at least 6 characters",
        variant: "destructive",
      });
      return;
    }
    updatePasswordMutation.mutate({ employeeId: selectedEmployee.id, newPassword });
  };

  const handleSetProfitMargin = () => {
    if (!selectedEmployeeForMargin || !selectedShopForMargin || !newProfitMargin.trim()) return;
    const margin = parseFloat(newProfitMargin);
    if (isNaN(margin) || margin < 0 || margin > 100) {
      toast({
        title: "Error",
        description: "Profit margin must be between 0 and 100",
        variant: "destructive",
      });
      return;
    }
    setProfitMarginMutation.mutate({
      employeeId: selectedEmployeeForMargin,
      shopId: selectedShopForMargin,
      profitMargin: newProfitMargin
    });
  };

  const handleUpdateExistingMargin = (marginId: number, currentMargin: string) => {
    const newMargin = prompt("Enter new profit margin (%)", currentMargin);
    if (!newMargin) return;
    
    const margin = parseFloat(newMargin);
    if (isNaN(margin) || margin < 0 || margin > 100) {
      toast({
        title: "Error",
        description: "Profit margin must be between 0 and 100",
        variant: "destructive",
      });
      return;
    }

    updateProfitMarginMutation.mutate({ marginId, profitMargin: newMargin });
  };

  if (employeesLoading || shopsLoading || marginsLoading) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="text-xl">Loading employee management...</div>
      </div>
    );
  }

  return (
    <div className="container mx-auto p-6 space-y-6">
      <div className="flex items-center gap-3 mb-6">
        <Users className="h-8 w-8 text-blue-600" />
        <h1 className="text-3xl font-bold">Employee Management</h1>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Employee Password Management */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Lock className="h-5 w-5" />
              Password Management
            </CardTitle>
            <CardDescription>
              Update employee passwords for your shops
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="space-y-3">
              {employees.map((employee: Employee) => (
                <div key={employee.id} className="flex items-center justify-between p-3 border rounded-lg">
                  <div>
                    <div className="font-medium">{employee.name}</div>
                    <div className="text-sm text-gray-600">@{employee.username}</div>
                  </div>
                  <Dialog open={passwordDialogOpen && selectedEmployee?.id === employee.id} onOpenChange={setPasswordDialogOpen}>
                    <DialogTrigger asChild>
                      <Button 
                        variant="outline" 
                        size="sm"
                        onClick={() => setSelectedEmployee(employee)}
                      >
                        <Settings className="h-4 w-4 mr-1" />
                        Change Password
                      </Button>
                    </DialogTrigger>
                    <DialogContent>
                      <DialogHeader>
                        <DialogTitle>Change Password for {employee.name}</DialogTitle>
                        <DialogDescription>
                          Enter a new password for this employee. Password must be at least 6 characters.
                        </DialogDescription>
                      </DialogHeader>
                      <div className="space-y-4">
                        <div>
                          <Label htmlFor="newPassword">New Password</Label>
                          <Input
                            id="newPassword"
                            type="password"
                            value={newPassword}
                            onChange={(e) => setNewPassword(e.target.value)}
                            placeholder="Enter new password"
                            className="mt-1"
                          />
                        </div>
                        <div className="flex justify-end gap-2">
                          <Button variant="outline" onClick={() => setPasswordDialogOpen(false)}>
                            Cancel
                          </Button>
                          <Button 
                            onClick={handlePasswordUpdate}
                            disabled={updatePasswordMutation.isPending}
                          >
                            {updatePasswordMutation.isPending ? "Updating..." : "Update Password"}
                          </Button>
                        </div>
                      </div>
                    </DialogContent>
                  </Dialog>
                </div>
              ))}
              {employees.length === 0 && (
                <div className="text-center text-gray-500 py-4">
                  No employees found in your shops
                </div>
              )}
            </div>
          </CardContent>
        </Card>

        {/* Profit Margin Management */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Percent className="h-5 w-5" />
              Profit Margin Management
            </CardTitle>
            <CardDescription>
              Set individual profit margins per employee per shop
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <Dialog open={marginDialogOpen} onOpenChange={setMarginDialogOpen}>
              <DialogTrigger asChild>
                <Button className="w-full">
                  <Percent className="h-4 w-4 mr-2" />
                  Set New Profit Margin
                </Button>
              </DialogTrigger>
              <DialogContent>
                <DialogHeader>
                  <DialogTitle>Set Employee Profit Margin</DialogTitle>
                  <DialogDescription>
                    Configure profit margin for a specific employee in a specific shop
                  </DialogDescription>
                </DialogHeader>
                <div className="space-y-4">
                  <div>
                    <Label>Select Shop</Label>
                    <Select value={selectedShopForMargin?.toString()} onValueChange={(value) => setSelectedShopForMargin(parseInt(value))}>
                      <SelectTrigger>
                        <SelectValue placeholder="Choose a shop" />
                      </SelectTrigger>
                      <SelectContent>
                        {shops.map((shop: Shop) => (
                          <SelectItem key={shop.id} value={shop.id.toString()}>
                            {shop.name}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                  <div>
                    <Label>Select Employee</Label>
                    <Select value={selectedEmployeeForMargin?.toString()} onValueChange={(value) => setSelectedEmployeeForMargin(parseInt(value))}>
                      <SelectTrigger>
                        <SelectValue placeholder="Choose an employee" />
                      </SelectTrigger>
                      <SelectContent>
                        {employees.map((employee: Employee) => (
                          <SelectItem key={employee.id} value={employee.id.toString()}>
                            {employee.name} (@{employee.username})
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                  <div>
                    <Label htmlFor="profitMargin">Profit Margin (%)</Label>
                    <Input
                      id="profitMargin"
                      type="number"
                      min="0"
                      max="100"
                      step="0.01"
                      value={newProfitMargin}
                      onChange={(e) => setNewProfitMargin(e.target.value)}
                      placeholder="e.g., 20.00"
                      className="mt-1"
                    />
                  </div>
                  <div className="flex justify-end gap-2">
                    <Button variant="outline" onClick={() => setMarginDialogOpen(false)}>
                      Cancel
                    </Button>
                    <Button 
                      onClick={handleSetProfitMargin}
                      disabled={setProfitMarginMutation.isPending}
                    >
                      {setProfitMarginMutation.isPending ? "Setting..." : "Set Margin"}
                    </Button>
                  </div>
                </div>
              </DialogContent>
            </Dialog>

            {/* Current Profit Margins */}
            <div className="space-y-3">
              <h4 className="font-medium">Current Profit Margins</h4>
              {profitMargins.map((margin: EmployeeProfitMargin) => (
                <div key={margin.id} className="flex items-center justify-between p-3 border rounded-lg">
                  <div>
                    <div className="font-medium">{margin.employeeName}</div>
                    <div className="text-sm text-gray-600">{margin.shopName} • {margin.profitMargin}%</div>
                  </div>
                  <Button 
                    variant="outline" 
                    size="sm"
                    onClick={() => handleUpdateExistingMargin(margin.id, margin.profitMargin)}
                    disabled={updateProfitMarginMutation.isPending}
                  >
                    Edit
                  </Button>
                </div>
              ))}
              {profitMargins.length === 0 && (
                <div className="text-center text-gray-500 py-4">
                  No profit margins configured yet
                </div>
              )}
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}