import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { useLocation } from "wouter";
import { useToast } from "@/hooks/use-toast";
import { apiRequest } from "@/lib/queryClient";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { User, Lock, Phone } from "lucide-react";

const BRAND_BLUE = "#1976D2";
const INPUT_BG = "#E3F2FD";

export default function LoginPage() {
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [, setLocation] = useLocation();
  const { toast } = useToast();
  const queryClient = useQueryClient();

  const loginMutation = useMutation({
    mutationFn: async (credentials: { username: string; password: string }) => {
      const response = await apiRequest("POST", "/api/auth/login", credentials);
      return response.json();
    },
    onSuccess: async (data: any) => {
      const user = data.user;
      
      // 1. Immediately update the 'auth/me' cache with the user data returned from login
      queryClient.setQueryData(["/api/auth/me"], { user });
      
      // 2. Force an immediate background refetch of all critical queries
      // This ensures the balance, shop status, and user profile are fresh
      await queryClient.invalidateQueries({ queryKey: ["/api/auth/me"] });
      
      // 3. Specifically trigger the cartelas fetch for the new user ID
      queryClient.invalidateQueries({ queryKey: ["/api/cartelas"] });
      
      toast({
        title: "Login successful",
        description: `Welcome back, ${user.name}!`,
      });

      // 4. Redirect to dashboard
      if (user.role === "super_admin" || user.role === "admin") {
        setLocation("/dashboard/admin");
      } else if (user.role === "employee") {
        setLocation("/dashboard/employee");
      }
    },
    onError: (error: any) => {
      toast({
        title: "Login Failed",
        description: error.message || "Invalid username or password",
        variant: "destructive",
      });
    },
  });

  const registerMutation = useMutation({
    mutationFn: async (fileData: string) => {
      const response = await apiRequest("POST", "/api/auth/register-file", { encryptedData: fileData });
      return response.json();
    },
    onSuccess: (data: any) => {
      if (data.autoLogin) {
        // Auto-login user after successful registration
        toast({
          title: "Registration & Login Successful",
          description: `Welcome ${data.username}! You have been automatically logged in.`,
        });
        // Update auth state with user data
        login(data.user);
        // Redirect to employee dashboard
        window.location.href = '/employee-dashboard';
      } else {
        // Regular registration success
        toast({
          title: "Registration successful",
          description: `Your account for ${data.username} has been created. You can now login.`,
        });
      }
    },
    onError: (error: any) => {
      toast({
        title: "Registration Failed",
        description: error.message || "Failed to process registration file",
        variant: "destructive",
      });
    }
  });

  const handleLogin = (e: React.FormEvent) => {
    e.preventDefault();
    if (!username || !password) {
      toast({
        title: "Error",
        description: "Please enter both username and password",
        variant: "destructive",
      });
      return;
    }
    loginMutation.mutate({ username, password });
  };

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      const reader = new FileReader();
      reader.onload = async (event) => {
        const text = event.target?.result as string;
        registerMutation.mutate(text);
      };
      reader.readAsText(file);
    }
  };

  return (
    <div className="min-h-screen bg-white flex flex-col">
      {/* Header: thin gray bar, logo left, contact right */}
      <header className="flex items-center justify-between px-6 lg:px-12 py-4 border-b border-gray-200 shadow-lg">
        <img
          src="/go_bingo.png"
          alt="Go Bingo"
          className="h-12 lg:h-14 w-auto object-contain"
        />
        <div className="flex flex-col items-end text-[#1976D2]">
          <span className="text-lg font-bold">ቢንጎ system ይፈልጋሉ?</span>
          <div className="flex items-center gap-2 mt-1">
            <Phone className="h-5 w-5 shrink-0" />
            <a href="tel:0951749796" className="text-lg font-bold">0951749796</a>
          </div>
        </div>
      </header>

      {/* Main: left = tagline + large logo, right = login card */}
      <main className="flex-1 flex flex-col lg:flex-row items-center justify-center gap-4 lg:gap-24 px-6 py-10 lg:py-16">
        {/* Left: ETHIOPIA'S BEST BINGO SOFTWARE. + large logo */}
        <div className="flex flex-col items-center flex-1 max-w-xl mr-8"> 
          <h1
            className="text-2xl sm:text-3xl lg:text-4xl font-serif font-bold text-[#1976D2] uppercase leading-tight mb-6 text-center"
            style={{ fontFamily: "Georgia, 'Times New Roman', serif" }}
          >
            <span className="block">ETHIOPIA'S BEST</span>
            {/* Increased font-black for "Stronger" look and removed left padding to keep it centered */}
            <span className="block mt-1 text-3xl sm:text-4xl lg:text-5xl font-black">
              BINGO SOFTWARE.
            </span>
          </h1>
          <img
            src="/go_bingo.png"
            alt="Go Bingo"
            className="w-full max-w-xl lg:max-w-3xl h-auto object-contain scale-205" 
          />
      </div>

        {/* Right: login card */}
        <div className="w-full max-w-md flex flex-col items-center ml-8">
          <div
            className="w-full bg-white rounded-2xl p-6 border border-gray-200"
            style={{ boxShadow: "0 8px 32px rgba(0,0,0,0.15)" }}
          >
            <h2
              className="text-center text-lg font-semibold mb-6"
              style={{ color: BRAND_BLUE }}
            >
              Please Login
            </h2>

            <form onSubmit={handleLogin} className="space-y-4">
              <div className="flex items-center gap-3 rounded-md border border-gray-300 overflow-hidden">
                <span className="pl-3 text-gray-500">
                  <User className="h-4 w-4" />
                </span>
                <Input
                  type="text"
                  placeholder="username"
                  value={username}
                  onChange={(e) => setUsername(e.target.value)}
                  className="flex-1 border-0 rounded-none focus-visible:ring-0 focus-visible:ring-offset-0 h-10"
                  style={{ backgroundColor: INPUT_BG }}
                />
              </div>
              <div className="flex items-center gap-3 rounded-md border border-gray-300 overflow-hidden">
                <span className="pl-3 text-gray-500">
                  <Lock className="h-4 w-4" />
                </span>
                <Input
                  type="password"
                  placeholder="password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  className="flex-1 border-0 rounded-none focus-visible:ring-0 focus-visible:ring-offset-0 h-10"
                  style={{ backgroundColor: INPUT_BG }}
                />
              </div>
              <Button
                type="submit"
                className="w-full h-10 font-medium text-white rounded-md"
                style={{ backgroundColor: BRAND_BLUE }}
                disabled={loginMutation.isPending}
              >
                {loginMutation.isPending ? "Logging in..." : "LOGIN"}
              </Button>
            </form>

            <div className="mt-6 pt-6 border-t border-gray-100 text-center">
              <p className="text-sm text-gray-600 mb-2">New User?</p>
              <label
                className="cursor-pointer inline-block px-4 py-2 rounded-md text-sm font-medium transition-colors hover:opacity-90"
                style={{ backgroundColor: INPUT_BG, color: BRAND_BLUE }}
              >
                <span>{registerMutation.isPending ? "Processing..." : "Register with Account File"}</span>
                <input
                  type="file"
                  className="hidden"
                  accept=".enc"
                  onChange={handleFileChange}
                  disabled={registerMutation.isPending}
                />
              </label>
              <p className="mt-2 text-[10px] text-gray-400">Upload the .enc file provided by your administrator</p>
            </div>
          </div>
        </div>
      </main>
    </div>
  );
}
