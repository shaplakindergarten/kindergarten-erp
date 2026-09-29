// src/app/my-profile/my-profile-client.tsx
"use client";

import * as React from "react";
import Link from "next/link";
import {
  User as UserIcon,
  Mail,
  Phone,
  ShieldCheck,
  Key,
  Building,
  MapPin,
  Calendar,
  Loader2,
  Camera,
  IdCard,
  Droplet,
  Clock,
  X,
  CheckCircle2,
  Eye,
  EyeOff,
  GraduationCap,
  BookOpen,
  TrendingUp,
  Save,
} from "lucide-react";
import { toast } from "sonner";
import { changePassword } from "./actions";

interface AcademicData {
  studentId: string;
  classRoll: string | null;
  className: string;
  sectionName: string;
  academicYear: string;
  admissionDate: string | null;
}

interface UserData {
  id: string;
  name: string;
  name_bn: string;
  email: string;
  phone: string;
  role: string;
  avatar: string;
  blood_group: string;
  gender: string;
  dob: string;
  father_name: string;
  mother_name: string;
  address: string;
  academic: AcademicData;
  institution: {
    name: string;
    address: string;
    logo: string;
    phone: string;
    email: string;
  };
  joinedDate: string;
  lastSignIn: string;
}

export default function MyProfileClient({ user: initialUser }: { user: UserData }) {
  const [user, setUser] = React.useState(initialUser);
  const [passwordOpen, setPasswordOpen] = React.useState(false);

  return (
    <div className="max-w-6xl mx-auto p-3 sm:p-6 lg:p-8 space-y-4 sm:space-y-6">
      {/* ═══════════════ PROFILE HEADER ═══════════════ */}
      <div className="bg-white dark:bg-slate-900 rounded-2xl shadow-sm border border-slate-200 dark:border-slate-800 overflow-hidden">
        {/* Banner */}
        <div className="h-20 sm:h-24 bg-gradient-to-br from-sky-500 via-blue-600 to-indigo-600 relative overflow-hidden">
          <div
            className="absolute inset-0 opacity-20"
            style={{
              backgroundImage: `radial-gradient(circle at 2px 2px, white 1.5px, transparent 0)`,
              backgroundSize: "24px 24px",
            }}
          />
          <div className="absolute -top-12 -right-12 w-48 h-48 rounded-full bg-white/10 blur-3xl" />
          <div className="absolute -bottom-12 -left-12 w-32 h-32 rounded-full bg-white/5 blur-2xl" />
        </div>

        {/* Profile Info */}
        <div className="relative px-4 sm:px-6 pb-5 sm:pb-6 flex flex-col sm:flex-row items-center sm:items-end justify-between gap-4 -mt-14 sm:-mt-16">
          <div className="flex flex-col sm:flex-row items-center sm:items-end gap-4 sm:gap-5 text-center sm:text-left w-full sm:w-auto">
            {/* Avatar */}
            <div className="relative group shrink-0">
              <div className="w-24 h-24 sm:w-28 sm:h-28 rounded-full border-[3px] border-white dark:border-slate-900 bg-gradient-to-br from-sky-500 to-blue-600 text-white font-bold text-3xl sm:text-4xl flex items-center justify-center shadow-xl ring-2 ring-sky-100 dark:ring-sky-950 overflow-hidden">
                {user.avatar ? (
                  <img src={user.avatar} alt={user.name} className="w-full h-full object-cover" />
                ) : (
                  user.name.charAt(0).toUpperCase()
                )}
              </div>
            </div>

            {/* Name + Class + ID */}
            <div className="mb-1 sm:mb-2 min-w-0">
              <div className="flex flex-col sm:flex-row items-center sm:items-center gap-2">
                <h1 className="text-xl sm:text-2xl font-bold text-slate-800 dark:text-slate-100 truncate">
                  {user.name}
                </h1>
                <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-semibold border bg-sky-100 text-sky-700 border-sky-200 dark:bg-sky-950/40 dark:text-sky-300 dark:border-sky-800 shrink-0">
                  <GraduationCap className="w-3.5 h-3.5 mr-1" />
                  Student
                </span>
              </div>
              {user.name_bn && (
                <p className="text-sm text-slate-500 dark:text-slate-400 mt-0.5 truncate">
                  {user.name_bn}
                </p>
              )}
              <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
                ID: {user.academic.studentId}
              </p>
            </div>
          </div>

          {/* Change Password Button */}
          <div className="flex flex-row gap-2 w-full sm:w-auto">
            <button
              onClick={() => setPasswordOpen(true)}
              className="flex-1 sm:flex-none flex items-center justify-center gap-2 px-4 py-2 text-sm font-medium text-slate-700 dark:text-slate-200 bg-white dark:bg-slate-800 border border-slate-300 dark:border-slate-700 rounded-lg hover:bg-slate-50 dark:hover:bg-slate-700 transition shadow-sm whitespace-nowrap"
            >
              <Key className="w-4 h-4" />
              পাসওয়ার্ড পরিবর্তন
            </button>
          </div>
        </div>
      </div>

      {/* ═══════════════ QUICK ACTIONS ═══════════════ */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
        <Link
          href="/my-results"
          className="group rounded-2xl bg-gradient-to-br from-purple-500 to-indigo-600 p-4 text-white shadow-md hover:shadow-lg transition-all hover:scale-[1.02]"
        >
          <div className="flex items-center justify-between">
            <div className="p-2 rounded-lg bg-white/20">
              <TrendingUp className="h-5 w-5" />
            </div>
            <span className="text-xs font-medium opacity-80 group-hover:opacity-100">→</span>
          </div>
          <p className="mt-3 text-base font-bold">আমার ফলাফল</p>
          <p className="text-xs opacity-90 mt-0.5">পরীক্ষার ফলাফল দেখুন</p>
        </Link>

        <Link
          href="/my-attendance"
          className="group rounded-2xl bg-gradient-to-br from-emerald-500 to-teal-600 p-4 text-white shadow-md hover:shadow-lg transition-all hover:scale-[1.02]"
        >
          <div className="flex items-center justify-between">
            <div className="p-2 rounded-lg bg-white/20">
              <Calendar className="h-5 w-5" />
            </div>
            <span className="text-xs font-medium opacity-80 group-hover:opacity-100">→</span>
          </div>
          <p className="mt-3 text-base font-bold">আমার হাজিরা</p>
          <p className="text-xs opacity-90 mt-0.5">উপস্থিতির রেকর্ড</p>
        </Link>

        <Link
          href="/my-fees"
          className="group rounded-2xl bg-gradient-to-br from-amber-500 to-orange-600 p-4 text-white shadow-md hover:shadow-lg transition-all hover:scale-[1.02]"
        >
          <div className="flex items-center justify-between">
            <div className="p-2 rounded-lg bg-white/20">
              <CheckCircle2 className="h-5 w-5" />
            </div>
            <span className="text-xs font-medium opacity-80 group-hover:opacity-100">→</span>
          </div>
          <p className="mt-3 text-base font-bold">আমার ফি</p>
          <p className="text-xs opacity-90 mt-0.5">বিল ও পেমেন্ট</p>
        </Link>
      </div>

      {/* ═══════════════ MAIN CONTENT GRID ═══════════════ */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4 sm:gap-6">
        {/* Left: Academic Info (Student's core info) */}
        <div className="lg:col-span-2 bg-white dark:bg-slate-900 rounded-2xl p-4 sm:p-6 shadow-sm border border-slate-200 dark:border-slate-800 space-y-4">
          <div className="border-b border-slate-100 dark:border-slate-800 pb-3">
            <h2 className="text-base sm:text-lg font-semibold text-slate-800 dark:text-slate-100 flex items-center gap-2">
              <GraduationCap className="w-5 h-5 text-sky-600 dark:text-sky-400" />
              একাডেমিক তথ্য
            </h2>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
            <GridField icon={IdCard} label="ছাত্র আইডি" value={user.academic.studentId} />
            <GridField icon={BookOpen} label="শ্রেণী" value={user.academic.className} />
            <GridField icon={BookOpen} label="শাখা" value={user.academic.sectionName} />
            <GridField icon={UserIcon} label="রোল নম্বর" value={user.academic.classRoll || "—"} />
            <GridField icon={Calendar} label="শিক্ষাবর্ষ" value={user.academic.academicYear} />
            <GridField
              icon={Calendar}
              label="ভর্তির তারিখ"
              value={
                user.academic.admissionDate
                  ? new Date(user.academic.admissionDate).toLocaleDateString("bn-BD", {
                      year: "numeric",
                      month: "long",
                      day: "numeric",
                    })
                  : "—"
              }
            />
          </div>
        </div>

        {/* Right: Personal + Institution */}
        <div className="space-y-4 sm:space-y-6">
          {/* Personal Info */}
          <div className="bg-white dark:bg-slate-900 rounded-2xl p-4 sm:p-6 shadow-sm border border-slate-200 dark:border-slate-800 space-y-4">
            <div className="border-b border-slate-100 dark:border-slate-800 pb-3">
              <h2 className="text-base sm:text-lg font-semibold text-slate-800 dark:text-slate-100 flex items-center gap-2">
                <UserIcon className="w-5 h-5 text-purple-600 dark:text-purple-400" />
                ব্যক্তিগত তথ্য
              </h2>
            </div>

            <div className="grid grid-cols-1 gap-2.5">
              <GridField icon={Mail} label="ইমেইল" value={user.email} />
              <GridField icon={Phone} label="ফোন" value={user.phone || "তথ্য নেই"} />
              <GridField icon={Droplet} label="রক্তের গ্রুপ" value={user.blood_group || "তথ্য নেই"} />
              <GridField icon={UserIcon} label="জন্ম তারিখ" value={user.dob || "তথ্য নেই"} />
              <GridField icon={UserIcon} label="পিতার নাম" value={user.father_name || "তথ্য নেই"} />
              <GridField icon={UserIcon} label="মাতার নাম" value={user.mother_name || "তথ্য নেই"} />
              <GridField icon={MapPin} label="ঠিকানা" value={user.address || "তথ্য নেই"} />
            </div>
          </div>

          {/* Institution Info */}
          <div className="bg-white dark:bg-slate-900 rounded-2xl p-4 sm:p-6 shadow-sm border border-slate-200 dark:border-slate-800 space-y-4">
            <div className="border-b border-slate-100 dark:border-slate-800 pb-3 flex items-center gap-3">
              {user.institution.logo ? (
                <img
                  src={user.institution.logo}
                  alt={user.institution.name}
                  className="w-10 h-10 rounded-lg object-cover border border-slate-200 dark:border-slate-700"
                />
              ) : (
                <div className="w-10 h-10 rounded-lg bg-gradient-to-br from-sky-500 to-blue-600 flex items-center justify-center text-white">
                  <Building className="w-5 h-5" />
                </div>
              )}
              <h2 className="text-base sm:text-lg font-semibold text-slate-800 dark:text-slate-100">
                প্রতিষ্ঠান
              </h2>
            </div>

            <div className="grid grid-cols-1 gap-2.5">
              <GridField icon={Building} label="প্রতিষ্ঠান" value={user.institution.name} />
              <GridField icon={MapPin} label="ঠিকানা" value={user.institution.address || "—"} />
              {user.institution.phone && (
                <GridField icon={Phone} label="ফোন" value={user.institution.phone} />
              )}
            </div>
          </div>

          {/* Account Info */}
          <div className="bg-white dark:bg-slate-900 rounded-2xl p-4 sm:p-6 shadow-sm border border-slate-200 dark:border-slate-800 space-y-3">
            <h2 className="text-base sm:text-lg font-semibold text-slate-800 dark:text-slate-100 border-b border-slate-100 dark:border-slate-800 pb-3 flex items-center gap-2">
              <Clock className="w-5 h-5 text-sky-600 dark:text-sky-400" />
              Account
            </h2>
            <div className="grid grid-cols-1 gap-2.5">
              <GridField icon={Calendar} label="যুক্ত হয়েছেন" value={user.joinedDate} />
              <GridField icon={Clock} label="সর্বশেষ লগইন" value={user.lastSignIn} />
            </div>
          </div>
        </div>
      </div>

      {passwordOpen && <PasswordModal onClose={() => setPasswordOpen(false)} />}
    </div>
  );
}

// ═══════════════ Grid Field ═══════════════
function GridField({
  icon: Icon,
  label,
  value,
}: {
  icon: React.ComponentType<{ className?: string }>;
  label: string;
  value: string;
}) {
  return (
    <div className="rounded-xl border border-slate-100 dark:border-slate-800 bg-slate-50/50 dark:bg-slate-800/30 p-3 hover:bg-slate-100 dark:hover:bg-slate-800/50 transition-colors">
      <div className="flex items-center gap-1.5 mb-1.5">
        <Icon className="w-3.5 h-3.5 text-sky-600 dark:text-sky-400 shrink-0" />
        <span className="text-[10px] font-semibold text-slate-500 dark:text-slate-400 uppercase tracking-wider">
          {label}
        </span>
      </div>
      <p className="text-sm font-medium text-slate-800 dark:text-slate-100 truncate" title={value}>
        {value}
      </p>
    </div>
  );
}

// ═══════════════ Password Modal ═══════════════
function PasswordModal({ onClose }: { onClose: () => void }) {
  const [newPassword, setNewPassword] = React.useState("");
  const [confirmPassword, setConfirmPassword] = React.useState("");
  const [saving, setSaving] = React.useState(false);
  const [showNew, setShowNew] = React.useState(false);
  const [showConfirm, setShowConfirm] = React.useState(false);

  const handleSave = async () => {
    if (newPassword.length < 6) {
      toast.error("পাসওয়ার্ড কমপক্ষে ৬ অক্ষর");
      return;
    }
    if (newPassword !== confirmPassword) {
      toast.error("পাসওয়ার্ড দুটি মিলছে না");
      return;
    }
    setSaving(true);
    const result = await changePassword(newPassword);
    setSaving(false);

    if (result.error) {
      toast.error(result.error);
      return;
    }
    toast.success("পাসওয়ার্ড পরিবর্তন সফল!");
    onClose();
  };

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm p-4"
      onClick={(e) => e.target === e.currentTarget && onClose()}
    >
      <div className="bg-white dark:bg-slate-900 rounded-2xl shadow-2xl max-w-md w-full">
        <div className="flex items-center justify-between p-4 sm:p-6 border-b border-slate-200 dark:border-slate-800">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-amber-100 dark:bg-amber-950/40 flex items-center justify-center">
              <Key className="w-5 h-5 text-amber-600 dark:text-amber-400" />
            </div>
            <div>
              <h3 className="text-lg font-bold text-slate-800 dark:text-slate-100">পাসওয়ার্ড পরিবর্তন</h3>
              <p className="text-xs text-slate-500 dark:text-slate-400">নতুন পাসওয়ার্ড সেট করুন</p>
            </div>
          </div>
          <button onClick={onClose} className="p-2 rounded-lg hover:bg-slate-100 dark:hover:bg-slate-800 transition">
            <X className="w-5 h-5 text-slate-500" />
          </button>
        </div>

        <div className="p-4 sm:p-6 space-y-4">
          <div>
            <label className="text-xs font-semibold text-slate-600 dark:text-slate-300 block mb-1">
              নতুন পাসওয়ার্ড
            </label>
            <div className="relative">
              <input
                type={showNew ? "text" : "password"}
                value={newPassword}
                onChange={(e) => setNewPassword(e.target.value)}
                className="w-full px-3 py-2 pr-10 text-sm rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-800 dark:text-slate-100 focus:ring-2 focus:ring-sky-500 outline-none"
                placeholder="••••••••"
              />
              <button
                type="button"
                onClick={() => setShowNew(!showNew)}
                className="absolute right-2 top-1/2 -translate-y-1/2 p-1 rounded-md hover:bg-slate-100 dark:hover:bg-slate-700 transition"
                tabIndex={-1}
              >
                {showNew ? (
                  <EyeOff className="w-4 h-4 text-slate-500 dark:text-slate-400" />
                ) : (
                  <Eye className="w-4 h-4 text-slate-500 dark:text-slate-400" />
                )}
              </button>
            </div>
          </div>

          <div>
            <label className="text-xs font-semibold text-slate-600 dark:text-slate-300 block mb-1">
              পাসওয়ার্ড নিশ্চিত করুন
            </label>
            <div className="relative">
              <input
                type={showConfirm ? "text" : "password"}
                value={confirmPassword}
                onChange={(e) => setConfirmPassword(e.target.value)}
                className="w-full px-3 py-2 pr-10 text-sm rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-800 dark:text-slate-100 focus:ring-2 focus:ring-sky-500 outline-none"
                placeholder="••••••••"
              />
              <button
                type="button"
                onClick={() => setShowConfirm(!showConfirm)}
                className="absolute right-2 top-1/2 -translate-y-1/2 p-1 rounded-md hover:bg-slate-100 dark:hover:bg-slate-700 transition"
                tabIndex={-1}
              >
                {showConfirm ? (
                  <EyeOff className="w-4 h-4 text-slate-500 dark:text-slate-400" />
                ) : (
                  <Eye className="w-4 h-4 text-slate-500 dark:text-slate-400" />
                )}
              </button>
            </div>
          </div>
        </div>

        <div className="flex gap-2 p-4 sm:p-6 border-t border-slate-200 dark:border-slate-800">
          <button
            onClick={onClose}
            className="flex-1 px-4 py-2 text-sm font-medium border border-slate-300 dark:border-slate-700 rounded-lg text-slate-700 dark:text-slate-200 hover:bg-slate-50 dark:hover:bg-slate-800 transition"
          >
            বাতিল
          </button>
          <button
            onClick={handleSave}
            disabled={saving}
            className="flex-1 px-4 py-2 text-sm font-medium bg-sky-600 hover:bg-sky-700 text-white rounded-lg transition disabled:opacity-50 flex items-center justify-center gap-2"
          >
            {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : <CheckCircle2 className="w-4 h-4" />}
            {saving ? "পরিবর্তন হচ্ছে..." : "পরিবর্তন করুন"}
          </button>
        </div>
      </div>
    </div>
  );
}