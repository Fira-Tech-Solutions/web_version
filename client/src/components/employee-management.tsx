/**
 * Employee Management Component
 * Complete employee data management with machine ID and password handling
 */
import { useState } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { useToast } from "@/hooks/use-toast";
import { 
  Users, 
  Eye, 
  EyeOff, 
  Copy, 
  Edit, 
  Trash2, 
  Monitor, 
  Key,
  Shield,
  Search,
  Plus
} from "lucide-react";

interface EmployeeManagementProps {
  employees: any[];
  onEmployeeUpdated: () => void;
}

export default function EmployeeManagement({ employees, onEmployeeUpdated }: EmployeeManagementProps) {
  const [searchTerm, setSearchTerm] = useState("");
  const [showPasswords, setShowPasswords] = useState<Record<number, boolean>>({});
  const [editingEmployee, setEditingEmployee] = useState<any | null>(null);
  const [isEditDialogOpen, setIsEditDialogOpen] = useState(false);
  const { toast } = useToast();

  const filteredEmployees = employees.filter(emp => 
    emp.name?.toLowerCase().includes(searchTerm.toLowerCase()) ||
    emp.accountNumber?.toLowerCase().includes(searchTerm.toLowerCase()) ||
    emp.machineId?.toLowerCase().includes(searchTerm.toLowerCase())
  );

  const togglePasswordVisibility = (employeeId: number) => {
    setShowPasswords(prev => ({
      ...prev,
      [employeeId]: !prev[employeeId]
    }));
  };

  const copyToClipboard = async (text: string, type: string) => {
    try {
      await navigator.clipboard.writeText(text);
      toast({
        title: "Copied",
        description: `${type} copied to clipboard`
      });
    } catch {
      toast({
        title: "Copy Failed",
        description: `Failed to copy ${type}`,
        variant: "destructive"
      });
    }
  };

  const openEditDialog = (employee: any) => {
    setEditingEmployee({ ...employee });
    setIsEditDialogOpen(true);
  };

  const handleEditEmployee = (employee: any) => {
    setEditingEmployee({ ...employee });
    setIsEditDialogOpen(true);
  };

  const handleSaveEmployee = async () => {
    try {
      const response = await fetch(`/api/admin/employees/${editingEmployee.id}/machine-id`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ machineId: editingEmployee.machineId })
      });

      if (response.ok) {
        toast({
          title: "Machine ID Updated",
          description: `${editingEmployee.name}'s machine ID has been updated`
        });
        setIsEditDialogOpen(false);
        setEditingEmployee(null);
        onEmployeeUpdated();
      } else {
        const error = await response.json();
        toast({
          title: "Update Failed",
          description: error.message || "Failed to update machine ID",
          variant: "destructive"
        });
      }
    } catch (error) {
      toast({
        title: "Update Failed",
        description: "Failed to update machine ID",
        variant: "destructive"
      });
    }
  };

  const handleDeleteEmployee = async (employee: any) => {
    if (confirm(`Are you sure you want to delete ${employee.name}?`)) {
      try {
        const response = await fetch(`/api/admin/employees/${employee.id}`, {
          method: 'DELETE',
          headers: { 'Content-Type': 'application/json' }
        });

        if (response.ok) {
          toast({
            title: "Employee Deleted",
            description: `${employee.name} has been removed`
          });
          onEmployeeUpdated(); // Refresh the employee list
        } else {
          const errorData = await response.json();
          throw new Error(errorData.message || 'Failed to delete employee');
        }
      } catch (error) {
        toast({
          title: "Delete Failed",
          description: error instanceof Error ? error.message : "Failed to delete employee",
          variant: "destructive"
        });
      }
    }
  };

  const maskPassword = (password: string) => {
    if (!password) return '•••••••••';
    return password.substring(0, 2) + '••••••••';
  };

  return (
    <div className="space-y-6">
      {/* Search and Actions */}
      <Card className="bg-slate-900 border-slate-800">
        <CardHeader>
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <Users className="h-5 w-5 text-blue-400" />
              <CardTitle className="text-white">Employee Management</CardTitle>
            </div>
            <Button className="bg-blue-600 hover:bg-blue-700 text-white">
              <Plus className="h-4 w-4 mr-2" />
              Add Employee
            </Button>
          </div>
          <CardDescription className="text-slate-400">
            Manage employee accounts, machine IDs, and credentials
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="flex items-center gap-2">
            <Search className="h-4 w-4 text-slate-400" />
            <Input
              placeholder="Search employees by name, account number, or machine ID..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="bg-slate-800 border-slate-700 text-white placeholder:text-slate-400"
            />
          </div>
        </CardContent>
      </Card>

      {/* Employee Table */}
      <Card className="bg-slate-900 border-slate-800">
        <CardHeader>
          <CardTitle className="text-white">Employee Directory</CardTitle>
          <CardDescription className="text-slate-400">
            Complete employee information with machine IDs and credentials
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow className="border-slate-700">
                  <TableHead className="text-slate-300">Name</TableHead>
                  <TableHead className="text-slate-300">Account Number</TableHead>
                  <TableHead className="text-slate-300">Machine ID</TableHead>
                  <TableHead className="text-slate-300">Password</TableHead>
                  <TableHead className="text-slate-300">Balance</TableHead>
                  <TableHead className="text-slate-300">Status</TableHead>
                  <TableHead className="text-slate-300">Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {filteredEmployees.map((emp) => (
                  <TableRow key={emp.id} className="border-slate-700">
                    <TableCell className="text-white font-medium">{emp.name}</TableCell>
                    <TableCell className="text-slate-300">
                      <div className="flex items-center gap-2">
                        <span className="font-mono text-sm">{emp.accountNumber}</span>
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => copyToClipboard(emp.accountNumber, 'Account Number')}
                          className="h-6 w-6 p-0 text-slate-400 hover:text-white"
                        >
                          <Copy className="h-3 w-3" />
                        </Button>
                      </div>
                    </TableCell>
                    <TableCell className="text-slate-300">
                      <div className="flex items-center gap-2">
                        <Monitor className="h-4 w-4 text-slate-400" />
                        <span className="font-mono text-sm">{emp.machineId || 'Not Set'}</span>
                        <div className="flex gap-1">
                          {emp.machineId && (
                            <Button
                              variant="ghost"
                              size="sm"
                              onClick={() => copyToClipboard(emp.machineId, 'Machine ID')}
                              className="h-6 w-6 p-0 text-slate-400 hover:text-white"
                            >
                              <Copy className="h-3 w-3" />
                            </Button>
                          )}
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => openEditDialog(emp)}
                            className="h-6 w-6 p-0 text-slate-400 hover:text-white"
                            title="Edit Machine ID"
                          >
                            <Edit className="h-3 w-3" />
                          </Button>
                        </div>
                      </div>
                    </TableCell>
                    <TableCell className="text-slate-300">
                      <div className="flex items-center gap-2">
                        <Key className="h-4 w-4 text-slate-400" />
                        <span className="font-mono text-sm bg-slate-800 px-2 py-1 rounded">
                          {showPasswords[emp.id] ? emp.password || 'N/A' : maskPassword(emp.password || '')}
                        </span>
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => togglePasswordVisibility(emp.id)}
                          className="h-6 w-6 p-0 text-slate-400 hover:text-white"
                        >
                          {showPasswords[emp.id] ? <EyeOff className="h-3 w-3" /> : <Eye className="h-3 w-3" />}
                        </Button>
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => copyToClipboard(emp.password || '', 'Password')}
                          className="h-6 w-6 p-0 text-slate-400 hover:text-white"
                        >
                          <Copy className="h-3 w-3" />
                        </Button>
                      </div>
                    </TableCell>
                    <TableCell className="text-green-400 font-bold">ETB {emp.balance || '0.00'}</TableCell>
                    <TableCell>
                      <Badge variant={emp.isBlocked ? "destructive" : "secondary"} className="bg-green-600 text-white">
                        {emp.isBlocked ? "Blocked" : "Active"}
                      </Badge>
                    </TableCell>
                    <TableCell>
                      <div className="flex gap-1">
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => handleEditEmployee(emp)}
                          className="border-slate-600 text-slate-300 hover:bg-slate-700"
                        >
                          <Edit className="h-3 w-3" />
                        </Button>
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => handleDeleteEmployee(emp)}
                          className="border-red-600 text-red-400 hover:bg-red-900/20"
                        >
                          <Trash2 className="h-3 w-3" />
                        </Button>
                      </div>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
        </CardContent>
      </Card>

      {/* Edit Employee Dialog */}
      <Dialog open={isEditDialogOpen} onOpenChange={setIsEditDialogOpen}>
        <DialogContent className="bg-slate-900 border-slate-800 text-white max-w-2xl">
          <DialogHeader>
            <DialogTitle className="text-white">Edit Employee</DialogTitle>
            <DialogDescription className="text-slate-400">
              Update employee information and credentials
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label className="text-slate-300">Full Name</Label>
                <Input
                  value={editingEmployee?.name || ''}
                  onChange={(e) => setEditingEmployee(prev => prev ? {...prev, name: e.target.value} : null)}
                  className="bg-slate-800 border-slate-700 text-white"
                />
              </div>
              <div className="space-y-2">
                <Label className="text-slate-300">Account Number</Label>
                <Input
                  value={editingEmployee?.accountNumber || ''}
                  readOnly
                  className="bg-slate-800 border-slate-700 text-slate-400"
                />
              </div>
            </div>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label className="text-slate-300">Machine ID</Label>
                <Input
                  value={editingEmployee?.machineId || ''}
                  onChange={(e) => setEditingEmployee(prev => prev ? {...prev, machineId: e.target.value} : null)}
                  placeholder="BNG-XXXXXXXXXXXX (from employee's system)"
                  className="bg-slate-800 border-slate-700 text-white font-mono text-sm"
                />
                <p className="text-xs text-slate-500">
                  Enter the machine ID provided by the employee from their system report tab
                </p>
              </div>
              <div className="space-y-2">
                <Label className="text-slate-300">Password</Label>
                <Input
                  type="password"
                  value={editingEmployee?.password || ''}
                  onChange={(e) => setEditingEmployee(prev => prev ? {...prev, password: e.target.value} : null)}
                  className="bg-slate-800 border-slate-700 text-white"
                />
              </div>
            </div>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label className="text-slate-300">Current Balance (ETB)</Label>
                <Input
                  type="number"
                  value={editingEmployee?.balance || ''}
                  onChange={(e) => setEditingEmployee(prev => prev ? {...prev, balance: e.target.value} : null)}
                  className="bg-slate-800 border-slate-700 text-white"
                />
              </div>
              <div className="space-y-2">
                <Label className="text-slate-300">Status</Label>
                <select
                  value={editingEmployee?.isBlocked ? 'blocked' : 'active'}
                  onChange={(e) => setEditingEmployee(prev => prev ? {...prev, isBlocked: e.target.value === 'blocked'} : null)}
                  className="w-full bg-slate-800 border-slate-700 text-white rounded-md px-3 py-2"
                >
                  <option value="active">Active</option>
                  <option value="blocked">Blocked</option>
                </select>
              </div>
            </div>
          </div>
          <div className="flex justify-end gap-2 pt-4 border-t border-slate-700">
            <Button
              variant="outline"
              onClick={() => setIsEditDialogOpen(false)}
              className="border-slate-600 text-slate-300"
            >
              Cancel
            </Button>
            <Button
              onClick={handleSaveEmployee}
              className="bg-blue-600 hover:bg-blue-700 text-white"
            >
              Save Changes
            </Button>
          </div>
        </DialogContent>
      </Dialog>

      {/* Security Notice */}
      <Card className="border-amber-200 bg-amber-50">
        <CardHeader>
          <CardTitle className="text-amber-800 flex items-center gap-2">
            <Shield className="h-5 w-5" />
            Security Notice
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="space-y-2 text-sm text-amber-700">
            <p>• Machine IDs bind employees to specific devices</p>
            <p>• Passwords are encrypted and stored securely</p>
            <p>• Account numbers are unique identifiers</p>
            <p>• All changes are logged for audit purposes</p>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
