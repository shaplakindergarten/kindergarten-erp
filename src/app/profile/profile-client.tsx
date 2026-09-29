// src/app/profile/profile-client.tsx
"use client";

import * as React from "react";
import {
  User as UserIcon,
  Mail,
  Phone,
  ShieldCheck,
  Key,
  Edit,
  Building,
  MapPin,
  Calendar,
  Loader2,
  Camera,
  IdCard,
  Droplet,
  Clock,
  Save,
  X,
  CheckCircle2,
  Eye,
  EyeOff,
} from "lucide-react";
import { toast } from "sonner";
import { updateProfile, uploadAvatar, changePassword } from "./actions";

interface UserData {
  id: string;
  name: string;
  email: string;
  phone: string;
  role: string;
  avatar: string;
  nid_no: string;
  blood_group: string;
  gender: string;
  dob: string;
  father_name: string;
  mother_name: string;
  address: string;
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

export default function ProfileClient({ user: initialUser }: { user: UserData }) {
  const [user, setUser] = React.useState(initialUser);
  const [editOpen, setEditOpen] = React.useState(false);
  const [passwordOpen, setPasswordOpen] = React.useState(false);
  const [uploading, setUploading] = React.useState(false);

  const roleBadgeColor = React.useMemo(() => {
    const role = user.role.toLowerCase();
    if (role === "admin") return "bg-purple-100 text-purple-700 border-purple-200 dark:bg-purple-950/40 dark:text-purple-300 dark:border-purple-800";
    if (role === "teacher") return "bg-blue-100 text-blue-700 border-blue-200 dark:bg-blue-950/40 dark:text-blue-300 dark:border-blue-800";
    if (role === "accountant") return "bg-emerald-100 text-emerald-700 border-emerald-200 dark:bg-emerald-950/40 dark:text-emerald-300 dark:border-emerald-800";
    if (role === "store") return "bg-amber-100 text-amber-700 border-amber-200 dark:bg-amber-950/40 dark:text-amber-300 dark:border-amber-800";
    return "bg-slate-100 text-slate-700 border-slate-200 dark:bg-slate-800 dark:text-slate-300 dark:border-slate-700";
  }, [user.role]);

  const roleDisplay = user.role.charAt(0).toUpperCase() + user.role.slice(1);

  const handleAvatarUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    if (file.size > 3 * 1024 * 1024) {
      toast.error("ছবি ৩MB এর কম হতে হবে");
      return;
    }

    if (!["image/png", "image/jpeg", "image/jpg", "image/webp"].includes(file.type)) {
      toast.error("শুধু PNG, JPG, JPEG, WebP allowed");
      return;
    }

    setUploading(true);
    const result = await uploadAvatar(file);
    setUploading(false);

    if (result.error) {
      toast.error(result.error);
      return;
    }
    if (result.url) {
      setUser({ ...user, avatar: result.url });
      toast.success("প্রোফাইল ছবি আপডেট হয়েছে!");
    }
    e.target.value = "";
  };

