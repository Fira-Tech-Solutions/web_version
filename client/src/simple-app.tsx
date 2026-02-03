import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import BingoEmployeeDashboard from "@/components/bingo-employee-dashboard";
import SimpleAdminDashboard from "@/pages/simple-admin-dashboard";

export default function SimpleApp() {
  const [currentPage, setCurrentPage] = useState("login");

  if (currentPage === "login") {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50">
        <Card className="w-96">
          <CardHeader>
            <CardTitle>Bingo System Login</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <Button 
              onClick={() => setCurrentPage("admin")} 
              className="w-full"
            >
              Login as Admin
            </Button>
            <Button 
              onClick={() => setCurrentPage("employee")} 
              variant="outline" 
              className="w-full"
            >
              Login as Employee
            </Button>
          </CardContent>
        </Card>
      </div>
    );
  }

  if (currentPage === "admin") {
    return <SimpleAdminDashboard onLogout={() => setCurrentPage("login")} />;
  }

  if (currentPage === "employee") {
    return <BingoEmployeeDashboard onLogout={() => setCurrentPage("login")} />;
  }

  return null;
}