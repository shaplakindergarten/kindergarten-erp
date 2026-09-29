// src/app/dashboard/page.tsx
"use client";

import { useState, useEffect } from "react";
import Link from "next/link";
import { motion, type Variants } from "framer-motion";
import { cn } from "@/lib/utils";
import { createClient } from "@/lib/supabase/client";
import {
  Users,
  GraduationCap,
  Wallet,
  CalendarCheck,
  FileText,
  AlertCircle,
  Activity,
  LayoutDashboard,
  BookOpen,
  Clock,
  Megaphone,
  UserPlus,
  ArrowRight,
} from "lucide-react";
import { ResponsiveLayout } from "@/components/layout/responsive-layout";
import { getDashboardStats } from "@/lib/api/students.service";
import { getAllStudentsWithDues, getAllPaymentsWithAllocation } from "@/lib/api/fees-dynamic";
import {
  getErrorMessage,
  isNetworkError,
  isRlsError,
  isEmptySupabaseError,
} from "@/lib/utils/error";

const supabase = createClient();

const containerVariants: Variants = {
  hidden: { opacity: 0 },
  visible: {
    opacity: 1,
    transition: { staggerChildren: 0.05 },
  },
};

const itemVariants: Variants = {
  hidden: { y: 10, opacity: 0 },
  visible: {
    y: 0,
    opacity: 1,
    transition: { type: "spring" as const, stiffness: 300, damping: 24 },
  },
};

type KpiCardProps = {
  title: string;
  value: string | number;
  icon: typeof Users;
  color: string;
  loading?: boolean;
};

const KpiCard = ({ title, value, icon: Icon, color, loading }: KpiCardProps) => (
  <motion.div
    layout
    variants={itemVariants}
    whileHover={{ y: -3 }}
    className={`group relative overflow-hidden rounded-xl bg-gradient-to-br ${color} shadow-[0_12px_35px_-18px_rgba(15,23,42,0.8)] hover:shadow-lg transition-all duration-300 hover:scale-[1.01] min-w-0 h-full`}
  >
    <div className="absolute -right-5 -top-5 h-20 w-20 rounded-full bg-white/30 blur-md" />
    <div className="absolute left-0 top-0 h-full w-full bg-[radial-gradient(circle_at_70%_10%,rgba(255,255,255,.20),transparent_30%)]" />
    <div className="p-4 relative z-10">
      <div className="flex items-center justify-between">
        <div className="p-2 rounded-xl border border-white/35 bg-white/20 backdrop-blur-md shadow-sm">
          <Icon className="h-5 w-5 text-white" />
        </div>
        <div className="h-8 w-8 rounded-full border border-white/40 bg-white/10" />
      </div>
      <div className="mt-2 text-center">
        <p className="text-[26px] font-black leading-none tracking-tight text-white">
          {loading ? (
            <span className="inline-block w-12 h-6 bg-white/20 rounded animate-pulse" />
          ) : (
            value
          )}
        </p>
        <p className="text-[11px] text-white/88 mt-2 font-semibold uppercase tracking-[0.12em]">
          {title}
        </p>
      </div>
    </div>
  </motion.div>
);

const CompactKpiCard = ({ title, value, icon: Icon, color, loading }: KpiCardProps) => (
  <motion.div
    layout
    variants={itemVariants}
    whileHover={{ y: -2 }}
    className={`w-full min-w-0 relative overflow-hidden rounded-2xl bg-gradient-to-br ${color} shadow-lg transition-all duration-300 hover:-translate-y-0.5 hover:shadow-xl`}
  >
    <div className="absolute inset-x-0 top-0 h-16 bg-white/10" />
    <div className="p-3 relative z-10">
      <div className="flex items-center justify-between">
        <div className="p-2 rounded-lg bg-white/20 backdrop-blur-sm border border-white/25">
          <Icon className="h-4 w-4 text-white" />
        </div>
      </div>
      <div className="mt-2 text-left">
        <p className="text-lg font-semibold text-white">
          {loading ? (
            <span className="inline-block w-14 h-5 bg-white/20 rounded animate-pulse" />
          ) : (
            value
          )}
        </p>
        <p className="text-[11px] text-white/80 mt-1 font-medium">{title}</p>
      </div>
    </div>
  </motion.div>
);

// ═══════════════════════════════════════════════════════════
// Hook: Monthly Fee Collection
// ═══════════════════════════════════════════════════════════
const useMonthlyFeeCollection = () => {
  const [data, setData] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetch = async () => {
      try {
        const payments = await getAllPaymentsWithAllocation();
        const now = new Date();
        const months: Record<string, number> = {};

        for (let i = 5; i >= 0; i--) {
          const d = new Date(now.getFullYear(), now.getMonth() - i, 1);
          const key = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
          months[key] = 0;
        }

        if (payments && Array.isArray(payments)) {
          payments.forEach((p: any) => {
            if (p.payment_date) {
              const key = p.payment_date.slice(0, 7);
              if (months[key] !== undefined) {
                months[key] += Number(p.amount) || 0;
              }
            }
          });
        }

        const result = Object.entries(months).map(([month, amount]) => ({
          month: new Date(month + "-01").toLocaleDateString("en-US", { month: "short" }),
          amount,
        }));
        setData(result);
      } catch (err) {
        if (isNetworkError(err)) {
          console.warn("Monthly fee collection unavailable: network connection is offline.");
        } else {
          console.error("Monthly fee collection:", getErrorMessage(err));
        }
        setData([]);
      } finally {
        setLoading(false);
      }
    };
    fetch();
  }, []);

  return { data, loading };
};

// ═══════════════════════════════════════════════════════════
// Hook: Attendance Trend
// ═══════════════════════════════════════════════════════════
const useAttendanceTrend = () => {
  const [data, setData] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetch = async () => {
      try {
        const { data: attendance, error } = await supabase
          .from("student_attendance")
          .select("date, status")
          .gte("date", new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString().split("T")[0])
          .order("date", { ascending: true });

        if (error) throw error;

        const dailyStats: Record<string, { present: number; total: number }> = {};
        attendance?.forEach((a: any) => {
          const date = a.date;
          if (!dailyStats[date]) dailyStats[date] = { present: 0, total: 0 };
          dailyStats[date].total += 1;
          if (a.status === "present" || a.status === "Present") dailyStats[date].present += 1;
        });

        const result = Object.entries(dailyStats).map(([date, stats]) => ({
          date,
          rate: stats.total > 0 ? Math.round((stats.present / stats.total) * 100) : 0,
        }));
        setData(result.slice(-7));
      } catch (err) {
        if (isNetworkError(err)) {
          console.warn("Attendance trend unavailable: network connection is offline.");
        } else {
          console.error("Attendance trend:", getErrorMessage(err));
        }
        setData([]);
      } finally {
        setLoading(false);
      }
    };
    fetch();
  }, []);

  return { data, loading };
};

