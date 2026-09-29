"use client";

import React from 'react';
import Link from 'next/link';
import { ArrowLeft, AlertCircle, AlertTriangle, Calendar, TrendingUp, Users, UserCheck, FileSpreadsheet } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { ResponsiveLayout } from "@/components/layout/responsive-layout";

const reportTypes = [
  {
    title: 'Master Fee Ledger',
    href: '/fees/reports/master-ledger',
    icon: FileSpreadsheet,
    description: 'All students × dynamic fee categories × all months with carry forward.',
  },
  {
    title: 'Daily Collection',
    href: '/fees/reports/daily',
    icon: Calendar,
    description: 'Daily fee collection summary.',
  },
  {
    title: 'Monthly Collection',
    href: '/fees/reports/monthly',
    icon: TrendingUp,
    description: 'Monthly fee collection report.',
  },
  {
    title: 'Student Ledger',
    href: '/fees/reports/student-ledger',
    icon: UserCheck,
    description: 'Student fee ledger and transaction history.',
  },
  {
    title: 'Class Collection',
    href: '/fees/reports/class-wise',
    icon: Users,
    description: 'Fee collection by class.',
  },
  {
    title: 'Due Report',
    href: '/fees/reports/due-summary',
    icon: AlertCircle,
    description: 'Summary of pending student dues.',
  },
  {
    title: 'Outstanding / Defaulter',
    href: '/fees/reports/outstanding',
    icon: AlertTriangle,
    description: 'Overdue and defaulter student list.',
  },
  {
    title: 'Year Closing',
    href: '/fees/reports/year-closing',
    icon: Calendar,
    description: 'Academic year closing report.',
  },
] as const;

type ReportType = (typeof reportTypes)[number];

function ReportCard({ report }: { report: ReportType }) {
  const Icon = report.icon;
  return (
    <Link
      href={report.href}
      className="block focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-slate-500 rounded-2xl"
      aria-label="Open"
    >
      <Card className="h-full border border-slate-200 bg-white shadow-sm transition hover:border-slate-300 focus-within:border-slate-300">
        <CardContent className="p-5">
          <div className="flex items-start gap-4">
            <div className="flex h-11 w-11 items-center justify-center rounded-2xl bg-slate-100">
              <Icon className="h-5 w-5 text-slate-700" aria-hidden="true" />
            </div>
            <div>
              <h3 className="text-base font-semibold text-slate-900">{report.title}</h3>
              <p className="mt-1 text-sm leading-6 text-slate-600">{report.description}</p>
            </div>
          </div>
        </CardContent>
      </Card>
    </Link>
  );
}

export default function ReportsPage() {
  return (
    <ResponsiveLayout>
      <div className="space-y-6 p-6">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
          <div className="flex items-center gap-3">
            <Button variant="ghost" size="icon" asChild>
              <Link href="/fees">
                <ArrowLeft className="h-5 w-5" aria-hidden="true" />
              </Link>
            </Button>
            <div>
              <p className="text-xs font-semibold uppercase tracking-[0.2em] text-slate-500">Fees</p>
              <h1 className="text-2xl font-semibold text-slate-900">Fee Reports</h1>
            </div>
          </div>
          <p className="max-w-xl text-sm leading-6 text-slate-600">
            Access fee reports for collection, ledgers, dues, and year-end closing.
          </p>
        </div>

        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {reportTypes.map((report) => (
            <ReportCard key={report.href} report={report} />
          ))}
        </div>
      </div>
    </ResponsiveLayout>
  );
}