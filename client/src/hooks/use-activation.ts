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
      
      // Bypass activation - always return activated
      setState({
        isActivated: true,
        isLoading: false,
        error: null,
        machineId: "bypassed"
      });
    } catch (error) {
      console.error("Failed to check activation status:", error);
      setState(prev => ({
        ...prev,
        isActivated: true, // Still return true on error
        isLoading: false,
        error: null
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
