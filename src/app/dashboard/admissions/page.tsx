// src/app/dashboard/admissions/page.tsx
"use client";

import { useState, useEffect, useMemo } from "react";
import Link from "next/link";
import {
  UserPlus, RefreshCw, Search, Filter, Clock, CheckCircle2, XCircle,
  Eye, Loader2, AlertCircle, FileText, ChevronDown, Calendar,
  User, Phone, MapPin, GraduationCap, Mail, Trash2,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Card, CardContent,
} from "@/components/ui/card";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from "@/components/ui/dialog";
import { ResponsiveLayout } from "@/components/layout/responsive-layout";
import { createClient } from "@/lib/supabase/client";
import { approveAdmission, rejectAdmission, deleteAdmission } from "./actions";
import { useToastStore } from "@/store/useStore";

// ═══════════════════════════════════════════════════════════════════════
// TYPES
// ═══════════════════════════════════════════════════════════════════════
type StatusFilter = "all" | "pending" | "reviewing" | "approved" | "rejected";

interface Admission {
  id: string;
  reference_no: string;
  name: string;
  name_bn: string | null;
  father_name: string;
  mother_name: string;
  dob: string;
  gender: string;
  blood_group: string | null;
  particular_disease: string | null;
  birth_cert_no: string | null;
  class_id: string | null;
  section_id: string | null;
  academic_year_id: string | null;
  village: string | null;
  post_office: string | null;
  police_station: string | null;
  district: string | null;
  permanent_village: string | null;
  permanent_post_office: string | null;
  permanent_police_station: string | null;
  permanent_district: string | null;
  contact: string;
  fathers_contact: string | null;
  mothers_contact: string | null;
  email: string | null;
  whatsapp: string | null;
  photo_url: string | null;
  status: "pending" | "reviewing" | "approved" | "rejected";
  rejection_reason: string | null;
  source: string;
  applied_at: string;
  reviewed_at: string | null;
  approved_student_id: string | null;
  classes?: { id: string; name: string } | null;
  sections?: { id: string; name: string } | null;
  academic_years?: { id: string; name: string } | null;
}

