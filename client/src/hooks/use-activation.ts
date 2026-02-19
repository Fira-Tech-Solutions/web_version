/**
 * Activation Hook
 * Manages application activation state and routing
 */
import { useState, useEffect } from "react";
import { apiRequest } from "@/lib/queryClient";

interface ActivationState {
  isActivated: boolean;
  isLoading: boolean;
  error: string | null;
  machineId: string;
}

export function useActivation() {
  const [state, setState] = useState<ActivationState>({
    isActivated: false,
    isLoading: true,
    error: null,
    machineId: ""
  });

  useEffect(() => {
    checkActivationStatus();
  }, []);

  const checkActivationStatus = async () => {
    try {
      setState(prev => ({ ...prev, isLoading: true, error: null }));
      
      // Check license status
      const licenseResponse = await apiRequest("GET", "/api/license/status");
      const licenseData = await licenseResponse.json();
      
      // Get machine ID
      const machineResponse = await apiRequest("GET", "/api/license/machine-id");
      const machineData = await machineResponse.json();
      
      setState({
        isActivated: licenseData.activated || false,
        isLoading: false,
        error: null,
        machineId: machineData.machineId || ""
      });
    } catch (error) {
      console.error("Failed to check activation status:", error);
      setState(prev => ({
        ...prev,
        isLoading: false,
        error: "Failed to check activation status"
      }));
    }
  };

  const refreshStatus = () => {
    checkActivationStatus();
  };

  return {
    ...state,
    refreshStatus
  };
}
