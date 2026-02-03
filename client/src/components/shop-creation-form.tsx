import { useState } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { useMutation, useQuery } from "@tanstack/react-query";
import { z } from "zod";
import { Button } from "@/components/ui/button";
import { Form, FormControl, FormDescription, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { apiRequest } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import { Building2, Plus } from "lucide-react";

const shopCreationSchema = z.object({
  name: z.string().min(1, "Shop name is required").max(100, "Shop name must be less than 100 characters"),
  adminId: z.string().min(1, "Admin selection is required"),
  profitMargin: z.string()
    .min(1, "Profit margin is required")
    .refine((val) => {
      const num = parseFloat(val);
      return !isNaN(num) && num >= 0 && num <= 100;
    }, "Profit margin must be between 0 and 100"),
  superAdminCommission: z.string()
    .min(1, "Super admin commission is required")
    .refine((val) => {
      const num = parseFloat(val);
      return !isNaN(num) && num >= 0 && num <= 100;
    }, "Commission must be between 0 and 100"),
  referralCommission: z.string()
    .min(1, "Referral commission is required")
    .refine((val) => {
      const num = parseFloat(val);
      return !isNaN(num) && num >= 0 && num <= 100;
    }, "Referral commission must be between 0 and 100"),
});

type ShopCreationForm = z.infer<typeof shopCreationSchema>;

interface ShopCreationFormProps {
  onSuccess?: () => void;
}

export function ShopCreationForm({ onSuccess }: ShopCreationFormProps) {
  const { toast } = useToast();
  const [isSubmitting, setIsSubmitting] = useState(false);

  const { data: allAdmins = [] } = useQuery({
    queryKey: ["/api/admin/all-admins"],
  });

  const form = useForm<ShopCreationForm>({
    resolver: zodResolver(shopCreationSchema),
    defaultValues: {
      name: "",
      adminId: "",
      profitMargin: "15.00",
      superAdminCommission: "25.00",
      referralCommission: "3.00",
    },
  });

  const createShopMutation = useMutation({
    mutationFn: async (data: ShopCreationForm) => {
      const response = await apiRequest("POST", "/api/shops", {
        name: data.name,
        adminId: parseInt(data.adminId),
        profitMargin: data.profitMargin,
        superAdminCommission: data.superAdminCommission,
        referralCommission: data.referralCommission,
      });
      return response;
    },
    onSuccess: () => {
      toast({
        title: "Success",
        description: "Shop created successfully",
      });
      form.reset();
      onSuccess?.();
    },
    onError: (error: any) => {
      toast({
        title: "Error",
        description: error.message || "Failed to create shop",
        variant: "destructive",
      });
    },
  });

  const onSubmit = (data: ShopCreationForm) => {
    setIsSubmitting(true);
    createShopMutation.mutate(data);
    setIsSubmitting(false);
  };

  // Filter out admins who already have shops
  const availableAdmins = allAdmins.filter((admin: any) => !admin.shopId);

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Plus className="h-5 w-5" />
          Create New Shop
        </CardTitle>
        <CardDescription>
          Add a new shop and assign it to an admin
        </CardDescription>
      </CardHeader>
      <CardContent>
        <Form {...form}>
          <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-6">
            <FormField
              control={form.control}
              name="name"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Shop Name</FormLabel>
                  <FormControl>
                    <Input placeholder="Enter shop name" {...field} />
                  </FormControl>
                  <FormDescription>
                    Choose a unique name for the shop
                  </FormDescription>
                  <FormMessage />
                </FormItem>
              )}
            />

            <FormField
              control={form.control}
              name="adminId"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Assign Admin</FormLabel>
                  <Select onValueChange={field.onChange} defaultValue={field.value}>
                    <FormControl>
                      <SelectTrigger>
                        <SelectValue placeholder="Select an admin" />
                      </SelectTrigger>
                    </FormControl>
                    <SelectContent>
                      {availableAdmins.length > 0 ? (
                        availableAdmins.map((admin: any) => (
                          <SelectItem key={admin.id} value={admin.id.toString()}>
                            {admin.name} ({admin.username})
                          </SelectItem>
                        ))
                      ) : (
                        <SelectItem value="no-admins" disabled>
                          Create an admin first (left panel)
                        </SelectItem>
                      )}
                    </SelectContent>
                  </Select>
                  <FormDescription>
                    Select an admin who doesn't have a shop yet
                  </FormDescription>
                  <FormMessage />
                </FormItem>
              )}
            />

            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <FormField
                control={form.control}
                name="profitMargin"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Profit Margin (%)</FormLabel>
                    <FormControl>
                      <Input type="number" step="0.01" min="0" max="100" {...field} />
                    </FormControl>
                    <FormDescription>
                      Shop's profit percentage
                    </FormDescription>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <FormField
                control={form.control}
                name="superAdminCommission"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Super Admin Commission (%)</FormLabel>
                    <FormControl>
                      <Input type="number" step="0.01" min="0" max="100" {...field} />
                    </FormControl>
                    <FormDescription>
                      Commission for super admin
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
                      <Input type="number" step="0.01" min="0" max="100" {...field} />
                    </FormControl>
                    <FormDescription>
                      Commission for referrals
                    </FormDescription>
                    <FormMessage />
                  </FormItem>
                )}
              />
            </div>

            <Button 
              type="submit" 
              disabled={isSubmitting || createShopMutation.isPending}
              className="w-full"
            >
              {createShopMutation.isPending ? "Creating Shop..." : "Create Shop"}
            </Button>
          </form>
        </Form>
      </CardContent>
    </Card>
  );
}