// ═══════════════════════════════════════════════════════════
// Hook: Recent Activity
// ═══════════════════════════════════════════════════════════
const useRecentActivity = () => {
  const [activity, setActivity] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetch = async () => {
      try {
        const { data: payments } = await supabase
          .from("fee_payments")
          .select("id, amount, payment_date, receipt_no, student_id")
          .order("payment_date", { ascending: false })
          .limit(5);

        let paymentStudents: Record<string, string> = {};
        if (payments && payments.length > 0) {
          const studentIds = payments.map((p: any) => p.student_id).filter(Boolean);
          if (studentIds.length > 0) {
            const { data: students } = await supabase
              .from("students")
              .select("id, name")
              .in("id", studentIds);
            if (students) {
              paymentStudents = students.reduce((acc: any, s: any) => {
                acc[s.id] = s.name;
                return acc;
              }, {});
            }
          }
        }

        const { data: students } = await supabase
          .from("students")
          .select("id, name, created_at")
          .eq("status", "active")
          .order("created_at", { ascending: false })
          .limit(5);

        const { data: attendanceData } = await supabase
          .from("student_attendance")
          .select("id, date, status, student_id")
          .order("date", { ascending: false })
          .limit(5);

        let attendanceStudents: Record<string, string> = {};
        if (attendanceData && attendanceData.length > 0) {
          const studentIds = attendanceData.map((a: any) => a.student_id).filter(Boolean);
          if (studentIds.length > 0) {
            const { data: students } = await supabase
              .from("students")
              .select("id, name")
              .in("id", studentIds);
            if (students) {
              attendanceStudents = students.reduce((acc: any, s: any) => {
                acc[s.id] = s.name;
                return acc;
              }, {});
            }
          }
        }

        const items: any[] = [
          ...(payments || []).map((p: any) => ({
            type: "payment",
            ...p,
            timestamp: p.payment_date,
            students: paymentStudents[p.student_id]
              ? { name: paymentStudents[p.student_id] }
              : null,
          })),
          ...(students || []).map((s: any) => ({
            type: "admission",
            ...s,
            timestamp: s.created_at,
          })),
          ...(attendanceData || []).map((a: any) => ({
            type: "attendance",
            ...a,
            timestamp: a.date,
            students: attendanceStudents[a.student_id]
              ? { name: attendanceStudents[a.student_id] }
              : null,
          })),
        ]
          .sort(
            (a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime()
          )
          .slice(0, 8);

        setActivity(items);
      } catch (err) {
        if (isNetworkError(err)) {
          console.warn("Recent activity unavailable: network connection is offline.");
        } else {
          console.error("Recent activity:", getErrorMessage(err));
        }
        setActivity([]);
      } finally {
        setLoading(false);
      }
    };
    fetch();
    const interval = setInterval(fetch, 30000);
    return () => clearInterval(interval);
  }, []);

  return { activity, loading };
};

const ActivityIcon = ({ type }: { type: string }) => {
  switch (type) {
    case "payment":
      return <Wallet className="h-3 w-3 text-emerald-600" />;
    case "admission":
      return <Users className="h-3 w-3 text-blue-600" />;
    case "attendance":
      return <CalendarCheck className="h-3 w-3 text-purple-600" />;
    default:
      return <Clock className="h-3 w-3 text-slate-400" />;
  }
};

export type StudentSummary = {
  class: string;
  class_id: string;
  boys: number;
  girls: number;
  total: number;
};

const ChartHeader = ({
  icon: Icon,
  title,
  subtitle,
  gradient,
}: {
  icon: typeof Users;
  title: string;
  subtitle: string;
  gradient: string;
}) => (
  <div
    className={`bg-gradient-to-r ${gradient} p-3 text-white rounded-t-2xl border-b border-white/30 shadow-inner`}
  >
    <div className="flex items-center justify-between">
      <div className="flex items-center gap-2">
        <div className="p-1.5 rounded-lg bg-white/20 backdrop-blur-sm border border-white/25">
          <Icon className="h-4 w-4 text-white" />
        </div>
        <div>
          <h3 className="text-sm font-bold tracking-wide leading-tight">{title}</h3>
          <p className="text-[10px] opacity-90 font-medium uppercase tracking-[0.12em]">
            {subtitle}
          </p>
        </div>
      </div>
    </div>
  </div>
);

const LineAreaChart = ({ data }: { data: any[] }) => {
  if (!data || data.length === 0) {
    return (
      <div className="flex items-center justify-center h-48 text-muted-foreground text-sm">
        No data available
      </div>
    );
  }

  const width = 640;
  const height = 220;
  const pad = { l: 34, r: 12, t: 12, b: 34 };
  const plotW = width - pad.l - pad.r;
  const plotH = height - pad.t - pad.b;
  const maxVal = Math.max(...data.map((d: any) => d.rate || 0), 1);

  const points = data.map((d, i) => {
    const x = pad.l + (plotW / Math.max(data.length - 1, 1)) * i;
    const y = pad.t + plotH - (plotH * (d.rate || 0)) / maxVal;
    return { x, y, value: d.rate };
  });

  const linePath = points.map((p, i) => `${i === 0 ? "M" : "L"} ${p.x},${p.y}`).join(" ");
  const areaPath = `${linePath} L ${points[points.length - 1].x},${pad.t + plotH} L ${
    points[0].x
  },${pad.t + plotH} Z`;

  return (
    <div className="min-w-0 px-3 py-3">
      <div className="relative h-56 min-h-55 w-full">
        <svg
          viewBox={`0 0 ${width} ${height}`}
          preserveAspectRatio="none"
          className="h-full w-full min-w-0"
        >
          <defs>
            <linearGradient id="attendanceFill" x1="0" x2="0" y1="0" y2="1">
              <stop offset="0" stopColor="#10b981" stopOpacity=".74" />
              <stop offset="1" stopColor="#bbf7d0" stopOpacity=".20" />
            </linearGradient>
            <linearGradient id="attendanceLine" x1="0" x2="1" y1="0" y2="0">
              <stop offset="0" stopColor="#14b8a6" />
              <stop offset="1" stopColor="#34d399" />
            </linearGradient>
          </defs>

          <rect x="0" y="0" width={width} height={height} rx="10" fill="#F8FAFC" />

          {[0, 25, 50, 75, 100].map((mark) => {
            const y = pad.t + plotH - (plotH * mark) / 100;
            return (
              <g key={mark}>
                <line
                  x1={pad.l}
                  x2={width - pad.r}
                  y1={y}
                  y2={y}
                  stroke="#CBD5E1"
                  strokeDasharray="3 3"
                  strokeWidth="1"
                  opacity=".9"
                />
                <text x="6" y={y + 3} fontSize="9" fill="#64748b">
                  {mark}%
                </text>
              </g>
            );
          })}

          <path d={areaPath} fill="url(#attendanceFill)" stroke="none" />
          <path
            d={linePath}
            fill="none"
            stroke="url(#attendanceLine)"
            strokeWidth="2.4"
            strokeLinecap="round"
          />

          {points.map((p, i) => (
            <g key={i}>
              <circle cx={p.x} cy={p.y} r="4" fill="#ffffff" stroke="#10b981" strokeWidth="2" />
              <text x={p.x} y={p.y - 9} textAnchor="middle" fontSize="8" fill="#475569">
                {p.value}%
              </text>
            </g>
          ))}

          {data.map((d, i) => (
            <text
              key={`label-${i}`}
              x={pad.l + (plotW / Math.max(data.length - 1, 1)) * i}
              y={height - 6}
              textAnchor="middle"
              fontSize="8"
              fill="#64748b"
            >
              {d.date.slice(5)}
            </text>
          ))}
        </svg>
      </div>
    </div>
  );
};

