import { Route, Router, useLocation } from "wouter";
import { queryClient } from "./lib/queryClient";
import { QueryClientProvider } from "@tanstack/react-query";
import { AuthProvider, useAuth } from "./hooks/use-auth";
import { useLicenseStatus } from "./hooks/use-license";
import { Toaster } from "./components/ui/toaster";
import LoginPage from "./pages/login-page";
import SecureAdminDashboard from "./pages/secure-admin-dashboard";
import EmployeeDashboard from "./pages/employee-dashboard";

function AppRouter() {
  const { user } = useAuth();
  const { activated, isLoading } = useLicenseStatus();

  const handleLogout = () => {
    window.location.href = "/";
  };

  // Locked: show First-Time Registration for / and /login
  if (!isLoading && !activated) {
    return (
      <Router>
        <Route path="/" component={LoginPage} />
      </Router>
    );
  }

  return (
    <>
      <Toaster />
      <Router>
        <Route path="/" component={LoginPage} />
        <Route path="/login" component={LoginPage} />

        {/* Dashboard Routes */}
        <Route path="/dashboard/admin">
          <SecureAdminDashboard onLogout={handleLogout} />
        </Route>
        <Route path="/dashboard/employee">
          <EmployeeDashboard onLogout={handleLogout} />
        </Route>

        {/* Legacy Routes for backward compatibility */}
        <Route path="/admin">
          <SecureAdminDashboard onLogout={handleLogout} />
        </Route>
        <Route path="/employee">
          <EmployeeDashboard onLogout={handleLogout} />
        </Route>
      </Router>
    </>
  );
}

function App() {
  return (
    <QueryClientProvider client={queryClient}>
      <AuthProvider>
        <AppRouter />
      </AuthProvider>
    </QueryClientProvider>
  );
}

export default App;
