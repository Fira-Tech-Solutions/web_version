import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import { AlertCircle, Database, Users, Building, Gamepad2 } from "lucide-react";
import { Alert, AlertDescription } from "@/components/ui/alert";

interface MongoDBUser {
  id: string;
  username: string;
  role: string;
  name: string;
  email?: string;
  shopId?: string;
  creditBalance: string;
  accountNumber?: string;
  createdAt: string;
}

interface MongoDBStatus {
  status: string;
  database: string;
  collections: {
    users: number;
    shops: number;
    games: number;
  };
  timestamp: string;
}

export default function MongoDBTest() {
  const [loginData, setLoginData] = useState({ username: "", password: "" });
  const [isLoggedIn, setIsLoggedIn] = useState(false);
  const [user, setUser] = useState<MongoDBUser | null>(null);
  const [loginError, setLoginError] = useState("");

  // Fetch MongoDB status
  const { data: status, isLoading: statusLoading } = useQuery<MongoDBStatus>({
    queryKey: ["/api/mongodb/status"],
    queryFn: async () => {
      const response = await fetch("/api/mongodb/status");
      if (!response.ok) throw new Error("Failed to fetch MongoDB status");
      return response.json();
    }
  });

  // Fetch MongoDB users (when logged in as super admin)
  const { data: users, isLoading: usersLoading } = useQuery<MongoDBUser[]>({
    queryKey: ["/api/mongodb/super-admin/admins"],
    queryFn: async () => {
      const response = await fetch("/api/mongodb/super-admin/admins");
      if (!response.ok) throw new Error("Failed to fetch users");
      return response.json();
    },
    enabled: isLoggedIn && user?.role === 'super_admin'
  });

  const handleLogin = async () => {
    try {
      setLoginError("");
      const response = await fetch("/api/mongodb/auth/login", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(loginData)
      });

      if (!response.ok) {
        const error = await response.json();
        setLoginError(error.message);
        return;
      }

      const data = await response.json();
      setUser(data.user);
      setIsLoggedIn(true);
      setLoginData({ username: "", password: "" });
    } catch (error) {
      setLoginError("Connection error");
    }
  };

  const handleLogout = async () => {
    try {
      await fetch("/api/mongodb/auth/logout", { method: "POST" });
      setIsLoggedIn(false);
      setUser(null);
    } catch (error) {
      console.error("Logout error:", error);
    }
  };

  return (
    <div className="container mx-auto p-6 space-y-6">
      <div className="text-center space-y-2">
        <h1 className="text-3xl font-bold flex items-center justify-center gap-2">
          <Database className="h-8 w-8 text-green-600" />
          MongoDB Test Dashboard
        </h1>
        <p className="text-muted-foreground">
          Test the parallel MongoDB implementation alongside PostgreSQL
        </p>
      </div>

      {/* MongoDB Status */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Database className="h-5 w-5" />
            MongoDB Connection Status
          </CardTitle>
        </CardHeader>
        <CardContent>
          {statusLoading ? (
            <div>Loading status...</div>
          ) : status ? (
            <div className="space-y-4">
              <div className="flex items-center gap-2">
                <Badge variant="success" className="bg-green-100 text-green-800">
                  {status.status}
                </Badge>
                <span className="text-sm text-muted-foreground">
                  Database: {status.database}
                </span>
              </div>
              
              <div className="grid grid-cols-3 gap-4">
                <div className="text-center p-3 bg-blue-50 rounded-lg">
                  <Users className="h-6 w-6 mx-auto mb-1 text-blue-600" />
                  <div className="text-2xl font-bold text-blue-600">
                    {status.collections.users}
                  </div>
                  <div className="text-sm text-blue-600">Users</div>
                </div>
                
                <div className="text-center p-3 bg-purple-50 rounded-lg">
                  <Building className="h-6 w-6 mx-auto mb-1 text-purple-600" />
                  <div className="text-2xl font-bold text-purple-600">
                    {status.collections.shops}
                  </div>
                  <div className="text-sm text-purple-600">Shops</div>
                </div>
                
                <div className="text-center p-3 bg-orange-50 rounded-lg">
                  <Gamepad2 className="h-6 w-6 mx-auto mb-1 text-orange-600" />
                  <div className="text-2xl font-bold text-orange-600">
                    {status.collections.games}
                  </div>
                  <div className="text-sm text-orange-600">Games</div>
                </div>
              </div>
              
              <div className="text-xs text-muted-foreground">
                Last updated: {new Date(status.timestamp).toLocaleString()}
              </div>
            </div>
          ) : (
            <Alert>
              <AlertCircle className="h-4 w-4" />
              <AlertDescription>
                Failed to connect to MongoDB. Check the connection.
              </AlertDescription>
            </Alert>
          )}
        </CardContent>
      </Card>

      {/* Authentication Section */}
      <Card>
        <CardHeader>
          <CardTitle>MongoDB Authentication Test</CardTitle>
          <CardDescription>
            Test login with MongoDB user accounts
          </CardDescription>
        </CardHeader>
        <CardContent>
          {!isLoggedIn ? (
            <div className="space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <Label htmlFor="username">Username</Label>
                  <Input
                    id="username"
                    value={loginData.username}
                    onChange={(e) => setLoginData(prev => ({ ...prev, username: e.target.value }))}
                    placeholder="Enter username"
                    data-testid="input-mongodb-username"
                  />
                </div>
                <div>
                  <Label htmlFor="password">Password</Label>
                  <Input
                    id="password"
                    type="password"
                    value={loginData.password}
                    onChange={(e) => setLoginData(prev => ({ ...prev, password: e.target.value }))}
                    placeholder="Enter password"
                    data-testid="input-mongodb-password"
                  />
                </div>
              </div>
              
              {loginError && (
                <Alert variant="destructive">
                  <AlertCircle className="h-4 w-4" />
                  <AlertDescription>{loginError}</AlertDescription>
                </Alert>
              )}
              
              <Button 
                onClick={handleLogin} 
                className="w-full"
                data-testid="button-mongodb-login"
              >
                Login to MongoDB System
              </Button>
              
              <div className="text-sm text-muted-foreground space-y-1">
                <div><strong>Test Accounts:</strong></div>
                <div>Super Admin: superadmin / password</div>
                <div>Demo Admin: demoadmin / admin123</div>
                <div>Demo Employee: demoemployee / employee123</div>
              </div>
            </div>
          ) : (
            <div className="space-y-4">
              <div className="p-4 bg-green-50 rounded-lg">
                <h3 className="font-semibold text-green-800 mb-2">Logged in successfully!</h3>
                <div className="space-y-1 text-sm">
                  <div><strong>User:</strong> {user?.name} ({user?.username})</div>
                  <div><strong>Role:</strong> <Badge variant="outline">{user?.role}</Badge></div>
                  <div><strong>Email:</strong> {user?.email || 'Not set'}</div>
                  <div><strong>Credit Balance:</strong> ${user?.creditBalance}</div>
                  <div><strong>Account Number:</strong> {user?.accountNumber}</div>
                </div>
              </div>
              
              <Button 
                variant="outline" 
                onClick={handleLogout}
                data-testid="button-mongodb-logout"
              >
                Logout
              </Button>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Admin Users List (for super admin) */}
      {isLoggedIn && user?.role === 'super_admin' && (
        <Card>
          <CardHeader>
            <CardTitle>MongoDB Admin Users</CardTitle>
            <CardDescription>
              List of admin users in the MongoDB system
            </CardDescription>
          </CardHeader>
          <CardContent>
            {usersLoading ? (
              <div>Loading users...</div>
            ) : users && users.length > 0 ? (
              <div className="space-y-3">
                {users.map((adminUser) => (
                  <div key={adminUser.id} className="p-3 border rounded-lg">
                    <div className="flex justify-between items-start">
                      <div>
                        <h4 className="font-semibold">{adminUser.name}</h4>
                        <p className="text-sm text-muted-foreground">@{adminUser.username}</p>
                        <p className="text-sm">{adminUser.email}</p>
                      </div>
                      <div className="text-right">
                        <Badge variant="secondary">{adminUser.role}</Badge>
                        <div className="text-sm text-muted-foreground mt-1">
                          Balance: ${adminUser.creditBalance}
                        </div>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              <div className="text-center text-muted-foreground">
                No admin users found
              </div>
            )}
          </CardContent>
        </Card>
      )}

      <Separator />
      
      <div className="text-center text-sm text-muted-foreground">
        <p>This is a parallel MongoDB implementation running alongside the PostgreSQL system.</p>
        <p>Both databases are independent and can be used simultaneously.</p>
      </div>
    </div>
  );
}