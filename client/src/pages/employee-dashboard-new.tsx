import BingoEmployeeDashboard from "@/components/bingo-employee-dashboard";
import { useAuth } from "@/hooks/use-auth";

export default function EmployeeDashboard() {
  const { user, logout } = useAuth();
  
  if (!user) {
    return <div>Loading...</div>;
  }

  return (
    <BingoEmployeeDashboard
      onLogout={logout}
    />
  );
}