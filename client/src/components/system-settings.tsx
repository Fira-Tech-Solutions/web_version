import { useState, useEffect } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { useToast } from "@/hooks/use-toast";
import { Settings, Percent, DollarSign, Save, History } from "lucide-react";

interface SystemSettingsProps {
  userRole: 'admin' | 'super_admin';
}

export function SystemSettings({ userRole }: SystemSettingsProps) {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [commissionRate, setCommissionRate] = useState("15");
  const [adminProfitMargin, setAdminProfitMargin] = useState("70");

  // Fetch current settings
  const { data: currentSettings } = useQuery({
    queryKey: ["/api/admin/system-settings"],
    enabled: userRole === 'admin' || userRole === 'super_admin',
  });

  // Update state when settings are loaded
  useEffect(() => {
    if (currentSettings) {
      setCommissionRate((currentSettings as any).commissionRate || "25");
      setAdminProfitMargin((currentSettings as any).adminProfitMargin || "15");
    }
  }, [currentSettings]);

  const { data: gameHistory = [] } = useQuery({
    queryKey: ["/api/admin/game-history"],
    enabled: userRole === 'admin' || userRole === 'super_admin',
  });

  const updateSettingsMutation = useMutation({
    mutationFn: async (settings: any) => {
      const response = await fetch("/api/admin/system-settings", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(settings),
      });
      
      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.message || "Failed to update settings");
      }
      
      return response.json();
    },
    onSuccess: () => {
      // Invalidate cache to refresh settings display
      queryClient.invalidateQueries({ queryKey: ["/api/admin/system-settings"] });
      queryClient.invalidateQueries({ queryKey: ["/api/shops"] });
      toast({
        title: "Settings Updated",
        description: "System settings have been updated successfully.",
      });
    },
    onError: (error: any) => {
      toast({
        title: "Error",
        description: error.message || "Failed to update settings",
        variant: "destructive",
      });
    },
  });

  const handleSaveSettings = () => {
    const settings: any = {};
    
    // Admin can only edit profit margin
    if (userRole === 'admin') {
      settings.adminProfitMargin = parseFloat(adminProfitMargin);
      if (settings.adminProfitMargin > 100) {
        toast({
          title: "Invalid Settings",
          description: "Profit margin cannot exceed 100%",
          variant: "destructive",
        });
        return;
      }
    } else if (userRole === 'super_admin') {
      // Super admin can edit commission rate and profit margin
      settings.commissionRate = parseFloat(commissionRate);
      settings.adminProfitMargin = parseFloat(adminProfitMargin);
      
      if (settings.commissionRate > 100 || settings.adminProfitMargin > 100) {
        toast({
          title: "Invalid Settings",
          description: "Percentages cannot exceed 100%",
          variant: "destructive",
        });
        return;
      }
    }

    updateSettingsMutation.mutate(settings);
  };

  if (userRole !== 'admin' && userRole !== 'super_admin') {
    return (
      <Card>
        <CardContent className="p-6">
          <p className="text-center text-muted-foreground">
            Access denied. Admin privileges required.
          </p>
        </CardContent>
      </Card>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-2">
        <Settings className="w-6 h-6" />
        <h2 className="text-2xl font-bold">System Settings & Game History</h2>
      </div>

      <Tabs defaultValue="settings" className="w-full">
        <TabsList className="grid w-full grid-cols-2">
          <TabsTrigger value="settings">Profit & Commission Settings</TabsTrigger>
          <TabsTrigger value="history">Game History</TabsTrigger>
        </TabsList>

        <TabsContent value="settings" className="space-y-6">
          <div className="grid md:grid-cols-2 gap-6">
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Percent className="w-5 h-5 text-blue-600" />
                  Commission Settings
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <div>
                  <Label htmlFor="commissionRate">Super Admin Commission Rate (%)</Label>
                  <Input
                    id="commissionRate"
                    type="number"
                    min="0"
                    max="50"
                    step="0.5"
                    value={commissionRate}
                    onChange={(e) => userRole === 'super_admin' ? setCommissionRate(e.target.value) : null}
                    placeholder="15"
                    disabled={userRole !== 'super_admin'}
                    className={userRole !== 'super_admin' ? 'bg-gray-100 cursor-not-allowed' : ''}
                  />
                  <p className="text-sm text-muted-foreground mt-1">
                    {userRole === 'super_admin' 
                      ? 'Percentage of game revenue that goes to super admin'
                      : 'Commission rate can only be modified by super admin'
                    }
                  </p>
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <DollarSign className="w-5 h-5 text-green-600" />
                  Admin Profit Margin
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <div>
                  <Label htmlFor="adminProfitMargin">Admin Profit Margin (%)</Label>
                  <Input
                    id="adminProfitMargin"
                    type="number"
                    min="0"
                    max="100"
                    step="1"
                    value={adminProfitMargin}
                    onChange={(e) => setAdminProfitMargin(e.target.value)}
                    placeholder="70"
                  />
                  <p className="text-sm text-muted-foreground mt-1">
                    Percentage of remaining revenue that goes to shop admin
                  </p>
                </div>

                <div className="bg-blue-50 p-4 rounded-lg">
                  <h3 className="font-medium mb-2">Revenue Distribution Preview:</h3>
                  <div className="space-y-1 text-sm">
                    <div>
                      Super Admin Commission: {commissionRate}%
                    </div>
                    <div>
                      Admin Profit Margin: {adminProfitMargin}% of remaining revenue
                    </div>
                    <div>
                      Admin Gets: {((100 - parseFloat(commissionRate || "0")) * parseFloat(adminProfitMargin || "0") / 100).toFixed(1)}% of total
                    </div>
                  </div>
                </div>
              </CardContent>
            </Card>
          </div>

          <Card>
            <CardContent className="p-6">
              <Button
                onClick={handleSaveSettings}
                disabled={updateSettingsMutation.isPending}
                className="w-full md:w-auto"
              >
                <Save className="w-4 h-4 mr-2" />
                {updateSettingsMutation.isPending ? "Saving..." : "Save Settings"}
              </Button>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="history" className="space-y-6">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <History className="w-5 h-5 text-purple-600" />
                Game History
              </CardTitle>
            </CardHeader>
            <CardContent>
              {Array.isArray(gameHistory) && gameHistory.length > 0 ? (
                <div className="space-y-4">
                  <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                    {gameHistory.map((game: any) => (
                      <Card key={game.id} className="border-l-4 border-l-blue-500">
                        <CardContent className="p-4">
                          <div className="space-y-2">
                            <div className="flex justify-between items-start">
                              <span className="font-medium">Game #{game.id}</span>
                              <span className="text-sm text-muted-foreground">
                                {new Date(game.completedAt).toLocaleDateString()}
                              </span>
                            </div>
                            <div className="space-y-1 text-sm">
                              <div className="flex justify-between">
                                <span>Status:</span>
                                <span className="capitalize">{game.status}</span>
                              </div>
                              <div className="flex justify-between">
                                <span>Total Amount:</span>
                                <span>{game.amount} ETB</span>
                              </div>
                              <div className="flex justify-between">
                                <span>Players:</span>
                                <span>{game.playerCount}</span>
                              </div>
                              <div className="flex justify-between">
                                <span>Admin Profit:</span>
                                <span>{game.adminProfit} ETB</span>
                              </div>
                              <div className="flex justify-between">
                                <span>Super Admin Commission:</span>
                                <span>{game.superAdminCommission} ETB</span>
                              </div>
                            </div>
                          </div>
                        </CardContent>
                      </Card>
                    ))}
                  </div>
                </div>
              ) : (
                <div className="text-center py-8">
                  <History className="w-12 h-12 text-muted-foreground mx-auto mb-4" />
                  <p className="text-muted-foreground">No game history available</p>
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
}