  return (
    <div className="max-w-6xl mx-auto p-3 sm:p-6 lg:p-8 space-y-4 sm:space-y-6">
      {/* ═══════════════ PROFILE HEADER ═══════════════ */}
      <div className="bg-white dark:bg-slate-900 rounded-2xl shadow-sm border border-slate-200 dark:border-slate-800 overflow-hidden">
        {/* ✅ FIX: Professional Banner with Pattern */}
        <div className="h-16 sm:h-20 bg-gradient-to-br from-indigo-600 via-purple-600 to-fuchsia-600 relative overflow-hidden">
          {/* Subtle dot pattern overlay */}
          <div
            className="absolute inset-0 opacity-20"
            style={{
              backgroundImage: `radial-gradient(circle at 2px 2px, white 1.5px, transparent 0)`,
              backgroundSize: "24px 24px",
            }}
          />
          {/* Soft glow top-right */}
          <div className="absolute -top-12 -right-12 w-48 h-48 rounded-full bg-white/10 blur-3xl" />
          <div className="absolute -bottom-12 -left-12 w-32 h-32 rounded-full bg-white/5 blur-2xl" />
        </div>

        {/* Profile Info */}
        <div className="relative px-4 sm:px-6 pb-5 sm:pb-6 flex flex-col sm:flex-row items-center sm:items-end justify-between gap-4 -mt-14 sm:-mt-16">
          <div className="flex flex-col sm:flex-row items-center sm:items-end gap-4 sm:gap-5 text-center sm:text-left w-full sm:w-auto">
            {/* Avatar */}
            <div className="relative group shrink-0">
              <div className="w-24 h-24 sm:w-28 sm:h-28 rounded-full border-[3px] border-white dark:border-slate-900 bg-gradient-to-br from-purple-500 to-indigo-600 text-white font-bold text-3xl sm:text-4xl flex items-center justify-center shadow-xl ring-2 ring-purple-100 dark:ring-purple-950 overflow-hidden">
                {user.avatar ? (
                  <img src={user.avatar} alt={user.name} className="w-full h-full object-cover" />
                ) : (
                  user.name.charAt(0).toUpperCase()
                )}
              </div>
              <label
                htmlFor="avatar-upload"
                className="absolute inset-0 rounded-full bg-black/60 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center cursor-pointer text-white"
                title="ছবি পরিবর্তন করুন (সর্বোচ্চ 3MB)"
              >
                {uploading ? (
                  <Loader2 className="w-6 h-6 animate-spin" />
                ) : (
                  <Camera className="w-6 h-6" />
                )}
              </label>
              <input
                id="avatar-upload"
                type="file"
                accept="image/png,image/jpeg,image/jpg,image/webp"
                onChange={handleAvatarUpload}
                disabled={uploading}
                className="hidden"
              />
            </div>

            {/* Name + Role + Email */}
            <div className="mb-1 sm:mb-2 min-w-0">
              <div className="flex flex-col sm:flex-row items-center sm:items-center gap-2">
                <h1 className="text-xl sm:text-2xl font-bold text-slate-800 dark:text-slate-100 truncate">
                  {user.name}
                </h1>
                <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-semibold border shrink-0 ${roleBadgeColor}`}>
                  <ShieldCheck className="w-3.5 h-3.5 mr-1" />
                  {roleDisplay}
                </span>
              </div>
              <p className="text-sm text-slate-500 dark:text-slate-400 mt-0.5 truncate">
                {user.email}
              </p>
            </div>
          </div>

          {/* ✅ FIX: Mobile - side-by-side buttons */}
          <div className="flex flex-row sm:flex-row gap-2 w-full sm:w-auto">
            <button
              onClick={() => setPasswordOpen(true)}
              className="flex-1 sm:flex-none flex items-center justify-center gap-2 px-3 sm:px-4 py-2 text-xs sm:text-sm font-medium text-slate-700 dark:text-slate-200 bg-white dark:bg-slate-800 border border-slate-300 dark:border-slate-700 rounded-lg hover:bg-slate-50 dark:hover:bg-slate-700 transition shadow-sm whitespace-nowrap"
            >
              <Key className="w-3.5 h-3.5 sm:w-4 sm:h-4" />
              <span className="hidden xs:inline sm:inline">পাসওয়ার্ড</span>
              <span className="xs:hidden sm:hidden">পাসওয়ার্ড</span>
            </button>
            <button
              onClick={() => setEditOpen(true)}
              className="flex-1 sm:flex-none flex items-center justify-center gap-2 px-3 sm:px-4 py-2 text-xs sm:text-sm font-medium text-white bg-purple-600 rounded-lg hover:bg-purple-700 transition shadow-sm whitespace-nowrap"
            >
              <Edit className="w-3.5 h-3.5 sm:w-4 sm:h-4" />
              এডিট প্রোফাইল
            </button>
          </div>
        </div>
      </div>

      {/* ═══════════════ MAIN CONTENT GRID ═══════════════ */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4 sm:gap-6">
        {/* Personal Info */}
        <div className="lg:col-span-2 bg-white dark:bg-slate-900 rounded-2xl p-4 sm:p-6 shadow-sm border border-slate-200 dark:border-slate-800 space-y-4">
          <div className="border-b border-slate-100 dark:border-slate-800 pb-3">
            <h2 className="text-base sm:text-lg font-semibold text-slate-800 dark:text-slate-100 flex items-center gap-2">
              <UserIcon className="w-5 h-5 text-purple-600 dark:text-purple-400" />
              ব্যক্তিগত তথ্য
            </h2>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
            <GridField icon={UserIcon} label="পূর্ণ নাম" value={user.name} />
            <GridField icon={Mail} label="ইমেইল" value={user.email} />
            <GridField icon={Phone} label="ফোন নম্বর" value={user.phone || "তথ্য নেই"} />
            <GridField icon={ShieldCheck} label="ইউজার রোল" value={roleDisplay} />
            <GridField icon={IdCard} label="NID নাম্বার" value={user.nid_no || "তথ্য নেই"} />
            <GridField icon={Droplet} label="রক্তের গ্রুপ" value={user.blood_group || "তথ্য নেই"} />
            <GridField icon={UserIcon} label="পিতার নাম" value={user.father_name || "তথ্য নেই"} />
            <GridField icon={UserIcon} label="মাতার নাম" value={user.mother_name || "তথ্য নেই"} />
            <GridField icon={Calendar} label="জন্ম তারিখ" value={user.dob || "তথ্য নেই"} />
            <GridField icon={UserIcon} label="লিঙ্গ" value={user.gender || "তথ্য নেই"} />
            <div className="sm:col-span-2 lg:col-span-3">
              <GridField icon={MapPin} label="ঠিকানা" value={user.address || "তথ্য নেই"} />
            </div>
          </div>
        </div>

        {/* Right: Institution + Account */}
        <div className="space-y-4 sm:space-y-6">
          {/* Institution */}
          <div className="bg-white dark:bg-slate-900 rounded-2xl p-4 sm:p-6 shadow-sm border border-slate-200 dark:border-slate-800 space-y-4">
            <div className="border-b border-slate-100 dark:border-slate-800 pb-3 flex items-center gap-3">
              {user.institution.logo ? (
                <img
                  src={user.institution.logo}
                  alt={user.institution.name}
                  className="w-10 h-10 rounded-lg object-cover border border-slate-200 dark:border-slate-700"
                />
              ) : (
                <div className="w-10 h-10 rounded-lg bg-gradient-to-br from-purple-500 to-indigo-600 flex items-center justify-center text-white">
                  <Building className="w-5 h-5" />
                </div>
              )}
              <h2 className="text-base sm:text-lg font-semibold text-slate-800 dark:text-slate-100">
                প্রতিষ্ঠান তথ্য
              </h2>
            </div>

            <div className="grid grid-cols-1 gap-2.5">
              <GridField icon={Building} label="প্রতিষ্ঠান" value={user.institution.name} />
              <GridField icon={MapPin} label="ঠিকানা" value={user.institution.address || "—"} />
              {user.institution.phone && (
                <GridField icon={Phone} label="ফোন" value={user.institution.phone} />
              )}
              {user.institution.email && (
                <GridField icon={Mail} label="ইমেইল" value={user.institution.email} />
              )}
            </div>
          </div>

          {/* Account Info */}
          <div className="bg-white dark:bg-slate-900 rounded-2xl p-4 sm:p-6 shadow-sm border border-slate-200 dark:border-slate-800 space-y-3">
            <h2 className="text-base sm:text-lg font-semibold text-slate-800 dark:text-slate-100 border-b border-slate-100 dark:border-slate-800 pb-3 flex items-center gap-2">
              <Clock className="w-5 h-5 text-purple-600 dark:text-purple-400" />
              Account তথ্য
            </h2>
            <div className="grid grid-cols-1 gap-2.5">
              <GridField icon={Calendar} label="যুক্ত হয়েছেন" value={user.joinedDate} />
              <GridField icon={Clock} label="সর্বশেষ লগইন" value={user.lastSignIn} />
            </div>
          </div>
        </div>
      </div>

      {editOpen && (
        <EditProfileModal
          user={user}
          onClose={() => setEditOpen(false)}
          onSave={(updated) => {
            setUser({ ...user, ...updated });
            setEditOpen(false);
          }}
        />
      )}

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
        <Icon className="w-3.5 h-3.5 text-purple-600 dark:text-purple-400 shrink-0" />
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

// ═══════════════ Edit Profile Modal ═══════════════
function EditProfileModal({
  user,
  onClose,
  onSave,
}: {
  user: UserData;
  onClose: () => void;
  onSave: (updated: Partial<UserData>) => void;
}) {
  const [form, setForm] = React.useState({
    full_name: user.name,
    phone: user.phone,
    address: user.address,
    nid_no: user.nid_no,
    blood_group: user.blood_group,
    gender: user.gender,
    dob: user.dob,
    father_name: user.father_name,
    mother_name: user.mother_name,
  });
  const [saving, setSaving] = React.useState(false);

  const handleSave = async () => {
    setSaving(true);
    const result = await updateProfile({
      full_name: form.full_name,
      phone: form.phone,
      address: form.address,
      nid_no: form.nid_no,
      blood_group: form.blood_group,
      gender: form.gender,
      dob: form.dob,
      father_name: form.father_name,
      mother_name: form.mother_name,
    });
    setSaving(false);

    if (result.error) {
      toast.error(result.error);
      return;
    }
    toast.success("প্রোফাইল আপডেট হয়েছে!");
    onSave({
      name: form.full_name,
      phone: form.phone,
      address: form.address,
      nid_no: form.nid_no,
      blood_group: form.blood_group,
      gender: form.gender,
      dob: form.dob,
      father_name: form.father_name,
      mother_name: form.mother_name,
    });
  };

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm p-4"
      onClick={(e) => e.target === e.currentTarget && onClose()}
    >
      <div className="bg-white dark:bg-slate-900 rounded-2xl shadow-2xl max-w-2xl w-full max-h-[90vh] overflow-y-auto">
        <div className="flex items-center justify-between p-4 sm:p-6 border-b border-slate-200 dark:border-slate-800">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-purple-100 dark:bg-purple-950/40 flex items-center justify-center">
              <Edit className="w-5 h-5 text-purple-600 dark:text-purple-400" />
            </div>
            <div>
              <h3 className="text-lg font-bold text-slate-800 dark:text-slate-100">এডিট প্রোফাইল</h3>
              <p className="text-xs text-slate-500 dark:text-slate-400">আপনার তথ্য আপডেট করুন</p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-2 rounded-lg hover:bg-slate-100 dark:hover:bg-slate-800 transition"
          >
            <X className="w-5 h-5 text-slate-500" />
          </button>
        </div>

        <div className="p-4 sm:p-6 space-y-4">
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <ModalField label="পূর্ণ নাম" value={form.full_name} onChange={(v) => setForm({ ...form, full_name: v })} />
            <ModalField label="ফোন নম্বর" value={form.phone} onChange={(v) => setForm({ ...form, phone: v })} type="tel" />
            <ModalField label="NID নাম্বার" value={form.nid_no} onChange={(v) => setForm({ ...form, nid_no: v })} />
            <ModalField label="রক্তের গ্রুপ" value={form.blood_group} onChange={(v) => setForm({ ...form, blood_group: v })} />
            <ModalField label="পিতার নাম" value={form.father_name} onChange={(v) => setForm({ ...form, father_name: v })} />
            <ModalField label="মাতার নাম" value={form.mother_name} onChange={(v) => setForm({ ...form, mother_name: v })} />
            <ModalField label="জন্ম তারিখ" value={form.dob} onChange={(v) => setForm({ ...form, dob: v })} type="date" />
            <div>
              <label className="text-xs font-semibold text-slate-600 dark:text-slate-300 block mb-1">লিঙ্গ</label>
              <select
                value={form.gender}
                onChange={(e) => setForm({ ...form, gender: e.target.value })}
                className="w-full px-3 py-2 text-sm rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-800 dark:text-slate-100 focus:ring-2 focus:ring-purple-500 outline-none"
              >
                <option value="">নির্বাচন করুন</option>
                <option value="Male">পুরুষ</option>
                <option value="Female">মহিলা</option>
                <option value="Other">অন্যান্য</option>
              </select>
            </div>
            <div className="sm:col-span-2">
              <ModalField label="ঠিকানা" value={form.address} onChange={(v) => setForm({ ...form, address: v })} />
            </div>
          </div>
        </div>

        <div className="flex flex-col sm:flex-row gap-2 p-4 sm:p-6 border-t border-slate-200 dark:border-slate-800">
          <button
            onClick={onClose}
            disabled={saving}
            className="flex-1 px-4 py-2 text-sm font-medium border border-slate-300 dark:border-slate-700 rounded-lg text-slate-700 dark:text-slate-200 hover:bg-slate-50 dark:hover:bg-slate-800 transition disabled:opacity-50"
          >
            বাতিল
          </button>
          <button
            onClick={handleSave}
            disabled={saving}
            className="flex-1 px-4 py-2 text-sm font-medium bg-purple-600 hover:bg-purple-700 text-white rounded-lg transition disabled:opacity-50 flex items-center justify-center gap-2"
          >
            {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />}
            {saving ? "সেভ হচ্ছে..." : "সেভ করুন"}
          </button>
        </div>
      </div>
    </div>
  );
}

function ModalField({
  label,
  value,
  onChange,
  type = "text",
}: {
  label: string;
  value: string;
  onChange: (v: string) => void;
  type?: string;
}) {
  return (
    <div>
      <label className="text-xs font-semibold text-slate-600 dark:text-slate-300 block mb-1">
        {label}
      </label>
      <input
        type={type}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        className="w-full px-3 py-2 text-sm rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-800 dark:text-slate-100 focus:ring-2 focus:ring-purple-500 outline-none"
      />
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
          {/* ✅ New Password with Eye Toggle */}
          <div>
            <label className="text-xs font-semibold text-slate-600 dark:text-slate-300 block mb-1">
              নতুন পাসওয়ার্ড
            </label>
            <div className="relative">
              <input
                type={showNew ? "text" : "password"}
                value={newPassword}
                onChange={(e) => setNewPassword(e.target.value)}
                className="w-full px-3 py-2 pr-10 text-sm rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-800 dark:text-slate-100 focus:ring-2 focus:ring-purple-500 outline-none"
                placeholder="••••••••"
              />
              <button
                type="button"
                onClick={() => setShowNew(!showNew)}
                className="absolute right-2 top-1/2 -translate-y-1/2 p-1 rounded-md hover:bg-slate-100 dark:hover:bg-slate-700 transition"
                aria-label={showNew ? "Hide password" : "Show password"}
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

          {/* ✅ Confirm Password with Eye Toggle */}
          <div>
            <label className="text-xs font-semibold text-slate-600 dark:text-slate-300 block mb-1">
              পাসওয়ার্ড নিশ্চিত করুন
            </label>
            <div className="relative">
              <input
                type={showConfirm ? "text" : "password"}
                value={confirmPassword}
                onChange={(e) => setConfirmPassword(e.target.value)}
                className="w-full px-3 py-2 pr-10 text-sm rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-800 dark:text-slate-100 focus:ring-2 focus:ring-purple-500 outline-none"
                placeholder="••••••••"
              />
              <button
                type="button"
                onClick={() => setShowConfirm(!showConfirm)}
                className="absolute right-2 top-1/2 -translate-y-1/2 p-1 rounded-md hover:bg-slate-100 dark:hover:bg-slate-700 transition"
                aria-label={showConfirm ? "Hide password" : "Show password"}
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

          {/* Password strength hint */}
          {newPassword.length > 0 && (
            <div className="text-[11px] text-slate-500 dark:text-slate-400">
              শক্তি:{" "}
              <span
                className={
                  newPassword.length < 6
                    ? "text-red-500 font-semibold"
                    : newPassword.length < 10
                    ? "text-amber-500 font-semibold"
                    : "text-emerald-500 font-semibold"
                }
              >
                {newPassword.length < 6 ? "দুর্বল" : newPassword.length < 10 ? "মধ্যম" : "শক্তিশালী"}
              </span>
            </div>
          )}
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
            className="flex-1 px-4 py-2 text-sm font-medium bg-amber-600 hover:bg-amber-700 text-white rounded-lg transition disabled:opacity-50 flex items-center justify-center gap-2"
          >
            {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : <CheckCircle2 className="w-4 h-4" />}
            {saving ? "পরিবর্তন হচ্ছে..." : "পরিবর্তন করুন"}
          </button>
        </div>
      </div>
    </div>
  );
}