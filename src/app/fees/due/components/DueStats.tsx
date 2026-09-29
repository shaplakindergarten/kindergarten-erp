// H:\kindergarten-erp\src\app\fees\due\components\DueStats.tsx

"use client";

import { Card, CardContent } from "@/components/ui/card";
import { Progress } from "@/components/ui/progress";
import { DollarSign, TrendingUp, AlertCircle, Clock, Zap, TrendingDown, Users, Wallet, Percent, Calendar } from "lucide-react";
import { formatCurrency } from "../utils/calculations";
import { DueStatsType } from "../types";

interface DueStatsProps {
  stats: DueStatsType;
  studentCount: number;
  onTabChange?: (tab: string) => void;
}

const StatCard = ({ title, value, icon: Icon, gradient, textColor, progress, subtitle, onClick }: any) => (
  <Card
    className="relative overflow-hidden transition-all duration-300 hover:scale-[1.02] hover:shadow-xl cursor-pointer border-0"
    onClick={onClick}
  >
    <div className={`absolute inset-0 bg-gradient-to-br ${gradient} opacity-90`} />
    <div className="absolute top-0 right-0 -mt-4 -mr-4 w-20 h-20 rounded-full bg-white/20 blur-2xl" />
    <CardContent className="relative z-10 p-2 sm:p-2.5 md:p-3">
      <div className="flex items-start justify-between gap-1">
        <div className="space-y-0.5 min-w-0 flex-1">
          {/* Title — one line, ellipsis on overflow */}
          <p className="text-[8px] sm:text-[9px] md:text-[10px] font-medium text-white/80 uppercase tracking-wider leading-none truncate">
            {title}
          </p>

          {/* ✅ FIXED: Value — clamp sizing, no ellipsis, tight letters */}
          <p
            className="font-bold tracking-tight text-white leading-none tabular-nums whitespace-nowrap"
            style={{
              fontSize: "clamp(10px, 2.2vw, 17px)",
              letterSpacing: "-0.02em",
            }}
            title={typeof value === "string" ? value : String(value)}
          >
            {value}
          </p>

          {subtitle && (
            <p className="text-[8px] sm:text-[9px] md:text-[10px] text-white/70 leading-none truncate">
              {subtitle}
            </p>
          )}
          {progress !== undefined && (
            <Progress value={progress} className="h-1 w-14 sm:w-16 md:w-20 mt-1 bg-white/30 [&>div]:bg-white" />
          )}
        </div>

        <div className="p-1 sm:p-1.5 rounded-md sm:rounded-lg bg-white/20 backdrop-blur-sm shadow-lg shrink-0">
          <Icon className="h-3 w-3 sm:h-3.5 sm:w-3.5 md:h-4 md:w-4 text-white" />
        </div>
      </div>
    </CardContent>
  </Card>
);

