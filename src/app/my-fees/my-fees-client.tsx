// src/app/my-fees/my-fees-client.tsx
"use client";

import * as React from "react";
import { motion, type Variants } from "framer-motion";
import {
  Wallet, AlertCircle, CheckCircle2, Receipt, Calendar, TrendingUp,
} from "lucide-react";

interface Student {
  id: string;
  name: string;
  student_id: string;
  class_roll: string | null;
  student_photo_url: string | null;
}

interface Due {
  id: string;
  month: string;
  expected_amount: number;
  paid_amount: number;
  due_amount: number;
  fine_amount: number;
  discount_amount: number;
  status: string;
  due_date: string;
}

interface Payment {
  id: string;
  amount: number;
  payment_date: string;
  receipt_no: string;
  payment_method: string;
  note: string | null;
}

const containerVariants: Variants = {
  hidden: { opacity: 0 },
  visible: { opacity: 1, transition: { staggerChildren: 0.05 } },
};

const itemVariants: Variants = {
  hidden: { y: 10, opacity: 0 },
  visible: { y: 0, opacity: 1 },
};

export function MyFeesClient({
  student,
  dues,
  payments,
}: {
  student: Student;
  dues: Due[];
  payments: Payment[];
}) {
  const stats = React.useMemo(() => {
    const totalExpected = dues.reduce((s, d) => s + (Number(d.expected_amount) || 0), 0);
    const totalPaid = dues.reduce((s, d) => s + (Number(d.paid_amount) || 0), 0);
    const totalDue = dues.reduce((s, d) => s + (Number(d.due_amount) || 0), 0);
    const totalFine = dues.reduce((s, d) => s + (Number(d.fine_amount) || 0), 0);
    return { totalExpected, totalPaid, totalDue, totalFine };
  }, [dues]);

  const formatBDT = (n: number) =>
    new Intl.NumberFormat("en-BD", { style: "currency", currency: "BDT", maximumFractionDigits: 0 }).format(n || 0);

  return (
    <motion.div
      initial="hidden"
      animate="visible"
      variants={containerVariants}
      className="max-w-5xl mx-auto p-3 sm:p-6 space-y-4"
    >
      {/* Student header */}
      <motion.div variants={itemVariants} className="rounded-2xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 p-4 sm:p-5 shadow-sm">
        <div className="flex items-center gap-4">
          <div className="w-14 h-14 rounded-full bg-gradient-to-br from-amber-500 to-orange-600 flex items-center justify-center text-white font-bold text-xl overflow-hidden shrink-0">
            {student.student_photo_url ? (
              <img src={student.student_photo_url} alt={student.name} className="w-full h-full object-cover" />
            ) : (
              student.name.charAt(0).toUpperCase()
            )}
          </div>
          <div>
            <h1 className="text-lg sm:text-xl font-bold text-slate-800 dark:text-slate-100">{student.name}</h1>
            <p className="text-xs text-slate-500 dark:text-slate-400">
              ID: {student.student_id} • Roll: {student.class_roll || "—"}
            </p>
          </div>
        </div>
      </motion.div>

      {/* Stats */}
      <motion.div variants={itemVariants} className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        <StatCard label="মোট বিল" value={formatBDT(stats.totalExpected)} color="from-blue-500 to-sky-600" icon={Wallet} />
        <StatCard label="পরিশোধিত" value={formatBDT(stats.totalPaid)} color="from-emerald-500 to-green-600" icon={CheckCircle2} />
        <StatCard label="বাকি" value={formatBDT(stats.totalDue)} color="from-red-500 to-rose-600" icon={AlertCircle} />
        <StatCard label="জরিমানা" value={formatBDT(stats.totalFine)} color="from-amber-500 to-orange-600" icon={TrendingUp} />
      </motion.div>

      {/* Recent Payments */}
      <motion.div variants={itemVariants} className="rounded-2xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 overflow-hidden shadow-sm">
        <div className="p-4 border-b border-slate-200 dark:border-slate-800">
          <h2 className="text-base font-bold text-slate-800 dark:text-slate-100 flex items-center gap-2">
            <Receipt className="h-4 w-4 text-amber-600" />
            সাম্প্রতিক পেমেন্ট
          </h2>
        </div>
        {payments.length === 0 ? (
          <div className="p-8 text-center">
            <AlertCircle className="h-10 w-10 text-slate-400 mx-auto mb-3" />
            <p className="text-sm text-slate-500">কোনো পেমেন্ট নেই।</p>
          </div>
        ) : (
          <div className="divide-y divide-slate-100 dark:divide-slate-800 max-h-80 overflow-y-auto">
            {payments.map((p) => (
              <div key={p.id} className="flex items-center justify-between p-3 sm:p-4 hover:bg-slate-50 dark:hover:bg-slate-800/50 transition">
                <div className="flex items-center gap-3 min-w-0">
                  <div className="p-2 rounded-lg bg-emerald-100 dark:bg-emerald-950/40">
                    <Receipt className="h-4 w-4 text-emerald-600 dark:text-emerald-400" />
                  </div>
                  <div className="min-w-0">
                    <p className="text-sm font-medium text-slate-800 dark:text-slate-100">
                      {formatBDT(p.amount)}
                    </p>
                    <p className="text-[10px] text-slate-500 dark:text-slate-400">
                      রিসিট: {p.receipt_no} • {p.payment_method}
                    </p>
                  </div>
                </div>
                <div className="text-right">
                  <p className="text-xs text-slate-500">
                    {new Date(p.payment_date).toLocaleDateString("bn-BD", {
                      month: "short",
                      day: "numeric",
                      year: "numeric",
                    })}
                  </p>
                </div>
              </div>
            ))}
          </div>
        )}
      </motion.div>

      {/* Dues Table */}
      <motion.div variants={itemVariants} className="rounded-2xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 overflow-hidden shadow-sm">
        <div className="p-4 border-b border-slate-200 dark:border-slate-800">
          <h2 className="text-base font-bold text-slate-800 dark:text-slate-100 flex items-center gap-2">
            <Calendar className="h-4 w-4 text-red-600" />
            ফি বিবরণ
          </h2>
        </div>
        {dues.length === 0 ? (
          <div className="p-8 text-center text-sm text-slate-500">কোনো ফি নেই।</div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs min-w-[600px]">
              <thead className="bg-slate-50 dark:bg-slate-800/60 text-slate-600 dark:text-slate-300 uppercase text-[10px] font-bold">
                <tr>
                  <th className="p-3">মাস</th>
                  <th className="p-3 text-right">মোট</th>
                  <th className="p-3 text-right">পরিশোধিত</th>
                  <th className="p-3 text-right">বাকি</th>
                  <th className="p-3 text-center">স্ট্যাটাস</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
                {dues.map((d) => (
                  <tr key={d.id} className="hover:bg-slate-50 dark:hover:bg-slate-800/40">
                    <td className="p-3 font-medium text-slate-800 dark:text-slate-100">{d.month}</td>
                    <td className="p-3 text-right text-slate-700 dark:text-slate-300">{formatBDT(d.expected_amount)}</td>
                    <td className="p-3 text-right text-emerald-700 dark:text-emerald-400">{formatBDT(d.paid_amount)}</td>
                    <td className="p-3 text-right text-red-700 dark:text-red-400 font-semibold">{formatBDT(d.due_amount)}</td>
                    <td className="p-3 text-center">
                      <span
                        className={`inline-block px-2 py-0.5 rounded-full text-[10px] font-bold uppercase ${
                          d.status === "paid"
                            ? "bg-emerald-100 text-emerald-700 dark:bg-emerald-950/40 dark:text-emerald-300"
                            : d.status === "partial"
                            ? "bg-amber-100 text-amber-700 dark:bg-amber-950/40 dark:text-amber-300"
                            : "bg-red-100 text-red-700 dark:bg-red-950/40 dark:text-red-300"
                        }`}
                      >
                        {d.status}
                      </span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </motion.div>
    </motion.div>
  );
}

function StatCard({
  label,
  value,
  color,
  icon: Icon,
}: {
  label: string;
  value: string;
  color: string;
  icon: React.ComponentType<{ className?: string }>;
}) {
  return (
    <div className={`rounded-2xl bg-gradient-to-br ${color} p-3 text-white shadow-sm`}>
      <div className="p-1.5 rounded-lg bg-white/20 w-fit mb-2">
        <Icon className="h-4 w-4" />
      </div>
      <p className="text-base sm:text-lg font-bold leading-tight">{value}</p>
      <p className="text-[10px] uppercase tracking-wide opacity-90 mt-1">{label}</p>
    </div>
  );
}