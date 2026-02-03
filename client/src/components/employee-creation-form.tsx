import { useState } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Form, FormControl, FormDescription, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form";
import { useToast } from "@/hooks/use-toast";
import { apiRequest } from "@/lib/queryClient";
import { UserPlus, Users } from "lucide-react";
import { useAuth } from "@/hooks/use-auth";

const employeeCreationSchema = z.object({
  name: z.string().min(2, "Name must be at least 2 characters"),
  username: z.string().min(3, "Username must be at least 3 characters"),
  password: z.string().min(6, "Password must be at least 6 characters"),
  email: z.string().email("Invalid email address").optional().or(z.literal("")),
});

type EmployeeCreationForm = z.infer<typeof employeeCreationSchema>;

interface EmployeeCreationFormProps {
  onSuccess?: () => void;
}

export function EmployeeCreationForm({ onSuccess }: EmployeeCreationFormProps) {
  const [isCreating, setIsCreating] = useState(false);
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const { user } = useAuth();

  const form = useForm<EmployeeCreationForm>({
    resolver: zodResolver(employeeCreationSchema),
    defaultValues: {
      name: "",
      username: "",
      password: "",
      email: "",
    },
  });

  const generateAccountFileMutation = useMutation({
    mutationFn: async (data: EmployeeCreationForm) => {
      const response = await apiRequest("POST", "/api/admin/employees/generate-account-file", data);
      return await response.json();
    },
    onSuccess: (data) => {
      // Trigger download of the encrypted file
      const blob = new Blob([data.encryptedData], { type: "application/octet-stream" });
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = data.filename;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      window.URL.revokeObjectURL(url);

      toast({
        title: "Account File Generated",
        description: `The registration file has been downloaded. Send this file to the employee for registration.`,
      });
      form.reset();
      onSuccess?.();
    },
    onError: (error: any) => {
      toast({
        title: "Failed to Generate File",
        description: error.message || "An error occurred while generating the account file",
        variant: "destructive",
      });
    },
  });

  const onSubmit = (data: EmployeeCreationForm) => {
    generateAccountFileMutation.mutate(data);
  };

  if (user?.role !== 'admin') {
    return null;
  }

  return (
    <Card className="w-full max-w-lg">
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Users className="h-5 w-5" />
          Create New Employee
        </CardTitle>
        <CardDescription>
          Add a new employee to your shop
        </CardDescription>
      </CardHeader>
      <CardContent>
        <Form {...form}>
          <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
            <FormField
              control={form.control}
              name="name"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Full Name</FormLabel>
                  <FormControl>
                    <Input placeholder="Enter employee's full name" {...field} />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />

            <FormField
              control={form.control}
              name="username"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Username</FormLabel>
                  <FormControl>
                    <Input placeholder="Enter username for login" {...field} />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />

            <FormField
              control={form.control}
              name="password"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Password</FormLabel>
                  <FormControl>
                    <Input type="password" placeholder="Enter password" {...field} />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />

            <FormField
              control={form.control}
              name="email"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Email (Optional)</FormLabel>
                  <FormControl>
                    <Input type="email" placeholder="Enter email address" {...field} />
                  </FormControl>
                  <FormDescription>
                    Optional: for notifications and communication
                  </FormDescription>
                  <FormMessage />
                </FormItem>
              )}
            />

            <Button
              type="submit"
              className="w-full"
              disabled={generateAccountFileMutation.isPending || isCreating}
            >
              {generateAccountFileMutation.isPending || isCreating
                ? "Generating Account File..."
                : "Generate Account File"
              }
            </Button>
          </form>
        </Form>
      </CardContent>
    </Card>
  );
}