export function DueStats({ stats, studentCount, onTabChange }: DueStatsProps) {
  const progressValue = stats.totalFees > 0 ? (stats.totalPaid / stats.totalFees) * 100 : 0;
  const avgDue = studentCount > 0 ? stats.totalDue / studentCount : 0;

  return (
    <>
      <div className="grid gap-1.5 sm:gap-2 md:gap-2.5 grid-cols-3 sm:grid-cols-3 md:grid-cols-3 lg:grid-cols-6">
        {/* Total Due */}
        <StatCard
          title="Total Due"
          value={formatCurrency(stats.totalDue)}
          icon={DollarSign}
          gradient="from-red-600 to-rose-600"
          onClick={() => onTabChange?.("all")}
        />

        {/* Collection Rate */}
        <StatCard
          title="Collection"
          value={`${stats.collectionRate.toFixed(1)}%`}
          icon={TrendingUp}
          gradient="from-emerald-600 to-teal-600"
          progress={progressValue}
          onClick={() => onTabChange?.("all")}
        />

        {/* Due Students */}
        <StatCard
          title="Students"
          value={studentCount}
          icon={Users}
          gradient="from-blue-600 to-cyan-600"
          subtitle={`Avg: ${formatCurrency(avgDue)}`}
          onClick={() => onTabChange?.("all")}
        />

        {/* High Risk */}
        <StatCard
          title="High Risk"
          value={stats.highDueCount}
          icon={AlertCircle}
          gradient="from-orange-600 to-amber-600"
          subtitle="2-3 months"
          onClick={() => onTabChange?.("high")}
        />

        {/* Critical */}
        <StatCard
          title="Critical"
          value={stats.criticalOverdue}
          icon={Clock}
          gradient="from-purple-600 to-pink-600"
          subtitle="3+ months"
          onClick={() => onTabChange?.("critical")}
        />

        {/* Advance Balance */}
        <StatCard
          title="Advance"
          value={formatCurrency(stats.advanceBalance || 0)}
          icon={Wallet}
          gradient="from-yellow-600 to-amber-600"
          subtitle="Total"
          onClick={() => onTabChange?.("all")}
        />
      </div>

      {/* Quick Filter Chips */}
      <div className="flex flex-wrap gap-1.5 sm:gap-2">
        <button
          onClick={() => onTabChange?.("all")}
          className="px-2.5 sm:px-3 py-1 sm:py-1.5 rounded-full text-[10px] sm:text-xs font-medium transition-all bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300 hover:bg-slate-200 dark:hover:bg-slate-700 whitespace-nowrap"
        >
          All ({studentCount})
        </button>
        <button
          onClick={() => onTabChange?.("critical")}
          className="px-2.5 sm:px-3 py-1 sm:py-1.5 rounded-full text-[10px] sm:text-xs font-medium transition-all bg-red-100 dark:bg-red-950/40 text-red-700 dark:text-red-400 hover:bg-red-200 dark:hover:bg-red-950/60 whitespace-nowrap"
        >
          🔴 Critical ({stats.criticalOverdue})
        </button>
        <button
          onClick={() => onTabChange?.("high")}
          className="px-2.5 sm:px-3 py-1 sm:py-1.5 rounded-full text-[10px] sm:text-xs font-medium transition-all bg-orange-100 dark:bg-orange-950/40 text-orange-700 dark:text-orange-400 hover:bg-orange-200 dark:hover:bg-orange-950/60 whitespace-nowrap"
        >
          🟠 High ({stats.highDueCount})
        </button>
        <button
          onClick={() => onTabChange?.("medium")}
          className="px-2.5 sm:px-3 py-1 sm:py-1.5 rounded-full text-[10px] sm:text-xs font-medium transition-all bg-yellow-100 dark:bg-yellow-950/40 text-yellow-700 dark:text-yellow-400 hover:bg-yellow-200 dark:hover:bg-yellow-950/60 whitespace-nowrap"
        >
          🟡 Medium ({stats.mediumDueCount})
        </button>
        <button
          onClick={() => onTabChange?.("low")}
          className="px-2.5 sm:px-3 py-1 sm:py-1.5 rounded-full text-[10px] sm:text-xs font-medium transition-all bg-green-100 dark:bg-green-950/40 text-green-700 dark:text-green-400 hover:bg-green-200 dark:hover:bg-green-950/60 whitespace-nowrap"
        >
          🟢 Low ({stats.lowDueCount})
        </button>
        <button
          onClick={() => onTabChange?.("advance")}
          className="px-2.5 sm:px-3 py-1 sm:py-1.5 rounded-full text-[10px] sm:text-xs font-medium transition-all bg-yellow-100 dark:bg-yellow-950/40 text-yellow-700 dark:text-yellow-400 hover:bg-yellow-200 dark:hover:bg-yellow-950/60 whitespace-nowrap"
        >
          💰 Advance ({stats.advanceCount || 0})
        </button>
      </div>
    </>
  );
}