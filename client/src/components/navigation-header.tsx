import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { useAuth } from "@/hooks/use-auth";
import { useLocation } from "wouter";
import { Dice1, Bell, LogOut } from "lucide-react";

interface NavigationHeaderProps {
  user: any;
  title?: string;
  onLogout?: () => void;
}

export function NavigationHeader({ user, title, onLogout }: NavigationHeaderProps) {
  const { logout } = useAuth();
  const [, setLocation] = useLocation();

  const handleLogout = async () => {
    if (onLogout) {
      onLogout();
    } else {
      await logout();
      setLocation('/login');
    }
  };

  const getRoleBadge = (role: string) => {
    const colors = {
      super_admin: "bg-purple-100 text-purple-800",
      admin: "bg-blue-100 text-blue-800",
      employee: "bg-green-100 text-green-800",
    };

    const labels = {
      super_admin: "Super Admin",
      admin: "Admin",
      employee: "Employee",
    };

    return (
      <Badge className={colors[role as keyof typeof colors]}>
        {labels[role as keyof typeof labels]}
      </Badge>
    );
  };

  return (
    <header className="bg-white shadow-sm border-b border-gray-200 sticky top-0 z-50">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex justify-between items-center h-16">
          <div className="flex items-center">
            <div className="flex-shrink-0 flex items-center">
              <Dice1 className="h-8 w-8 text-primary mr-3" />
              <h1 className="text-xl font-semibold text-gray-900">BingoSaaS</h1>
            </div>
            <div className="ml-8">
              {getRoleBadge(user?.role || '')}
            </div>
          </div>
          <div className="flex items-center space-x-4">
            <div className="flex items-center space-x-3">
              {user?.shopId && (
                <>
                  <span className="text-sm text-gray-600">
                    Shop ID: <span className="font-medium text-gray-900">{user.shopId}</span>
                  </span>
                  <div className="h-6 border-l border-gray-300"></div>
                </>
              )}
              <span className="text-sm text-gray-600">
                User: <span className="font-medium text-gray-900">{user?.name || user?.username}</span>
              </span>
            </div>
            <Button variant="ghost" size="sm">
              <Bell className="h-4 w-4" />
            </Button>
            <Button variant="ghost" size="sm" onClick={handleLogout}>
              <LogOut className="h-4 w-4 mr-2" />
              Logout
            </Button>
          </div>
        </div>
      </div>
    </header>
  );
}
