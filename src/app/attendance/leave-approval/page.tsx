"use client";

import React, { useState, useEffect, useCallback, useMemo } from 'react';
import { ResponsiveLayout } from "@/components/layout/responsive-layout";
import { Card, CardContent } from '@/components/ui/card';
import { Check, X, Paperclip, Calendar, User, Search, AlertCircle, Sparkles, Loader2, ChevronLeft, ChevronRight, Ban, RefreshCw } from 'lucide-react';
import { toast, Toaster } from 'sonner';

// Supabase ক্লায়েন্ট ইম্পোর্ট
import { createClient } from '@/lib/supabase/client';
const supabase = createClient();

interface LeaveAttachment {
  id: string;
  file_path: string;
  file_name: string;
}

interface StudentDetails {
  name: string;
  class_roll: string;
  classes: { name: string } | null;
  sections: { name: string } | null;
}

interface LeaveRequest {
  id: string;
  student_id: string;
  start_date: string;
  end_date: string;
  leave_type: string;
  reason: string;
  status: 'Pending' | 'Approved' | 'Rejected';
  created_at: string;
  students: StudentDetails | null;
  student_leave_attachments: LeaveAttachment[] | null;
}

type DateFilterType = 'all_time' | 'this_month' | 'last_7_days';

export default function LeaveApprovalPage() {
  const [leaves, setLeaves] = useState<LeaveRequest[]>([]);
  const [loading, setLoading] = useState(true);
  const [statusFilter, setStatusFilter] = useState<'All' | 'Pending' | 'Approved' | 'Rejected'>('Pending');
  const [searchQuery, setSearchQuery] = useState('');
  const [processingId, setProcessingId] = useState<string | null>(null);
  
  // পেজিনেশন স্টেট
  const [currentPage, setCurrentPage] = useState(1);
  const itemsPerPage = 10; 

  // ডেট ফিল্টার স্টেট
  const [dateFilter, setDateFilter] = useState<DateFilterType>('all_time');

  // ডাটাবেজ থেকে ছুটির আবেদনগুলো নিয়ে আসা
  const fetchIncomingLeaves = useCallback(async () => {
    try {
      setLoading(true);
      let query = supabase
        .from('student_leaves')
        .select(`
          id, student_id, start_date, end_date, leave_type, reason, status, created_at,
          students(name, class_roll, classes(name), sections(name)),
          student_leave_attachments(id, file_path, file_name)
        `)
        .order('created_at', { ascending: false });

      if (statusFilter !== 'All') {
        query = query.eq('status', statusFilter);
      }

      const { data, error } = await query;
      if (error) throw error;
      
      setLeaves((data as unknown as LeaveRequest[]) || []);
      setCurrentPage(1); // ট্যাব ফিল্টার চেঞ্জ হলে পেজ ১ নম্বরে রিসেট হবে
    } catch (err: any) {
      toast.error(`Error loading data: ${err.message}`);
    } finally {
      setLoading(false);
    }
  }, [statusFilter]);

  useEffect(() => {
    fetchIncomingLeaves();
  }, [fetchIncomingLeaves]);

  // সার্চ বা ডেট ফিল্টার চেঞ্জ হলেও পেজ ১ নম্বরে রিসেট করার ইফেক্ট
  useEffect(() => {
    setCurrentPage(1);
  }, [searchQuery, dateFilter]);

  // স্ট্যাটিসটিক্স ক্যালকুলেশন
  const stats = useMemo(() => {
    const rejectedApps = leaves.filter(item => item.status === 'Rejected');
    const approvedApps = leaves.filter(item => item.status === 'Approved');
    
    const totalRejectedDays = rejectedApps.reduce((acc, item) => {
      if (!item.start_date || !item.end_date) return acc;
      const start = new Date(item.start_date);
      const end = new Date(item.end_date);
      const diffTime = Math.abs(end.getTime() - start.getTime());
      const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24)) + 1;
      return acc + diffDays;
    }, 0);

    return {
      totalRejectedCount: rejectedApps.length,
      totalApprovedCount: approvedApps.length,
      totalRejectedDays: totalRejectedDays
    };
  }, [leaves]);

  // ছুটি অনুমোদন (Approve) বা বাতিল (Reject) করার মেকানিজম
  const handleUpdateStatus = async (id: string, newStatus: 'Approved' | 'Rejected') => {
    try {
      setProcessingId(id);
      
      const { error } = await supabase
        .from('student_leaves')
        .update({ 
          status: newStatus,
          updated_at: new Date().toISOString()
        })
        .eq('id', id);

      if (error) throw error;

      if (newStatus === 'Approved') {
        toast.success('Application successfully approved! 🎉', { 
          description: 'Attendance logs auto-synced to leave status.' 
        });
      } else {
        toast.error('Application successfully rejected.', { 
          description: 'The leave request state has been updated.' 
        });
      }
      
      fetchIncomingLeaves();
    } catch (err: any) {
      toast.error(`Action failed: ${err.message}`, {
        description: 'Verify if the balance constraints or target relations mismatch.',
      });
    } finally {
      setProcessingId(null);
    }
  };

  // আংশিক ছুটি বাতিল বা ডেট কারেকশন (Partial Cancel / Early Rejoin) ফাংশন
  const handlePartialCancel = async (id: string, startDate: string, newEndDate: string) => {
    if (new Date(newEndDate) < new Date(startDate)) {
      toast.error('Invalid Date range!', {
        description: 'End date cannot be earlier than the start date.'
      });
      return;
    }

    try {
      setProcessingId(id);
      
      const { error } = await supabase
        .from('student_leaves')
        .update({ 
          end_date: newEndDate,
          updated_at: new Date().toISOString()
        })
        .eq('id', id);

      if (error) throw error;

      toast.success('Leave duration updated successfully! 🗓️', { 
        description: `New end date set to ${newEndDate}. Restricted attendance dates released.` 
      });
      
      fetchIncomingLeaves();
    } catch (err: any) {
      toast.error(`Failed to correct leave date: ${err.message}`);
    } finally {
      setProcessingId(null);
    }
  };

  // ফাইল দেখার ফাংশন
  const handleViewAttachment = async (path: string) => {
    const { data } = supabase.storage.from('student-documents').getPublicUrl(path);
    if (data?.publicUrl) {
      window.open(data.publicUrl, '_blank', 'noopener,noreferrer');
    } else {
      toast.error('Attachment public URI could not be resolved.');
    }
  };

  // অ্যাডভান্সড ক্লায়েন্ট-সাইড ফিল্টারিং (সার্চ + ডেট রেঞ্জ)
  const filteredLeaves = useMemo(() => {
    return leaves.filter(item => {
      // ১. সার্চ ফিল্টার
      const studentName = item.students?.name?.toLowerCase() || '';
      const classRoll = item.students?.class_roll?.toLowerCase() || '';
      const search = searchQuery.toLowerCase();
      const matchesSearch = studentName.includes(search) || classRoll.includes(search);

      if (!matchesSearch) return false;

      // ২. ডেট ফিল্টার
      if (dateFilter === 'all_time') return true;
      
      const createdAt = new Date(item.created_at);
      const now = new Date();

      if (dateFilter === 'last_7_days') {
        const sevenDaysAgo = new Date();
        sevenDaysAgo.setDate(now.getDate() - 7);
        return createdAt >= sevenDaysAgo;
      }

      if (dateFilter === 'this_month') {
        return createdAt.getMonth() === now.getMonth() && createdAt.getFullYear() === now.getFullYear();
      }

      return true;
    });
  }, [leaves, searchQuery, dateFilter]);

  // পেজিনেশন ম্যাথমেটিক্স লজিক
  const totalPages = Math.ceil(filteredLeaves.length / itemsPerPage);
  const pagedItems = useMemo(() => {
    const indexOfLastItem = currentPage * itemsPerPage;
    const indexOfFirstItem = indexOfLastItem - itemsPerPage;
    return filteredLeaves.slice(indexOfFirstItem, indexOfLastItem);
  }, [filteredLeaves, currentPage]);

  return (
    <ResponsiveLayout>
      <Toaster richColors closeButton position="top-right" />

      <div className="flex-1 space-y-6 p-4 md:p-8 pt-6 transition-colors duration-300 bg-slate-50/50 dark:bg-zinc-950 min-h-screen">
        
        {/* মডার্ন গ্রেডিয়েন্ট হেডার প্যানেল */}
        <div className="relative overflow-hidden rounded-2xl bg-gradient-to-r from-indigo-600 via-purple-600 to-pink-600 dark:from-indigo-950 dark:via-purple-950 dark:to-zinc-900 p-6 md:p-8 shadow-lg border border-indigo-500/10">
          <div className="absolute right-0 top-0 -mt-4 -mr-4 h-32 w-32 rounded-full bg-white/10 blur-2xl" />
          <div className="absolute left-1/3 bottom-0 -mb-8 h-24 w-24 rounded-full bg-pink-500/20 blur-xl" />
          
          <div className="relative flex flex-col md:flex-row md:items-center md:justify-between gap-6 z-10">
            <div className="space-y-1.5 text-white">
              <div className="flex items-center gap-2">
                <h2 className="text-2xl md:text-3xl font-extrabold tracking-tight">Student Leave Approvals</h2>
                <Sparkles className="h-5 w-5 text-amber-300 animate-pulse hidden md:block" />
              </div>
              <p className="text-indigo-100/80 text-xs md:text-sm max-w-xl font-medium">
                Review administrative requests, verify medical attachment objects, and commit decisions into the live ledger instantly.
              </p>
            </div>
            
            {/* মডার্ন ট্যাব ফিল্টার */}
            <div className="flex items-center gap-1 bg-black/20 dark:bg-black/40 backdrop-blur-md p-1.5 rounded-xl border border-white/10 self-start md:self-auto">
              {(['Pending', 'Approved', 'Rejected', 'All'] as const).map((tab) => (
                <button
                  key={tab}
                  type="button"
                  onClick={() => setStatusFilter(tab)}
                  className={`px-4 py-2 text-xs font-bold rounded-lg transition-all duration-200 ${
                    statusFilter === tab 
                      ? 'bg-white text-indigo-700 dark:bg-zinc-800 dark:text-white shadow-md scale-105' 
                      : 'text-white/70 hover:text-white hover:bg-white/10'
                  }`}
                >
                  {tab}
                </button>
              ))}
            </div>
          </div>
        </div>

        {/* স্ট্যাটিসটিক্স কাউন্টার কার্ডস */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
          <Card className="bg-gradient-to-br from-rose-50 to-rose-100/30 dark:from-zinc-900/50 border-rose-200/40 dark:border-rose-950/30 p-4 rounded-xl shadow-sm flex items-center justify-between">
            <div>
              <div className="text-xs font-bold text-rose-600 dark:text-rose-400 uppercase tracking-wider">Total Rejected Requests</div>
              <div className="text-2xl font-black text-slate-900 dark:text-zinc-100 mt-1">{stats.totalRejectedCount} Students</div>
            </div>
            <div className="h-10 w-10 bg-rose-500/10 rounded-lg flex items-center justify-center text-rose-600">
              <Ban className="h-5 w-5" />
            </div>
          </Card>

          <Card className="bg-gradient-to-br from-amber-50 to-amber-100/30 dark:from-zinc-900/50 border-amber-200/40 dark:border-amber-950/30 p-4 rounded-xl shadow-sm flex items-center justify-between">
            <div>
              <div className="text-xs font-bold text-amber-600 dark:text-amber-400 uppercase tracking-wider">Accumulated Rejected Days</div>
              <div className="text-2xl font-black text-slate-900 dark:text-zinc-100 mt-1">{stats.totalRejectedDays} Days</div>
            </div>
            <div className="h-10 w-10 bg-amber-500/10 rounded-lg flex items-center justify-center text-amber-600">
              <Calendar className="h-5 w-5" />
            </div>
          </Card>

          <Card className="bg-gradient-to-br from-emerald-50 to-emerald-100/30 dark:from-zinc-900/50 border-emerald-200/40 dark:border-emerald-950/30 p-4 rounded-xl shadow-sm flex items-center justify-between sm:col-span-2 lg:col-span-1">
            <div>
              <div className="text-xs font-bold text-emerald-600 dark:text-emerald-400 uppercase tracking-wider">Total Approved Requests</div>
              <div className="text-2xl font-black text-slate-900 dark:text-zinc-100 mt-1">{stats.totalApprovedCount} Students</div>
            </div>
            <div className="h-10 w-10 bg-emerald-500/10 rounded-lg flex items-center justify-center text-emerald-600">
              <Check className="h-5 w-5" />
            </div>
          </Card>
        </div>

        {/* সার্চ এবং ডেট ফিল্টার কন্ট্রোল প্যানেল */}
        <div className="flex flex-col sm:flex-row gap-3 items-stretch sm:items-center justify-between">
          <div className="relative max-w-md flex-1 group">
            <Search className="absolute left-3.5 top-3 h-4 w-4 text-slate-400 group-focus-within:text-indigo-500 transition-colors" />
            <input
              type="text"
              placeholder="Filter by student name or roll ID..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full pl-10 pr-4 py-2.5 border border-slate-200 dark:border-zinc-800 rounded-xl text-sm outline-none transition-all focus:ring-4 focus:ring-indigo-500/10 focus:border-indigo-500 bg-white dark:bg-zinc-900 text-slate-900 dark:text-zinc-100 placeholder-slate-400"
            />
          </div>

          <div className="flex items-center gap-2">
            <span className="text-xs font-semibold text-slate-400 dark:text-zinc-500 whitespace-nowrap">Timeframe:</span>
            <select
              value={dateFilter}
              onChange={(e) => setDateFilter(e.target.value as DateFilterType)}
              className="border border-slate-200 dark:border-zinc-800 rounded-xl px-3 py-2 text-xs font-bold bg-white dark:bg-zinc-900 text-slate-700 dark:text-zinc-300 outline-none focus:border-indigo-500 transition-all cursor-pointer"
            >
              <option value="all_time">All History</option>
              <option value="this_month">This Month</option>
              <option value="last_7_days">Last 7 Days</option>
            </select>
          </div>
        </div>

        {/* মেইন কনটেন্ট কার্ড ও টেবিল */}
        <Card className="overflow-hidden border border-slate-200/80 dark:border-zinc-800 shadow-xl shadow-slate-100/40 dark:shadow-none rounded-2xl">
          <CardContent className="p-0">
            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs text-slate-600 dark:text-zinc-400 border-collapse">
                <thead className="bg-slate-50 dark:bg-zinc-900 text-slate-700 dark:text-zinc-300 font-bold tracking-wider border-b border-slate-200 dark:border-zinc-800 uppercase">
                  <tr>
                    <th className="px-6 py-4">Student Identity</th>
                    <th className="px-6 py-4">Class & Roll</th>
                    <th className="px-6 py-4">Leave Context</th>
                    <th className="px-6 py-4">Duration</th>
                    <th className="px-6 py-4">Documentation</th>
                    <th className="px-6 py-4 text-center">Actions / Decision</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 dark:divide-zinc-800 bg-white dark:bg-zinc-900">
                  {loading ? (
                    <tr>
                      <td colSpan={6} className="text-center py-20 text-slate-400 dark:text-zinc-500 font-medium">
                        <div className="flex flex-col items-center justify-center gap-3">
                          <Loader2 className="h-6 w-6 text-indigo-600 animate-spin" />
                          <span className="animate-pulse tracking-wide">Loading secure approval pipelines...</span>
                        </div>
                      </td>
                    </tr>
                  ) : pagedItems.length === 0 ? (
                    <tr>
                      <td colSpan={6} className="text-center py-20 text-slate-400 dark:text-zinc-500 font-medium">
                        <div className="flex flex-col items-center justify-center gap-2">
                          <AlertCircle className="h-8 w-8 text-slate-300 dark:text-zinc-700" />
                          <span>No live leave applications found matching this criteria.</span>
                        </div>
                      </td>
                    </tr>
                  ) : (
                    pagedItems.map((request) => (
                      <tr key={request.id} className="hover:bg-slate-50/60 dark:hover:bg-zinc-800/40 transition-colors duration-150">
                        
                        {/* Student Identity */}
                        <td className="px-6 py-5">
                          <div className="flex items-center gap-3">
                            <div className="h-9 w-9 rounded-xl bg-gradient-to-br from-indigo-50 to-indigo-100/80 dark:from-zinc-800 dark:to-zinc-800/50 flex items-center justify-center border border-indigo-200/20">
                              <User className="h-4 w-4 text-indigo-600 dark:text-indigo-400" />
                            </div>
                            <div>
                              <div className="font-bold text-slate-900 dark:text-zinc-100 text-sm">
                                {request.students?.name || 'Unknown Student'}
                              </div>
                              <div className="text-slate-400 dark:text-zinc-500 text-[11px] font-medium mt-0.5">
                                Applied: {new Date(request.created_at).toLocaleDateString()}
                              </div>
                            </div>
                          </div>
                        </td>

                        {/* Class & Roll */}
                        <td className="px-6 py-5">
                          <div className="font-semibold text-slate-800 dark:text-zinc-200">
                            {request.students?.classes?.name || 'N/A'}
                          </div>
                          <div className="text-[11px] font-medium text-slate-500 dark:text-zinc-400">
                            Section: {request.students?.sections?.name || 'N/A'}
                          </div>
                          <div className="inline-block font-mono bg-blue-50 dark:bg-blue-950/40 text-blue-600 dark:text-blue-400 px-1.5 py-0.5 rounded text-[10px] font-bold mt-1">
                            Roll: {request.students?.class_roll || 'N/A'}
                          </div>
                        </td>

                        {/* Leave Context */}
                        <td className="px-6 py-5 max-w-xs">
                          <span className="inline-block text-[10px] font-extrabold px-2 py-0.5 rounded-md bg-amber-50 dark:bg-amber-950/40 border border-amber-200/60 dark:border-amber-900/30 text-amber-700 dark:text-amber-400 uppercase tracking-wide mb-1.5">
                            {request.leave_type}
                          </span>
                          <p className="text-slate-600 dark:text-zinc-300 text-xs leading-relaxed line-clamp-2 font-medium">
                            {request.reason}
                          </p>
                        </td>

                        {/* Duration */}
                        <td className="px-6 py-5 text-slate-900 dark:text-zinc-200 font-medium">
                          <div className="space-y-1.5">
                            <div className="flex items-center gap-1.5 text-xs text-slate-700 dark:text-zinc-300">
                              <Calendar className="h-3.5 w-3.5 text-emerald-500" /> 
                              <span>{request.start_date}</span>
                            </div>
                            <div className="w-0.5 h-2 bg-slate-200 dark:bg-zinc-800 ml-1.5" />
                            <div className="flex items-center gap-1.5 text-xs text-slate-700 dark:text-zinc-300">
                              <Calendar className="h-3.5 w-3.5 text-rose-500" /> 
                              <span>{request.end_date}</span>
                            </div>
                          </div>
                        </td>

                        {/* Documentation Attachment */}
                        <td className="px-6 py-5">
                          {request.student_leave_attachments && request.student_leave_attachments.length > 0 ? (
                            <button
                              type="button"
                              onClick={() => handleViewAttachment(request.student_leave_attachments![0].file_path)}
                              className="inline-flex items-center gap-1.5 text-indigo-600 dark:text-indigo-400 hover:text-indigo-800 dark:hover:text-indigo-300 hover:underline font-bold transition-all"
                            >
                              <Paperclip className="h-3.5 w-3.5" /> View Proof
                            </button>
                          ) : (
                            <span className="text-slate-400 dark:text-zinc-600 italic font-medium">No files uploaded</span>
                          )}
                        </td>

                        {/* Decision / Actions */}
                        <td className="px-6 py-5 text-center min-w-[180px]">
                          {request.status === 'Pending' ? (
                            <div className="flex items-center justify-center gap-2">
                              <button
                                type="button"
                                onClick={() => handleUpdateStatus(request.id, 'Approved')}
                                disabled={processingId !== null}
                                className="inline-flex items-center gap-1 bg-emerald-600 hover:bg-emerald-700 dark:bg-emerald-600/90 dark:hover:bg-emerald-600 text-white font-bold px-3.5 py-2 rounded-xl shadow-md shadow-emerald-500/10 hover:shadow-lg transition-all duration-150 text-xs disabled:opacity-50"
                              >
                                {processingId === request.id ? (
                                  <Loader2 className="h-3.5 w-3.5 animate-spin" />
                                ) : (
                                  <Check className="h-3.5 w-3.5" />
                                )}
                                Approve
                              </button>
                              
                              <button
                                type="button"
                                onClick={() => handleUpdateStatus(request.id, 'Rejected')}
                                disabled={processingId !== null}
                                className="inline-flex items-center gap-1 bg-rose-600 hover:bg-rose-700 dark:bg-rose-600/90 dark:hover:bg-rose-600 text-white font-bold px-3.5 py-2 rounded-xl shadow-md shadow-rose-500/10 hover:shadow-lg transition-all duration-150 text-xs disabled:opacity-50"
                              >
                                {processingId === request.id ? (
                                  <Loader2 className="h-3.5 w-3.5 animate-spin" />
                                ) : (
                                  <X className="h-3.5 w-3.5" />
                                )}
                                Reject
                              </button>
                            </div>
                          ) : request.status === 'Approved' ? (
                            <div className="flex flex-col items-center gap-2">
                              <span className="inline-flex items-center gap-1.5 rounded-full px-3.5 py-1 text-xs font-bold border tracking-wide uppercase bg-emerald-50 text-emerald-700 border-emerald-200 dark:bg-emerald-950/30 dark:text-emerald-400 dark:border-emerald-900/40">
                                <Check className="h-3 w-3" /> Approved
                              </span>
                              
                              <div className="flex items-center gap-1.5 mt-1 p-1 bg-slate-50 dark:bg-zinc-800/60 rounded-xl border border-slate-200 dark:border-zinc-800">
                                <input 
                                  type="date"
                                  defaultValue={request.end_date}
                                  id={`new-date-${request.id}`}
                                  min={request.start_date}
                                  className="border border-slate-200 dark:border-zinc-700 rounded-lg p-1 text-[11px] bg-white dark:bg-zinc-900 text-slate-800 dark:text-zinc-200 outline-none focus:border-indigo-500 w-[105px]"
                                />
                                <button
                                  type="button"
                                  disabled={processingId !== null}
                                  onClick={() => {
                                    const inputEl = document.getElementById(`new-date-${request.id}`) as HTMLInputElement;
                                    if (inputEl && inputEl.value) {
                                      handlePartialCancel(request.id, request.start_date, inputEl.value);
                                    }
                                  }}
                                  className="bg-indigo-600 hover:bg-indigo-700 text-white text-[10px] font-bold px-2 py-1.5 rounded-lg transition-all flex items-center gap-1 disabled:opacity-50"
                                  title="Correct end date / Early rejoin"
                                >
                                  {processingId === request.id ? (
                                    <Loader2 className="h-3 w-3 animate-spin" />
                                  ) : (
                                    <RefreshCw className="h-3 w-3" />
                                  )}
                                  Update
                                </button>
                              </div>
                            </div>
                          ) : (
                            <div className="flex justify-center">
                              <span className="inline-flex items-center gap-1.5 rounded-full px-3.5 py-1 text-xs font-bold border tracking-wide uppercase bg-rose-50 text-rose-700 border-rose-200 dark:bg-rose-950/30 dark:text-rose-400 dark:border-rose-900/40">
                                <X className="h-3 w-3" /> Rejected
                              </span>
                            </div>
                          )}
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>

            {/* মডার্ন পেজিনেশন কন্ট্রোল বাটনসমূহ */}
            {totalPages > 1 && (
              <div className="flex items-center justify-between px-6 py-4 border-t border-slate-100 dark:border-zinc-800 bg-slate-50/50 dark:bg-zinc-900/50">
                <div className="text-xs font-semibold text-slate-500 dark:text-zinc-400">
                  Showing <span className="text-slate-800 dark:text-zinc-200">{pagedItems.length}</span> of{" "}
                  <span className="text-slate-800 dark:text-zinc-200">{filteredLeaves.length}</span> entries
                </div>
                
                <div className="flex items-center gap-2">
                  <button
                    type="button"
                    disabled={currentPage === 1}
                    onClick={() => setCurrentPage(prev => Math.max(prev - 1, 1))}
                    className="inline-flex items-center gap-1 px-3 py-1.5 border border-slate-200 dark:border-zinc-800 rounded-xl text-xs font-bold bg-white dark:bg-zinc-900 text-slate-700 dark:text-zinc-300 disabled:opacity-40 hover:bg-slate-50 dark:hover:bg-zinc-800/50 transition-all cursor-pointer"
                  >
                    <ChevronLeft className="h-3.5 w-3.5" /> Previous
                  </button>
                  
                  <span className="text-xs font-bold text-indigo-600 dark:text-indigo-400 bg-indigo-50 dark:bg-indigo-950/30 px-3 py-1.5 rounded-lg border border-indigo-100 dark:border-indigo-900/30">
                    Page {currentPage} of {totalPages}
                  </span>
                  
                  <button
                    type="button"
                    disabled={currentPage === totalPages}
                    onClick={() => setCurrentPage(prev => Math.min(prev + 1, totalPages))}
                    className="inline-flex items-center gap-1 px-3 py-1.5 border border-slate-200 dark:border-zinc-800 rounded-xl text-xs font-bold bg-white dark:bg-zinc-900 text-slate-700 dark:text-zinc-300 disabled:opacity-40 hover:bg-slate-50 dark:hover:bg-zinc-800/50 transition-all cursor-pointer"
                  >
                    Next <ChevronRight className="h-3.5 w-3.5" />
                  </button>
                </div>
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </ResponsiveLayout>
  );
}
