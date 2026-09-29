// src/app/exams/dashboard/page.tsx
'use client';

import React, { useState, useEffect, useCallback } from 'react';
import { ResponsiveLayout } from "@/components/layout/responsive-layout";
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Badge } from '@/components/ui/badge';
import { 
  BookOpen, 
  Users, 
  FileText, 
  CheckCircle, 
  Lock, 
  Send,
  ShieldCheck,
  TrendingUp,
  AlertCircle,
  Loader2,
  RefreshCw,
  PlusCircle,
  Sparkles,
  Award,
  Calendar,
  ClipboardCheck,
  BarChart3,
  Zap,
  Rocket
} from 'lucide-react';
import { format } from 'date-fns';
import { createClient } from '@/lib/supabase/client';
import { toast } from 'sonner';
import Link from 'next/link';

const supabase = createClient();

interface DashboardStats {
  total_terms: number;
  active_terms: number;
  completed_terms: number;
  published_results: number;
  total_students: number;
  avg_gpa: number;
  pending_submit: number;
  pending_verify: number;
  pending_lock: number;
}

interface ExamTerm {
  id: string;
  name: string;
  term_code: string;
  status: string;
  result_status: string;
  weightage_percentage: number;
}

export default function ExamDashboardPage() {
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [selectedTerm, setSelectedTerm] = useState<string>("");
  const [terms, setTerms] = useState<ExamTerm[]>([]);
  const [stats, setStats] = useState<DashboardStats>({
    total_terms: 0,
    active_terms: 0,
    completed_terms: 0,
    published_results: 0,
    total_students: 0,
    avg_gpa: 0,
    pending_submit: 0,
    pending_verify: 0,
    pending_lock: 0,
  });

  const fetchTerms = useCallback(async () => {
    try {
      const { data, error } = await supabase
        .from('exam_terms')
        .select('*')
        .order('created_at', { ascending: false });

      if (error) {
        console.error('Error fetching terms:', error.message);
        return;
      }

      if (data && data.length > 0) {
        setTerms(data);
        if (!selectedTerm) {
          setSelectedTerm(data[0].id);
        }
      } else {
        setTerms([]);
      }
    } catch (err) {
      console.error('Unexpected error:', err);
    }
  }, [selectedTerm]);

  const fetchStats = useCallback(async () => {
    setLoading(true);
    try {
      const { data: termsData } = await supabase
        .from('exam_terms')
        .select('id, status, result_status');

      const activeTerms = termsData?.filter(t => t.status === 'ongoing').length || 0;
      const completedTerms = termsData?.filter(t => t.status === 'completed').length || 0;
      const publishedResults = termsData?.filter(t => t.result_status === 'published').length || 0;

      const { count: studentsCount } = await supabase
        .from('students')
        .select('*', { count: 'exact', head: true })
        .eq('status', 'active');

      const { data: pendingMarks } = await supabase
        .from('student_marks_new')
        .select('entry_status');

      const pendingSubmit = pendingMarks?.filter(m => m.entry_status === 'draft').length || 0;
      const pendingVerify = pendingMarks?.filter(m => m.entry_status === 'submitted').length || 0;
      const pendingLock = pendingMarks?.filter(m => m.entry_status === 'verified').length || 0;

      const { data: gpaData } = await supabase
        .from('compiled_results')
        .select('gpa')
        .eq('is_published', true);

      const avgGpa = gpaData && gpaData.length > 0
        ? gpaData.reduce((sum, r) => sum + (r.gpa || 0), 0) / gpaData.length
        : 0;

      setStats({
        total_terms: termsData?.length || 0,
        active_terms: activeTerms,
        completed_terms: completedTerms,
        published_results: publishedResults,
        total_students: studentsCount || 0,
        avg_gpa: avgGpa,
        pending_submit: pendingSubmit,
        pending_verify: pendingVerify,
        pending_lock: pendingLock,
      });
    } catch (error) {
      console.error('Error fetching stats:', error);
      toast.error('Failed to load dashboard data');
    } finally {
      setLoading(false);
    }
  }, []);

  const handleRefresh = async () => {
    setRefreshing(true);
    await Promise.all([fetchTerms(), fetchStats()]);
    setRefreshing(false);
    toast.success('Dashboard refreshed');
  };

  useEffect(() => {
    fetchTerms();
    fetchStats();
  }, [fetchTerms, fetchStats]);

  const workflowSteps = [
    {
      id: 'entry',
      title: 'Marks Entry',
      description: 'Enter draft marks',
      count: stats.pending_submit,
      icon: FileText,
      link: '/exams/marks/entry',
      gradient: 'from-blue-500 to-blue-600',
      hoverGradient: 'hover:from-blue-600 hover:to-blue-700',
      iconBg: 'bg-blue-100 dark:bg-blue-900/30',
      iconColor: 'text-blue-600 dark:text-blue-400',
      badgeBg: 'bg-white/90 dark:bg-gray-800/90',
      badgeText: 'text-blue-700 dark:text-blue-300',
    },
    {
      id: 'submit',
      title: 'Submit Marks',
      description: 'Submit for verification',
      count: stats.pending_submit,
      icon: Send,
      link: '/exams/marks/submit',
      gradient: 'from-indigo-500 to-indigo-600',
      hoverGradient: 'hover:from-indigo-600 hover:to-indigo-700',
      iconBg: 'bg-indigo-100 dark:bg-indigo-900/30',
      iconColor: 'text-indigo-600 dark:text-indigo-400',
      badgeBg: 'bg-white/90 dark:bg-gray-800/90',
      badgeText: 'text-indigo-700 dark:text-indigo-300',
    },
    {
      id: 'verify',
      title: 'Verify Marks',
      description: 'Verify submitted marks',
      count: stats.pending_verify,
      icon: ShieldCheck,
      link: '/exams/marks/verify',
      gradient: 'from-amber-500 to-amber-600',
      hoverGradient: 'hover:from-amber-600 hover:to-amber-700',
      iconBg: 'bg-amber-100 dark:bg-amber-900/30',
      iconColor: 'text-amber-600 dark:text-amber-400',
      badgeBg: 'bg-white/90 dark:bg-gray-800/90',
      badgeText: 'text-amber-700 dark:text-amber-300',
    },
    {
      id: 'lock',
      title: 'Lock Marks',
      description: 'Lock verified marks',
      count: stats.pending_lock,
      icon: Lock,
      link: '/exams/marks/lock',
      gradient: 'from-red-500 to-red-600',
      hoverGradient: 'hover:from-red-600 hover:to-red-700',
      iconBg: 'bg-red-100 dark:bg-red-900/30',
      iconColor: 'text-red-600 dark:text-red-400',
      badgeBg: 'bg-white/90 dark:bg-gray-800/90',
      badgeText: 'text-red-700 dark:text-red-300',
    },
  ];

  const quickActions = [
    { title: 'Generate Result', link: '/exams/results/generate', icon: Zap, gradient: 'from-purple-500 to-purple-600' },
    { title: 'Publish Result', link: '/exams/results/publish', icon: Rocket, gradient: 'from-green-500 to-green-600' },
    { title: 'Tabulation Sheet', link: '/exams/tabulation', icon: BarChart3, gradient: 'from-teal-500 to-teal-600' },
    { title: 'Progress Card', link: '/exams/reports/progress-card', icon: Award, gradient: 'from-cyan-500 to-cyan-600' },
  ];

  const statCards = [
    { title: 'Total Exams', value: stats.total_terms, icon: Calendar, gradient: 'from-blue-500 to-blue-600', suffix: '' },
    { title: 'Total Students', value: stats.total_students, icon: Users, gradient: 'from-purple-500 to-purple-600', suffix: '' },
    { title: 'Published Results', value: stats.published_results, icon: CheckCircle, gradient: 'from-green-500 to-green-600', suffix: '' },
    { title: 'Average GPA', value: stats.avg_gpa.toFixed(2), icon: TrendingUp, gradient: 'from-teal-500 to-teal-600', suffix: '' },
  ];

  const workflowGuideSteps = [
    {
      name: 'Marks Entry',
      icon: FileText,
      bgLight: 'bg-blue-50 dark:bg-blue-950/50',
      iconColor: 'text-blue-600 dark:text-blue-400',
      borderColor: 'border-blue-200 dark:border-blue-800',
    },
    {
      name: 'Submit',
      icon: Send,
      bgLight: 'bg-indigo-50 dark:bg-indigo-950/50',
      iconColor: 'text-indigo-600 dark:text-indigo-400',
      borderColor: 'border-indigo-200 dark:border-indigo-800',
    },
    {
      name: 'Verify',
      icon: ShieldCheck,
      bgLight: 'bg-amber-50 dark:bg-amber-950/50',
      iconColor: 'text-amber-600 dark:text-amber-400',
      borderColor: 'border-amber-200 dark:border-amber-800',
    },
    {
      name: 'Lock',
      icon: Lock,
      bgLight: 'bg-red-50 dark:bg-red-950/50',
      iconColor: 'text-red-600 dark:text-red-400',
      borderColor: 'border-red-200 dark:border-red-800',
    },
    {
      name: 'Generate',
      icon: Sparkles,
      bgLight: 'bg-purple-50 dark:bg-purple-950/50',
      iconColor: 'text-purple-600 dark:text-purple-400',
      borderColor: 'border-purple-200 dark:border-purple-800',
    },
    {
      name: 'Publish',
      icon: Rocket,
      bgLight: 'bg-green-50 dark:bg-green-950/50',
      iconColor: 'text-green-600 dark:text-green-400',
      borderColor: 'border-green-200 dark:border-green-800',
    },
    {
      name: 'Tabulation',
      icon: BarChart3,
      bgLight: 'bg-teal-50 dark:bg-teal-950/50',
      iconColor: 'text-teal-600 dark:text-teal-400',
      borderColor: 'border-teal-200 dark:border-teal-800',
    },
  ];

  if (loading) {
    return (
      <ResponsiveLayout>
        <div className="flex flex-col items-center justify-center py-20">
          <Loader2 className="h-8 w-8 animate-spin text-emerald-600 dark:text-emerald-400 mb-3" />
          <p className="text-sm text-gray-500 dark:text-gray-400">Loading dashboard...</p>
        </div>
      </ResponsiveLayout>
    );
  }

  if (terms.length === 0) {
    return (
      <ResponsiveLayout>
        <div className="space-y-6">
          <div className="rounded-3xl bg-gradient-to-r from-emerald-700 via-teal-700 to-cyan-800 p-6 shadow-2xl">
            <div className="flex flex-col lg:flex-row gap-4 justify-between">
              <div>
                <h1 className="text-3xl font-bold text-white flex items-center gap-3">
                  <BookOpen className="h-8 w-8" />
                  Exams Dashboard
                  <Badge className="bg-yellow-400 text-black ml-2">Setup Required</Badge>
                </h1>
                <p className="text-emerald-100 mt-2">Configure exam terms to get started</p>
              </div>
              <div className="flex flex-wrap gap-2">
                <Button onClick={handleRefresh} disabled={refreshing} variant="outline" className="bg-white/20 hover:bg-white/30 text-white border-0">
                  {refreshing ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <RefreshCw className="mr-2 h-4 w-4" />}
                  Refresh
                </Button>
              </div>
            </div>
          </div>

          <Card className="rounded-3xl border border-gray-200 dark:border-gray-700 shadow-lg overflow-hidden bg-white dark:bg-gray-900">
            <CardContent className="flex flex-col items-center justify-center py-16 text-center">
              <div className="h-20 w-20 rounded-full bg-amber-100 dark:bg-amber-900/30 flex items-center justify-center mb-4">
                <AlertCircle className="h-10 w-10 text-amber-600 dark:text-amber-400" />
              </div>
              <h2 className="text-xl font-semibold text-gray-900 dark:text-white mb-2">No Exam Terms Found</h2>
              <p className="text-gray-500 dark:text-gray-400 max-w-md mb-6">
                You need to create at least one exam term before using the exam module.
              </p>
              <Link href="/exams/setup/terms">
                <Button className="rounded-xl bg-emerald-600 hover:bg-emerald-700">
                  <PlusCircle className="h-4 w-4 mr-2" />
                  Create First Exam Term
                </Button>
              </Link>
            </CardContent>
          </Card>

          <div className="text-center text-sm text-gray-500 dark:text-gray-400 py-4">
            {format(new Date(), "dd MMMM yyyy hh:mm a")}
          </div>
        </div>
      </ResponsiveLayout>
    );
  }

  return (
    <ResponsiveLayout>
      <div className="space-y-6">
        {/* Header */}
        <div className="rounded-3xl bg-gradient-to-r from-emerald-700 via-teal-700 to-cyan-800 p-6 shadow-2xl">
          <div className="flex flex-col lg:flex-row gap-4 justify-between">
            <div>
              <h1 className="text-3xl font-bold text-white flex items-center gap-3">
                <BookOpen className="h-8 w-8" />
                Exams Dashboard
                <Badge className="bg-yellow-400 text-black ml-2">Overview</Badge>
              </h1>
              <p className="text-emerald-100 mt-2">Manage exams, marks, and results from one place</p>
            </div>
            <div className="flex flex-wrap gap-2">
              <Button onClick={handleRefresh} disabled={refreshing} variant="outline" className="bg-white/20 hover:bg-white/30 text-white border-0">
                {refreshing ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <RefreshCw className="mr-2 h-4 w-4" />}
                Refresh
              </Button>
            </div>
          </div>
        </div>

        {/* Term Selector Card */}
        <Card className="border-0 shadow-lg rounded-3xl bg-gradient-to-r from-slate-50 to-gray-100 dark:from-gray-900 dark:to-gray-950">
          <CardContent className="p-6">
            <div className="max-w-md">
              <Label className="mb-2 block text-gray-700 dark:text-gray-200 font-medium flex items-center gap-2">
                <Calendar className="h-4 w-4 text-emerald-600 dark:text-emerald-400" />
                Filter by Exam Term
              </Label>
              <Select value={selectedTerm} onValueChange={setSelectedTerm}>
                <SelectTrigger className="w-full rounded-xl border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-800 text-gray-900 dark:text-gray-100 shadow-sm">
                  <SelectValue placeholder="Select Exam Term" />
                </SelectTrigger>
                <SelectContent className="bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-xl shadow-lg">
                  {terms.map((term) => (
                    <SelectItem key={term.id} value={term.id} className="text-gray-900 dark:text-gray-100 hover:bg-gray-100 dark:hover:bg-gray-700 cursor-pointer">
                      {term.name} <span className="text-gray-500 dark:text-gray-400 text-xs">({term.status})</span>
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </CardContent>
        </Card>

        {/* Stats Cards */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
          {statCards.map((card, idx) => (
            <Card key={idx} className={`rounded-2xl border-0 shadow-md hover:shadow-xl transition-all duration-300 hover:-translate-y-1 bg-gradient-to-br ${card.gradient}`}>
              <CardContent className="p-5">
                <div className="flex justify-between items-start">
                  <div>
                    <p className="text-sm text-white/80 font-medium">{card.title}</p>
                    <p className="text-3xl font-bold text-white mt-1">{card.value}{card.suffix}</p>
                  </div>
                  <div className="h-12 w-12 rounded-full bg-white/20 flex items-center justify-center backdrop-blur-sm">
                    <card.icon className="h-6 w-6 text-white" />
                  </div>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>

        {/* Info Alert */}
        <div className="flex flex-wrap justify-between items-center p-4 rounded-xl bg-gradient-to-r from-blue-50 to-indigo-50 dark:from-blue-950/30 dark:to-indigo-950/30 border border-blue-200 dark:border-blue-800">
          <div className="flex flex-wrap gap-4 text-sm">
            <span className="text-blue-700 dark:text-blue-300 flex items-center gap-1"><span className="h-2 w-2 rounded-full bg-blue-500"></span> Active Terms: {stats.active_terms}</span>
            <span className="text-green-700 dark:text-green-300 flex items-center gap-1"><span className="h-2 w-2 rounded-full bg-green-500"></span> Completed: {stats.completed_terms}</span>
            <span className="text-purple-700 dark:text-purple-300 flex items-center gap-1"><span className="h-2 w-2 rounded-full bg-purple-500"></span> Results Published: {stats.published_results}</span>
            <span className="text-amber-700 dark:text-amber-300 flex items-center gap-1"><span className="h-2 w-2 rounded-full bg-amber-500"></span> Students: {stats.total_students}</span>
          </div>
          <div className="text-sm text-gray-500 dark:text-gray-400">
            <span className="h-2 w-2 rounded-full bg-emerald-500 inline-block mr-1"></span> Avg GPA: {stats.avg_gpa.toFixed(2)}
          </div>
        </div>

        {/* Workflow Steps */}
        <div className="flex items-center justify-between">
          <h2 className="text-xl font-bold text-gray-900 dark:text-white flex items-center gap-2">
            <ClipboardCheck className="h-5 w-5 text-emerald-600 dark:text-emerald-400" />
            Marks Workflow
          </h2>
          <Badge variant="outline" className="bg-gradient-to-r from-emerald-50 to-teal-50 dark:from-emerald-950/50 dark:to-teal-950/50 border-emerald-200 dark:border-emerald-800 text-emerald-700 dark:text-emerald-300">
            {stats.pending_submit + stats.pending_verify + stats.pending_lock} Pending Tasks
          </Badge>
        </div>
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
          {workflowSteps.map((step) => (
            <Link href={step.link} key={step.id}>
              <Card className={`rounded-2xl border-0 shadow-md hover:shadow-xl transition-all duration-300 hover:-translate-y-1 cursor-pointer bg-gradient-to-br ${step.gradient} ${step.hoverGradient}`}>
                <CardContent className="p-5">
                  <div className="flex items-start gap-3">
                    <div className={`h-10 w-10 rounded-full ${step.iconBg} flex items-center justify-center backdrop-blur-sm`}>
                      <step.icon className={`h-5 w-5 ${step.iconColor}`} />
                    </div>
                    <div className="flex-1">
                      <p className="font-semibold text-white">{step.title}</p>
                      <p className="text-xs text-white/80">{step.description}</p>
                      <div className="mt-2">
                        <Badge variant="secondary" className={`text-xs ${step.badgeBg} ${step.badgeText} border-0 font-medium shadow-sm`}>
                          {step.count} pending
                        </Badge>
                      </div>
                    </div>
                  </div>
                </CardContent>
              </Card>
            </Link>
          ))}
        </div>

        {/* Quick Actions */}
        <div className="flex items-center justify-between">
          <h2 className="text-xl font-bold text-gray-900 dark:text-white flex items-center gap-2">
            <Rocket className="h-5 w-5 text-emerald-600 dark:text-emerald-400" />
            Quick Actions
          </h2>
        </div>
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
          {quickActions.map((action, idx) => (
            <Link href={action.link} key={idx}>
              <Button className={`w-full justify-start gap-2 rounded-xl bg-gradient-to-r ${action.gradient} hover:shadow-lg transition-all duration-300 text-white border-0`}>
                <div className="h-6 w-6 rounded-full bg-white/20 flex items-center justify-center">
                  <action.icon className="h-3.5 w-3.5 text-white" />
                </div>
                {action.title}
              </Button>
            </Link>
          ))}
        </div>

        {/* Workflow Guide */}
        <div className="flex items-center justify-between">
          <h2 className="text-xl font-bold text-gray-900 dark:text-white flex items-center gap-2">
            <Sparkles className="h-5 w-5 text-amber-600 dark:text-amber-400" />
            Workflow Guide
          </h2>
        </div>
        <Card className="rounded-2xl border-0 shadow-md bg-gradient-to-r from-amber-50 via-orange-50 to-yellow-50 dark:from-amber-950/30 dark:via-orange-950/30 dark:to-yellow-950/30">
          <CardContent className="p-5">
            <div className="flex flex-wrap items-center justify-center gap-2">
              {workflowGuideSteps.map((step, idx) => (
                <React.Fragment key={step.name}>
                  <div className={`inline-flex items-center gap-2 px-3 py-1.5 rounded-full ${step.bgLight} ${step.borderColor}`}>
                    <step.icon className={`h-3.5 w-3.5 ${step.iconColor}`} />
                    <span className="text-xs font-medium text-gray-700 dark:text-gray-300">{step.name}</span>
                  </div>
                  {idx < workflowGuideSteps.length - 1 && (
                    <span className="text-gray-400 dark:text-gray-600 text-sm">→</span>
                  )}
                </React.Fragment>
              ))}
            </div>
          </CardContent>
        </Card>

        {/* Footer */}
        <div className="text-center text-sm text-gray-500 dark:text-gray-400 py-4 flex justify-center items-center gap-4">
          <span className="flex items-center gap-1"><Sparkles className="h-3 w-3" /> ERP v2.0</span>
          <span>•</span>
          <span>Generated on {format(new Date(), "dd MMM yyyy hh:mm a")}</span>
        </div>
      </div>
    </ResponsiveLayout>
  );
}
