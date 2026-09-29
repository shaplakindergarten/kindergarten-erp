"use client";

import React, { useState, useEffect } from 'react';
import { ResponsiveLayout } from "@/components/layout/responsive-layout"; 
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Calendar, User, Search, Filter, CheckCircle2, AlertCircle, Clock, FileText, Paperclip, Trash2, ChevronLeft, ChevronRight, Ban, CalendarDays } from 'lucide-react';
import { toast } from 'sonner';

// Supabase ক্লায়েন্ট ইম্পোর্ট
import { createClient } from '@/lib/supabase/client';
const supabase = createClient();

interface Student {
  id: string;
  name: string;
  admission_no: string;
  class_roll: string;
  father_name: string;
  class_id: string;
  section_id: string;
  classes?: { name: string };
  sections?: { name: string };
}

interface ClassOption {
  id: string;
  name: string;
}

interface SectionOption {
  id: string;
  name: string;
  class_id: string;
}

interface LeaveAttachment {
  id: string;
  file_path: string;
  file_name: string;
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
  students?: {
    name: string;
    class_roll: string;
    classes: { name: string };
    sections: { name: string };
  };
  student_leave_attachments?: LeaveAttachment[];
}

export default function StudentLeavePage() {
  // Leave Form States
  const [selectedStudent, setSelectedStudent] = useState<Student | null>(null);
  const [startDate, setStartDate] = useState('');
  const [endDate, setEndDate] = useState('');
  const [leaveType, setLeaveType] = useState('Sick Leave');
  const [reason, setReason] = useState('');
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

  // Filters & Lookups
  const [studentsList, setStudentsList] = useState<Student[]>([]);
  const [classes, setClasses] = useState<ClassOption[]>([]);
  const [sections, setSections] = useState<SectionOption[]>([]);
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedClass, setSelectedClass] = useState('all');
  const [selectedSection, setSelectedSection] = useState('all');
  const [showLookup, setShowLookup] = useState(false);
  
  // History Logs & Pagination States
  const [leaveHistory, setLeaveHistory] = useState<LeaveRequest[]>([]);
  const [loadingHistory, setLoadingHistory] = useState(true);
  const [currentPage, setCurrentPage] = useState(1);
  const itemsPerPage = 5; // এক পেজে সর্বোচ্চ ৫টি হিস্ট্রি রেকর্ড দেখাবে

  // Initial Data Fetch
  useEffect(() => {
    const fetchMetadata = async () => {
      try {
        const { data: classData } = await supabase.from('classes').select('id, name');
        if (classData) setClasses(classData);

        const { data: sectionData } = await supabase.from('sections').select('id, name, class_id');
        if (sectionData) setSections(sectionData);

        const { data: studentData } = await supabase
          .from('students')
          .select(`
            id, name, admission_no, class_roll, father_name, class_id, section_id,
            classes(name), sections(name)
          `)
          .eq('status', 'active');
        
        if (studentData) setStudentsList(studentData as any);
      } catch (err) {
        console.error('Error fetching ERP initialization filters:', err);
      }
    };

    fetchMetadata();
    fetchLeaveHistory();
  }, []);

  // Fetch Leave History Records
  const fetchLeaveHistory = async () => {
    try {
      setLoadingHistory(true);
      const { data, error } = await supabase
        .from('student_leaves')
        .select(`
          id, 
          student_id,
          start_date, 
          end_date, 
          leave_type, 
          reason, 
          status,
          created_at,
          students(name, class_roll, classes(name), sections(name)),
          student_leave_attachments(id, file_path, file_name)
        `)
        .order('created_at', { ascending: false });

      if (error) throw new Error(error.message);
      if (data) setLeaveHistory(data as any);
    } catch (err: any) {
      toast.error(`Error loading leave history: ${err.message}`);
    } finally {
      setLoadingHistory(false);
    }
  };

  // Student Search Filter
  const filteredStudents = studentsList.filter((student) => {
    const matchesSearch = 
      student.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
      student.class_roll.toLowerCase().includes(searchQuery.toLowerCase()) ||
      student.admission_no.toLowerCase().includes(searchQuery.toLowerCase());
    const matchesClass = selectedClass === 'all' || student.class_id === selectedClass;
    const matchesSection = selectedSection === 'all' || student.section_id === selectedSection;
    return matchesSearch && matchesClass && matchesSection;
  });

  // ডাইনামিক স্ট্যাটিসটিক্স লজিক (কতজন রিজেক্টেড এবং কত দিন)
  const rejectedApplications = leaveHistory.filter(item => item.status === 'Rejected');
  const totalRejectedCount = rejectedApplications.length;

  const totalRejectedDays = rejectedApplications.reduce((acc, item) => {
    const start = new Date(item.start_date);
    const end = new Date(item.end_date);
    const diffTime = Math.abs(end.getTime() - start.getTime());
    const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24)) + 1;
    return acc + (isNaN(diffDays) ? 0 : diffDays);
  }, 0);

  // পেজিনেটেড ডেটা ফিল্টারিং লজিক
  const indexOfLastItem = currentPage * itemsPerPage;
  const indexOfFirstItem = indexOfLastItem - itemsPerPage;
  const currentLeaveItems = leaveHistory.slice(indexOfFirstItem, indexOfLastItem);
  const totalPages = Math.ceil(leaveHistory.length / itemsPerPage);

  // Handle Form Submission
  const handleFormSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedStudent) {
      toast.error('Please select a student first.');
      return;
    }

    // অতিরিক্ত ফ্রন্টএন্ড তারিখ যৌক্তিকতা যাচাইকরণ
    if (new Date(startDate) > new Date(endDate)) {
      toast.error('তারিখ নির্বাচন সঠিক নয়!', {
        description: 'ছুটি শুরুর তারিখ অবশ্যই শেষ তারিখের আগের অথবা সমসাময়িক হতে হবে।'
      });
      return;
    }

    try {
      setIsSubmitting(true);

      // 🔴 বুলেটপ্রুফ ভ্যালিডেশন চেক: 
      // ডাটাবেজের ফিল্ড 'timestamp/timestamptz' বা 'date' যাই হোক, এটি নির্দিষ্ট দিনকে কুয়েরি রেঞ্জে ধরে কনফ্লিক্ট খুঁজবে।
      const formattedStart = `${startDate} 00:00:00`;
      const formattedEnd = `${endDate} 23:59:59`;

      const { data: existingLeaves, error: checkError } = await supabase
        .from('student_leaves')
        .select('id, status')
        .eq('student_id', selectedStudent.id)
        .gte('start_date', formattedStart)
        .lte('end_date', formattedEnd);

      if (checkError) throw checkError;

      // যদি অলরেডি একটি সচল আবেদন (Pending বা Approved) থেকে থাকে, তবে রিকোয়েস্ট আটকে দেওয়া হবে
      if (existingLeaves && existingLeaves.length > 0) {
        const existingStatus = existingLeaves[0].status;
        toast.error('ছুটির আবেদন গ্রহণ করা সম্ভব নয়!', {
          description: `এই শিক্ষার্থীর জন্য এই নির্দিষ্ট তারিখে ইতিমধ্যে একটি আবেদন করা আছে যা বর্তমানে '${existingStatus}' অবস্থায় আছে।`
        });
        return; 
      }
      
      // ডাটাবেজে লিভ রিকোয়েস্ট তৈরি
      const { data: leaveData, error: leaveError } = await supabase
        .from('student_leaves')
        .insert([
          {
            student_id: selectedStudent.id,
            start_date: startDate,
            end_date: endDate,
            leave_type: leaveType,
            reason: reason,
            status: 'Pending'
          },
        ])
        .select('id')
        .single();

      if (leaveError) {
        // ডাটাবেজের অনন্য বাধা (Unique Constraint/Index: Error Code 23505) হ্যান্ডলিং
        if (leaveError.code === '23505') {
          toast.error('ছুটির আবেদন গ্রহণ করা সম্ভব নয়!', {
            description: 'ডাটাবেজ সুরক্ষানীতি অনুযায়ী এই শিক্ষার্থীর জন্য এই নির্দিষ্ট সময়ের একটি আবেদন ইতিমধ্যে নিবন্ধিত রয়েছে।'
          });
          return;
        }
        throw leaveError;
      }

      // ফাইল আপলোড অংশ
      if (selectedFile && leaveData) {
        const fileExt = selectedFile.name.split('.').pop();
        const filePath = `leaves/${leaveData.id}-${Date.now()}.${fileExt}`;

        const { error: uploadError } = await supabase.storage
          .from('student-documents')
          .upload(filePath, selectedFile);

        if (uploadError) throw uploadError;

        const { error: attachmentError } = await supabase
          .from('student_leave_attachments')
          .insert([
            {
              leave_id: leaveData.id,
              file_path: filePath,
              file_name: selectedFile.name
            }
          ]);

        if (attachmentError) throw attachmentError;
      }

      // ফর্ম স্টেট রিসেট করা
      setSelectedStudent(null);
      setStartDate('');
      setEndDate('');
      setReason('');
      setSelectedFile(null);
      setCurrentPage(1); 
      
      toast.success('Leave application submitted successfully!');
      fetchLeaveHistory();
    } catch (error: any) {
      toast.error(`Submission Failed: ${error.message || error}`);
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleViewAttachment = async (path: string) => {
    const { data } = supabase.storage.from('student-documents').getPublicUrl(path);
    if (data?.publicUrl) {
      window.open(data.publicUrl, '_blank');
    }
  };

  return (
    <ResponsiveLayout>
      <div className="flex-1 space-y-6 p-8 pt-6 bg-slate-50/30 dark:bg-zinc-950 min-h-screen text-slate-900 dark:text-zinc-100">
        
        {/* কালারফুল মডার্ন হেডার প্যানেল */}
        <div className="p-6 rounded-2xl bg-gradient-to-r from-blue-600 via-indigo-600 to-violet-600 text-white shadow-xl shadow-indigo-100 dark:shadow-none border border-indigo-500/20">
          <h2 className="text-3xl font-black tracking-tight">Student Leave Workspace</h2>
          <p className="text-indigo-100 text-xs mt-1 font-medium">Manage and track leaves, pagination telemetry, and documentation logs for students.</p>
        </div>

        {/* স্ট্যাটিসটিক্স কাউন্টার উইজেট */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <Card className="bg-gradient-to-br from-rose-50 to-rose-100/40 dark:from-zinc-900/40 border-rose-100 dark:border-zinc-800 rounded-xl shadow-sm">
            <CardContent className="p-4 flex items-center gap-4">
              <div className="p-3 bg-rose-500/10 rounded-xl text-rose-600 dark:text-rose-400">
                <Ban className="h-6 w-6" />
              </div>
              <div>
                <div className="text-xs font-bold text-rose-600 dark:text-rose-400 uppercase tracking-wider">Total Rejected Candidates</div>
                <div className="text-2xl font-black mt-0.5 text-slate-800 dark:text-zinc-100">{totalRejectedCount} Students</div>
              </div>
            </CardContent>
          </Card>

          <Card className="bg-gradient-to-br from-amber-50 to-amber-100/40 dark:from-zinc-900/40 border-amber-100 dark:border-zinc-800 rounded-xl shadow-sm">
            <CardContent className="p-4 flex items-center gap-4">
              <div className="p-3 bg-amber-500/10 rounded-xl text-amber-600 dark:text-amber-400">
                <CalendarDays className="h-6 w-6" />
              </div>
              <div>
                <div className="text-xs font-bold text-amber-600 dark:text-amber-400 uppercase tracking-wider">Accumulated Rejected Days</div>
                <div className="text-2xl font-black mt-0.5 text-slate-800 dark:text-zinc-100">{totalRejectedDays} Calendar Days</div>
              </div>
            </CardContent>
          </Card>
        </div>

        <div className="grid gap-6 lg:grid-cols-3">
          {/* Submission Card */}
          <Card className="lg:col-span-1 shadow-md border-slate-100 dark:border-zinc-800 bg-white dark:bg-zinc-900 h-fit rounded-xl overflow-hidden">
            <CardHeader className="bg-gradient-to-r from-blue-50 to-indigo-50/50 dark:from-zinc-800/50 dark:to-zinc-800/30 border-b dark:border-zinc-800">
              <CardTitle className="text-md font-bold flex items-center gap-2 text-slate-800 dark:text-zinc-100">
                <FileText className="h-5 w-5 text-blue-600 dark:text-blue-400" />
                Submit Leave Form
              </CardTitle>
            </CardHeader>
            <CardContent className="pt-5">
              <form onSubmit={handleFormSubmit} className="space-y-4">
                
                {/* Select Student Selector */}
                <div className="space-y-2 relative">
                  <label className="text-xs uppercase tracking-wider font-bold text-slate-500 dark:text-zinc-400 block">Select Student</label>
                  {selectedStudent ? (
                    <div className="p-3 border border-emerald-200 dark:border-emerald-800 bg-emerald-50/50 dark:bg-emerald-950/20 rounded-lg flex justify-between items-start animate-in fade-in duration-200">
                      <div>
                        <p className="font-bold text-emerald-900 dark:text-emerald-400 text-sm">{selectedStudent.name}</p>
                        <p className="text-xs text-emerald-700 dark:text-emerald-500 font-medium">Roll: {selectedStudent.class_roll} | Adm: {selectedStudent.admission_no}</p>
                      </div>
                      <button type="button" onClick={() => setSelectedStudent(null)} className="text-xs font-bold text-rose-600 dark:text-rose-400 hover:underline">Clear</button>
                    </div>
                  ) : (
                    <button type="button" onClick={() => setShowLookup(!showLookup)} className="w-full flex items-center justify-between px-3 py-2 border rounded-lg text-sm text-left bg-white dark:bg-zinc-950 border-slate-200 dark:border-zinc-800 shadow-sm transition-all hover:bg-slate-50 dark:hover:bg-zinc-900">
                      <span className="text-slate-400 dark:text-zinc-500 flex items-center gap-2"><Search className="h-4 w-4" /> Search Name, Roll, or Admission...</span>
                      <Filter className="h-4 w-4 text-slate-400" />
                    </button>
                  )}

                  {showLookup && !selectedStudent && (
                    <div className="absolute z-50 mt-1 w-full bg-white dark:bg-zinc-900 border dark:border-zinc-800 rounded-lg shadow-xl p-3 space-y-3 max-h-96 overflow-y-auto animate-in zoom-in-95 duration-150">
                      <input type="text" placeholder="Type to search..." value={searchQuery} onChange={(e) => setSearchQuery(e.target.value)} className="w-full text-xs p-2 border dark:border-zinc-800 dark:bg-zinc-950 rounded-lg outline-none focus:ring-2 focus:ring-blue-500/20" />
                      <div className="grid grid-cols-2 gap-2 text-xs">
                        <select value={selectedClass} onChange={(e) => { setSelectedClass(e.target.value); setSelectedSection('all'); }} className="p-1.5 border dark:border-zinc-800 rounded bg-slate-50 dark:bg-zinc-950">
                          <option value="all">All Classes</option>
                          {classes.map((cls) => <option key={cls.id} value={cls.id}>{cls.name}</option>)}
                        </select>
                        <select value={selectedSection} onChange={(e) => setSelectedSection(e.target.value)} className="p-1.5 border dark:border-zinc-800 rounded bg-slate-50 dark:bg-zinc-950" disabled={selectedClass === 'all'}>
                          <option value="all">All Sections</option>
                          {sections.filter((sec) => sec.class_id === selectedClass).map((sec) => <option key={sec.id} value={sec.id}>{sec.name}</option>)}
                        </select>
                      </div>
                      <div className="border-t dark:border-zinc-800 pt-2 space-y-1 max-h-44 overflow-y-auto text-xs">
                        {filteredStudents.length === 0 ? (
                          <p className="text-center py-4 text-slate-400">No active students found</p>
                        ) : (
                          filteredStudents.map((student) => (
                            <div key={student.id} onClick={() => { setSelectedStudent(student); setShowLookup(false); setSearchQuery(''); }} className="p-2 hover:bg-slate-50 dark:hover:bg-zinc-800 rounded-md cursor-pointer border-b dark:border-zinc-800/60 flex justify-between items-center transition-colors">
                              <div>
                                <p className="font-semibold text-slate-800 dark:text-zinc-200">{student.name}</p>
                                <p className="text-[10px] font-bold text-blue-600 dark:text-blue-400">{student.classes?.name} • {student.sections?.name}</p>
                              </div>
                              <p className="text-slate-400 font-medium">Roll: {student.class_roll}</p>
                            </div>
                          ))
                        )}
                      </div>
                    </div>
                  )}
                </div>

                {/* Date Fields */}
                <div className="grid grid-cols-2 gap-3">
                  <div className="space-y-1">
                    <label className="text-xs font-semibold text-slate-600 dark:text-zinc-400 flex items-center gap-1"><Calendar className="h-3 w-3" /> Start Date</label>
                    <input type="date" value={startDate} onChange={(e) => setStartDate(e.target.value)} required className="w-full text-sm p-2 border dark:border-zinc-800 dark:bg-zinc-950 rounded-lg outline-none focus:border-blue-500 transition-colors" />
                  </div>
                  <div className="space-y-1">
                    <label className="text-xs font-semibold text-slate-600 dark:text-zinc-400 flex items-center gap-1"><Calendar className="h-3 w-3" /> End Date</label>
                    <input type="date" value={endDate} onChange={(e) => setEndDate(e.target.value)} required className="w-full text-sm p-2 border dark:border-zinc-800 dark:bg-zinc-950 rounded-lg outline-none focus:border-blue-500 transition-colors" />
                  </div>
                </div>

                {/* Leave Type Selector */}
                <div className="space-y-1">
                  <label className="text-xs font-semibold text-slate-600 dark:text-zinc-400">Leave Type</label>
                  <select value={leaveType} onChange={(e) => setLeaveType(e.target.value)} className="w-full text-sm p-2 border dark:border-zinc-800 bg-white dark:bg-zinc-950 rounded-lg outline-none cursor-pointer">
                    <option value="Sick Leave">Sick Leave</option>
                    <option value="Casual Leave">Casual Leave</option>
                    <option value="Urgent Affairs">Urgent Affairs</option>
                  </select>
                </div>

                {/* Reason Details */}
                <div className="space-y-1">
                  <label className="text-xs font-semibold text-slate-600 dark:text-zinc-400">Reason Description</label>
                  <textarea rows={3} placeholder="Provide valid reason details..." value={reason} onChange={(e) => setReason(e.target.value)} required className="w-full text-sm p-2 border dark:border-zinc-800 dark:bg-zinc-950 rounded-lg outline-none resize-none focus:border-blue-500 transition-colors"></textarea>
                </div>

                {/* File Upload Field */}
                <div className="space-y-1">
                  <label className="text-xs font-semibold text-slate-600 dark:text-zinc-400 flex items-center gap-1">
                    <Paperclip className="h-3 w-3" /> Attachment Document (Optional)
                  </label>
                  {selectedFile ? (
                    <div className="p-2 border dark:border-zinc-800 rounded-lg bg-slate-50 dark:bg-zinc-900 flex justify-between items-center text-xs animate-in fade-in duration-150">
                      <span className="truncate max-w-[180px] font-semibold text-slate-700 dark:text-zinc-300">{selectedFile.name}</span>
                      <button type="button" onClick={() => setSelectedFile(null)} className="p-1 text-rose-500 hover:bg-rose-50 dark:hover:bg-rose-950/30 rounded-md transition-colors">
                        <Trash2 className="h-3.5 w-3.5" />
                      </button>
                    </div>
                  ) : (
                    <input
                      type="file"
                      accept=".pdf,.jpg,.jpeg,.png,.doc,.docx"
                      onChange={(e) => e.target.files && setSelectedFile(e.target.files[0])}
                      className="w-full text-xs text-slate-500 file:mr-4 file:py-1.5 file:px-3 file:rounded-md file:border-0 file:text-xs file:font-bold file:bg-indigo-50 dark:file:bg-zinc-800 file:text-indigo-700 dark:file:text-zinc-200 hover:file:bg-indigo-100 cursor-pointer border dark:border-zinc-800 rounded-lg p-1 bg-white dark:bg-zinc-950 transition-all"
                    />
                  )}
                </div>

                <button type="submit" disabled={isSubmitting} className="w-full py-2.5 px-4 rounded-lg text-sm font-bold bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-700 hover:to-indigo-700 text-white shadow-md disabled:opacity-50 transition-all transform active:scale-[0.98]">
                  {isSubmitting ? 'Submitting Log...' : 'Submit Request'}
                </button>
              </form>
            </CardContent>
          </Card>

          {/* History Feed with Pagination */}
          <Card className="lg:col-span-2 shadow-md border-slate-100 dark:border-zinc-800 bg-white dark:bg-zinc-900 rounded-xl overflow-hidden">
            <CardHeader className="bg-gradient-to-r from-indigo-50 via-slate-50/50 to-transparent dark:from-zinc-800/50 border-b dark:border-zinc-800">
              <CardTitle className="text-md font-bold flex items-center gap-2 text-slate-800 dark:text-zinc-100">
                <Clock className="h-5 w-5 text-indigo-600 dark:text-indigo-400" />
                Student Leaves Logs History
              </CardTitle>
            </CardHeader>
            <CardContent className="pt-4 flex flex-col justify-between h-[calc(100%-60px)]">
              <div className="rounded-xl border dark:border-zinc-800 overflow-x-auto bg-white dark:bg-zinc-950 shadow-inner">
                <table className="w-full border-collapse text-left text-xs text-slate-600 dark:text-zinc-400">
                  <thead className="bg-slate-50 dark:bg-zinc-900 text-slate-700 dark:text-zinc-300 font-bold border-b dark:border-zinc-800 uppercase tracking-wider">
                    <tr>
                      <th className="px-4 py-3.5">Student</th>
                      <th className="px-4 py-3.5">Class/Roll</th>
                      <th className="px-4 py-3.5">Timeline Duration</th>
                      <th className="px-4 py-3.5">Leave Type</th>
                      <th className="px-4 py-3.5">Attachment</th>
                      <th className="px-4 py-3.5">Status</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y dark:divide-zinc-800/60 text-slate-700 dark:text-zinc-300">
                    {loadingHistory ? (
                      <tr><td colSpan={6} className="text-center py-12 text-slate-400 animate-pulse font-medium">Fetching telemetry database records...</td></tr>
                    ) : currentLeaveItems.length === 0 ? (
                      <tr><td colSpan={6} className="text-center py-12 text-slate-400 font-medium">No leaves records tracked inside workspace.</td></tr>
                    ) : (
                      currentLeaveItems.map((request) => (
                        <tr key={request.id} className="hover:bg-slate-50/50 dark:hover:bg-zinc-900/40 transition-colors">
                          <td className="px-4 py-3.5 font-bold text-slate-900 dark:text-zinc-100">{request.students?.name}</td>
                          <td className="px-4 py-3.5 text-slate-500 dark:text-zinc-400">
                            {request.students?.classes?.name} ({request.students?.sections?.name})<br />
                            <span className="font-mono font-bold text-[10px] text-indigo-600 dark:text-indigo-400">Roll: {request.students?.class_roll}</span>
                          </td>
                          <td className="px-4 py-3.5 font-semibold text-slate-800 dark:text-zinc-200">{request.start_date} to {request.end_date}</td>
                          <td className="px-4 py-3.5">
                            <span className="text-[10px] px-2 py-0.5 rounded-md bg-slate-100 dark:bg-zinc-800 border dark:border-zinc-700 font-bold text-slate-700 dark:text-zinc-300">{request.leave_type}</span>
                          </td>
                          <td className="px-4 py-3.5">
                            {request.student_leave_attachments && request.student_leave_attachments.length > 0 ? (
                              <button
                                type="button"
                                onClick={() => handleViewAttachment(request.student_leave_attachments![0].file_path)}
                                className="inline-flex items-center gap-1 text-blue-600 dark:text-blue-400 hover:underline font-bold"
                              >
                                <Paperclip className="h-3.5 w-3.5" /> View Doc
                              </button>
                            ) : (
                              <span className="text-slate-400 dark:text-zinc-600 font-medium">None</span>
                            )}
                          </td>
                          <td className="px-4 py-3.5">
                            <span className={`inline-flex items-center gap-1 rounded-full px-2.5 py-0.5 text-[11px] font-bold border shadow-sm ${
                              request.status === 'Approved' ? 'bg-emerald-50 dark:bg-emerald-950/20 text-emerald-700 dark:text-emerald-400 border-emerald-200 dark:border-emerald-900' :
                              request.status === 'Rejected' ? 'bg-rose-50 dark:bg-rose-950/20 text-rose-700 dark:text-rose-400 border-rose-200 dark:border-rose-900' :
                              'bg-amber-50 dark:bg-amber-950/20 text-amber-700 dark:text-amber-400 border-amber-200 dark:border-amber-900'
                            }`}>
                              {request.status === 'Approved' && <CheckCircle2 className="h-3 w-3" />}
                              {request.status === 'Rejected' && <AlertCircle className="h-3 w-3" />}
                              {request.status === 'Pending' && <Clock className="h-3 w-3" />}
                              {request.status}
                            </span>
                          </td>
                        </tr>
                      ))
                    )}
                  </tbody>
                </table>
              </div>

              {/* পেজিনেরেশন কন্ট্রোল ইন্টারফেস */}
              {totalPages > 1 && (
                <div className="flex items-center justify-between border-t dark:border-zinc-800 pt-4 mt-4 text-xs font-semibold">
                  <p className="text-slate-500 dark:text-zinc-400">
                    Showing <span className="text-slate-800 dark:text-zinc-200">{indexOfFirstItem + 1}</span> to <span className="text-slate-800 dark:text-zinc-200">{Math.min(indexOfLastItem, leaveHistory.length)}</span> of <span className="text-slate-800 dark:text-zinc-200">{leaveHistory.length}</span> logs
                  </p>
                  <div className="flex items-center gap-1.5">
                    <button
                      type="button"
                      disabled={currentPage === 1}
                      onClick={() => setCurrentPage(prev => prev - 1)}
                      className="p-1.5 border dark:border-zinc-800 rounded-lg bg-white dark:bg-zinc-950 hover:bg-slate-50 dark:hover:bg-zinc-900 disabled:opacity-40 shadow-sm transition-all"
                    >
                      <ChevronLeft className="h-4 w-4" />
                    </button>
                    <span className="px-3 py-1.5 border dark:border-zinc-800 bg-slate-50 dark:bg-zinc-900 rounded-lg text-slate-700 dark:text-zinc-300">
                      Page {currentPage} of {totalPages}
                    </span>
                    <button
                      type="button"
                      disabled={currentPage === totalPages}
                      onClick={() => setCurrentPage(prev => prev + 1)}
                      className="p-1.5 border dark:border-zinc-800 rounded-lg bg-white dark:bg-zinc-950 hover:bg-slate-50 dark:hover:bg-zinc-900 disabled:opacity-40 shadow-sm transition-all"
                    >
                      <ChevronRight className="h-4 w-4" />
                    </button>
                  </div>
                </div>
              )}
            </CardContent>
          </Card>
        </div>
      </div>
    </ResponsiveLayout>
  );
}
