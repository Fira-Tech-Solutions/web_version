import { useToast } from "@/hooks/use-toast";
import { useEffect } from "react";

interface ErrorNotificationProps {
  error: any;
  title?: string;
  description?: string;
}

export function ErrorNotification({ error, title = "Error", description }: ErrorNotificationProps) {
  const { toast } = useToast();

  useEffect(() => {
    if (error) {
      toast({
        title,
        description: description || error.message || "Something went wrong",
        variant: "destructive",
      });
    }
  }, [error, title, description, toast]);

  return null;
}

export function SuccessNotification({ message, title = "Success" }: { message: string; title?: string }) {
  const { toast } = useToast();

  useEffect(() => {
    if (message) {
      toast({
        title,
        description: message,
      });
    }
  }, [message, title, toast]);

  return null;
}