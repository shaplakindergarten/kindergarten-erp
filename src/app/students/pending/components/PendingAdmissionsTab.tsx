// src/app/students/pending/components/PendingAdmissionsTab.tsx
"use client";

import { useState, useEffect, useMemo, useCallback } from "react";
import Link from "next/link";
import {
  UserPlus, RefreshCw, Search, CheckCircle2, XCircle,
  Eye, Loader2, Phone, User, GraduationCap,
  Calendar, Trash2, ChevronLeft, ChevronRight, ArrowLeft,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent } from "@/components/ui/card";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle,
  DialogDescription, DialogFooter,
} from "@/components/ui/dialog";
import { createClient } from "@/lib/supabase/client";
import {
  approveAdmission,
  rejectAdmission,
  deleteAdmission,
} from "@/app/dashboard/admissions/actions";
import { useToastStore } from "@/store/useStore";
import { getErrorMessage, isNetworkError } from "@/lib/utils/error";

// ═══════════════════════════════════════════════════════════════════════
// TYPES
// ═══════════════════════════════════════════════════════════════════════
interface PendingAdmission {
  id: string;
  reference_no: string;
  name: string;
  name_bn: string | null;
  father_name: string;
  mother_name: string;
  dob: string;
  gender: string;
  blood_group: string | null;
  contact: string;
  class_id: string | null;
  section_id: string | null;
  photo_url: string | null;
  status: "pending" | "reviewing" | "approved" | "rejected";
  rejection_reason: string | null;
  applied_at: string;
  classes?: { id: string; name: string } | null;
  sections?: { id: string; name: string } | null;
}

const ITEMS_PER_PAGE = 10;

