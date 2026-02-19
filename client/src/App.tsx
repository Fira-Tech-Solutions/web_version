import { Route, Router, useLocation } from "wouter";
import { queryClient } from "./lib/queryClient";
import { QueryClientProvider } from "@tanstack/react-query";
import { AuthProvider, useAuth } from "./hooks/use-auth";
import { useActivation } from "./hooks/use-activation";
import { Toaster } from "./components/ui/toaster";
import LoginPage from "./pages/login-page";
import SecureAdminDashboard from "./pages/secure-admin-dashboard";
import EmployeeDashboard from "./pages/employee-dashboard";
import ActivationScreen from "./components/activation-screen";
import ActivationGuard from "./components/activation-guard";
import { useState } from "react";

function AppRouter() {
  const { user } = useAuth();
  const { isActivated, isLoading, refreshStatus } = useActivation();
  const [userState, setUserState] = useState<any>(null);

  const handleLogout = () => {
    window.location.href = "/";
  };

  // Show loading while checking activation
  if (isLoading) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mx-auto mb-4"></div>
          <p className="text-gray-600">Checking activation status...</p>
        </div>
      </div>
    );
  }

  // If not activated, show activation screen
  if (!isActivated) {
    return <ActivationScreen onActivationSuccess={refreshStatus} />;
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
