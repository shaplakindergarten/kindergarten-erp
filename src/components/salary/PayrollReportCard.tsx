"use client";

import React, { useEffect, useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { fetchMonthlyPayrollReport, PayrollReportRPCResponse } from "@/lib/salary/salaryService";
import { Skeleton } from "@/components/ui/skeleton";
import { Users, DollarSign, CheckCircle2, AlertCircle } from "lucide-react";

interface PayrollReportCardProps {
  month: number;
  year: number;
}

export const PayrollReportCard: React.FC<PayrollReportCardProps> = ({ month, year }) => {
  const [report, setReport] = useState<PayrollReportRPCResponse | null>(null);
  const [loading, setLoading] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    async function loadReport() {
      setLoading(true);
      setError(null);
      try {
        const data = await fetchMonthlyPayrollReport(month, year);
        setReport(data);
      } catch (err: any) {
        setError(err.message || "ডাটা লোড করতে সমস্যা হয়েছে");
      } finally {
        setLoading(false);
      }
    }

    loadReport();
  }, [month, year]);

  if (loading) {
    return (
      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
        {[...Array(4)].map((_, i) => (
          <Skeleton key={i} className="h-32 w-full rounded-xl" />
        ))}
      </div>
    );
  }

  if (error) {
    return (
      <div className="p-4 rounded-lg bg-destructive/10 text-destructive text-sm">
        পে-রোল সামারি লোড করা যায়নি: {error}
      </div>
    );
  }

  return (
    <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
      <Card>
        <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
          <CardTitle className="text-sm font-medium">মোট স্টাফ</CardTitle>
          <Users className="h-4 w-4 text-muted-foreground" />
        </CardHeader>
        <CardContent>
          <div className="text-2xl font-bold">{report?.total_staff || 0} জন</div>
          <p className="text-xs text-muted-foreground">চলতি মাসের অন্তর্ভুক্ত</p>
        </CardContent>
      </Card>

      <Card>
        <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
          <CardTitle className="text-sm font-medium">মোট পে-রোল ডিমান্ড</CardTitle>
          <DollarSign className="h-4 w-4 text-muted-foreground" />
        </CardHeader>
        <CardContent>
          <div className="text-2xl font-bold">৳{(report?.total_demand || 0).toLocaleString()}</div>
          <p className="text-xs text-muted-foreground">ধার্যকৃত সর্বমোট বেতন</p>
        </CardContent>
      </Card>

      <Card>
        <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
          <CardTitle className="text-sm font-medium">মোট প্রদানকৃত</CardTitle>
          <CheckCircle2 className="h-4 w-4 text-emerald-500" />
        </CardHeader>
        <CardContent>
          <div className="text-2xl font-bold text-emerald-600">
            ৳{(report?.total_paid || 0).toLocaleString()}
          </div>
          <p className="text-xs text-muted-foreground">পরিশোধিত অর্থ</p>
        </CardContent>
      </Card>

      <Card>
        <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
          <CardTitle className="text-sm font-medium">মোট বকেয়া</CardTitle>
          <AlertCircle className="h-4 w-4 text-rose-500" />
        </CardHeader>
        <CardContent>
          <div className="text-2xl font-bold text-rose-600">
            ৳{(report?.total_due || 0).toLocaleString()}
          </div>
          <p className="text-xs text-muted-foreground">অপরিশোধিত বকেয়া</p>
        </CardContent>
      </Card>
    </div>
  );
};