// ═══════════════════════════════════════════════════════════════════════
// MAIN COMPONENT
// ═══════════════════════════════════════════════════════════════════════
export function PendingAdmissionsTab() {
  const addToast = useToastStore((s) => s.addToast);

  // ── Data ──
  const [admissions, setAdmissions] = useState<PendingAdmission[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  // ── Filters ──
  const [search, setSearch] = useState("");
  const [page, setPage] = useState(1);

  // ── Dialogs ──
  const [selectedAdmission, setSelectedAdmission] = useState<PendingAdmission | null>(null);
  const [showDetailDialog, setShowDetailDialog] = useState(false);
  const [showApproveDialog, setShowApproveDialog] = useState(false);
  const [showRejectDialog, setShowRejectDialog] = useState(false);
  const [showDeleteDialog, setShowDeleteDialog] = useState(false);

  // ── Processing ──
  const [processing, setProcessing] = useState<string | null>(null);
  const [rejectReason, setRejectReason] = useState("");

  // ═══════════════════════════════════════════════════════════════════
  // LOAD DATA
  // ═══════════════════════════════════════════════════════════════════
  const loadAdmissions = useCallback(
    async (isRefresh = false) => {
      if (isRefresh) setRefreshing(true);
      else setLoading(true);

      try {
        const supabase = createClient();
        const { data, error } = await supabase
          .from("pending_admissions")
          .select(`
            id, reference_no, name, name_bn, father_name, mother_name,
            dob, gender, blood_group, contact, class_id, section_id,
            photo_url, status, rejection_reason, applied_at,
            classes (id, name),
            sections (id, name)
          `)
          .eq("status", "pending")
          .order("applied_at", { ascending: false });

        if (error) throw error;
        setAdmissions((data as unknown as PendingAdmission[]) || []);
      } catch (err) {
        if (isNetworkError(err)) {
          console.warn("Pending admissions unavailable: network is offline.");
        } else {
          console.error("Load pending admissions:", getErrorMessage(err));
          addToast({
            type: "error",
            title: "লোড ব্যর্থ",
            message: "আবেদন লোড করা যায়নি",
          });
        }
        setAdmissions([]);
      } finally {
        setLoading(false);
        setRefreshing(false);
      }
    },
    [addToast]
  );

  useEffect(() => {
    loadAdmissions();
  }, [loadAdmissions]);

  // ═══════════════════════════════════════════════════════════════════
  // REALTIME SUBSCRIPTION
  // ═══════════════════════════════════════════════════════════════════
  useEffect(() => {
    const supabase = createClient();
    const channel = supabase
      .channel("students-pending-admissions-page")
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "pending_admissions" },
        () => loadAdmissions(true)
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [loadAdmissions]);

  // ═══════════════════════════════════════════════════════════════════
  // FILTER + PAGINATION
  // ═══════════════════════════════════════════════════════════════════
  const filtered = useMemo(() => {
    if (!search.trim()) return admissions;
    const q = search.toLowerCase().trim();
    return admissions.filter(
      (a) =>
        a.name?.toLowerCase().includes(q) ||
        a.name_bn?.toLowerCase().includes(q) ||
        a.father_name?.toLowerCase().includes(q) ||
        a.contact?.includes(q) ||
        a.reference_no?.toLowerCase().includes(q)
    );
  }, [admissions, search]);

  const totalPages = Math.max(1, Math.ceil(filtered.length / ITEMS_PER_PAGE));
  const currentPage = Math.min(page, totalPages);
  const paginated = filtered.slice(
    (currentPage - 1) * ITEMS_PER_PAGE,
    currentPage * ITEMS_PER_PAGE
  );

  useEffect(() => {
    setPage(1);
  }, [search]);

  // ═══════════════════════════════════════════════════════════════════
  // HANDLERS
  // ═══════════════════════════════════════════════════════════════════
  const openDetail = (admission: PendingAdmission) => {
    setSelectedAdmission(admission);
    setShowDetailDialog(true);
  };

  const openApprove = (admission: PendingAdmission) => {
    setSelectedAdmission(admission);
    setShowApproveDialog(true);
    setShowDetailDialog(false);
  };

  const openReject = (admission: PendingAdmission) => {
    setSelectedAdmission(admission);
    setRejectReason("");
    setShowRejectDialog(true);
    setShowDetailDialog(false);
  };

  const openDelete = (admission: PendingAdmission) => {
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
        message: `${result.studentName} — ID: ${result.studentId}`,
      });

      setShowApproveDialog(false);
      setSelectedAdmission(null);
      loadAdmissions(true);
    } else {
      addToast({
        type: "error",
        title: "ব্যর্থ",
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
        title: "বাতিল হয়েছে",
        message: `${selectedAdmission.name}-এর আবেদন বাতিল`,
      });
      setShowRejectDialog(false);
      setSelectedAdmission(null);
      setRejectReason("");
      loadAdmissions(true);
    } else {
      addToast({
        type: "error",
        title: "ব্যর্থ",
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
      loadAdmissions(true);
    } else {
      addToast({
        type: "error",
        title: "ব্যর্থ",
        message: result.error,
      });
    }
  };

  // ═══════════════════════════════════════════════════════════════════
  // RENDER
  // ═══════════════════════════════════════════════════════════════════
  return (
    <div className="h-screen flex flex-col bg-white dark:bg-gray-900 overflow-hidden">
      {/* ── Header ── */}
      <div className="flex-shrink-0 p-3 bg-gradient-to-r from-amber-500 via-orange-500 to-orange-600 rounded-b-lg shadow-lg">
        <div className="flex flex-col lg:flex-row items-start lg:items-center gap-3">
          <div className="flex items-center gap-3 w-full lg:w-auto">
            <Link
              href="/students/list"
              className="text-white hover:bg-white/20 rounded-lg p-2 transition"
              title="Back to Students"
            >
              <ArrowLeft className="w-5 h-5" />
            </Link>
            <div>
              <h1 className="text-xl font-bold text-white flex items-center gap-2">
                <UserPlus className="w-5 h-5" />
                Pending Admissions
              </h1>
              <p className="text-xs text-white/80">
                {loading
                  ? "লোড হচ্ছে..."
                  : filtered.length === 0
                  ? "কোনো অপেক্ষমাণ আবেদন নেই"
                  : `${filtered.length}টি আবেদন অপেক্ষমাণ`}
              </p>
            </div>
          </div>

          {/* Search + Refresh */}
          <div className="w-full lg:flex-1 flex flex-wrap items-center gap-2 justify-end">
            <div className="relative flex-1 min-w-[200px] max-w-md">
              <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-white/70 pointer-events-none" />
              <Input
                placeholder="নাম, রেফারেন্স বা মোবাইল..."
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                className="w-full pl-8 h-8 bg-white/20 backdrop-blur-sm text-white placeholder:text-white/60 border-white/30 focus:border-white/50 focus:ring-white/30 text-sm"
              />
            </div>
            <Button
              variant="secondary"
              size="sm"
              onClick={() => loadAdmissions(true)}
              disabled={refreshing}
              className="bg-white/20 backdrop-blur-sm text-white hover:bg-white/30 border border-white/30 h-8 px-3"
            >
              <RefreshCw className={`h-3.5 w-3.5 ${refreshing ? "animate-spin" : ""}`} />
            </Button>
          </div>
        </div>
      </div>

      {/* ── Content ── */}
      <div className="flex-1 overflow-auto p-3 min-h-0">
        {loading ? (
          <div className="text-center py-16">
            <Loader2 className="w-8 h-8 animate-spin mx-auto text-amber-500" />
            <p className="text-sm text-slate-500 mt-3">লোড হচ্ছে...</p>
          </div>
        ) : paginated.length === 0 ? (
          <Card className="border-dashed border-2 border-slate-200 dark:border-slate-800">
            <CardContent className="p-12 text-center">
              <UserPlus className="w-14 h-14 mx-auto text-slate-300 mb-3" />
              <p className="text-base font-medium text-slate-600 dark:text-slate-400">
                {search
                  ? "সার্চের সাথে মিল নেই"
                  : "কোনো অপেক্ষমাণ আবেদন নেই ✅"}
              </p>
              <p className="text-xs text-slate-400 mt-1">
                নতুন আবেদন এলে এখানে দেখা যাবে
              </p>
            </CardContent>
          </Card>
        ) : (
          <>
            {/* ── Card List ── */}
            <div className="space-y-2 max-w-5xl mx-auto">
              {paginated.map((adm) => (
                <AdmissionRow
                  key={adm.id}
                  admission={adm}
                  processing={processing === adm.id}
                  onView={() => openDetail(adm)}
                  onApprove={() => openApprove(adm)}
                  onReject={() => openReject(adm)}
                />
              ))}
            </div>

            {/* ── Pagination ── */}
            {totalPages > 1 && (
              <div className="flex items-center justify-between pt-4 max-w-5xl mx-auto">
                <p className="text-xs text-slate-500">
                  পেজ {currentPage} / {totalPages} — মোট {filtered.length}টি
                </p>
                <div className="flex items-center gap-1">
                  <Button
                    variant="outline"
                    size="sm"
                    disabled={currentPage === 1}
                    onClick={() => setPage(currentPage - 1)}
                  >
                    <ChevronLeft className="w-4 h-4" />
                  </Button>
                  <span className="text-xs px-3 py-1.5 bg-slate-100 dark:bg-slate-800 rounded">
                    {currentPage}
                  </span>
                  <Button
                    variant="outline"
                    size="sm"
                    disabled={currentPage === totalPages}
                    onClick={() => setPage(currentPage + 1)}
                  >
                    <ChevronRight className="w-4 h-4" />
                  </Button>
                </div>
              </div>
            )}
          </>
        )}
      </div>

      {/* ═══════════════════════════════════════════════════════════
          DETAIL DIALOG
      ═══════════════════════════════════════════════════════════ */}
      <Dialog open={showDetailDialog} onOpenChange={setShowDetailDialog}>
        <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
          {selectedAdmission && (
            <>
              <DialogHeader>
                <DialogTitle className="flex items-center gap-3 flex-wrap">
                  <span className="font-mono text-xs bg-blue-100 dark:bg-blue-950 text-blue-700 dark:text-blue-300 px-2 py-1 rounded">
                    {selectedAdmission.reference_no}
                  </span>
                  <span>{selectedAdmission.name}</span>
                </DialogTitle>
                <DialogDescription>
                  জমা:{" "}
                  {new Date(selectedAdmission.applied_at).toLocaleString("bn-BD")}
                </DialogDescription>
              </DialogHeader>

              <div className="space-y-3 mt-2">
                {selectedAdmission.photo_url && (
                  <div className="flex justify-center">
                    <img
                      src={selectedAdmission.photo_url}
                      alt={selectedAdmission.name}
                      className="w-24 h-24 rounded-full object-cover border-4 border-white shadow-lg"
                    />
                  </div>
                )}

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <InfoRow label="পিতার নাম" value={selectedAdmission.father_name} />
                  <InfoRow label="মাতার নাম" value={selectedAdmission.mother_name} />
                  <InfoRow label="জন্ম তারিখ" value={selectedAdmission.dob} />
                  <InfoRow
                    label="লিঙ্গ"
                    value={
                      selectedAdmission.gender === "male"
                        ? "পুরুষ"
                        : selectedAdmission.gender === "female"
                        ? "মহিলা"
                        : "অন্যান্য"
                    }
                  />
                  <InfoRow
                    label="শ্রেণি"
                    value={selectedAdmission.classes?.name || "-"}
                  />
                  <InfoRow
                    label="শাখা"
                    value={selectedAdmission.sections?.name || "-"}
                  />
                  <InfoRow label="মোবাইল" value={selectedAdmission.contact} />
                  <InfoRow
                    label="রক্তের গ্রুপ"
                    value={selectedAdmission.blood_group || "-"}
                  />
                </div>
              </div>

              <DialogFooter className="flex-wrap gap-2 mt-4">
                <Button
                  variant="ghost"
                  onClick={() => {
                    setShowDetailDialog(false);
                    openDelete(selectedAdmission);
                  }}
                  className="text-red-600 hover:bg-red-50"
                >
                  <Trash2 className="w-4 h-4 mr-1" />
                  মুছুন
                </Button>
                <Button
                  variant="destructive"
                  onClick={() => openReject(selectedAdmission)}
                >
                  <XCircle className="w-4 h-4 mr-2" />
                  বাতিল
                </Button>
                <Button
                  onClick={() => openApprove(selectedAdmission)}
                  className="bg-emerald-600 hover:bg-emerald-700"
                >
                  <CheckCircle2 className="w-4 h-4 mr-2" />
                  অনুমোদন
                </Button>
              </DialogFooter>
            </>
          )}
        </DialogContent>
      </Dialog>

      {/* ═══════════════════════════════════════════════════════════
          APPROVE DIALOG
      ═══════════════════════════════════════════════════════════ */}
      <Dialog open={showApproveDialog} onOpenChange={setShowApproveDialog}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle className="text-emerald-700 flex items-center gap-2">
              <CheckCircle2 className="w-5 h-5" />
              অনুমোদন নিশ্চিত করুন
            </DialogTitle>
            <DialogDescription>
              অনুমোদন করলে শিক্ষার্থী সরাসরি Student List-এ যোগ হবে এবং Fee Structure স্বয়ংক্রিয়ভাবে assign হবে।
            </DialogDescription>
          </DialogHeader>

          {selectedAdmission && (
            <div className="bg-emerald-50 dark:bg-emerald-950/30 rounded-lg p-4 my-3">
              <p className="font-bold">{selectedAdmission.name}</p>
              <p className="text-xs text-slate-600 mt-1">
                শ্রেণি: {selectedAdmission.classes?.name} —{" "}
                {selectedAdmission.sections?.name}
              </p>
              <p className="text-xs font-mono mt-1">
                {selectedAdmission.reference_no}
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
                  হ্যাঁ, অনুমোদন
                </>
              )}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* ═══════════════════════════════════════════════════════════
          REJECT DIALOG
      ═══════════════════════════════════════════════════════════ */}
      <Dialog open={showRejectDialog} onOpenChange={setShowRejectDialog}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle className="text-red-700 flex items-center gap-2">
              <XCircle className="w-5 h-5" />
              আবেদন বাতিল
            </DialogTitle>
            <DialogDescription>
              বাতিলের কারণ লিখুন। এটি সংরক্ষিত থাকবে।
            </DialogDescription>
          </DialogHeader>

          <div className="my-3">
            <label className="text-sm font-medium mb-2 block">কারণ *</label>
            <textarea
              value={rejectReason}
              onChange={(e) => setRejectReason(e.target.value)}
              className="w-full border rounded-lg p-3 text-sm min-h-[100px] focus:ring-2 focus:ring-red-500 outline-none dark:bg-slate-900 resize-none"
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
              disabled={rejectReason.trim().length < 3 || processing !== null}
              variant="destructive"
            >
              {processing ? (
                <>
                  <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                  প্রসেস হচ্ছে...
                </>
              ) : (
                "নিশ্চিত বাতিল"
              )}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* ═══════════════════════════════════════════════════════════
          DELETE DIALOG
      ═══════════════════════════════════════════════════════════ */}
      <Dialog open={showDeleteDialog} onOpenChange={setShowDeleteDialog}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle className="text-red-700 flex items-center gap-2">
              <Trash2 className="w-5 h-5" />
              আবেদন স্থায়ীভাবে মুছুন
            </DialogTitle>
            <DialogDescription>
              এই আবেদন স্থায়ীভাবে মুছে যাবে। ফেরত আনা যাবে না।
            </DialogDescription>
          </DialogHeader>

          {selectedAdmission && (
            <div className="bg-red-50 dark:bg-red-950/30 rounded-lg p-4 my-3">
              <p className="font-bold">{selectedAdmission.name}</p>
              <p className="text-xs font-mono mt-1">
                {selectedAdmission.reference_no}
              </p>
            </div>
          )}

          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => setShowDeleteDialog(false)}
              disabled={processing !== null}
            >
              না
            </Button>
            <Button
              onClick={handleDelete}
              disabled={processing !== null}
              variant="destructive"
            >
              {processing ? (
                <>
                  <Loader2 className="w-4 h-4 animate-spin mr-2" />
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
  );
}

