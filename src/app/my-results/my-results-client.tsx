// src/app/my-results/my-results-client.tsx
"use client";

import * as React from "react";
import { motion, type Variants } from "framer-motion";
import {
  Award, TrendingUp, Trophy, FileText, Calendar,
  CheckCircle2, XCircle, AlertCircle, BookOpen,
} from "lucide-react";

interface Student {
  id: string;
  name: string;
  student_id: string;
  class_id: string;
  section_id: string | null;
  class_roll: string | null;
  student_photo_url: string | null;
}

interface Result {
  id: string;
  term_id: string;
  total_marks_obtained: number;
  total_full_marks: number;
  percentage: number;
  gpa: number;
  letter_grade: string;
  class_rank: number | null;
  section_rank: number | null;
  result_status: string;
  is_published: boolean;
  published_at: string;
  failed_subjects: any[];
  has_failed_compulsory: boolean;
  exam_terms: { name: string; term_code: string } | null;
}

const containerVariants: Variants = {
  hidden: { opacity: 0 },
  visible: { opacity: 1, transition: { staggerChildren: 0.06 } },
};

const itemVariants: Variants = {
  hidden: { y: 12, opacity: 0 },
  visible: { y: 0, opacity: 1, transition: { type: "spring" as const, stiffness: 300, damping: 24 } },
};

export function MyResultsClient({
  student,
  results,
}: {
  student: Student;
  results: Result[];
}) {
  return (
    <motion.div
      initial="hidden"
      animate="visible"
      variants={containerVariants}
      className="max-w-5xl mx-auto p-3 sm:p-6 space-y-4"
    >
      {/* Student Card */}
      <motion.div
        variants={itemVariants}
        className="rounded-2xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 p-4 sm:p-6 shadow-sm"
      >
        <div className="flex items-center gap-4">
          <div className="w-16 h-16 sm:w-20 sm:h-20 rounded-full bg-gradient-to-br from-indigo-500 to-purple-600 flex items-center justify-center text-white font-bold text-2xl overflow-hidden shrink-0">
            {student.student_photo_url ? (
              <img
                src={student.student_photo_url}
                alt={student.name}
                className="w-full h-full object-cover"
              />
            ) : (
              student.name.charAt(0).toUpperCase()
            )}
          </div>
          <div className="flex-1 min-w-0">
            <h1 className="text-xl sm:text-2xl font-bold text-slate-800 dark:text-slate-100 truncate">
              {student.name}
            </h1>
            <p className="text-sm text-slate-500 dark:text-slate-400">
              ID: {student.student_id} • Roll: {student.class_roll || "—"}
            </p>
          </div>
        </div>
      </motion.div>

      {/* Summary Stats */}
      {results.length > 0 && (
        <motion.div variants={itemVariants} className="grid grid-cols-2 sm:grid-cols-4 gap-3">
          <StatCard
            icon={Award}
            label="সর্বশেষ GPA"
            value={results[0].gpa?.toFixed(2) || "0.00"}
            color="from-purple-500 to-indigo-600"
          />
          <StatCard
            icon={Trophy}
            label="Class Rank"
            value={results[0].class_rank ? `#${results[0].class_rank}` : "—"}
            color="from-amber-500 to-orange-600"
          />
          <StatCard
            icon={TrendingUp}
            label="সর্বশেষ %"
            value={`${results[0].percentage?.toFixed(1) || "0.0"}%`}
            color="from-emerald-500 to-green-600"
          />
          <StatCard
            icon={FileText}
            label="মোট পরীক্ষা"
            value={results.length.toString()}
            color="from-blue-500 to-sky-600"
          />
        </motion.div>
      )}

      {/* Results List */}
      {results.length === 0 ? (
        <motion.div
          variants={itemVariants}
          className="rounded-2xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 p-8 text-center"
        >
          <AlertCircle className="h-12 w-12 text-slate-400 mx-auto mb-3" />
          <p className="text-slate-500 dark:text-slate-400">
            এখনো কোনো ফলাফল publish করা হয়নি।
          </p>
          <p className="text-xs text-slate-400 mt-2">
            ফলাফল publish হলে এখানে দেখা যাবে।
          </p>
        </motion.div>
      ) : (
        <div className="space-y-3">
          {results.map((result) => (
            <motion.div
              key={result.id}
              variants={itemVariants}
              className="rounded-2xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 p-4 sm:p-5 shadow-sm hover:shadow-md transition-shadow"
            >
              {/* Term Header */}
              <div className="flex items-center justify-between mb-3">
                <div className="flex items-center gap-2">
                  <div className="p-2 rounded-lg bg-indigo-100 dark:bg-indigo-950/40">
                    <BookOpen className="h-4 w-4 text-indigo-600 dark:text-indigo-400" />
                  </div>
                  <div>
                    <h3 className="text-base font-bold text-slate-800 dark:text-slate-100">
                      {result.exam_terms?.name || "Exam"}
                    </h3>
                    <p className="text-xs text-slate-500">
                      {result.published_at && new Date(result.published_at).toLocaleDateString("bn-BD", {
                        year: "numeric",
                        month: "long",
                        day: "numeric",
                      })}
                    </p>
                  </div>
                </div>
                <div
                  className={`px-3 py-1 rounded-full text-xs font-bold ${
                    result.has_failed_compulsory
                      ? "bg-red-100 text-red-700 dark:bg-red-950/40 dark:text-red-300"
                      : "bg-emerald-100 text-emerald-700 dark:bg-emerald-950/40 dark:text-emerald-300"
                  }`}
                >
                  {result.has_failed_compulsory ? (
                    <>
                      <XCircle className="h-3 w-3 inline mr-1" />
                      Fail
                    </>
                  ) : (
                    <>
                      <CheckCircle2 className="h-3 w-3 inline mr-1" />
                      Pass
                    </>
                  )}
                </div>
              </div>

              {/* Grade Row */}
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                <MiniStat label="GPA" value={result.gpa?.toFixed(2) || "0.00"} highlight />
                <MiniStat label="Grade" value={result.letter_grade || "F"} />
                <MiniStat
                  label="Marks"
                  value={`${result.total_marks_obtained || 0} / ${result.total_full_marks || 0}`}
                />
                <MiniStat label="Class Rank" value={result.class_rank ? `#${result.class_rank}` : "—"} />
              </div>
            </motion.div>
          ))}
        </div>
      )}
    </motion.div>
  );
}

