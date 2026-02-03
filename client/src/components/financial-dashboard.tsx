import { useQuery } from "@tanstack/react-query";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Calendar } from "@/components/ui/calendar";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Button } from "@/components/ui/button";
import { CalendarIcon } from "lucide-react";
import { useState } from "react";
import { format } from "date-fns";

interface FinancialDashboardProps {
  userRole: 'super_admin' | 'admin' | 'employee';
  shopId?: number;
  employeeId?: number;
}

export function FinancialDashboard({ userRole, shopId, employeeId }: FinancialDashboardProps) {
  const [dateRange, setDateRange] = useState<{
    from: Date | undefined;
    to: Date | undefined;
  }>({
    from: undefined,
    to: undefined,
  });

  const { data: transactions = [] } = useQuery({
    queryKey: [
      userRole === 'employee' 
        ? `/api/transactions/employee/${employeeId}`
        : `/api/transactions/shop/${shopId}`,
      dateRange.from?.toISOString(),
      dateRange.to?.toISOString()
    ],
    enabled: !!(shopId || employeeId),
  });

  const totalAmount = transactions.reduce((sum: number, transaction: any) => {
    return sum + parseFloat(transaction.amount || "0");
  }, 0);

  const entryFees = transactions.filter((t: any) => t.type === 'entry_fee');
  const prizes = transactions.filter((t: any) => t.type === 'prize_payout');

  return (
    <Card>
      <CardHeader>
        <CardTitle>Financial Overview</CardTitle>
        <CardDescription>
          Track income and expenses
        </CardDescription>
        <div className="flex space-x-2">
          <Popover>
            <PopoverTrigger asChild>
              <Button variant="outline" size="sm">
                <CalendarIcon className="h-4 w-4 mr-2" />
                {dateRange.from ? (
                  dateRange.to ? (
                    <>
                      {format(dateRange.from, "LLL dd, y")} -{" "}
                      {format(dateRange.to, "LLL dd, y")}
                    </>
                  ) : (
                    format(dateRange.from, "LLL dd, y")
                  )
                ) : (
                  "Pick a date range"
                )}
              </Button>
            </PopoverTrigger>
            <PopoverContent className="w-auto p-0" align="start">
              <Calendar
                initialFocus
                mode="range"
                defaultMonth={dateRange.from}
                selected={{
                  from: dateRange.from,
                  to: dateRange.to,
                }}
                onSelect={(range) => setDateRange(range || { from: undefined, to: undefined })}
                numberOfMonths={2}
              />
            </PopoverContent>
          </Popover>
        </div>
      </CardHeader>
      <CardContent>
        <div className="space-y-4">
          {/* Summary Stats */}
          <div className="grid grid-cols-3 gap-4">
            <div className="text-center">
              <p className="text-sm text-gray-600">Total Revenue</p>
              <p className="text-lg font-semibold text-green-600">
                ${entryFees.reduce((sum: number, t: any) => sum + parseFloat(t.amount), 0).toFixed(2)}
              </p>
            </div>
            <div className="text-center">
              <p className="text-sm text-gray-600">Prizes Paid</p>
              <p className="text-lg font-semibold text-red-600">
                ${prizes.reduce((sum: number, t: any) => sum + parseFloat(t.amount), 0).toFixed(2)}
              </p>
            </div>
            <div className="text-center">
              <p className="text-sm text-gray-600">Net Income</p>
              <p className="text-lg font-semibold text-blue-600">
                ${(entryFees.reduce((sum: number, t: any) => sum + parseFloat(t.amount), 0) - 
                   prizes.reduce((sum: number, t: any) => sum + parseFloat(t.amount), 0)).toFixed(2)}
              </p>
            </div>
          </div>

          {/* Recent Transactions */}
          <div>
            <h4 className="text-sm font-medium text-gray-700 mb-3">Recent Transactions</h4>
            <div className="space-y-2 max-h-48 overflow-y-auto">
              {transactions.length === 0 ? (
                <p className="text-sm text-gray-500 text-center py-4">
                  No transactions found
                </p>
              ) : (
                transactions.slice(0, 10).map((transaction: any) => (
                  <div key={transaction.id} className="flex items-center justify-between py-2 border-b border-gray-100">
                    <div className="flex items-center space-x-3">
                      <Badge variant={transaction.type === 'entry_fee' ? 'default' : 'destructive'}>
                        {transaction.type === 'entry_fee' ? 'Income' : 'Expense'}
                      </Badge>
                      <span className="text-sm text-gray-600">
                        {transaction.description || transaction.type}
                      </span>
                    </div>
                    <div className="text-right">
                      <p className={`text-sm font-medium ${
                        transaction.type === 'entry_fee' ? 'text-green-600' : 'text-red-600'
                      }`}>
                        {transaction.type === 'entry_fee' ? '+' : '-'}${transaction.amount}
                      </p>
                      <p className="text-xs text-gray-500">
                        {format(new Date(transaction.createdAt), 'MMM dd, HH:mm')}
                      </p>
                    </div>
                  </div>
                ))
              )}
            </div>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
