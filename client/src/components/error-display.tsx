import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { AlertCircle, RefreshCw } from "lucide-react";

interface ErrorDisplayProps {
  error: any;
  title?: string;
  onRetry?: () => void;
  className?: string;
}

export function ErrorDisplay({ error, title = "Error", onRetry, className }: ErrorDisplayProps) {
  const errorMessage = error?.message || "Something went wrong. Please try again.";
  
  return (
    <Alert variant="destructive" className={className}>
      <AlertCircle className="h-4 w-4" />
      <AlertTitle className="text-red-800">{title}</AlertTitle>
      <AlertDescription className="text-red-700">
        {errorMessage}
        {onRetry && (
          <div className="mt-2">
            <Button
              variant="outline"
              size="sm"
              onClick={onRetry}
              className="h-7 text-red-800 border-red-300 hover:bg-red-50"
            >
              <RefreshCw className="h-3 w-3 mr-1" />
              Retry
            </Button>
          </div>
        )}
      </AlertDescription>
    </Alert>
  );
}

export function LoadingState({ message = "Loading..." }: { message?: string }) {
  return (
    <div className="flex items-center justify-center p-4 text-gray-500">
      <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-blue-600 mr-2"></div>
      {message}
    </div>
  );
}