function StatCard({
  icon: Icon,
  label,
  value,
  color,
}: {
  icon: React.ComponentType<{ className?: string }>;
  label: string;
  value: string;
  color: string;
}) {
  return (
    <div
      className={`rounded-2xl bg-gradient-to-br ${color} p-3 text-white shadow-md`}
    >
      <div className="p-1.5 rounded-lg bg-white/20 w-fit mb-2">
        <Icon className="h-4 w-4" />
      </div>
      <p className="text-xl font-bold leading-none">{value}</p>
      <p className="text-[10px] uppercase tracking-wide opacity-90 mt-1">{label}</p>
    </div>
  );
}

function MiniStat({
  label,
  value,
  highlight,
}: {
  label: string;
  value: string;
  highlight?: boolean;
}) {
  return (
    <div
      className={`rounded-lg p-2.5 ${
        highlight
          ? "bg-gradient-to-br from-purple-50 to-indigo-50 dark:from-purple-950/40 dark:to-indigo-950/40 border border-purple-200 dark:border-purple-800"
          : "bg-slate-50 dark:bg-slate-800/40 border border-slate-200 dark:border-slate-700"
      }`}
    >
      <p className="text-[10px] uppercase text-slate-500 dark:text-slate-400 font-semibold tracking-wide">
        {label}
      </p>
      <p
        className={`text-lg font-bold mt-0.5 ${
          highlight ? "text-purple-700 dark:text-purple-300" : "text-slate-800 dark:text-slate-200"
        }`}
      >
        {value}
      </p>
    </div>
  );
}