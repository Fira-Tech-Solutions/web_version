import BingoEmployeeDashboard from "@/components/bingo-employee-dashboard";
import { useAuth } from "@/hooks/use-auth";

interface EmployeeDashboardProps {
  onLogout?: () => void;
}

export default function EmployeeDashboard({ onLogout }: EmployeeDashboardProps) {
  const { logout } = useAuth();
  
  const handleLogout = async () => {
    await logout();
    if (onLogout) {
      onLogout();
    }
  };
  
  return <BingoEmployeeDashboard onLogout={handleLogout} />;
}
