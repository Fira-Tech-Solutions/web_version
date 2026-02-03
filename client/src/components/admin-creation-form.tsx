import { useState } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Form, FormControl, FormDescription, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form";
import { useToast } from "@/hooks/use-toast";
import { apiRequest } from "@/lib/queryClient";
import { UserPlus, Building2, Percent, Users } from "lucide-react";

const adminCreationSchema = z.object({
  name: z.string().min(2, "Name must be at least 2 characters"),
  username: z.string().min(3, "Username must be at least 3 characters"),
  password: z.string().min(6, "Password must be at least 6 characters"),
  email: z.string().email("Invalid email address").optional().or(z.literal("")),
  shopName: z.string().min(2, "Shop name must be at least 2 characters"),
  profitMargin: z.string().min(1, "Profit margin is required"),
  referralCommission: z.string().min(1, "Referral commission is required"),
  referredBy: z.string().optional(),
});

type AdminCreationForm = z.infer<typeof adminCreationSchema>;

interface AdminCreationFormProps {
  onSuccess?: () => void;
}

export function AdminCreationForm({ onSuccess }: AdminCreationFormProps) {
  const [isCreating, setIsCreating] = useState(false);
  const { toast } = useToast();
  const queryClient = useQueryClient();

  // Get existing admins for referral selection
  const { data: existingAdmins = [] } = useQuery({
    queryKey: ["/api/admin/all-admins"],
  });

  const form = useForm<AdminCreationForm>({
    resolver: zodResolver(adminCreationSchema),
    defaultValues: {
      name: "",
      username: "",
      password: "",
      email: "",
      shopName: "",
      profitMargin: "20",
      referralCommission: "3",
      referredBy: "",
    },
  });

  const createAdminMutation = useMutation({
    mutationFn: async (data: AdminCreationForm) => {
      const payload = {
        ...data,
        referredBy: data.referredBy && data.referredBy !== "none" && data.referredBy !== "" ? parseInt(data.referredBy) : undefined,
      };
      const response = await apiRequest("POST", "/api/admin/create-admin", payload);
      return await response.json();
    },
    onSuccess: (data) => {
      toast({
        title: "Admin Created Successfully",
        description: `Admin ${data.admin.name} created with account number ${data.accountNumber}`,
      });
      form.reset();
      queryClient.invalidateQueries({ queryKey: ["/api/admin/all-admins"] });
      queryClient.invalidateQueries({ queryKey: ["/api/shops"] });
      onSuccess?.();
    },
    onError: (error: any) => {
      toast({
        title: "Failed to Create Admin",
        description: error.message || "An error occurred while creating the admin",
        variant: "destructive",
      });
    },
  });

  const onSubmit = (data: AdminCreationForm) => {
    setIsCreating(true);
    createAdminMutation.mutate(data);
    setTimeout(() => setIsCreating(false), 2000);
  };

  return (
    <Card className="w-full max-w-2xl">
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <UserPlus className="h-5 w-5" />
          Create New Admin
        </CardTitle>
        <CardDescription>
          Create a new admin account with shop assignment and profit settings
        </CardDescription>
      </CardHeader>
      <CardContent>
        <Form {...form}>
          <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-6">
            {/* Basic Information */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <FormField
                control={form.control}
                name="name"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Full Name</FormLabel>
                    <FormControl>
                      <Input placeholder="Enter full name" {...field} />
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
                      <Input placeholder="Enter username" {...field} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
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
                      <Input type="email" placeholder="Enter email" {...field} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
            </div>

            {/* Shop Information */}
            <div className="border-t pt-4">
              <h3 className="flex items-center gap-2 text-lg font-medium mb-4">
                <Building2 className="h-4 w-4" />
                Shop Assignment
              </h3>
              
              <FormField
                control={form.control}
                name="shopName"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Shop Name</FormLabel>
                    <FormControl>
                      <Input placeholder="Enter shop name" {...field} />
                    </FormControl>
                    <FormDescription>
                      A new shop will be created for this admin
                    </FormDescription>
                    <FormMessage />
                  </FormItem>
                )}
              />
            </div>

            {/* Financial Settings */}
            <div className="border-t pt-4">
              <h3 className="flex items-center gap-2 text-lg font-medium mb-4">
                <Percent className="h-4 w-4" />
                Financial Settings
              </h3>
              
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <FormField
                  control={form.control}
                  name="profitMargin"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Admin Profit Margin (%)</FormLabel>
                      <FormControl>
                        <Input type="number" min="0" max="100" {...field} />
                      </FormControl>
                      <FormDescription>
                        Percentage the admin earns from each game
                      </FormDescription>
                      <FormMessage />
                    </FormItem>
                  )}
                />
                
                <FormField
                  control={form.control}
                  name="referralCommission"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Referral Commission (%)</FormLabel>
                      <FormControl>
                        <Input type="number" min="0" max="100" {...field} />
                      </FormControl>
                      <FormDescription>
                        Commission for referring admins
                      </FormDescription>
                      <FormMessage />
                    </FormItem>
                  )}
                />
              </div>
            </div>

            {/* Referral Information */}
            {existingAdmins.length > 0 && (
              <div className="border-t pt-4">
                <h3 className="flex items-center gap-2 text-lg font-medium mb-4">
                  <Users className="h-4 w-4" />
                  Referral (Optional)
                </h3>
                
                <FormField
                  control={form.control}
                  name="referredBy"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Referred By</FormLabel>
                      <Select onValueChange={field.onChange} defaultValue={field.value}>
                        <FormControl>
                          <SelectTrigger>
                            <SelectValue placeholder="Select referring admin (optional)" />
                          </SelectTrigger>
                        </FormControl>
                        <SelectContent>
                          <SelectItem value="none">No referrer</SelectItem>
                          {existingAdmins.map((admin: any) => (
                            <SelectItem key={admin.id} value={admin.id.toString()}>
                              {admin.name} ({admin.accountNumber || `ID: ${admin.id}`})
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                      <FormDescription>
                        Select if this admin was referred by another admin
                      </FormDescription>
                      <FormMessage />
                    </FormItem>
                  )}
                />
              </div>
            )}

            <Button 
              type="submit" 
              className="w-full" 
              disabled={createAdminMutation.isPending || isCreating}
            >
              {createAdminMutation.isPending || isCreating 
                ? "Creating Admin..." 
                : "Create Admin Account"
              }
            </Button>
          </form>
        </Form>
      </CardContent>
    </Card>
  );
}