// ═══════════════════════════════════════════════════════════════════════
// MAIN COMPONENT
// ═══════════════════════════════════════════════════════════════════════
export default function AdmissionsDashboardPage() {
  const addToast = useToastStore((s) => s.addToast);

  // ── Data ──
  const [admissions, setAdmissions] = useState<Admission[]>([]);
  const [loading, setLoading] = useState(true);

  // ── Filters ──
  const [statusFilter, setStatusFilter] = useState<StatusFilter>("pending");
  const [search, setSearch] = useState("");
  const [classFilter, setClassFilter] = useState<string>("");

  // ── Dialogs ──
  const [selectedAdmission, setSelectedAdmission] = useState<Admission | null>(null);
  const [showDetailDialog, setShowDetailDialog] = useState(false);
  const [showApproveDialog, setShowApproveDialog] = useState(false);
  const [showRejectDialog, setShowRejectDialog] = useState(false);
  const [showDeleteDialog, setShowDeleteDialog] = useState(false);

  // ── Processing ──
  const [processing, setProcessing] = useState<string | null>(null);
  const [rejectReason, setRejectReason] = useState("");

  // ═══════════════════════════════════════════════════════════════════
  // LOAD ADMISSIONS
  // ═══════════════════════════════════════════════════════════════════
  const loadAdmissions = async () => {
    setLoading(true);
    try {
      const supabase = createClient();
      const { data, error } = await supabase
        .from("pending_admissions")
        .select(
          `
          *,
          classes (id, name),
          sections (id, name),
          academic_years (id, name)
        `
        )
        .order("applied_at", { ascending: false });

      if (error) throw error;
      setAdmissions((data as Admission[]) || []);
    } catch (err: any) {
      console.error("Load error:", err);
      addToast({
        type: "error",
        title: "Error",
        message: err?.message || "আবেদন লোড করা যায়নি",
      });
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadAdmissions();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // ═══════════════════════════════════════════════════════════════════
  // REALTIME UPDATES
  // ═══════════════════════════════════════════════════════════════════
  useEffect(() => {
    const supabase = createClient();
    const channel = supabase
      .channel("pending-admissions-page-live")
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "pending_admissions" },
        () => {
          loadAdmissions();
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // ═══════════════════════════════════════════════════════════════════
  // COMPUTED STATS
  // ═══════════════════════════════════════════════════════════════════
  const stats = useMemo(() => {
    return {
      all: admissions.length,
      pending: admissions.filter((a) => a.status === "pending").length,
      reviewing: admissions.filter((a) => a.status === "reviewing").length,
      approved: admissions.filter((a) => a.status === "approved").length,
      rejected: admissions.filter((a) => a.status === "rejected").length,
    };
  }, [admissions]);

  // ═══════════════════════════════════════════════════════════════════
  // UNIQUE CLASSES FOR FILTER
  // ═══════════════════════════════════════════════════════════════════
  const uniqueClasses = useMemo(() => {
    const map = new Map<string, string>();
    admissions.forEach((a) => {
      if (a.classes?.id && a.classes?.name) {
        map.set(a.classes.id, a.classes.name);
      }
    });
    return Array.from(map.entries()).map(([id, name]) => ({ id, name }));
  }, [admissions]);

  // ═══════════════════════════════════════════════════════════════════
  // FILTERED LIST
  // ═══════════════════════════════════════════════════════════════════
  const filteredAdmissions = useMemo(() => {
    let filtered = [...admissions];

    // Status filter
    if (statusFilter !== "all") {
      filtered = filtered.filter((a) => a.status === statusFilter);
    }

    // Class filter
    if (classFilter) {
      filtered = filtered.filter((a) => a.class_id === classFilter);
    }

    // Search
    if (search.trim()) {
      const q = search.toLowerCase().trim();
      filtered = filtered.filter(
        (a) =>
          a.name?.toLowerCase().includes(q) ||
          a.name_bn?.toLowerCase().includes(q) ||
          a.father_name?.toLowerCase().includes(q) ||
          a.mother_name?.toLowerCase().includes(q) ||
          a.contact?.includes(q) ||
          a.reference_no?.toLowerCase().includes(q)
      );
    }

    return filtered;
  }, [admissions, statusFilter, classFilter, search]);

  // ═══════════════════════════════════════════════════════════════════
  // HANDLERS
  // ═══════════════════════════════════════════════════════════════════
  const openDetail = (admission: Admission) => {
    setSelectedAdmission(admission);
    setShowDetailDialog(true);
  };

  const openApproveDialog = (admission: Admission) => {
    setSelectedAdmission(admission);
    setShowApproveDialog(true);
    setShowDetailDialog(false);
  };

  const openRejectDialog = (admission: Admission) => {
    setSelectedAdmission(admission);
    setRejectReason("");
    setShowRejectDialog(true);
    setShowDetailDialog(false);
  };

  const openDeleteDialog = (admission: Admission) => {
    setSelectedAdmission(admission);
    setShowDeleteDialog(true);
  };

  // ── Approve ──
  const handleApprove = async () => {
    if (!selectedAdmission || processing) return;

    setProcessing(selectedAdmission.id);
    const result = await approveAdmission(selectedAdmission.id);
    setProcessing(null);

    if (result.success) {
      addToast({
        type: "success",
        title: "✅ অনুমোদিত!",
        message: `${result.studentName} — Student ID: ${result.studentId}`,
      });

      setShowApproveDialog(false);
      setSelectedAdmission(null);

      // Offer to view profile
      setTimeout(() => {
        if (
          window.confirm(
            `শিক্ষার্থী সফলভাবে ভর্তি হয়েছে!\n\nStudent ID: ${result.studentId}\n\nপ্রোফাইল দেখতে চান?`
          )
        ) {
          window.location.href = `/students/${result.studentUuid}`;
        }
      }, 400);

      loadAdmissions();
    } else {
      addToast({
        type: "error",
        title: "অনুমোদন ব্যর্থ",
        message: result.error,
      });
    }
  };

  // ── Reject ──
  const handleReject = async () => {
    if (!selectedAdmission || processing) return;

    if (rejectReason.trim().length < 3) {
      addToast({
        type: "error",
        title: "কারণ লিখুন",
        message: "কমপক্ষে ৩ অক্ষরের কারণ লিখুন",
      });
      return;
    }

    setProcessing(selectedAdmission.id);
    const result = await rejectAdmission(selectedAdmission.id, rejectReason);
    setProcessing(null);

    if (result.success) {
      addToast({
        type: "success",
        title: "বাতিল করা হয়েছে",
        message: `${selectedAdmission.name}-এর আবেদন বাতিল হয়েছে`,
      });
      setShowRejectDialog(false);
      setSelectedAdmission(null);
      setRejectReason("");
      loadAdmissions();
    } else {
      addToast({
        type: "error",
        title: "বাতিল ব্যর্থ",
        message: result.error,
      });
    }
  };

  // ── Delete ──
  const handleDelete = async () => {
    if (!selectedAdmission || processing) return;

    setProcessing(selectedAdmission.id);
    const result = await deleteAdmission(selectedAdmission.id);
    setProcessing(null);

    if (result.success) {
      addToast({
        type: "success",
        title: "মুছে ফেলা হয়েছে",
        message: `${selectedAdmission.name}-এর আবেদন মুছে ফেলা হয়েছে`,
      });
      setShowDeleteDialog(false);
      setSelectedAdmission(null);
      loadAdmissions();
    } else {
      addToast({
        type: "error",
        title: "মুছতে ব্যর্থ",
        message: result.error,
      });
    }
  };

  // ═══════════════════════════════════════════════════════════════════
  // RENDER
  // ═══════════════════════════════════════════════════════════════════
  return (
    <ResponsiveLayout>
      <div className="space-y-6 p-4 md:p-6">
        {/* ─── HEADER ─── */}
        <div className="flex flex-wrap items-center justify-between gap-4">
          <div>
            <h1 className="text-2xl md:text-3xl font-bold text-[#0a4d8c] dark:text-blue-400 flex items-center gap-3">
              <UserPlus className="w-7 h-7 md:w-8 md:h-8" />
              অনলাইন ভর্তি আবেদন
            </h1>
            <p className="text-sm text-slate-500 dark:text-slate-400 mt-1">
              অনলাইনে জমা পড়া ভর্তি আবেদন পর্যালোচনা করুন ও অনুমোদন দিন
            </p>
          </div>
          <Button
            variant="outline"
            onClick={loadAdmissions}
            disabled={loading}
            className="flex items-center gap-2"
          >
            <RefreshCw className={`w-4 h-4 ${loading ? "animate-spin" : ""}`} />
            রিফ্রেশ
          </Button>
        </div>

        {/* ─── PENDING ALERT ─── */}
        {stats.pending > 0 && (
          <div className="bg-amber-50 dark:bg-amber-950/30 border-l-4 border-amber-500 rounded-lg p-4 flex items-start gap-3">
            <AlertCircle className="w-5 h-5 text-amber-600 shrink-0 mt-0.5" />
            <div className="flex-1">
              <p className="font-bold text-amber-900 dark:text-amber-200">
                ⏳ {stats.pending}টি আবেদন অনুমোদনের অপেক্ষায়
              </p>
              <p className="text-sm text-amber-700 dark:text-amber-300 mt-0.5">
                অনুমোদন করলে শিক্ষার্থী সরাসরি Student List-এ যোগ হবে এবং Fee Structure স্বয়ংক্রিয়ভাবে assign হবে
              </p>
            </div>
          </div>
        )}

        {/* ─── STATS CARDS ─── */}
        <div className="grid grid-cols-2 md:grid-cols-5 gap-3 md:gap-4">
          <StatCard
            label="মোট"
            value={stats.all}
            color="bg-blue-500"
            icon={FileText}
            active={statusFilter === "all"}
            onClick={() => setStatusFilter("all")}
          />
          <StatCard
            label="অপেক্ষমাণ"
            value={stats.pending}
            color="bg-amber-500"
            icon={Clock}
            active={statusFilter === "pending"}
            onClick={() => setStatusFilter("pending")}
          />
          <StatCard
            label="পর্যালোচনা"
            value={stats.reviewing}
            color="bg-indigo-500"
            icon={Eye}
            active={statusFilter === "reviewing"}
            onClick={() => setStatusFilter("reviewing")}
          />
          <StatCard
            label="অনুমোদিত"
            value={stats.approved}
            color="bg-emerald-500"
            icon={CheckCircle2}
            active={statusFilter === "approved"}
            onClick={() => setStatusFilter("approved")}
          />
          <StatCard
            label="বাতিল"
            value={stats.rejected}
            color="bg-red-500"
            icon={XCircle}
            active={statusFilter === "rejected"}
            onClick={() => setStatusFilter("rejected")}
          />
        </div>

        {/* ─── FILTERS ─── */}
        <Card>
          <CardContent className="p-4">
            <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
              {/* Search */}
              <div className="relative md:col-span-2">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400 pointer-events-none" />
                <Input
                  placeholder="নাম, রেফারেন্স নম্বর বা ফোন দিয়ে খুঁজুন..."
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                  className="pl-9"
                />
              </div>

              {/* Class Filter */}
              <div className="relative">
                <select
                  value={classFilter}
                  onChange={(e) => setClassFilter(e.target.value)}
                  className="w-full h-10 rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background focus:outline-none focus:ring-2 focus:ring-ring"
                >
                  <option value="">সব শ্রেণি</option>
                  {uniqueClasses.map((c) => (
                    <option key={c.id} value={c.id}>
                      {c.name}
                    </option>
                  ))}
                </select>
              </div>
            </div>

            {/* Active filters summary */}
            {(search || classFilter || statusFilter !== "pending") && (
              <div className="flex items-center gap-2 mt-3 pt-3 border-t text-xs text-slate-500">
                <Filter className="w-3.5 h-3.5" />
                <span>ফিল্টার প্রয়োগ:</span>
                {statusFilter !== "pending" && (
                  <span className="bg-slate-100 dark:bg-slate-800 px-2 py-0.5 rounded">
                    Status: {statusFilter}
                  </span>
                )}
                {classFilter && (
                  <span className="bg-slate-100 dark:bg-slate-800 px-2 py-0.5 rounded">
                    Class filtered
                  </span>
                )}
                {search && (
                  <span className="bg-slate-100 dark:bg-slate-800 px-2 py-0.5 rounded">
                    Search: "{search}"
                  </span>
                )}
                <button
                  onClick={() => {
                    setSearch("");
                    setClassFilter("");
                    setStatusFilter("pending");
                  }}
                  className="ml-auto text-blue-600 hover:underline"
                >
                  সব মুছুন
                </button>
              </div>
            )}
          </CardContent>
        </Card>

        {/* ─── LIST ─── */}
        {loading ? (
          <div className="text-center py-16">
            <Loader2 className="w-8 h-8 animate-spin mx-auto text-[#0a4d8c]" />
            <p className="text-slate-500 mt-3">লোড হচ্ছে...</p>
          </div>
        ) : filteredAdmissions.length === 0 ? (
          <Card>
            <CardContent className="p-12 text-center">
              <UserPlus className="w-16 h-16 mx-auto text-slate-300 mb-3" />
              <p className="text-lg font-medium text-slate-600 dark:text-slate-400">
                {statusFilter === "pending"
                  ? "কোনো অপেক্ষমাণ আবেদন নেই ✅"
                  : "কোনো আবেদন পাওয়া যায়নি"}
              </p>
              <p className="text-sm text-slate-400 mt-1">
                {search ? "সার্চ ফিল্টার পরিবর্তন করে দেখুন" : ""}
              </p>
            </CardContent>
          </Card>
        ) : (
          <div className="grid gap-4">
            {filteredAdmissions.map((adm) => (
              <AdmissionCard
                key={adm.id}
                admission={adm}
                processing={processing === adm.id}
                onView={() => openDetail(adm)}
                onApprove={() => openApproveDialog(adm)}
                onReject={() => openRejectDialog(adm)}
                onDelete={() => openDeleteDialog(adm)}
              />
            ))}
          </div>
        )}

        {/* ═══════════════════════════════════════════════════════
            DETAIL DIALOG
        ═══════════════════════════════════════════════════════ */}
        <Dialog open={showDetailDialog} onOpenChange={setShowDetailDialog}>
          <DialogContent className="max-w-3xl max-h-[90vh] overflow-y-auto">
            {selectedAdmission && (
              <>
                <DialogHeader>
                  <DialogTitle className="flex items-center gap-3 flex-wrap">
                    <span className="font-mono text-xs bg-blue-100 dark:bg-blue-950 text-blue-700 dark:text-blue-300 px-2 py-1 rounded">
                      {selectedAdmission.reference_no}
                    </span>
                    <span className="font-bold text-lg">{selectedAdmission.name}</span>
                    <StatusBadge status={selectedAdmission.status} />
                  </DialogTitle>
                  <DialogDescription>
                    জমা: {new Date(selectedAdmission.applied_at).toLocaleString("bn-BD")}
                    {selectedAdmission.reviewed_at && (
                      <> • পর্যালোচনা: {new Date(selectedAdmission.reviewed_at).toLocaleString("bn-BD")}</>
                    )}
                  </DialogDescription>
                </DialogHeader>

                <div className="space-y-4 mt-4">
                  <DetailSection title="শিক্ষার্থীর তথ্য" icon={User}>
                    <DetailRow label="নাম (English)" value={selectedAdmission.name} />
                    <DetailRow label="নাম (বাংলা)" value={selectedAdmission.name_bn || "-"} />
                    <DetailRow label="পিতার নাম" value={selectedAdmission.father_name} />
                    <DetailRow label="মাতার নাম" value={selectedAdmission.mother_name} />
                    <DetailRow label="জন্ম তারিখ" value={selectedAdmission.dob} />
                    <DetailRow label="লিঙ্গ" value={
                      selectedAdmission.gender === "male" ? "পুরুষ" :
                      selectedAdmission.gender === "female" ? "মহিলা" : "অন্যান্য"
                    } />
                    <DetailRow label="রক্তের গ্রুপ" value={selectedAdmission.blood_group || "-"} />
                    <DetailRow label="বিশেষ রোগ" value={selectedAdmission.particular_disease || "নেই"} />
                    <DetailRow label="জন্ম সনদ" value={selectedAdmission.birth_cert_no || "-"} />
                  </DetailSection>

                  <DetailSection title="একাডেমিক তথ্য" icon={GraduationCap}>
                    <DetailRow label="শ্রেণি" value={selectedAdmission.classes?.name || "-"} />
                    <DetailRow label="শাখা" value={selectedAdmission.sections?.name || "-"} />
                    <DetailRow label="শিক্ষাবর্ষ" value={selectedAdmission.academic_years?.name || "-"} />
                  </DetailSection>

                  <DetailSection title="বর্তমান ঠিকানা" icon={MapPin}>
                    <DetailRow label="জেলা" value={selectedAdmission.district || "-"} />
                    <DetailRow label="থানা" value={selectedAdmission.police_station || "-"} />
                    <DetailRow label="ডাকঘর" value={selectedAdmission.post_office || "-"} />
                    <DetailRow label="গ্রাম" value={selectedAdmission.village || "-"} />
                  </DetailSection>

                  {(selectedAdmission.permanent_district ||
                    selectedAdmission.permanent_village) && (
                    <DetailSection title="স্থায়ী ঠিকানা" icon={MapPin}>
                      <DetailRow label="জেলা" value={selectedAdmission.permanent_district || "-"} />
                      <DetailRow label="থানা" value={selectedAdmission.permanent_police_station || "-"} />
                      <DetailRow label="ডাকঘর" value={selectedAdmission.permanent_post_office || "-"} />
                      <DetailRow label="গ্রাম" value={selectedAdmission.permanent_village || "-"} />
                    </DetailSection>
                  )}

                  <DetailSection title="যোগাযোগ" icon={Phone}>
                    <DetailRow label="মোবাইল" value={selectedAdmission.contact} />
                    <DetailRow label="পিতার মোবাইল" value={selectedAdmission.fathers_contact || "-"} />
                    <DetailRow label="মাতার মোবাইল" value={selectedAdmission.mothers_contact || "-"} />
                    <DetailRow label="ইমেইল" value={selectedAdmission.email || "-"} />
                    <DetailRow label="WhatsApp" value={selectedAdmission.whatsapp || "-"} />
                  </DetailSection>

                  {selectedAdmission.photo_url && (
                    <div className="bg-slate-50 dark:bg-slate-800/50 rounded-lg p-4">
                      <h4 className="text-sm font-bold text-[#0a4d8c] dark:text-blue-400 mb-3">
                        📸 শিক্ষার্থীর ছবি
                      </h4>
                      <div className="flex justify-center">
                        <img
                          src={selectedAdmission.photo_url}
                          alt={selectedAdmission.name}
                          className="w-32 h-32 rounded-full object-cover border-4 border-white shadow-md"
                        />
                      </div>
                    </div>
                  )}

                  {selectedAdmission.status === "rejected" && selectedAdmission.rejection_reason && (
                    <div className="bg-red-50 dark:bg-red-950/30 border-l-4 border-red-500 rounded-lg p-4">
                      <p className="text-sm font-bold text-red-700 dark:text-red-300 mb-1">
                        ❌ বাতিলের কারণ
                      </p>
                      <p className="text-sm text-red-600 dark:text-red-400">
                        {selectedAdmission.rejection_reason}
                      </p>
                    </div>
                  )}
                </div>

                <DialogFooter className="flex-wrap gap-2">
                  {selectedAdmission.status === "pending" && (
                    <>
                      <Button
                        variant="ghost"
                        onClick={() => {
                          setShowDetailDialog(false);
                          openDeleteDialog(selectedAdmission);
                        }}
                        className="text-red-600 hover:text-red-700 hover:bg-red-50"
                      >
                        <Trash2 className="w-4 h-4 mr-1" />
                        মুছুন
                      </Button>
                      <Button
                        variant="destructive"
                        onClick={() => openRejectDialog(selectedAdmission)}
                      >
                        <XCircle className="w-4 h-4 mr-2" />
                        বাতিল করুন
                      </Button>
                      <Button
                        onClick={() => openApproveDialog(selectedAdmission)}
                        className="bg-emerald-600 hover:bg-emerald-700"
                      >
                        <CheckCircle2 className="w-4 h-4 mr-2" />
                        অনুমোদন করুন
                      </Button>
                    </>
                  )}

                  {selectedAdmission.status === "approved" && selectedAdmission.approved_student_id && (
                    <Link href={`/students/${selectedAdmission.approved_student_id}`}>
                      <Button className="bg-emerald-600 hover:bg-emerald-700">
                        <GraduationCap className="w-4 h-4 mr-2" />
                        Student Profile দেখুন
                      </Button>
                    </Link>
                  )}
                </DialogFooter>
              </>
            )}
          </DialogContent>
        </Dialog>

        {/* ═══════════════════════════════════════════════════════
            APPROVE CONFIRMATION
        ═══════════════════════════════════════════════════════ */}
        <Dialog open={showApproveDialog} onOpenChange={setShowApproveDialog}>
          <DialogContent className="max-w-md">
            <DialogHeader>
              <DialogTitle className="text-emerald-700 dark:text-emerald-400 flex items-center gap-2">
                <CheckCircle2 className="w-5 h-5" />
                অনুমোদন নিশ্চিত করুন
              </DialogTitle>
              <DialogDescription>
                এই আবেদন অনুমোদন করলে শিক্ষার্থী সরাসরি <strong>Student List</strong>-এ যোগ হবে এবং তার জন্য <strong>Fee Structure</strong> স্বয়ংক্রিয়ভাবে assign হবে।
              </DialogDescription>
            </DialogHeader>

            {selectedAdmission && (
              <div className="bg-emerald-50 dark:bg-emerald-950/30 rounded-lg p-4 my-4 space-y-2">
                <p className="font-bold text-lg">{selectedAdmission.name}</p>
                <p className="text-sm text-slate-600 dark:text-slate-400">
                  শ্রেণি: {selectedAdmission.classes?.name} — {selectedAdmission.sections?.name}
                </p>
                <p className="text-xs text-slate-500">
                  Reference: <span className="font-mono">{selectedAdmission.reference_no}</span>
                </p>
              </div>
            )}

            <DialogFooter>
              <Button
                variant="outline"
                onClick={() => setShowApproveDialog(false)}
                disabled={processing !== null}
              >
                বাতিল
              </Button>
              <Button
                onClick={handleApprove}
                disabled={processing !== null}
                className="bg-emerald-600 hover:bg-emerald-700"
              >
                {processing ? (
                  <>
                    <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                    প্রসেস হচ্ছে...
                  </>
                ) : (
                  <>
                    <CheckCircle2 className="w-4 h-4 mr-2" />
                    হ্যাঁ, অনুমোদন করুন
                  </>
                )}
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>

        {/* ═══════════════════════════════════════════════════════
            REJECT DIALOG
        ═══════════════════════════════════════════════════════ */}
        <Dialog open={showRejectDialog} onOpenChange={setShowRejectDialog}>
          <DialogContent className="max-w-md">
            <DialogHeader>
              <DialogTitle className="text-red-700 dark:text-red-400 flex items-center gap-2">
                <XCircle className="w-5 h-5" />
                আবেদন বাতিল
              </DialogTitle>
              <DialogDescription>
                আবেদন বাতিলের কারণ লিখুন। এটি সংরক্ষিত থাকবে।
              </DialogDescription>
            </DialogHeader>

            <div className="my-4">
              <label className="text-sm font-medium mb-2 block">
                বাতিলের কারণ *
              </label>
              <textarea
                value={rejectReason}
                onChange={(e) => setRejectReason(e.target.value)}
                className="w-full border border-slate-300 dark:border-slate-700 rounded-lg p-3 text-sm min-h-[100px] focus:ring-2 focus:ring-red-500 outline-none dark:bg-slate-900 resize-none"
                placeholder="যেমন: জন্ম সনদ যাচাই করা যায়নি..."
                maxLength={500}
              />
              <p className="text-xs text-slate-400 mt-1 text-right">
                {rejectReason.length}/500
              </p>
            </div>

            <DialogFooter>
              <Button
                variant="outline"
                onClick={() => setShowRejectDialog(false)}
                disabled={processing !== null}
              >
                বাতিল
              </Button>
              <Button
                onClick={handleReject}
                disabled={
                  rejectReason.trim().length < 3 || processing !== null
                }
                variant="destructive"
              >
                {processing ? (
                  <>
                    <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                    প্রসেস হচ্ছে...
                  </>
                ) : (
                  "নিশ্চিত বাতিল করুন"
                )}
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>

        {/* ═══════════════════════════════════════════════════════
            DELETE DIALOG
        ═══════════════════════════════════════════════════════ */}
        <Dialog open={showDeleteDialog} onOpenChange={setShowDeleteDialog}>
          <DialogContent className="max-w-md">
            <DialogHeader>
              <DialogTitle className="text-red-700 dark:text-red-400 flex items-center gap-2">
                <Trash2 className="w-5 h-5" />
                আবেদন স্থায়ীভাবে মুছুন
              </DialogTitle>
              <DialogDescription>
                এই আবেদন স্থায়ীভাবে মুছে যাবে। এটি আর ফেরত আনা যাবে না।
              </DialogDescription>
            </DialogHeader>

            {selectedAdmission && (
              <div className="bg-red-50 dark:bg-red-950/30 rounded-lg p-4 my-4">
                <p className="font-bold">{selectedAdmission.name}</p>
                <p className="text-xs text-slate-500 mt-1">
                  Reference: <span className="font-mono">{selectedAdmission.reference_no}</span>
                </p>
              </div>
            )}

            <DialogFooter>
              <Button
                variant="outline"
                onClick={() => setShowDeleteDialog(false)}
                disabled={processing !== null}
              >
                না, থাক
              </Button>
              <Button
                onClick={handleDelete}
                disabled={processing !== null}
                variant="destructive"
              >
                {processing ? (
                  <>
                    <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                    মুছছে...
                  </>
                ) : (
                  "হ্যাঁ, মুছে ফেলুন"
                )}
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </div>
    </ResponsiveLayout>
  );
}

// ═══════════════════════════════════════════════════════════════════════
// SUB-COMPONENTS
// ═══════════════════════════════════════════════════════════════════════

function StatCard({
  label, value, color, icon: Icon, active, onClick,
}: {
  label: string;
  value: number;
  color: string;
  icon: any;
  active?: boolean;
  onClick?: () => void;
}) {
  return (
    <button
      onClick={onClick}
      className={`text-left transition-all ${
        active ? "ring-2 ring-[#0a4d8c] dark:ring-blue-400 shadow-md" : ""
      }`}
    >
      <Card className="hover:shadow-md transition">
        <CardContent className="p-4 flex items-center gap-3">
          <div className={`w-11 h-11 rounded-lg ${color} text-white flex items-center justify-center shrink-0`}>
            <Icon className="w-6 h-6" />
          </div>
          <div className="min-w-0">
            <p className="text-xs text-slate-500 dark:text-slate-400 font-medium">
              {label}
            </p>
            <p className="text-2xl font-bold text-slate-800 dark:text-slate-100">
              {value}
            </p>
          </div>
        </CardContent>
      </Card>
    </button>
  );
}

function StatusBadge({ status }: { status: Admission["status"] }) {
  const styles = {
    pending: "bg-amber-100 text-amber-800 dark:bg-amber-950/50 dark:text-amber-300",
    reviewing: "bg-indigo-100 text-indigo-800 dark:bg-indigo-950/50 dark:text-indigo-300",
    approved: "bg-emerald-100 text-emerald-800 dark:bg-emerald-950/50 dark:text-emerald-300",
    rejected: "bg-red-100 text-red-800 dark:bg-red-950/50 dark:text-red-300",
  };
  const labels = {
    pending: "⏳ অপেক্ষমাণ",
    reviewing: "👀 পর্যালোচনাধীন",
    approved: "✅ অনুমোদিত",
    rejected: "❌ বাতিল",
  };
  return (
    <span className={`text-xs px-2.5 py-1 rounded-full font-semibold ${styles[status]}`}>
      {labels[status]}
    </span>
  );
}

function AdmissionCard({
  admission, processing, onView, onApprove, onReject, onDelete,
}: {
  admission: Admission;
  processing: boolean;
  onView: () => void;
  onApprove: () => void;
  onReject: () => void;
  onDelete: () => void;
}) {
  const borderColor = {
    pending: "border-l-amber-500",
    reviewing: "border-l-indigo-500",
    approved: "border-l-emerald-500",
    rejected: "border-l-red-500",
  }[admission.status];

  const age = (() => {
    if (!admission.dob) return "-";
    const birth = new Date(admission.dob);
    const today = new Date();
    let years = today.getFullYear() - birth.getFullYear();
    const m = today.getMonth() - birth.getMonth();
    if (m < 0 || (m === 0 && today.getDate() < birth.getDate())) years--;
    return years;
  })();

  return (
    <Card className={`border-l-4 ${borderColor} hover:shadow-md transition-shadow`}>
      <CardContent className="p-4">
        <div className="flex flex-wrap items-start gap-4">
          {/* Photo */}
          <div className="w-16 h-16 rounded-full bg-slate-200 dark:bg-slate-700 overflow-hidden shrink-0 border-2 border-white shadow-md">
            {admission.photo_url ? (
              <img
                src={admission.photo_url}
                alt={admission.name}
                className="w-full h-full object-cover"
              />
            ) : (
              <div className="w-full h-full flex items-center justify-center text-2xl font-bold text-slate-500 bg-gradient-to-br from-slate-100 to-slate-300 dark:from-slate-700 dark:to-slate-800">
                {admission.name?.charAt(0)?.toUpperCase() || "?"}
              </div>
            )}
          </div>

          {/* Info */}
          <div className="flex-1 min-w-[250px]">
            <div className="flex items-center gap-2 flex-wrap mb-2">
              <h3 className="font-bold text-lg text-slate-800 dark:text-slate-100">
                {admission.name}
              </h3>
              <StatusBadge status={admission.status} />
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-2 text-sm text-slate-600 dark:text-slate-400">
              <div className="flex items-center gap-1.5">
                <User className="w-3.5 h-3.5 text-slate-400 shrink-0" />
                <span className="truncate">বাবা: {admission.father_name}</span>
              </div>
              <div className="flex items-center gap-1.5">
                <GraduationCap className="w-3.5 h-3.5 text-slate-400 shrink-0" />
                <span className="truncate">
                  {admission.classes?.name || "?"} — {admission.sections?.name || "?"}
                </span>
              </div>
              <div className="flex items-center gap-1.5">
                <Phone className="w-3.5 h-3.5 text-slate-400 shrink-0" />
                <span className="truncate">{admission.contact}</span>
              </div>
              <div className="flex items-center gap-1.5">
                <Calendar className="w-3.5 h-3.5 text-slate-400 shrink-0" />
                <span>বয়স: {age} বছর</span>
              </div>
              <div className="flex items-center gap-1.5">
                <Clock className="w-3.5 h-3.5 text-slate-400 shrink-0" />
                <span className="truncate">
                  {new Date(admission.applied_at).toLocaleDateString("bn-BD")}
                </span>
              </div>
              <div className="font-mono text-xs bg-slate-100 dark:bg-slate-800 px-2 py-0.5 rounded w-fit">
                {admission.reference_no}
              </div>
            </div>
          </div>

          {/* Actions */}
          <div className="flex flex-wrap gap-2 ml-auto">
            <Button
              variant="outline"
              size="sm"
              onClick={onView}
              disabled={processing}
            >
              <Eye className="w-4 h-4 mr-1" />
              দেখুন
            </Button>
            {admission.status === "pending" && (
              <>
                <Button
                  size="sm"
                  onClick={onApprove}
                  disabled={processing}
                  className="bg-emerald-600 hover:bg-emerald-700"
                >
                  {processing ? (
                    <Loader2 className="w-4 h-4 animate-spin" />
                  ) : (
                    <CheckCircle2 className="w-4 h-4 mr-1" />
                  )}
                  অনুমোদন
                </Button>
                <Button
                  size="sm"
                  variant="destructive"
                  onClick={onReject}
                  disabled={processing}
                >
                  <XCircle className="w-4 h-4 mr-1" />
                  বাতিল
                </Button>
              </>
            )}
            {admission.status === "approved" && admission.approved_student_id && (
              <Link href={`/students/${admission.approved_student_id}`}>
                <Button
                  size="sm"
                  variant="outline"
                  className="text-emerald-600 border-emerald-300 hover:bg-emerald-50"
                >
                  <GraduationCap className="w-4 h-4 mr-1" />
                  প্রোফাইল
                </Button>
              </Link>
            )}
            {admission.status === "rejected" && (
              <Button
                size="sm"
                variant="ghost"
                onClick={onDelete}
                disabled={processing}
                className="text-red-600 hover:bg-red-50"
                title="স্থায়ীভাবে মুছুন"
              >
                <Trash2 className="w-4 h-4" />
              </Button>
            )}
          </div>
        </div>
      </CardContent>
    </Card>
  );
}

function DetailSection({
  title, icon: Icon, children,
}: {
  title: string;
  icon: any;
  children: React.ReactNode;
}) {
  return (
    <div className="bg-slate-50 dark:bg-slate-800/50 rounded-lg p-4">
      <h4 className="flex items-center gap-2 text-sm font-bold text-[#0a4d8c] dark:text-blue-400 mb-3 pb-2 border-b border-slate-200 dark:border-slate-700">
        <Icon className="w-4 h-4" />
        {title}
      </h4>
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-x-6 gap-y-2">
        {children}
      </div>
    </div>
  );
}

function DetailRow({ label, value }: { label: string; value: React.ReactNode }) {
  return (
    <div className="flex text-sm">
      <span className="text-slate-500 dark:text-slate-400 w-32 shrink-0">
        {label}:
      </span>
      <span className="font-medium text-slate-800 dark:text-slate-200 flex-1 break-words">
        {value || "-"}
      </span>
    </div>
  );
}