const BarChart = ({ data }: { data: any[] }) => {
  if (!data || data.length === 0) {
    return (
      <div className="flex items-center justify-center h-48 text-muted-foreground text-sm">
        No data available
      </div>
    );
  }

  const width = 640;
  const height = 220;
  const pad = { l: 34, r: 10, t: 10, b: 34 };
  const plotW = width - pad.l - pad.r;
  const plotH = height - pad.t - pad.b;
  const maxVal = Math.max(...data.map((d: any) => d.amount || 0), 1);
  const slotWidth = plotW / data.length;
  const barWidth = Math.max(20, Math.round(slotWidth * 0.48));

  return (
    <div className="min-w-0 px-3 py-3">
      <div className="relative h-56 min-h-55 w-full">
        <svg
          viewBox={`0 0 ${width} ${height}`}
          preserveAspectRatio="none"
          className="h-full w-full min-w-0"
        >
          <defs>
            <linearGradient id="feeBarFill" x1="0" x2="0" y1="0" y2="1">
              <stop offset="0" stopColor="#fb923c" />
              <stop offset="1" stopColor="#fbbf24" />
            </linearGradient>
          </defs>

          <rect x="0" y="0" width={width} height={height} rx="10" fill="#fff7ed" />

          {[0, 25, 50, 75, 100].map((mark) => {
            const y = pad.t + plotH - (plotH * mark) / 100;
            return (
              <g key={mark}>
                <line
                  x1={pad.l}
                  x2={width - pad.r}
                  y1={y}
                  y2={y}
                  stroke="#CBD5E1"
                  strokeDasharray="3 3"
                  strokeWidth="1"
                  opacity="0.95"
                />
              </g>
            );
          })}

          {data.map((item: any, i: number) => {
            const barHeight = (Math.max(item.amount || 0, 0) / maxVal) * plotH;
            const x = pad.l + i * slotWidth + (slotWidth - barWidth) / 2;
            const y = pad.t + plotH - barHeight;

            return (
              <g key={i}>
                <rect
                  x={x}
                  y={y}
                  width={barWidth}
                  height={barHeight}
                  rx="6"
                  fill="url(#feeBarFill)"
                  opacity="1"
                />
                <text
                  x={x + barWidth / 2}
                  y={Math.max(y - 5, 12)}
                  textAnchor="middle"
                  fontSize="8"
                  fill="#9a5b00"
                >
                  ৳{(item.amount || 0).toLocaleString()}
                </text>
                <text
                  x={x + barWidth / 2}
                  y={height - 9}
                  textAnchor="middle"
                  fontSize="8"
                  fill="#64748b"
                >
                  {item.month}
                </text>
              </g>
            );
          })}
        </svg>
      </div>
    </div>
  );
};

