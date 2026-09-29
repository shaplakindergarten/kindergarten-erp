// src/app/my-attendance/my-attendance-client.tsx
"use client";

import * as React from "react";
import { motion, type Variants } from "framer-motion";
import {
  CalendarCheck, CheckCircle2, XCircle, Clock, AlertCircle,
} from "lucide-react";

interface Student {
  id: string;
  name: string;
  student_id: string;
  class_roll: string | null;
  student_photo_url: string | null;
}

interface Attendance {
  id: string;
  date: string;
  status: string;
  remarks: string | null;
  check_in: string | null;
  check_out: string | null;
}

const containerVariants: Variants = {
  hidden: { opacity: 0 },
  visible: { opacity: 1, transition: { staggerChildren: 0.05 } },
};

const itemVariants: Variants = {
  hidden: { y: 10, opacity: 0 },
  visible: { y: 0, opacity: 1 },
};

export function MyAttendanceClient({
  student,
  attendance,
}: {
  student: Student;
  attendance: Attendance[];
}) {
  // Compute stats
  const stats = React.useMemo(() => {
    const total = attendance.length;
    const present = attendance.filter((a) => a.status?.toLowerCase() === "present").length;
    const absent = attendance.filter((a) => a.status?.toLowerCase() === "absent").length;
    const late = attendance.filter((a) => a.status?.toLowerCase() === "late").length;
    const leave = attendance.filter((a) => a.status?.toLowerCase() === "leave").length;
    const rate = total > 0 ? Math.round((present / total) * 100) : 0;
    return { total, present, absent, late, leave, rate };
  }, [attendance]);

  return (
    <motion.div
      initial="hidden"
      animate="visible"
      variants={containerVariants}
      className="max-w-5xl mx-auto p-3 sm:p-6 space-y-4"
    >
      {/* Student Header */}
      <motion.div variants={itemVariants} className="rounded-2xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 p-4 sm:p-5 shadow-sm">
        <div className="flex items-center gap-4">
          <div className="w-14 h-14 rounded-full bg-gradient-to-br from-emerald-500 to-teal-600 flex items-center justify-center text-white font-bold text-xl overflow-hidden shrink-0">
            {student.student_photo_url ? (
              <img src={student.student_photo_url} alt={student.name} className="w-full h-full object-cover" />
            ) : (
              student.name.charAt(0).toUpperCase()
            )}
          </div>
          <div>
            <h1 className="text-lg sm:text-xl font-bold text-slate-800 dark:text-slate-100">
              {student.name}
            </h1>
            <p className="text-xs text-slate-500 dark:text-slate-400">
              ID: {student.student_id} • Roll: {student.class_roll || "—"}
            </p>
          </div>
        </div>
      </motion.div>

      {/* Stats */}
      <motion.div variants={itemVariants} className="grid grid-cols-2 sm:grid-cols-5 gap-3">
        <StatBox label="উপস্থিত" value={stats.present} color="from-emerald-500 to-green-600" />
        <StatBox label="অনুপস্থিত" value={stats.absent} color="from-red-500 to-rose-600" />
        <StatBox label="দেরি" value={stats.late} color="from-amber-500 to-orange-600" />
        <StatBox label="ছুটি" value={stats.leave} color="from-sky-500 to-blue-600" />
        <StatBox label="হার" value={`${stats.rate}%`} color="from-purple-500 to-indigo-600" />
      </motion.div>

      {/* Attendance List */}
      <motion.div variants={itemVariants} className="rounded-2xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 overflow-hidden shadow-sm">
        <div className="p-4 border-b border-slate-200 dark:border-slate-800">
          <h2 className="text-base font-bold text-slate-800 dark:text-slate-100 flex items-center gap-2">
            <CalendarCheck className="h-4 w-4 text-emerald-600" />
            সাম্প্রতিক হাজিরা
          </h2>
        </div>

        {attendance.length === 0 ? (
          <div className="p-8 text-center">
            <AlertCircle className="h-10 w-10 text-slate-400 mx-auto mb-3" />
            <p className="text-sm text-slate-500">কোনো হাজিরার তথ্য নেই।</p>
          </div>
        ) : (
          <div className="divide-y divide-slate-100 dark:divide-slate-800">
            {attendance.map((a) => (
              <div key={a.id} className="flex items-center justify-between p-3 sm:p-4 hover:bg-slate-50 dark:hover:bg-slate-800/50 transition">
                <div className="flex items-center gap-3 min-w-0">
                  <StatusIcon status={a.status} />
                  <div className="min-w-0">
                    <p className="text-sm font-medium text-slate-800 dark:text-slate-100">
                      {new Date(a.date).toLocaleDateString("bn-BD", {
                        weekday: "short",
                        year: "numeric",
                        month: "short",
                        day: "numeric",
                      })}
                    </p>
                    {a.remarks && (
                      <p className="text-xs text-slate-500 dark:text-slate-400 truncate">
                        {a.remarks}
                      </p>
                    )}
                  </div>
                </div>
                <StatusBadge status={a.status} />
              </div>
            ))}
          </div>
        )}
      </motion.div>
    </motion.div>
  );
}

function StatBox({ label, value, color }: { label: string; value: string | number; color: string }) {
  return (
    <div className={`rounded-2xl bg-gradient-to-br ${color} p-3 text-white shadow-sm`}>
      <p className="text-2xl font-bold leading-none">{value}</p>
      <p className="text-[10px] uppercase tracking-wide opacity-90 mt-1">{label}</p>
    </div>
  );
}

function StatusIcon({ status }: { status: string }) {
  const s = status?.toLowerCase();
  if (s === "present") return <CheckCircle2 className="h-5 w-5 text-emerald-600 shrink-0" />;
  if (s === "absent") return <XCircle className="h-5 w-5 text-red-600 shrink-0" />;
  if (s === "late") return <Clock className="h-5 w-5 text-amber-600 shrink-0" />;
  if (s === "leave") return <CalendarCheck className="h-5 w-5 text-sky-600 shrink-0" />;
  return <AlertCircle className="h-5 w-5 text-slate-400 shrink-0" />;
}

function StatusBadge({ status }: { status: string }) {
  const s = status?.toLowerCase();
  const colors =
    s === "present"
      ? "bg-emerald-100 text-emerald-700 dark:bg-emerald-950/40 dark:text-emerald-300"
      : s === "absent"
      ? "bg-red-100 text-red-700 dark:bg-red-950/40 dark:text-red-300"
      : s === "late"
      ? "bg-amber-100 text-amber-700 dark:bg-amber-950/40 dark:text-amber-300"
      : s === "leave"
      ? "bg-sky-100 text-sky-700 dark:bg-sky-950/40 dark:text-sky-300"
      : "bg-slate-100 text-slate-700 dark:bg-slate-800 dark:text-slate-300";
  return (
    <span className={`px-2.5 py-1 rounded-full text-[10px] font-bold uppercase shrink-0 ${colors}`}>
      {status}
    </span>
  );
}