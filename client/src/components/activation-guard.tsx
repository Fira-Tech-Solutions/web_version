/**
 * Activation Guard Component
 * Protects routes and shows activation screen when not activated
 */
import { ReactNode } from "react";
import { useActivation } from "@/hooks/use-activation";
import ActivationScreen from "./activation-screen";

interface ActivationGuardProps {
  children: ReactNode;
}

export default function ActivationGuard({ children }: ActivationGuardProps) {
  const { isActivated, isLoading } = useActivation();

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

  if (!isActivated) {
    return <ActivationScreen />;
  }

  return <>{children}</>;
}