export default function DashboardPage() {
  const [dashboardStats, setDashboardStats] = useState({
    totalStudents: 0,
    totalStaff: 0,
    feesCollection: 0,
    attendanceRate: 0,
    totalClasses: 0,
    pendingFees: 0,
    todaysCollection: 0,
    monthlyCollection: 0,
  });
  const [loading, setLoading] = useState(true);
  const [isOnline, setIsOnline] = useState(true);
  const [studentsSummary, setStudentsSummary] = useState<StudentSummary[]>([]);
  const [summaryLoading, setSummaryLoading] = useState(true);
  const [classesMap, setClassesMap] = useState<Map<string, string>>(new Map());
  const [notices, setNotices] = useState<any[]>([]);
  const [noticesLoading, setNoticesLoading] = useState(true);

  // 🆕 Pending Admissions counter
  const [pendingAdmissionsCount, setPendingAdmissionsCount] = useState(0);

  const { data: monthlyCollectionData, loading: monthlyLoading } = useMonthlyFeeCollection();
  const { data: attendanceTrendData, loading: attendanceTrendLoading } = useAttendanceTrend();
  const { activity: recentActivity, loading: activityLoading } = useRecentActivity();

  const totalBoys = studentsSummary.reduce((sum, row) => sum + row.boys, 0);
  const totalGirls = studentsSummary.reduce((sum, row) => sum + row.girls, 0);
  const totalStudentsCount = studentsSummary.reduce((sum, row) => sum + row.total, 0);

  // Online/offline detection
  useEffect(() => {
    if (typeof window === "undefined") return;

    setIsOnline(navigator.onLine);

    const handleOnline = () => setIsOnline(true);
    const handleOffline = () => setIsOnline(false);

    window.addEventListener("online", handleOnline);
    window.addEventListener("offline", handleOffline);

    return () => {
      window.removeEventListener("online", handleOnline);
      window.removeEventListener("offline", handleOffline);
    };
  }, []);

  // ═══════════════════════════════════════════════════════════
  // Pending Admissions count + realtime subscription (FINAL FIX)
  // ═══════════════════════════════════════════════════════════
  useEffect(() => {
    // ✅ CRITICAL: declare EVERYTHING first — before fetchPendingCount uses them
    let cancelled = false;
    let debounceTimer: ReturnType<typeof setTimeout> | null = null;
    let channel: any = null;

    const fetchPendingCount = async () => {
      if (cancelled) return;

      try {
        const { count, error } = await supabase
          .from("pending_admissions")
          .select("id", { count: "exact", head: true })
          .eq("status", "pending");

        if (cancelled) return;

        if (error) {
          // Empty / transient Supabase error {} → silently skip
          if (isEmptySupabaseError(error)) return;

          console.error("[pending_admissions] query failed:", {
            message: error.message,
            code: (error as any).code,
            details: (error as any).details,
            hint: (error as any).hint,
          });
          throw error;
        }

        setPendingAdmissionsCount(count ?? 0);
      } catch (err) {
        if (cancelled) return;

        if (isEmptySupabaseError(err)) return;

        if (isNetworkError(err)) {
          console.warn("[pending_admissions] offline — skipping fetch");
        } else if (isRlsError(err)) {
          console.warn("[pending_admissions] RLS blocked:", getErrorMessage(err));
        } else {
          console.error("[pending_admissions] unexpected:", getErrorMessage(err));
        }

        if (!cancelled) {
          setPendingAdmissionsCount(0);
        }
      }
    };

    const setup = async () => {
      try {
        const { data: { session } } = await supabase.auth.getSession();
        if (session) {
          await supabase.realtime.setAuth(session.access_token);
        }
      } catch {
        // session fetch failed — proceed without realtime auth
      }

      if (cancelled) return;

      // Initial fetch AFTER auth setup
      fetchPendingCount();

      // ✅ CORRECT ORDER: channel() → .on() → .subscribe()
      channel = supabase
        .channel("dashboard-pending-admissions")
        .on(
          "postgres_changes",
          { event: "*", schema: "public", table: "pending_admissions" },
          () => {
            if (debounceTimer) clearTimeout(debounceTimer);
            debounceTimer = setTimeout(() => {
              if (!cancelled) fetchPendingCount();
            }, 800);
          }
        )
        .subscribe();
    };

    setup();

    return () => {
      cancelled = true;
      if (debounceTimer) clearTimeout(debounceTimer);
      if (channel) {
        try {
          supabase.removeChannel(channel);
        } catch {
          // ignore
        }
      }
    };
  }, []);

  // Load notices
  useEffect(() => {
    const loadNotices = async () => {
      try {
        const res = await fetch("/api/notifications/notice");
        const data = await res.json();
        setNotices(Array.isArray(data) ? data.slice(0, 3) : []);
      } catch (err) {
        if (isNetworkError(err)) {
          console.warn("Notices unavailable: network connection is offline.");
        } else {
          console.error("Notices:", getErrorMessage(err));
        }
        setNotices([]);
      } finally {
        setNoticesLoading(false);
      }
    };
    loadNotices();
  }, []);

  useEffect(() => {
    const loadStats = async () => {
      try {
        const data = await getDashboardStats();
        setDashboardStats((prev) => ({ ...prev, ...data }));
      } catch (err) {
        if (isNetworkError(err)) {
          console.warn("Dashboard stats unavailable: network connection is offline.");
        } else {
          console.error("Dashboard stats:", getErrorMessage(err));
        }
      } finally {
        setLoading(false);
      }
    };

    const loadClasses = async () => {
      try {
        const { data, error } = await supabase
          .from("classes")
          .select("id, name")
          .order("name", { ascending: true });

        if (error) throw error;

        const map = new Map<string, string>();
        data?.forEach((cls: { id: string; name: string }) => {
          map.set(cls.id, cls.name);
        });
        setClassesMap(map);

        if (data) {
          setDashboardStats((prev) => ({ ...prev, totalClasses: data.length }));
        }
      } catch (err) {
        if (isNetworkError(err)) {
          console.warn("Classes unavailable: network connection is offline.");
        } else {
          console.error("Classes:", getErrorMessage(err));
        }
      }
    };

    const loadPendingFees = async () => {
      try {
        const dueStudents = await getAllStudentsWithDues();
        const totalDue = dueStudents.reduce((sum, s) => sum + (s.due_amount || 0), 0);
        console.log("✅ Total Due Amount:", totalDue);
        setDashboardStats((prev) => ({ ...prev, pendingFees: totalDue }));
      } catch (err) {
        if (isNetworkError(err)) {
          console.warn("Pending fees unavailable: network connection is offline.");
        } else {
          console.error("Pending fees:", getErrorMessage(err));
          setDashboardStats((prev) => ({ ...prev, pendingFees: 0 }));
        }
      }
    };

    const loadCollections = async () => {
      try {
        const today = new Date().toISOString().split("T")[0];
        const thirtyDaysAgo = new Date();
        thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);

        const [todayPayments, monthPayments, allPayments] = await Promise.all([
          supabase
            .from("fee_payments")
            .select("amount")
            .gte("payment_date", `${today}T00:00:00`)
            .lte("payment_date", `${today}T23:59:59`),
          supabase
            .from("fee_payments")
            .select("amount")
            .gte("payment_date", thirtyDaysAgo.toISOString()),
          supabase.from("fee_payments").select("amount"),
        ]);

        const todaysCollection = (todayPayments.data || []).reduce(
          (sum: number, p: any) => sum + (Number(p.amount) || 0),
          0
        );
        const monthlyCollection = (monthPayments.data || []).reduce(
          (sum: number, p: any) => sum + (Number(p.amount) || 0),
          0
        );
        const feesCollection = (allPayments.data || []).reduce(
          (sum: number, p: any) => sum + (Number(p.amount) || 0),
          0
        );

        setDashboardStats((prev) => ({
          ...prev,
          todaysCollection,
          monthlyCollection,
          feesCollection,
        }));
      } catch (err) {
        if (isNetworkError(err)) {
          console.warn("Collections unavailable: network connection is offline.");
        } else {
          console.error("Collections:", getErrorMessage(err));
        }
      }
    };

    const loadAll = async () => {
      await Promise.all([loadStats(), loadClasses()]);
      await Promise.all([loadPendingFees(), loadCollections()]);
    };
    loadAll();
  }, []);

  useEffect(() => {
    if (classesMap.size === 0) return;

    const loadStudentsSummary = async () => {
      setSummaryLoading(true);
      try {
        const { data, error } = await supabase
          .from("students")
          .select("class_id, gender, status")
          .eq("status", "active");

        if (error) throw error;

        const summaryMap = new Map<string, { boys: number; girls: number; total: number }>();

        data?.forEach((student: { class_id: string; gender: string }) => {
          const classId = student.class_id;
          const gender = student.gender;

          if (!summaryMap.has(classId)) {
            summaryMap.set(classId, { boys: 0, girls: 0, total: 0 });
          }

          const classData = summaryMap.get(classId);
          if (classData) {
            if (gender === "Male" || gender === "male" || gender === "M") {
              classData.boys++;
            } else if (gender === "Female" || gender === "female" || gender === "F") {
              classData.girls++;
            }
            classData.total++;
          }
        });

        const result = Array.from(summaryMap.entries()).map(([classId, data]) => ({
          class: classesMap.get(classId) || classId,
          class_id: classId,
          boys: data.boys,
          girls: data.girls,
          total: data.total,
        }));

        const order = ["Play", "Nursery", "KG", "One", "Two", "Three", "Four", "Five"];
        result.sort((a, b) => order.indexOf(a.class) - order.indexOf(b.class));

        setStudentsSummary(result);
      } catch (err) {
        if (isNetworkError(err)) {
          console.warn("Students summary unavailable: network connection is offline.");
        } else {
          console.error("Students summary:", getErrorMessage(err));
        }
      } finally {
        setSummaryLoading(false);
      }
    };

    loadStudentsSummary();
  }, [classesMap]);

  useEffect(() => {
    if (classesMap.size === 0) return;

    const subscription = supabase
      .channel("students-changes")
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "students" },
        async () => {
          try {
            const { data, error } = await supabase
              .from("students")
              .select("class_id, gender, status")
              .eq("status", "active");

            if (error) throw error;

            const summaryMap = new Map<
              string,
              { boys: number; girls: number; total: number }
            >();
            data?.forEach((student: { class_id: string; gender: string }) => {
              const classId = student.class_id;
              const gender = student.gender;

              if (!summaryMap.has(classId)) {
                summaryMap.set(classId, { boys: 0, girls: 0, total: 0 });
              }

              const classData = summaryMap.get(classId);
              if (classData) {
                if (gender === "Male" || gender === "male" || gender === "M") {
                  classData.boys++;
                } else if (gender === "Female" || gender === "female" || gender === "F") {
                  classData.girls++;
                }
                classData.total++;
              }
            });

            const result = Array.from(summaryMap.entries()).map(([classId, data]) => ({
              class: classesMap.get(classId) || classId,
              class_id: classId,
              boys: data.boys,
              girls: data.girls,
              total: data.total,
            }));

            const order = ["Play", "Nursery", "KG", "One", "Two", "Three", "Four", "Five"];
            result.sort((a, b) => order.indexOf(a.class) - order.indexOf(b.class));

            setStudentsSummary(result);
          } catch (err) {
            if (isNetworkError(err)) {
              console.warn("Students summary refresh unavailable: network connection is offline.");
            } else {
              console.error("Students summary refresh:", getErrorMessage(err));
            }
          }
        }
      )
      .subscribe();

    return () => {
      subscription.unsubscribe();
    };
  }, [classesMap]);

  const formatCurrency = (amount: number) => {
    if (!amount) return "৳ 0";
    return new Intl.NumberFormat("en-BD", {
      style: "currency",
      currency: "BDT",
      minimumFractionDigits: 0,
      maximumFractionDigits: 0,
    }).format(amount);
  };

  return (
    <ResponsiveLayout>
      <motion.div
        initial="hidden"
        animate="visible"
        variants={containerVariants}
        className="space-y-2 pt-0"
      >
        {/* ====== HEADER SECTION ====== */}
        <motion.div variants={itemVariants}>
          <div className="rounded-2xl border border-slate-200/70 bg-white/80 p-3 shadow-[0_10px_30px_-16px_rgba(15,23,42,0.45)] backdrop-blur-xl dark:border-slate-800/70 dark:bg-slate-900/70">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <div className="flex items-center gap-2.5">
                <div className="rounded-xl bg-gradient-to-br from-indigo-500 to-violet-500 p-2 text-white shadow-lg shadow-indigo-500/20">
                  <LayoutDashboard className="h-4 w-4" />
                </div>
                <div>
                  <h1 className="text-base font-semibold tracking-tight text-slate-900 dark:text-slate-100 sm:text-lg">
                    Welcome back,{" "}
                    <span className="bg-gradient-to-r from-indigo-600 to-violet-600 bg-clip-text text-transparent">
                      Dashboard!
                    </span>
                  </h1>
                  <p className="text-[11px] text-slate-500 dark:text-slate-400">
                    A premium snapshot of your school operations
                  </p>
                </div>
              </div>

              <div className="flex flex-wrap items-center gap-2">
                <Link href="/reports">
                  <motion.button
                    whileHover={{ scale: 1.02 }}
                    whileTap={{ scale: 0.98 }}
                    className="rounded-xl bg-gradient-to-r from-indigo-600 to-violet-600 px-3 py-1.5 text-[12px] font-semibold text-white shadow-sm transition-all duration-200 hover:shadow-md"
                  >
                    <span className="flex items-center gap-1">
                      <FileText className="h-3 w-3" />
                      View Reports
                    </span>
                  </motion.button>
                </Link>
                <Link href="/students/new">
                  <motion.button
                    whileHover={{ scale: 1.02 }}
                    whileTap={{ scale: 0.98 }}
                    className="rounded-xl border border-slate-200 bg-white/80 px-3 py-1.5 text-[12px] font-semibold text-slate-700 transition-all duration-200 hover:bg-slate-100 dark:border-slate-700 dark:bg-slate-800/70 dark:text-slate-200 dark:hover:bg-slate-700"
                  >
                    <span className="flex items-center gap-1">
                      <Users className="h-3 w-3" />
                      New Admission
                    </span>
                  </motion.button>
                </Link>
              </div>
            </div>
          </div>
        </motion.div>

        {/* 🆕 ====== PENDING ADMISSIONS BANNER ====== */}
        {pendingAdmissionsCount > 0 && (
          <motion.div variants={itemVariants}>
            <Link
              href="/dashboard/admissions"
              className="block bg-gradient-to-r from-amber-500 via-orange-500 to-orange-600 text-white rounded-2xl p-4 md:p-5 shadow-lg hover:shadow-xl transition-all duration-300 group relative overflow-hidden"
            >
              <div className="absolute -right-10 -top-10 w-32 h-32 rounded-full bg-white/10 blur-2xl" />
              <div className="absolute -left-8 -bottom-8 w-24 h-24 rounded-full bg-white/5 blur-xl" />

              <div className="relative z-10 flex items-center justify-between gap-4">
                <div className="flex items-center gap-3 md:gap-4">
                  <div className="w-12 h-12 md:w-14 md:h-14 rounded-full bg-white/25 backdrop-blur-md flex items-center justify-center shrink-0 border border-white/30 shadow-lg">
                    <UserPlus className="w-6 h-6 md:w-7 md:h-7" />
                  </div>
                  <div className="min-w-0">
                    <p className="font-bold text-base md:text-lg leading-tight">
                      🔔 {pendingAdmissionsCount}টি নতুন ভর্তি আবেদন
                    </p>
                    <p className="text-amber-50 text-xs md:text-sm mt-0.5">
                      অনুমোদনের জন্য অপেক্ষা করছে — এখনই দেখুন
                    </p>
                  </div>
                </div>
                <div className="flex items-center gap-2 shrink-0">
                  <span className="hidden md:inline-block text-xs font-semibold bg-white/20 px-3 py-1.5 rounded-full border border-white/30">
                    Approve
                  </span>
                  <ArrowRight className="w-5 h-5 md:w-6 md:h-6 group-hover:translate-x-1 transition-transform duration-300" />
                </div>
              </div>
            </Link>
          </motion.div>
        )}

        {!isOnline && (
          <motion.div
            variants={itemVariants}
            className="mb-2 rounded-xl border border-amber-300 bg-amber-50 px-4 py-3 text-sm text-amber-800 dark:border-amber-700 dark:bg-amber-950/40 dark:text-amber-200"
          >
            ইন্টারনেট সংযোগ নেই। Dashboard-এর সর্বশেষ তথ্য এখন লোড করা যাচ্ছে না। সংযোগ
            ফিরে এলে আবার চেষ্টা করা হবে।
          </motion.div>
        )}

        {/* ====== KPI CARDS ====== */}
        <div className="lg:hidden">
          <div className="grid grid-cols-2 gap-2 sm:grid-cols-3">
            <CompactKpiCard
              title="Total Students"
              value={dashboardStats.totalStudents || totalStudentsCount}
              icon={Users}
              color="from-blue-500 to-blue-600"
              loading={loading}
            />
            <CompactKpiCard
              title="Total Staff"
              value={dashboardStats.totalStaff || 0}
              icon={GraduationCap}
              color="from-purple-500 to-purple-600"
              loading={loading}
            />
            <CompactKpiCard
              title="Total Classes"
              value={dashboardStats.totalClasses || classesMap.size}
              icon={BookOpen}
              color="from-indigo-500 to-indigo-600"
              loading={loading}
            />
            <CompactKpiCard
              title="Fees Collection"
              value={formatCurrency(dashboardStats.feesCollection || 0)}
              icon={Wallet}
              color="from-emerald-500 to-emerald-600"
              loading={loading}
            />
            <CompactKpiCard
              title="Total Due Amount"
              value={formatCurrency(dashboardStats.pendingFees || 0)}
              icon={AlertCircle}
              color="from-amber-500 to-amber-600"
              loading={loading}
            />
          </div>
        </div>

        <div className="hidden md:grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-5 gap-3">
          <KpiCard
            title="Total Students"
            value={dashboardStats.totalStudents || totalStudentsCount}
            icon={Users}
            color="from-blue-500 to-blue-600"
            loading={loading}
          />
          <KpiCard
            title="Total Staff"
            value={dashboardStats.totalStaff || 0}
            icon={GraduationCap}
            color="from-purple-500 to-purple-600"
            loading={loading}
          />
          <KpiCard
            title="Total Classes"
            value={dashboardStats.totalClasses || classesMap.size}
            icon={BookOpen}
            color="from-indigo-500 to-indigo-600"
            loading={loading}
          />
          <KpiCard
            title="Fees Collection"
            value={formatCurrency(dashboardStats.feesCollection || 0)}
            icon={Wallet}
            color="from-emerald-500 to-emerald-600"
            loading={loading}
          />
          <KpiCard
            title="Total Due Amount"
            value={formatCurrency(dashboardStats.pendingFees || 0)}
            icon={AlertCircle}
            color="from-amber-500 to-amber-600"
            loading={loading}
          />
        </div>

        {/* ====== CHARTS ROW ====== */}
        <div className="grid grid-cols-1 xl:grid-cols-2 gap-4 min-w-0">
          <motion.div
            variants={itemVariants}
            className="overflow-hidden rounded-2xl border border-slate-200/70 bg-white shadow-[0_15px_35px_-20px_rgba(15,23,42,0.55)] backdrop-blur-xl dark:border-slate-800/70 dark:bg-slate-800/80 min-w-0 w-full"
          >
            <ChartHeader
              icon={Activity}
              title="Attendance Trend"
              subtitle="Last 7 days"
              gradient="from-emerald-500 via-green-600 to-teal-700"
            />
            <div className="bg-gradient-to-b from-emerald-50/80 to-white dark:from-emerald-950/30 dark:to-slate-900/70">
              {attendanceTrendLoading ? (
                <div className="flex items-center justify-center h-56">
                  <div className="w-6 h-6 border-2 border-emerald-500 border-t-transparent rounded-full animate-spin" />
                </div>
              ) : attendanceTrendData.length > 0 ? (
                <LineAreaChart data={attendanceTrendData} />
              ) : (
                <div className="flex items-center justify-center h-56 text-muted-foreground text-sm">
                  No attendance data
                </div>
              )}
            </div>
          </motion.div>

          <motion.div
            variants={itemVariants}
            className="overflow-hidden rounded-2xl border border-slate-200/70 bg-white shadow-[0_15px_35px_-20px_rgba(15,23,42,0.55)] backdrop-blur-xl dark:border-slate-800/70 dark:bg-slate-800/80 min-w-0 w-full"
          >
            <ChartHeader
              icon={Wallet}
              title="Fee Collection"
              subtitle="Last 6 months"
              gradient="from-amber-500 via-orange-500 to-orange-600"
            />
            <div className="bg-gradient-to-b from-orange-50/80 to-white dark:from-orange-950/30 dark:to-slate-900/70">
              {monthlyLoading ? (
                <div className="flex items-center justify-center h-56">
                  <div className="w-6 h-6 border-2 border-orange-500 border-t-transparent rounded-full animate-spin" />
                </div>
              ) : monthlyCollectionData.length > 0 ? (
                <BarChart data={monthlyCollectionData} />
              ) : (
                <div className="flex items-center justify-center h-56 text-muted-foreground text-sm">
                  No fee data
                </div>
              )}
            </div>
          </motion.div>
        </div>

        {/* ====== STUDENTS SUMMARY + SIDE PANELS ====== */}
        <div className="grid grid-cols-1 xl:grid-cols-2 gap-4 min-w-0">
          <motion.div
            variants={itemVariants}
            className="overflow-hidden rounded-2xl border border-slate-200/70 bg-white shadow-[0_15px_35px_-20px_rgba(15,23,42,0.55)] backdrop-blur-xl dark:border-slate-800/70 dark:bg-slate-900/80 min-w-0 w-full"
          >
            <div className="bg-gradient-to-r from-blue-600 via-indigo-600 to-purple-600 p-3 text-white rounded-t-2xl border-b border-white/30">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <div className="p-1.5 rounded-lg bg-white/20 backdrop-blur-sm border border-white/25">
                    <Users className="h-5 w-5 text-white" />
                  </div>
                  <div>
                    <h3 className="text-sm font-bold tracking-wide">Students Summary</h3>
                    <p className="text-[10px] uppercase tracking-[0.11em] opacity-90">
                      Class distribution
                    </p>
                  </div>
                </div>
                <div className="flex items-center gap-2">
                  <span className="text-[10px] bg-white/20 px-2 py-1 rounded-full">
                    {new Date().getFullYear()} - {new Date().getFullYear() + 1}
                  </span>
                  {summaryLoading && (
                    <div className="w-3 h-3 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                  )}
                </div>
              </div>
            </div>
            <div className="p-3">
              {studentsSummary.length === 0 && !summaryLoading ? (
                <div className="text-center py-6 text-gray-500">
                  <Users className="h-10 w-10 mx-auto mb-2 opacity-50" />
                  <p className="text-xs">No student data found</p>
                </div>
              ) : (
                <div className="overflow-x-auto min-w-0">
                  <table className="w-full text-xs min-w-0">
                    <thead>
                      <tr className="border-b border-blue-200 dark:border-blue-800">
                        <th className="rounded-l-xl bg-slate-100/90 px-2 py-2.5 text-left text-[11px] font-semibold uppercase tracking-[0.2em] text-slate-700 dark:bg-slate-800/80 dark:text-slate-300">
                          Class
                        </th>
                        <th className="bg-slate-100/90 px-2 py-2.5 text-center text-[11px] font-semibold uppercase tracking-[0.2em] text-slate-700 dark:bg-slate-800/80 dark:text-slate-300">
                          Boys
                        </th>
                        <th className="bg-slate-100/90 px-2 py-2.5 text-center text-[11px] font-semibold uppercase tracking-[0.2em] text-slate-700 dark:bg-slate-800/80 dark:text-slate-300">
                          Girls
                        </th>
                        <th className="rounded-r-xl bg-slate-100/90 px-2 py-2.5 text-center text-[11px] font-semibold uppercase tracking-[0.2em] text-slate-700 dark:bg-slate-800/80 dark:text-slate-300">
                          Total
                        </th>
                      </tr>
                    </thead>
                    <tbody>
                      {studentsSummary.map((row, idx) => (
                        <tr
                          key={row.class_id}
                          className={cn(
                            "transition-all duration-200 hover:bg-blue-50/50 dark:hover:bg-blue-950/30",
                            idx % 2 === 0
                              ? "bg-white/50 dark:bg-gray-900/50"
                              : "bg-blue-50/30 dark:bg-blue-950/20"
                          )}
                        >
                          <td className="px-2 py-2.5 font-semibold text-slate-800 dark:text-slate-200">
                            <div className="flex items-center gap-2">
                              <div
                                className={cn(
                                  "flex h-5 w-5 items-center justify-center rounded-lg text-[10px] font-bold text-white",
                                  row.class === "Play"
                                    ? "bg-gradient-to-r from-emerald-500 to-green-600"
                                    : row.class === "Nursery"
                                    ? "bg-gradient-to-r from-sky-500 to-cyan-600"
                                    : row.class === "KG"
                                    ? "bg-gradient-to-r from-violet-500 to-fuchsia-600"
                                    : row.class === "One"
                                    ? "bg-gradient-to-r from-amber-500 to-orange-600"
                                    : row.class === "Two"
                                    ? "bg-gradient-to-r from-rose-500 to-red-600"
                                    : row.class === "Three"
                                    ? "bg-gradient-to-r from-indigo-500 to-blue-600"
                                    : row.class === "Four"
                                    ? "bg-gradient-to-r from-teal-500 to-emerald-600"
                                    : "bg-gradient-to-r from-slate-500 to-slate-600"
                                )}
                              >
                                {row.class?.charAt(0) || "?"}
                              </div>
                              {row.class || "Unknown"}
                            </div>
                          </td>
                          <td className="px-2 py-2.5 text-center">
                            <span className="inline-flex items-center gap-0.5 rounded-full bg-blue-100 px-2 py-0.5 text-[10px] font-semibold text-blue-700 dark:bg-blue-950/40 dark:text-blue-200">
                              {row.boys}
                            </span>
                          </td>
                          <td className="px-2 py-2.5 text-center">
                            <span className="inline-flex items-center gap-0.5 rounded-full bg-pink-100 px-2 py-0.5 text-[10px] font-semibold text-pink-700 dark:bg-pink-950/40 dark:text-pink-200">
                              {row.girls}
                            </span>
                          </td>
                          <td className="px-2 py-2.5 text-center">
                            <span className="inline-flex items-center gap-0.5 rounded-full bg-emerald-100 px-2 py-0.5 text-[10px] font-bold text-emerald-700 dark:bg-emerald-950/40 dark:text-emerald-200">
                              {row.total}
                            </span>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                    <tfoot className="border-t border-blue-300 dark:border-blue-700">
                      <tr className="bg-gradient-to-r from-slate-100 to-slate-200/80 dark:from-slate-800/90 dark:to-slate-700/90">
                        <td className="px-2 py-2.5 text-sm font-bold text-slate-900 dark:text-slate-100">
                          G/Total
                        </td>
                        <td className="px-2 py-2.5 text-center">
                          <span className="inline-flex items-center gap-0.5 rounded-full bg-blue-600 px-2 py-0.5 text-[10px] font-bold text-white shadow-md">
                            {totalBoys}
                          </span>
                        </td>
                        <td className="px-2 py-2.5 text-center">
                          <span className="inline-flex items-center gap-0.5 rounded-full bg-pink-600 px-2 py-0.5 text-[10px] font-bold text-white shadow-md">
                            {totalGirls}
                          </span>
                        </td>
                        <td className="px-2 py-2.5 text-center">
                          <span className="inline-flex items-center gap-0.5 rounded-full bg-emerald-600 px-2 py-0.5 text-[10px] font-bold text-white shadow-md">
                            {totalStudentsCount}
                          </span>
                        </td>
                      </tr>
                    </tfoot>
                  </table>
                </div>
              )}
            </div>
          </motion.div>

          <div className="space-y-4 min-w-0">
            {/* NOTICE BOARD SECTION */}
            <motion.div
              variants={itemVariants}
              className="overflow-hidden rounded-2xl border border-slate-200/70 bg-white shadow-[0_15px_35px_-20px_rgba(15,23,42,0.55)] backdrop-blur-xl dark:border-slate-800/70 dark:bg-slate-900/80 min-w-0 w-full"
            >
              <div className="bg-gradient-to-r from-blue-600 via-cyan-600 to-teal-600 p-3 text-white rounded-t-2xl border-b border-white/30">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <div className="p-1.5 rounded-lg bg-white/20 backdrop-blur-sm border border-white/25">
                      <Megaphone className="h-4 w-4 text-white" />
                    </div>
                    <h3 className="text-sm font-semibold">Notice Board</h3>
                  </div>
                  <Link href="/notifications/notice">
                    <span className="text-[10px] bg-white/20 px-2 py-1 rounded-full hover:bg-white/30 transition-colors cursor-pointer">
                      View All
                    </span>
                  </Link>
                </div>
              </div>
              <div className="p-3">
                {noticesLoading ? (
                  <div className="flex items-center justify-center py-6">
                    <div className="w-5 h-5 border-2 border-blue-500 border-t-transparent rounded-full animate-spin" />
                  </div>
                ) : notices.length > 0 ? (
                  <div className="space-y-2 max-h-48 overflow-y-auto min-w-0">
                    {notices.map((notice) => (
                      <div
                        key={notice.id}
                        className="flex items-start gap-2 p-2 hover:bg-slate-50 dark:hover:bg-slate-800 transition-colors rounded-lg"
                      >
                        <div
                          className={`p-1.5 rounded-lg flex-shrink-0 ${
                            notice.type === "urgent"
                              ? "bg-red-100 dark:bg-red-900/30"
                              : notice.type === "holiday"
                              ? "bg-purple-100 dark:bg-purple-900/30"
                              : notice.type === "event"
                              ? "bg-green-100 dark:bg-green-900/30"
                              : "bg-blue-100 dark:bg-blue-900/30"
                          }`}
                        >
                          <Megaphone
                            className={`h-3 w-3 ${
                              notice.type === "urgent"
                                ? "text-red-500"
                                : notice.type === "holiday"
                                ? "text-purple-500"
                                : notice.type === "event"
                                ? "text-green-500"
                                : "text-blue-500"
                            }`}
                          />
                        </div>
                        <div className="flex-1 min-w-0">
                          <p className="text-xs font-medium truncate dark:text-white">
                            {notice.title}
                            {notice.pinned && <span className="ml-1 text-amber-500">📌</span>}
                          </p>
                          <p className="text-[10px] text-slate-500 dark:text-slate-400 truncate">
                            {notice.content}
                          </p>
                          <p className="text-[9px] text-slate-400 dark:text-slate-500">
                            {new Date(notice.created_at).toLocaleDateString("en-US", {
                              month: "short",
                              day: "numeric",
                            })}
                          </p>
                        </div>
                      </div>
                    ))}
                  </div>
                ) : (
                  <div className="text-center py-6 text-muted-foreground text-sm flex flex-col items-center justify-center">
                    <Megaphone className="h-8 w-8 mx-auto mb-2 opacity-50 dark:text-gray-600" />
                    <p className="text-xs dark:text-gray-400">No notices posted</p>
                  </div>
                )}
              </div>
            </motion.div>

            {/* RECENT ACTIVITY */}
            <motion.div
              variants={itemVariants}
              className="overflow-hidden rounded-2xl border border-slate-200/70 bg-white shadow-[0_15px_35px_-20px_rgba(15,23,42,0.55)] backdrop-blur-xl dark:border-slate-800/70 dark:bg-slate-900/80 min-w-0 w-full"
            >
              <div className="bg-gradient-to-r from-pink-600 via-purple-600 to-violet-600 p-3 text-white rounded-t-2xl border-b border-white/30">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <div className="p-1.5 rounded-lg bg-white/20 backdrop-blur-sm border border-white/25">
                      <Clock className="h-4 w-4 text-white" />
                    </div>
                    <h3 className="text-sm font-semibold">Recent Activity</h3>
                  </div>
                </div>
              </div>
              {activityLoading ? (
                <div className="flex items-center justify-center py-6">
                  <div className="w-6 h-6 border-2 border-pink-500 border-t-transparent rounded-full animate-spin" />
                </div>
              ) : recentActivity.length > 0 ? (
                <div className="space-y-1 max-h-50 overflow-y-auto min-w-0">
                  {recentActivity.map((item: any, idx: number) => (
                    <div
                      key={idx}
                      className="flex items-center gap-2 p-2 hover:bg-slate-50 dark:hover:bg-slate-800 transition-colors"
                    >
                      <div className="p-1.5 rounded-lg bg-slate-100 dark:bg-slate-700">
                        <ActivityIcon type={item.type} />
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className="text-xs font-medium truncate">
                          {item.type === "payment"
                            ? `${item.students?.name || "Unknown"} - ৳${(
                                Number(item.amount) || 0
                              ).toLocaleString()}`
                            : item.type === "admission"
                            ? `${item.name} - New Admission`
                            : `${item.students?.name || "Unknown"} - ${item.status}`}
                        </p>
                        <p className="text-[10px] text-slate-500">
                          {new Date(item.timestamp).toLocaleDateString("en-US", {
                            month: "short",
                            day: "numeric",
                          })}
                        </p>
                      </div>
                    </div>
                  ))}
                </div>
              ) : (
                <div className="text-center py-6 text-muted-foreground text-sm">
                  No recent activity
                </div>
              )}
            </motion.div>
          </div>
        </div>
      </motion.div>
    </ResponsiveLayout>
  );
}