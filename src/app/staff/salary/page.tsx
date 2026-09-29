// src/app/staff/salary/page.tsx - Dashboard (Enhanced with Modern Colors & Dark Mode)
"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { 
  ArrowLeft, DollarSign, Users, Settings, History, 
  TrendingUp, TrendingDown, Calendar, FileText, 
  CreditCard, Bell, Award, Eye, LayoutDashboard
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { ResponsiveLayout } from "@/components/layout/responsive-layout";
import { useSalaryData } from "@/hooks/useSalaryData";
import { getStaff } from "@/lib/api/staff";
import { formatCurrency, months, getStatusBadge, getPaymentStatusBadge } from "@/lib/salary/salaryUtils";
import { motion } from "framer-motion";

const AnimatedCard = ({ children, delay = 0 }: any) => (
  <motion.div
    initial={{ opacity: 0, y: 20 }}
    animate={{ opacity: 1, y: 0 }}
    transition={{ duration: 0.4, delay }}
  >
    {children}
  </motion.div>
);

export default function SalaryDashboardPage() {
  const router = useRouter();
  const { balances, advances, payments, loading } = useSalaryData();
  const [staffList, setStaffList] = useState<any[]>([]);
  const [staffLoading, setStaffLoading] = useState(true);

  // Load staff list separately for accurate count
  useEffect(() => {
    async function loadStaff() {
      try {
        const staffData = await getStaff();
        setStaffList(staffData || []);
      } catch (err) {
        console.error("Failed to load staff:", err);
      } finally {
        setStaffLoading(false);
      }
    }
    loadStaff();
  }, []);

  // Calculate statistics
  const totalStaff = staffList.length;
  const totalPaidThisMonth = payments
    .filter(p => p.month === months[new Date().getMonth()] && p.year === new Date().getFullYear())
    .reduce((sum, p) => sum + p.amount, 0);
  const totalPending = balances.filter(b => b.status === 'partial').length;
  const totalAdvanceAmount = advances.reduce((sum, a) => sum + (a.amount - (a.installment_amount * a.paid_installments)), 0);

  const stats = [
    { 
      title: "Total Staff", 
      value: totalStaff, 
      icon: Users, 
      bgGradient: "from-blue-50 to-blue-100 dark:from-blue-950/30 dark:to-blue-900/30",
      iconBg: "bg-blue-500 dark:bg-blue-600",
      textColor: "text-gray-900 dark:text-white"
    },
    { 
      title: "Paid This Month", 
      value: formatCurrency(totalPaidThisMonth), 
      icon: DollarSign, 
      bgGradient: "from-emerald-50 to-emerald-100 dark:from-emerald-950/30 dark:to-emerald-900/30",
      iconBg: "bg-emerald-500 dark:bg-emerald-600",
      textColor: "text-gray-900 dark:text-white"
    },
    { 
      title: "Pending Salary", 
      value: totalPending, 
      icon: TrendingDown, 
      bgGradient: "from-rose-50 to-rose-100 dark:from-rose-950/30 dark:to-rose-900/30",
      iconBg: "bg-rose-500 dark:bg-rose-600",
      textColor: "text-gray-900 dark:text-white"
    },
    { 
      title: "Advance Due", 
      value: formatCurrency(totalAdvanceAmount), 
      icon: CreditCard, 
      bgGradient: "from-amber-50 to-amber-100 dark:from-amber-950/30 dark:to-amber-900/30",
      iconBg: "bg-amber-500 dark:bg-amber-600",
      textColor: "text-gray-900 dark:text-white"
    },
  ];

  const menuItems = [
    { name: "Staff Salary", href: "/staff/salary/staff-salary", icon: Users, description: "Manage staff salary structure" },
    { name: "Categories", href: "/staff/salary/categories", icon: Settings, description: "Salary categories & grades" },
    { name: "Salary Payment", href: "/staff/salary/payment", icon: DollarSign, description: "Record salary payments" },
    { name: "Monthly Report", href: "/staff/salary/reports/monthly", icon: FileText, description: "Monthly salary report" },
    { name: "Annual Report", href: "/staff/salary/reports/annual", icon: Calendar, description: "Annual salary report" },
    { name: "Staff-wise Report", href: "/staff/salary/reports/staff-wise", icon: Eye, description: "Staff wise report" },
    { name: "Pay Slip", href: "/staff/salary/pay-slip", icon: FileText, description: "Generate pay slip" },
    { name: "Advance & Loan", href: "/staff/salary/advance", icon: CreditCard, description: "Advance management" },
    { name: "Increment", href: "/staff/salary/increment", icon: TrendingUp, description: "Salary increment history" },
    { name: "Promotion", href: "/staff/salary/promotion", icon: Award, description: "Promotion records" },
    { name: "Notifications", href: "/staff/salary/notifications", icon: Bell, description: "Notification settings" },
  ];

  const isLoading = loading || staffLoading;

  return (
    <ResponsiveLayout>
      <div className="space-y-6 p-4 sm:p-6">
        {/* Header - Vibrant Gradient */}
        <motion.div
          initial={{ opacity: 0, y: -20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.5 }}
          className="relative overflow-hidden rounded-2xl bg-gradient-to-r from-indigo-600 via-purple-600 to-pink-600 dark:from-indigo-700 dark:via-purple-700 dark:to-pink-700 p-6 shadow-xl"
        >
          <div className="absolute inset-0 bg-white/10 dark:bg-white/5 backdrop-blur-sm"></div>
          <div className="relative flex items-center gap-4">
            <Button 
              variant="ghost" 
              size="icon" 
              onClick={() => router.back()} 
              className="rounded-xl bg-white/20 hover:bg-white/30 text-white border-0"
            >
              <ArrowLeft className="h-5 w-5" />
            </Button>
            <div>
              <h1 className="text-2xl md:text-3xl font-bold text-white drop-shadow-lg">
                Salary Dashboard
              </h1>
              <p className="text-white/80 text-sm drop-shadow">Complete overview of salary management system</p>
            </div>
          </div>
        </motion.div>

        {/* Stats Cards - Modern & Vibrant with Visible Text */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
          {stats.map((stat, idx) => (
            <AnimatedCard key={stat.title} delay={idx * 0.1}>
              <Card className="border-0 shadow-lg rounded-2xl overflow-hidden hover:shadow-xl transition-all duration-300 hover:-translate-y-1 bg-white dark:bg-gray-800">
                <div className={`bg-gradient-to-br ${stat.bgGradient} p-5`}>
                  <div className="flex items-center justify-between">
                    <div>
                      <p className={`text-2xl sm:text-3xl font-bold ${stat.textColor}`}>
                        {stat.value}
                      </p>
                      <p className="text-sm font-medium text-gray-600 dark:text-gray-300 mt-1">{stat.title}</p>
                    </div>
                    <div className={`p-3 rounded-2xl ${stat.iconBg} shadow-lg`}>
                      <stat.icon className="h-6 w-6 text-white" />
                    </div>
                  </div>
                </div>
              </Card>
            </AnimatedCard>
          ))}
        </div>

        {/* Quick Navigation - Modern & Vibrant */}
        <div>
          <h2 className="text-lg font-semibold text-gray-800 dark:text-white mb-4">Quick Navigation</h2>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
            {menuItems.map((item, idx) => {
              const colors = [
                "from-violet-500 to-purple-500",
                "from-blue-500 to-indigo-500",
                "from-emerald-500 to-teal-500",
                "from-rose-500 to-pink-500",
                "from-amber-500 to-orange-500",
                "from-cyan-500 to-sky-500",
                "from-fuchsia-500 to-purple-500",
                "from-lime-500 to-emerald-500",
                "from-red-500 to-rose-500",
                "from-indigo-500 to-blue-500",
                "from-purple-500 to-violet-500",
              ];
              const color = colors[idx % colors.length];
              
              return (
                <AnimatedCard key={item.name} delay={0.2 + (idx * 0.05)}>
                  <Card 
                    className="border-0 shadow-lg rounded-2xl hover:shadow-2xl hover:scale-[1.02] transition-all duration-300 cursor-pointer overflow-hidden group bg-white dark:bg-gray-800"
                    onClick={() => router.push(item.href)}
                  >
                    <div className={`bg-gradient-to-br ${color} p-4 relative`}>
                      <div className="absolute inset-0 bg-white/10 group-hover:bg-white/20 transition-colors duration-300"></div>
                      <div className="relative flex items-center gap-3">
                        <div className="p-2.5 rounded-xl bg-white/20 backdrop-blur-sm group-hover:bg-white/30 transition-all duration-300">
                          <item.icon className="h-5 w-5 text-white" />
                        </div>
                        <div className="flex-1 min-w-0">
                          <h3 className="font-semibold text-white text-sm truncate">{item.name}</h3>
                          <p className="text-xs text-white/70 truncate">{item.description}</p>
                        </div>
                      </div>
                    </div>
                  </Card>
                </AnimatedCard>
              );
            })}
          </div>
        </div>

        {/* Recent Activity - Modern Header */}
        <div>
          <h2 className="text-lg font-semibold text-gray-800 dark:text-white mb-4">Recent Activity</h2>
          <Card className="border-0 shadow-lg rounded-2xl overflow-hidden bg-white dark:bg-gray-800">
            <div className="bg-gradient-to-r from-indigo-500 to-purple-500 dark:from-indigo-600 dark:to-purple-600 p-4">
              <CardHeader className="p-0">
                <CardTitle className="text-white text-base font-semibold">Recent Salary Payments</CardTitle>
                <CardDescription className="text-white/70 text-sm">Last 5 payment records</CardDescription>
              </CardHeader>
            </div>
            <CardContent className="p-4">
              {isLoading ? (
                <div className="text-center py-8 text-gray-500 dark:text-gray-400">Loading...</div>
              ) : payments.length === 0 ? (
                <div className="text-center py-8 text-gray-500 dark:text-gray-400">No records found</div>
              ) : (
                <div className="space-y-3">
                  {payments.slice(0, 5).map((payment, idx) => {
                    const { label, color } = getPaymentStatusBadge(payment.status);
                    return (
                      <motion.div
                        key={payment.id}
                        initial={{ opacity: 0, x: -20 }}
                        animate={{ opacity: 1, x: 0 }}
                        transition={{ delay: idx * 0.1 }}
                        className="flex justify-between items-center p-3 bg-gray-50 dark:bg-gray-700/50 rounded-xl hover:bg-gray-100 dark:hover:bg-gray-700 transition-colors duration-200"
                      >
                        <div className="flex-1 min-w-0">
                          <p className="font-medium text-sm text-gray-800 dark:text-white truncate">
                            {payment.staff?.name || '-'}
                          </p>
                          <p className="text-xs text-gray-500 dark:text-gray-400">{payment.month} {payment.year}</p>
                        </div>
                        <div className="text-right ml-4">
                          <p className="font-semibold text-emerald-600 dark:text-emerald-400">
                            {formatCurrency(payment.amount)}
                          </p>
                        </div>
                        <div className="ml-3">
                          <span className={`text-xs px-2 py-1 rounded-full font-medium ${color}`}>
                            {label}
                          </span>
                        </div>
                      </motion.div>
                    );
                  })}
                </div>
              )}
            </CardContent>
          </Card>
        </div>
      </div>
    </ResponsiveLayout>
  );
}