// ═══════════════════════════════════════════════════════════════════════
// SUB-COMPONENTS
// ═══════════════════════════════════════════════════════════════════════

function AdmissionRow({
  admission,
  processing,
  onView,
  onApprove,
  onReject,
}: {
  admission: PendingAdmission;
  processing: boolean;
  onView: () => void;
  onApprove: () => void;
  onReject: () => void;
}) {
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
    <Card className="border-l-4 border-l-amber-500 hover:shadow-md transition-shadow">
      <CardContent className="p-3">
        <div className="flex flex-wrap items-start gap-3">
          <div className="w-12 h-12 rounded-full bg-slate-200 dark:bg-slate-700 overflow-hidden shrink-0 border-2 border-white shadow-sm">
            {admission.photo_url ? (
              <img
                src={admission.photo_url}
                alt={admission.name}
                className="w-full h-full object-cover"
              />
            ) : (
              <div className="w-full h-full flex items-center justify-center text-lg font-bold text-slate-500">
                {admission.name?.charAt(0)?.toUpperCase() || "?"}
              </div>
            )}
          </div>

          <div className="flex-1 min-w-[200px]">
            <div className="flex items-center gap-2 flex-wrap">
              <h3 className="font-bold text-slate-800 dark:text-slate-100">
                {admission.name}
              </h3>
              <span className="text-[10px] font-mono bg-slate-100 dark:bg-slate-800 px-2 py-0.5 rounded text-slate-600 dark:text-slate-300">
                {admission.reference_no}
              </span>
            </div>

            <div className="grid grid-cols-2 sm:grid-cols-4 gap-x-3 gap-y-1 mt-1.5 text-xs text-slate-600 dark:text-slate-400">
              <div className="flex items-center gap-1 truncate">
                <User className="w-3 h-3 text-slate-400 shrink-0" />
                <span className="truncate">{admission.father_name}</span>
              </div>
              <div className="flex items-center gap-1 truncate">
                <GraduationCap className="w-3 h-3 text-slate-400 shrink-0" />
                <span className="truncate">
                  {admission.classes?.name} — {admission.sections?.name}
                </span>
              </div>
              <div className="flex items-center gap-1 truncate">
                <Phone className="w-3 h-3 text-slate-400 shrink-0" />
                <span className="truncate">{admission.contact}</span>
              </div>
              <div className="flex items-center gap-1 truncate">
                <Calendar className="w-3 h-3 text-slate-400 shrink-0" />
                <span>বয়স: {age}</span>
              </div>
            </div>
          </div>

          <div className="flex gap-2 ml-auto shrink-0">
            <Button
              variant="outline"
              size="sm"
              onClick={onView}
              disabled={processing}
            >
              <Eye className="w-4 h-4 sm:mr-1" />
              <span className="hidden sm:inline">দেখুন</span>
            </Button>
            <Button
              size="sm"
              onClick={onApprove}
              disabled={processing}
              className="bg-emerald-600 hover:bg-emerald-700"
            >
              {processing ? (
                <Loader2 className="w-4 h-4 animate-spin" />
              ) : (
                <>
                  <CheckCircle2 className="w-4 h-4 sm:mr-1" />
                  <span className="hidden sm:inline">অনুমোদন</span>
                </>
              )}
            </Button>
            <Button
              size="sm"
              variant="destructive"
              onClick={onReject}
              disabled={processing}
            >
              <XCircle className="w-4 h-4 sm:mr-1" />
              <span className="hidden sm:inline">বাতিল</span>
            </Button>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}

function InfoRow({ label, value }: { label: string; value: string | null }) {
  return (
    <div className="bg-slate-50 dark:bg-slate-800/50 rounded-lg p-3">
      <p className="text-[10px] uppercase tracking-wider text-slate-500 mb-0.5">
        {label}
      </p>
      <p className="text-sm font-medium text-slate-800 dark:text-slate-200 break-words">
        {value || "-"}
      </p>
    </div>
  );
}