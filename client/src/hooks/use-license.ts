/**
 * License status hook - checks if app is activated
 */
import { useQuery } from "@tanstack/react-query";
import { getQueryFn } from "@/lib/queryClient";

export function useLicenseStatus() {
  const { data, isLoading } = useQuery({
    queryKey: ["/api/license/status"],
    queryFn: getQueryFn({ on401: "returnNull" }),
    retry: 1,
    staleTime: 60000, // 1 min
  });

  const activated = (data as any)?.activated ?? false;
  return { activated, isLoading };
}
