// src/app/staff/salary/notifications/page.tsx
"use client";

import { useState, useEffect, useRef, useCallback, useMemo } from "react";
import { useRouter } from "next/navigation";
import { 
  ArrowLeft, Bell, Mail, Phone, MessageSquare, 
  Send, Eye, Trash2, CheckCircle, AlertCircle,
  DollarSign, Calendar, Users, TrendingUp, CreditCard,
  Search, Filter, Download, Printer, Settings,
  Clock, UserCheck, Award, Rocket
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Textarea } from "@/components/ui/textarea";
import { Switch } from "@/components/ui/switch";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogTrigger,
} from "@/components/ui/dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { ResponsiveLayout } from "@/components/layout/responsive-layout";
import { getStaff } from "@/lib/api/staff";
import { useToastStore } from "@/store/useStore";
import { createClient } from "@/lib/supabase/client";
import { formatCurrency, months, getCurrentMonth, getCurrentYear } from "@/lib/salary/salaryUtils";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { motion } from "framer-motion";
import * as XLSX from "xlsx";

interface Notification {
  id: string;
  staff_id: string;
  staff_name: string;
  staff_employee_id: string;
  staff_photo_url?: string;
  type: 'payment' | 'advance' | 'increment' | 'promotion' | 'general';
  title: string;
  message: string;
  sent_via: 'sms' | 'email' | 'both';
  sent_at: string;
  status: 'sent' | 'pending' | 'failed';
  is_read: boolean;
}

interface NotificationSettings {
  id: string;
  enable_sms: boolean;
  enable_email: boolean;
  payment_notification: boolean;
  advance_notification: boolean;
  increment_notification: boolean;
  promotion_notification: boolean;
  sms_api_key?: string;
  sms_sender_id?: string;
  email_host?: string;
  email_port?: string;
  email_user?: string;
  email_pass?: string;
}

interface SchoolSettings {
  id: number;
  school_name: string;
  school_address: string;
  school_phone: string;
  school_email: string;
  school_logo: string;
}

// ============================================================
// NUMBER INPUT WITH BENGALI SUPPORT
// ============================================================

const convertBengaliToEnglish = (str: string): string => {
  const bengaliDigits = ['০', '১', '২', '৩', '৪', '৫', '৬', '৭', '৮', '৯'];
  const englishDigits = ['0', '1', '2', '3', '4', '5', '6', '7', '8', '9'];
  
  let result = '';
  for (let char of str) {
    const index = bengaliDigits.indexOf(char);
    if (index !== -1) {
      result += englishDigits[index];
    } else {
      result += char;
    }
  }
  return result;
};

const useNumberInput = (initialValue: string = '') => {
  const [value, setValue] = useState(initialValue);
  const [displayValue, setDisplayValue] = useState(initialValue);
  const inputRef = useRef<HTMLInputElement>(null);

  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    let rawValue = e.target.value;
    let englishValue = convertBengaliToEnglish(rawValue);
    const cleaned = englishValue.replace(/[^0-9.]/g, '');
    const parts = cleaned.split('.');
    let finalValue = cleaned;
    if (parts.length > 2) {
      finalValue = parts[0] + '.' + parts.slice(1).join('');
    }
    setValue(finalValue);
    setDisplayValue(rawValue);
  };

  const handleFocus = () => {
    if (value === '0' || value === '0.00' || value === '') {
      setValue('');
      setDisplayValue('');
    }
    setTimeout(() => {
      if (inputRef.current) {
        inputRef.current.select();
      }
    }, 10);
  };

  const handleBlur = () => {
    if (value === '' || value === '.') {
      setValue('0');
      setDisplayValue('0');
    }
  };

  return {
    value,
    displayValue,
    setValue,
    setDisplayValue,
    handleChange,
    handleFocus,
    handleBlur,
    inputRef
  };
};

// ============================================================
// MAIN COMPONENT
// ============================================================

export default function NotificationsPage() {
  const router = useRouter();
  const [staff, setStaff] = useState<any[]>([]);
  const [notifications, setNotifications] = useState<Notification[]>([]);
  const [settings, setSettings] = useState<NotificationSettings | null>(null);
  const [loading, setLoading] = useState(true);
  const [sendDialogOpen, setSendDialogOpen] = useState(false);
  const [viewDialogOpen, setViewDialogOpen] = useState(false);
  const [settingsDialogOpen, setSettingsDialogOpen] = useState(false);
  const [selectedNotification, setSelectedNotification] = useState<Notification | null>(null);
  const [searchTerm, setSearchTerm] = useState("");
  const [filterType, setFilterType] = useState("all");
  const [schoolSettings, setSchoolSettings] = useState<SchoolSettings | null>(null);
  const [settingsLoading, setSettingsLoading] = useState(true);
  
  const [sendForm, setSendForm] = useState({
    staff_id: "",
    type: "general",
    title: "",
    message: "",
    sent_via: "email",
  });

  const [settingsForm, setSettingsForm] = useState({
    enable_sms: false,
    enable_email: true,
    payment_notification: true,
    advance_notification: true,
    increment_notification: true,
    promotion_notification: true,
    sms_api_key: "",
    sms_sender_id: "",
    email_host: "",
    email_port: "",
    email_user: "",
    email_pass: "",
  });

  const addToast = useToastStore((state) => state.addToast);

  // ============================================================
  // LOAD FUNCTIONS
  // ============================================================

  const loadSchoolSettings = useCallback(async () => {
    setSettingsLoading(true);
    try {
      const supabase = createClient();
      const { data, error } = await supabase
        .from("school_settings")
        .select("*")
        .limit(1)
        .single();
      
      if (error || !data) {
        setSchoolSettings({
          id: 0,
          school_name: "চে আলী মডেল একাডেমী",
          school_address: "Nowtala, Madhaiya Bazar, Chandina, Cumilla",
          school_phone: "01923253454",
          school_email: "shapla.kindergarten@gmail.com",
          school_logo: "",
        });
      } else {
        setSchoolSettings(data);
      }
    } catch (error) {
      console.error("Error loading school settings:", error);
      setSchoolSettings({
        id: 0,
        school_name: "চে আলী মডেল একাডেমী",
        school_address: "Nowtala, Madhaiya Bazar, Chandina, Cumilla",
        school_phone: "01923253454",
        school_email: "shapla.kindergarten@gmail.com",
        school_logo: "",
      });
    } finally {
      setSettingsLoading(false);
    }
  }, []);

  const loadData = useCallback(async () => {
    setLoading(true);
    try {
      const supabase = createClient();
      const [staffData, notificationsData] = await Promise.all([
        getStaff(),
        supabase
          .from("salary_notifications")
          .select("*, staff:staff_id(name, employee_id, photo_url)")
          .order("sent_at", { ascending: false }),
      ]);
      
      setStaff(staffData || []);
      
      const mappedNotifications = (notificationsData.data || []).map((not: any) => ({
        id: not.id,
        staff_id: not.staff_id,
        staff_name: not.staff?.name || "",
        staff_employee_id: not.staff?.employee_id || "",
        staff_photo_url: not.staff?.photo_url || "",
        type: not.type,
        title: not.title,
        message: not.message,
        sent_via: not.sent_via,
        sent_at: not.sent_at,
        status: not.status,
        is_read: not.is_read || false,
      }));
      
      setNotifications(mappedNotifications);
      
    } catch (err) {
      console.error("Failed to load data:", err);
      addToast({ type: "error", title: "Error", message: "Failed to load notifications" });
    } finally {
      setLoading(false);
    }
  }, [addToast]);

  const loadSettings = useCallback(async () => {
    try {
      const supabase = createClient();
      const { data } = await supabase
        .from("notification_settings")
        .select("*")
        .single();
      
      if (data) {
        setSettings(data);
        setSettingsForm({
          enable_sms: data.enable_sms || false,
          enable_email: data.enable_email !== false,
          payment_notification: data.payment_notification !== false,
          advance_notification: data.advance_notification !== false,
          increment_notification: data.increment_notification !== false,
          promotion_notification: data.promotion_notification !== false,
          sms_api_key: data.sms_api_key || "",
          sms_sender_id: data.sms_sender_id || "",
          email_host: data.email_host || "",
          email_port: data.email_port || "",
          email_user: data.email_user || "",
          email_pass: data.email_pass || "",
        });
      }
    } catch (err) {
      console.error("Failed to load settings:", err);
    }
  }, []);

  useEffect(() => {
    loadData();
    loadSettings();
    loadSchoolSettings();
  }, [loadData, loadSettings, loadSchoolSettings]);

  // ============================================================
  // HANDLERS
  // ============================================================

  const saveSettings = useCallback(async () => {
    try {
      const supabase = createClient();
      const { error } = await supabase
        .from("notification_settings")
        .upsert({
          id: settings?.id || crypto.randomUUID(),
          ...settingsForm,
          updated_at: new Date().toISOString(),
        });
      
      if (error) throw error;
      
      addToast({ type: "success", title: "Success", message: "Settings saved successfully" });
      setSettingsDialogOpen(false);
      await loadSettings();
    } catch (err) {
      console.error(err);
      addToast({ type: "error", title: "Error", message: "Failed to save settings" });
    }
  }, [settingsForm, settings, addToast, loadSettings]);

  const sendNotification = useCallback(async () => {
    if (!sendForm.staff_id || !sendForm.title || !sendForm.message) {
      addToast({ type: "error", title: "Error", message: "Please fill all required fields" });
      return;
    }

    try {
      const supabase = createClient();
      const staffMember = staff.find(s => s.id === sendForm.staff_id);
      
      const notificationData = {
        staff_id: sendForm.staff_id,
        type: sendForm.type,
        title: sendForm.title,
        message: sendForm.message,
        sent_via: sendForm.sent_via,
        sent_at: new Date().toISOString(),
        status: 'sent',
        is_read: false,
      };
      
      const { error } = await supabase
        .from("salary_notifications")
        .insert(notificationData);
      
      if (error) throw error;
      
      addToast({ 
        type: "success", 
        title: "Success", 
        message: `Notification sent to ${staffMember?.name} via ${sendForm.sent_via}` 
      });
      
      setSendDialogOpen(false);
      setSendForm({
        staff_id: "",
        type: "general",
        title: "",
        message: "",
        sent_via: "email",
      });
      await loadData();
    } catch (err) {
      console.error(err);
      addToast({ type: "error", title: "Error", message: "Failed to send notification" });
    }
  }, [sendForm, staff, addToast, loadData]);

  const markAsRead = useCallback(async (id: string) => {
    try {
      const supabase = createClient();
      await supabase
        .from("salary_notifications")
        .update({ is_read: true })
        .eq("id", id);
      
      await loadData();
    } catch (err) {
      console.error(err);
    }
  }, [loadData]);

  const deleteNotification = useCallback(async (id: string) => {
    if (!confirm("Are you sure you want to delete this notification?")) return;
    
    try {
      const supabase = createClient();
      await supabase.from("salary_notifications").delete().eq("id", id);
      addToast({ type: "success", title: "Success", message: "Notification deleted" });
      await loadData();
    } catch (err) {
      console.error(err);
      addToast({ type: "error", title: "Error", message: "Failed to delete notification" });
    }
  }, [addToast, loadData]);

  // ============================================================
  // UTILITY FUNCTIONS
  // ============================================================

  const getTypeIcon = (type: string) => {
    switch (type) {
      case 'payment': return <DollarSign className="h-4 w-4 text-emerald-500" />;
      case 'advance': return <CreditCard className="h-4 w-4 text-orange-500" />;
      case 'increment': return <TrendingUp className="h-4 w-4 text-blue-500" />;
      case 'promotion': return <Award className="h-4 w-4 text-purple-500" />;
      default: return <Bell className="h-4 w-4 text-gray-500" />;
    }
  };

  const getTypeBadge = (type: string) => {
    const styles: Record<string, string> = {
      payment: 'bg-emerald-100 text-emerald-800 dark:bg-emerald-900/30 dark:text-emerald-400',
      advance: 'bg-orange-100 text-orange-800 dark:bg-orange-900/30 dark:text-orange-400',
      increment: 'bg-blue-100 text-blue-800 dark:bg-blue-900/30 dark:text-blue-400',
      promotion: 'bg-purple-100 text-purple-800 dark:bg-purple-900/30 dark:text-purple-400',
      general: 'bg-gray-100 text-gray-800 dark:bg-gray-800 dark:text-gray-400',
    };
    return styles[type] || styles.general;
  };

  // ============================================================
  // FILTERED DATA & STATISTICS
  // ============================================================

  const filteredNotifications = useMemo(() => {
    return notifications.filter(not => {
      if (searchTerm && !not.staff_name.toLowerCase().includes(searchTerm.toLowerCase())) return false;
      if (filterType !== "all" && not.type !== filterType) return false;
      return true;
    });
  }, [notifications, searchTerm, filterType]);

  const unreadCount = useMemo(() => notifications.filter(n => !n.is_read).length, [notifications]);

  const statistics = useMemo(() => ({
    total: notifications.length,
    unread: unreadCount,
    payment: notifications.filter(n => n.type === 'payment').length,
    advance: notifications.filter(n => n.type === 'advance').length,
    increment: notifications.filter(n => n.type === 'increment').length,
    promotion: notifications.filter(n => n.type === 'promotion').length,
  }), [notifications, unreadCount]);

  const stats = useMemo(() => [
    { 
      title: "Total", 
      value: statistics.total, 
      icon: Bell,
      bgGradient: "from-blue-50 to-blue-100 dark:from-blue-950/30 dark:to-blue-900/30",
      iconBg: "bg-blue-500 dark:bg-blue-600",
      textColor: "text-gray-900 dark:text-white"
    },
    { 
      title: "Unread", 
      value: statistics.unread, 
      icon: Bell,
      bgGradient: "from-rose-50 to-rose-100 dark:from-rose-950/30 dark:to-rose-900/30",
      iconBg: "bg-rose-500 dark:bg-rose-600",
      textColor: "text-gray-900 dark:text-white"
    },
    { 
      title: "Payment", 
      value: statistics.payment, 
      icon: DollarSign,
      bgGradient: "from-emerald-50 to-emerald-100 dark:from-emerald-950/30 dark:to-emerald-900/30",
      iconBg: "bg-emerald-500 dark:bg-emerald-600",
      textColor: "text-gray-900 dark:text-white"
    },
    { 
      title: "Advance", 
      value: statistics.advance, 
      icon: CreditCard,
      bgGradient: "from-orange-50 to-orange-100 dark:from-orange-950/30 dark:to-orange-900/30",
      iconBg: "bg-orange-500 dark:bg-orange-600",
      textColor: "text-gray-900 dark:text-white"
    },
    { 
      title: "Increment", 
      value: statistics.increment, 
      icon: TrendingUp,
      bgGradient: "from-blue-50 to-blue-100 dark:from-blue-950/30 dark:to-blue-900/30",
      iconBg: "bg-blue-500 dark:bg-blue-600",
      textColor: "text-gray-900 dark:text-white"
    },
    { 
      title: "Promotion", 
      value: statistics.promotion, 
      icon: Award,
      bgGradient: "from-purple-50 to-purple-100 dark:from-purple-950/30 dark:to-purple-900/30",
      iconBg: "bg-purple-500 dark:bg-purple-600",
      textColor: "text-gray-900 dark:text-white"
    },
  ], [statistics]);

  const notificationTypes = [
    { value: "payment", label: "Salary Payment", icon: DollarSign },
    { value: "advance", label: "Advance & Loan", icon: CreditCard },
    { value: "increment", label: "Salary Increment", icon: TrendingUp },
    { value: "promotion", label: "Promotion", icon: Award },
    { value: "general", label: "General", icon: Bell },
  ];

  const handleExportExcel = useCallback(() => {
    const exportData = filteredNotifications.map(item => ({
      "Staff Name": item.staff_name,
      "Staff ID": item.staff_employee_id,
      "Type": item.type,
      "Title": item.title,
      "Message": item.message,
      "Sent Via": item.sent_via,
      "Sent At": new Date(item.sent_at).toLocaleString(),
      "Status": item.status,
      "Read": item.is_read ? "Yes" : "No",
    }));

    const ws = XLSX.utils.json_to_sheet(exportData);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, "Notifications");
    XLSX.writeFile(wb, `notifications_${new Date().toISOString().split("T")[0]}.xlsx`);
  }, [filteredNotifications]);

  if (settingsLoading) {
    return (
      <ResponsiveLayout>
        <div className="flex items-center justify-center h-64">
          <div className="text-center">
            <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-emerald-600 mx-auto"></div>
            <p className="mt-4 text-gray-600 dark:text-gray-400">Loading...</p>
          </div>
        </div>
      </ResponsiveLayout>
    );
  }

  return (
    <ResponsiveLayout>
      <div className="space-y-6 p-4 sm:p-6">
        {/* Header - Vibrant Gradient */}
        <motion.div
          initial={{ opacity: 0, y: -20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.5 }}
          className="relative overflow-hidden rounded-2xl bg-gradient-to-r from-emerald-600 via-teal-600 to-cyan-600 dark:from-emerald-700 dark:via-teal-700 dark:to-cyan-700 p-6 shadow-xl"
        >
          <div className="absolute inset-0 bg-white/10 dark:bg-white/5 backdrop-blur-sm"></div>
          <div className="relative flex items-center justify-between flex-wrap gap-4">
            <div className="flex items-center gap-4">
              <Button 
                variant="ghost" 
                size="icon" 
                onClick={() => router.back()} 
                className="rounded-xl bg-white/20 hover:bg-white/30 text-white border-0"
              >
                <ArrowLeft className="h-5 w-5" />
              </Button>
              <div>
                <h1 className="text-2xl md:text-3xl font-bold text-white drop-shadow-lg">
                  Notifications
                </h1>
                <p className="text-white/80 text-sm drop-shadow">Salary notification management system</p>
              </div>
            </div>
            <div className="flex gap-2">
              <Button 
                variant="outline" 
                onClick={() => setSettingsDialogOpen(true)} 
                className="rounded-xl bg-white/20 hover:bg-white/30 text-white border-0 backdrop-blur-sm"
              >
                <Settings className="h-4 w-4 mr-2" /> Settings
              </Button>
              <Button 
                variant="outline" 
                onClick={handleExportExcel} 
                className="rounded-xl bg-white/20 hover:bg-white/30 text-white border-0 backdrop-blur-sm"
              >
                <Download className="h-4 w-4 mr-2" /> Export
              </Button>
              <Dialog open={sendDialogOpen} onOpenChange={setSendDialogOpen}>
                <DialogTrigger asChild>
                  <Button className="rounded-xl bg-white/20 hover:bg-white/30 text-white border-0 backdrop-blur-sm">
                    <Send className="h-4 w-4 mr-2" /> Send Notification
                  </Button>
                </DialogTrigger>
                <DialogContent className="rounded-2xl max-w-md bg-white dark:bg-gray-900 border-0 shadow-2xl max-h-[90vh] overflow-y-auto">
                  <DialogHeader className="sticky top-0 bg-white dark:bg-gray-900 z-10 pt-2 pb-4 border-b border-gray-200 dark:border-gray-700">
                    <DialogTitle className="text-gray-900 dark:text-white">Send Notification</DialogTitle>
                    <DialogDescription className="text-gray-600 dark:text-gray-400">
                      Send notification to staff members
                    </DialogDescription>
                  </DialogHeader>
                  <div className="space-y-4 pt-4">
                    <div>
                      <Label className="text-gray-700 dark:text-gray-300">Recipient *</Label>
                      <Select value={sendForm.staff_id} onValueChange={(v) => setSendForm({ ...sendForm, staff_id: v })}>
                        <SelectTrigger className="rounded-xl bg-white dark:bg-gray-800 border-gray-300 dark:border-gray-600 text-gray-900 dark:text-white">
                          <SelectValue placeholder="Select staff member" />
                        </SelectTrigger>
                        <SelectContent className="bg-white dark:bg-gray-800 border-gray-300 dark:border-gray-600">
                          {staff.map((s) => (
                            <SelectItem key={s.id} value={s.id} className="text-gray-900 dark:text-white">
                              {s.employee_id} - {s.name}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>
                    <div>
                      <Label className="text-gray-700 dark:text-gray-300">Type *</Label>
                      <Select value={sendForm.type} onValueChange={(v) => setSendForm({ ...sendForm, type: v })}>
                        <SelectTrigger className="rounded-xl bg-white dark:bg-gray-800 border-gray-300 dark:border-gray-600 text-gray-900 dark:text-white">
                          <SelectValue placeholder="Select type" />
                        </SelectTrigger>
                        <SelectContent className="bg-white dark:bg-gray-800 border-gray-300 dark:border-gray-600">
                          {notificationTypes.map((type) => (
                            <SelectItem key={type.value} value={type.value} className="text-gray-900 dark:text-white">
                              <div className="flex items-center gap-2">
                                <type.icon className="h-4 w-4" />
                                {type.label}
                              </div>
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>
                    <div>
                      <Label className="text-gray-700 dark:text-gray-300">Title *</Label>
                      <Input
                        value={sendForm.title}
                        onChange={(e) => setSendForm({ ...sendForm, title: e.target.value })}
                        placeholder="Notification title"
                        className="rounded-xl bg-white dark:bg-gray-800 border-gray-300 dark:border-gray-600 text-gray-900 dark:text-white placeholder-gray-400 dark:placeholder-gray-500"
                      />
                    </div>
                    <div>
                      <Label className="text-gray-700 dark:text-gray-300">Message *</Label>
                      <Textarea
                        value={sendForm.message}
                        onChange={(e) => setSendForm({ ...sendForm, message: e.target.value })}
                        placeholder="Detailed message"
                        className="rounded-xl min-h-[100px] bg-white dark:bg-gray-800 border-gray-300 dark:border-gray-600 text-gray-900 dark:text-white placeholder-gray-400 dark:placeholder-gray-500"
                      />
                    </div>
                    <div>
                      <Label className="text-gray-700 dark:text-gray-300">Send Via *</Label>
                      <Select value={sendForm.sent_via} onValueChange={(v) => setSendForm({ ...sendForm, sent_via: v })}>
                        <SelectTrigger className="rounded-xl bg-white dark:bg-gray-800 border-gray-300 dark:border-gray-600 text-gray-900 dark:text-white">
                          <SelectValue placeholder="Select method" />
                        </SelectTrigger>
                        <SelectContent className="bg-white dark:bg-gray-800 border-gray-300 dark:border-gray-600">
                          <SelectItem value="email" className="text-gray-900 dark:text-white">Email</SelectItem>
                          <SelectItem value="sms" className="text-gray-900 dark:text-white">SMS</SelectItem>
                          <SelectItem value="both" className="text-gray-900 dark:text-white">Both (Email + SMS)</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>
                    <div className="flex justify-end gap-2 sticky bottom-0 bg-white dark:bg-gray-900 py-3 border-t border-gray-200 dark:border-gray-700">
                      <Button variant="outline" onClick={() => setSendDialogOpen(false)} className="rounded-xl border-gray-300 dark:border-gray-600 text-gray-700 dark:text-gray-300">
                        Cancel
                      </Button>
                      <Button onClick={sendNotification} className="rounded-xl bg-gradient-to-r from-emerald-600 to-teal-600 text-white">
                        <Send className="h-4 w-4 mr-2" /> Send
                      </Button>
                    </div>
                  </div>
                </DialogContent>
              </Dialog>
            </div>
          </div>
        </motion.div>

        {/* Statistics Cards - Modern & Vibrant */}
        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3">
          {stats.map((stat, idx) => (
            <motion.div
              key={stat.title}
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.4, delay: idx * 0.08 }}
            >
              <Card className="border-0 shadow-lg rounded-2xl overflow-hidden hover:shadow-xl transition-all duration-300 hover:-translate-y-1 bg-white dark:bg-gray-800">
                <div className={`bg-gradient-to-br ${stat.bgGradient} p-3 text-center`}>
                  <div className="flex justify-center mb-1">
                    <div className={`p-2 rounded-xl ${stat.iconBg} shadow-lg`}>
                      <stat.icon className="h-4 w-4 text-white" />
                    </div>
                  </div>
                  <p className={`text-xl font-bold ${stat.textColor}`}>
                    {stat.value}
                  </p>
                  <p className="text-xs font-medium text-gray-600 dark:text-gray-300">{stat.title}</p>
                </div>
              </Card>
            </motion.div>
          ))}
        </div>

        {/* Filters */}
        <Card className="border-0 shadow-md rounded-2xl bg-white dark:bg-gray-800">
          <CardContent className="p-4">
            <div className="flex flex-col sm:flex-row gap-4">
              <div className="flex-1 relative">
                <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-gray-400 dark:text-gray-500" />
                <Input
                  placeholder="Search by staff name..."
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  className="pl-10 rounded-xl bg-white dark:bg-gray-900 border-gray-300 dark:border-gray-600 text-gray-900 dark:text-white placeholder-gray-400 dark:placeholder-gray-500"
                />
              </div>
              <Select value={filterType} onValueChange={setFilterType}>
                <SelectTrigger className="w-[150px] rounded-xl bg-white dark:bg-gray-900 border-gray-300 dark:border-gray-600 text-gray-900 dark:text-white">
                  <Filter className="h-4 w-4 mr-2" />
                  <SelectValue placeholder="Type" />
                </SelectTrigger>
                <SelectContent className="bg-white dark:bg-gray-800 border-gray-300 dark:border-gray-600">
                  <SelectItem value="all" className="text-gray-900 dark:text-white">All</SelectItem>
                  {notificationTypes.map((type) => (
                    <SelectItem key={type.value} value={type.value} className="text-gray-900 dark:text-white">
                      {type.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </CardContent>
        </Card>

        {/* Notifications Table - Modern Header */}
        <Card className="border-0 shadow-lg rounded-2xl overflow-hidden bg-white dark:bg-gray-800">
          <div className="bg-gradient-to-r from-emerald-500 to-teal-500 dark:from-emerald-600 dark:to-teal-600 p-4">
            <CardHeader className="p-0">
              <CardTitle className="text-white text-lg font-semibold">Notification History</CardTitle>
              <CardDescription className="text-white/70 text-sm">Complete notification history</CardDescription>
            </CardHeader>
          </div>
          <CardContent className="p-0 sm:p-6 overflow-x-auto">
            {loading ? (
              <div className="text-center py-8 text-gray-500 dark:text-gray-400">Loading...</div>
            ) : filteredNotifications.length === 0 ? (
              <div className="text-center py-12">
                <Bell className="h-12 w-12 mx-auto text-gray-300 dark:text-gray-600 mb-3" />
                <p className="text-gray-500 dark:text-gray-400">No notifications found</p>
              </div>
            ) : (
              <div className="overflow-x-auto">
                <Table>
                  <TableHeader>
                    <TableRow className="bg-gradient-to-r from-emerald-500 to-teal-500 dark:from-emerald-600 dark:to-teal-600">
                      <TableHead className="text-white text-xs sm:text-sm font-semibold">Recipient</TableHead>
                      <TableHead className="text-white text-xs sm:text-sm font-semibold">Type</TableHead>
                      <TableHead className="text-white text-xs sm:text-sm font-semibold">Title</TableHead>
                      <TableHead className="text-white text-xs sm:text-sm font-semibold hidden md:table-cell">Date</TableHead>
                      <TableHead className="text-white text-xs sm:text-sm font-semibold hidden lg:table-cell">Via</TableHead>
                      <TableHead className="text-white text-xs sm:text-sm font-semibold">Status</TableHead>
                      <TableHead className="text-center text-white text-xs sm:text-sm font-semibold">Actions</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {filteredNotifications.map((not, idx) => (
                      <motion.tr
                        key={not.id}
                        initial={{ opacity: 0, x: -20 }}
                        animate={{ opacity: 1, x: 0 }}
                        transition={{ duration: 0.3, delay: idx * 0.03 }}
                        className={`hover:bg-gray-50 dark:hover:bg-gray-700/50 transition-colors border-b border-gray-100 dark:border-gray-700 ${!not.is_read ? 'bg-emerald-50/30 dark:bg-emerald-900/20' : ''}`}
                      >
                        <TableCell>
                          <div className="flex items-center gap-2">
                            <Avatar className="h-8 w-8">
                              <AvatarImage src={not.staff_photo_url} />
                              <AvatarFallback className="bg-gradient-to-r from-emerald-500 to-teal-500 text-white text-xs">
                                {not.staff_name?.charAt(0).toUpperCase()}
                              </AvatarFallback>
                            </Avatar>
                            <div>
                              <p className="font-medium text-sm text-gray-900 dark:text-white">{not.staff_name}</p>
                              <p className="text-xs text-gray-500 dark:text-gray-400">{not.staff_employee_id}</p>
                            </div>
                          </div>
                        </TableCell>
                        <TableCell>
                          <Badge className={`rounded-xl ${getTypeBadge(not.type)}`}>
                            <span className="flex items-center gap-1">
                              {getTypeIcon(not.type)}
                              {not.type}
                            </span>
                          </Badge>
                        </TableCell>
                        <TableCell>
                          <div>
                            <p className="text-sm font-medium text-gray-900 dark:text-white">{not.title}</p>
                            <p className="text-xs text-gray-500 dark:text-gray-400 truncate max-w-[200px]">{not.message}</p>
                          </div>
                        </TableCell>
                        <TableCell className="text-sm text-gray-700 dark:text-gray-300 hidden md:table-cell">
                          {new Date(not.sent_at).toLocaleDateString("en-CA")}
                        </TableCell>
                        <TableCell className="text-sm text-gray-700 dark:text-gray-300 hidden lg:table-cell capitalize">{not.sent_via}</TableCell>
                        <TableCell>
                          {not.is_read ? (
                            <Badge className="bg-emerald-100 text-emerald-800 dark:bg-emerald-900/30 dark:text-emerald-400 rounded-xl">Read</Badge>
                          ) : (
                            <Badge className="bg-blue-100 text-blue-800 dark:bg-blue-900/30 dark:text-blue-400 rounded-xl">Unread</Badge>
                          )}
                        </TableCell>
                        <TableCell className="text-center">
                          <div className="flex justify-center gap-1">
                            <Button
                              variant="ghost"
                              size="sm"
                              onClick={() => {
                                setSelectedNotification(not);
                                setViewDialogOpen(true);
                                if (!not.is_read) markAsRead(not.id);
                              }}
                              className="text-blue-500 hover:text-blue-700 dark:text-blue-400 dark:hover:text-blue-300"
                              title="View"
                            >
                              <Eye className="h-4 w-4" />
                            </Button>
                            <Button
                              variant="ghost"
                              size="sm"
                              onClick={() => deleteNotification(not.id)}
                              className="text-red-500 hover:text-red-700 dark:text-red-400 dark:hover:text-red-300"
                              title="Delete"
                            >
                              <Trash2 className="h-4 w-4" />
                            </Button>
                          </div>
                        </TableCell>
                      </motion.tr>
                    ))}
                  </TableBody>
                </Table>
              </div>
            )}
          </CardContent>
        </Card>
      </div>

      {/* View Notification Dialog - Solid Background */}
      <Dialog open={viewDialogOpen} onOpenChange={setViewDialogOpen}>
        <DialogContent className="rounded-2xl max-w-md bg-white dark:bg-gray-900 border-0 shadow-2xl max-h-[80vh] overflow-y-auto">
          <DialogHeader className="sticky top-0 bg-white dark:bg-gray-900 z-10 pt-2 pb-3 border-b border-gray-200 dark:border-gray-700">
            <DialogTitle className="text-gray-900 dark:text-white">Notification Details</DialogTitle>
            <DialogDescription className="text-gray-600 dark:text-gray-400">
              Complete notification information
            </DialogDescription>
          </DialogHeader>
          {selectedNotification && (
            <div className="space-y-4 pt-3">
              <div className="bg-gradient-to-r from-emerald-50 to-teal-50 dark:from-emerald-950/30 dark:to-teal-950/30 rounded-xl p-4">
                <div className="flex items-center gap-3">
                  <Avatar className="h-12 w-12">
                    <AvatarImage src={selectedNotification.staff_photo_url} />
                    <AvatarFallback className="bg-gradient-to-r from-emerald-500 to-teal-500 text-white">
                      {selectedNotification.staff_name?.charAt(0).toUpperCase()}
                    </AvatarFallback>
                  </Avatar>
                  <div>
                    <h3 className="font-bold text-gray-900 dark:text-white">{selectedNotification.staff_name}</h3>
                    <p className="text-sm text-gray-500 dark:text-gray-400">ID: {selectedNotification.staff_employee_id}</p>
                  </div>
                </div>
              </div>
              
              <div className="space-y-3">
                <div className="flex justify-between py-2 border-b border-gray-200 dark:border-gray-700">
                  <span className="text-gray-500 dark:text-gray-400">Type:</span>
                  <Badge className={`rounded-xl ${getTypeBadge(selectedNotification.type)}`}>
                    {selectedNotification.type}
                  </Badge>
                </div>
                <div className="flex justify-between py-2 border-b border-gray-200 dark:border-gray-700">
                  <span className="text-gray-500 dark:text-gray-400">Title:</span>
                  <span className="font-medium text-gray-900 dark:text-white">{selectedNotification.title}</span>
                </div>
                <div className="py-2 border-b border-gray-200 dark:border-gray-700">
                  <span className="text-gray-500 dark:text-gray-400">Message:</span>
                  <p className="mt-1 text-gray-700 dark:text-gray-300">{selectedNotification.message}</p>
                </div>
                <div className="flex justify-between py-2 border-b border-gray-200 dark:border-gray-700">
                  <span className="text-gray-500 dark:text-gray-400">Sent Via:</span>
                  <span className="capitalize text-gray-900 dark:text-white">{selectedNotification.sent_via}</span>
                </div>
                <div className="flex justify-between py-2 border-b border-gray-200 dark:border-gray-700">
                  <span className="text-gray-500 dark:text-gray-400">Sent Date:</span>
                  <span className="text-gray-900 dark:text-white">{new Date(selectedNotification.sent_at).toLocaleString()}</span>
                </div>
                <div className="flex justify-between py-2">
                  <span className="text-gray-500 dark:text-gray-400">Status:</span>
                  <span className="text-gray-900 dark:text-white">{selectedNotification.is_read ? "Read" : "Unread"}</span>
                </div>
              </div>
              
              <div className="sticky bottom-0 bg-white dark:bg-gray-900 pt-3 border-t border-gray-200 dark:border-gray-700">
                <Button variant="outline" onClick={() => setViewDialogOpen(false)} className="w-full rounded-xl border-gray-300 dark:border-gray-600 text-gray-700 dark:text-gray-300">
                  Close
                </Button>
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>

      {/* Settings Dialog - Solid Background with Enhanced Visibility */}
      <Dialog open={settingsDialogOpen} onOpenChange={setSettingsDialogOpen}>
        <DialogContent className="rounded-2xl max-w-md max-h-[85vh] overflow-y-auto bg-white dark:bg-gray-900 border-0 shadow-2xl">
          <DialogHeader className="sticky top-0 bg-white dark:bg-gray-900 z-10 pt-2 pb-3 border-b border-gray-200 dark:border-gray-700">
            <DialogTitle className="text-gray-900 dark:text-white">Notification Settings</DialogTitle>
            <DialogDescription className="text-gray-600 dark:text-gray-400">
              Configure notification system settings
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-5 pt-3">
            {/* Notification Types */}
            <div className="space-y-3">
              <h4 className="font-semibold text-gray-800 dark:text-white">Enable Notifications</h4>
              <div className="space-y-3 bg-gray-50 dark:bg-gray-800/50 rounded-xl p-4">
                <div className="flex justify-between items-center py-2 px-3 bg-white dark:bg-gray-800 rounded-lg shadow-sm border border-gray-200 dark:border-gray-700">
                  <Label className="text-gray-700 dark:text-gray-300 font-medium">Salary Payment Notification</Label>
                  <Switch
                    checked={settingsForm.payment_notification}
                    onCheckedChange={(v) => setSettingsForm({ ...settingsForm, payment_notification: v })}
                    className="data-[state=checked]:bg-emerald-500 dark:data-[state=checked]:bg-emerald-600"
                  />
                </div>
                <div className="flex justify-between items-center py-2 px-3 bg-white dark:bg-gray-800 rounded-lg shadow-sm border border-gray-200 dark:border-gray-700">
                  <Label className="text-gray-700 dark:text-gray-300 font-medium">Advance Notification</Label>
                  <Switch
                    checked={settingsForm.advance_notification}
                    onCheckedChange={(v) => setSettingsForm({ ...settingsForm, advance_notification: v })}
                    className="data-[state=checked]:bg-emerald-500 dark:data-[state=checked]:bg-emerald-600"
                  />
                </div>
                <div className="flex justify-between items-center py-2 px-3 bg-white dark:bg-gray-800 rounded-lg shadow-sm border border-gray-200 dark:border-gray-700">
                  <Label className="text-gray-700 dark:text-gray-300 font-medium">Increment Notification</Label>
                  <Switch
                    checked={settingsForm.increment_notification}
                    onCheckedChange={(v) => setSettingsForm({ ...settingsForm, increment_notification: v })}
                    className="data-[state=checked]:bg-emerald-500 dark:data-[state=checked]:bg-emerald-600"
                  />
                </div>
                <div className="flex justify-between items-center py-2 px-3 bg-white dark:bg-gray-800 rounded-lg shadow-sm border border-gray-200 dark:border-gray-700">
                  <Label className="text-gray-700 dark:text-gray-300 font-medium">Promotion Notification</Label>
                  <Switch
                    checked={settingsForm.promotion_notification}
                    onCheckedChange={(v) => setSettingsForm({ ...settingsForm, promotion_notification: v })}
                    className="data-[state=checked]:bg-emerald-500 dark:data-[state=checked]:bg-emerald-600"
                  />
                </div>
              </div>
            </div>

            {/* Channel Settings */}
            <div className="space-y-3 border-t border-gray-200 dark:border-gray-700 pt-4">
              <h4 className="font-semibold text-gray-800 dark:text-white">Delivery Channels</h4>
              <div className="space-y-3 bg-gray-50 dark:bg-gray-800/50 rounded-xl p-4">
                <div className="flex justify-between items-center py-2 px-3 bg-white dark:bg-gray-800 rounded-lg shadow-sm border border-gray-200 dark:border-gray-700">
                  <Label className="text-gray-700 dark:text-gray-300 font-medium flex items-center gap-2">
                    <Phone className="h-4 w-4 text-emerald-500" />
                    Enable SMS
                  </Label>
                  <Switch
                    checked={settingsForm.enable_sms}
                    onCheckedChange={(v) => setSettingsForm({ ...settingsForm, enable_sms: v })}
                    className="data-[state=checked]:bg-emerald-500 dark:data-[state=checked]:bg-emerald-600"
                  />
                </div>
                <div className="flex justify-between items-center py-2 px-3 bg-white dark:bg-gray-800 rounded-lg shadow-sm border border-gray-200 dark:border-gray-700">
                  <Label className="text-gray-700 dark:text-gray-300 font-medium flex items-center gap-2">
                    <Mail className="h-4 w-4 text-blue-500" />
                    Enable Email
                  </Label>
                  <Switch
                    checked={settingsForm.enable_email}
                    onCheckedChange={(v) => setSettingsForm({ ...settingsForm, enable_email: v })}
                    className="data-[state=checked]:bg-emerald-500 dark:data-[state=checked]:bg-emerald-600"
                  />
                </div>
              </div>
            </div>

            {/* SMS Configuration */}
            {settingsForm.enable_sms && (
              <div className="space-y-3 border-t border-gray-200 dark:border-gray-700 pt-4">
                <h4 className="font-semibold text-gray-800 dark:text-white">SMS Configuration</h4>
                <div className="bg-gray-50 dark:bg-gray-800/50 rounded-xl p-4 space-y-3">
                  <div>
                    <Label className="text-gray-700 dark:text-gray-300 text-sm">API Key</Label>
                    <Input
                      type="password"
                      value={settingsForm.sms_api_key}
                      onChange={(e) => setSettingsForm({ ...settingsForm, sms_api_key: e.target.value })}
                      placeholder="SMS API Key"
                      className="rounded-xl mt-1 bg-white dark:bg-gray-800 border-gray-300 dark:border-gray-600 text-gray-900 dark:text-white"
                    />
                  </div>
                  <div>
                    <Label className="text-gray-700 dark:text-gray-300 text-sm">Sender ID</Label>
                    <Input
                      value={settingsForm.sms_sender_id}
                      onChange={(e) => setSettingsForm({ ...settingsForm, sms_sender_id: e.target.value })}
                      placeholder="Sender ID"
                      className="rounded-xl mt-1 bg-white dark:bg-gray-800 border-gray-300 dark:border-gray-600 text-gray-900 dark:text-white"
                    />
                  </div>
                </div>
              </div>
            )}

            {/* Email Configuration */}
            {settingsForm.enable_email && (
              <div className="space-y-3 border-t border-gray-200 dark:border-gray-700 pt-4">
                <h4 className="font-semibold text-gray-800 dark:text-white">Email Configuration (SMTP)</h4>
                <div className="bg-gray-50 dark:bg-gray-800/50 rounded-xl p-4 space-y-3">
                  <div>
                    <Label className="text-gray-700 dark:text-gray-300 text-sm">SMTP Host</Label>
                    <Input
                      value={settingsForm.email_host}
                      onChange={(e) => setSettingsForm({ ...settingsForm, email_host: e.target.value })}
                      placeholder="smtp.gmail.com"
                      className="rounded-xl mt-1 bg-white dark:bg-gray-800 border-gray-300 dark:border-gray-600 text-gray-900 dark:text-white"
                    />
                  </div>
                  <div>
                    <Label className="text-gray-700 dark:text-gray-300 text-sm">SMTP Port</Label>
                    <Input
                      value={settingsForm.email_port}
                      onChange={(e) => setSettingsForm({ ...settingsForm, email_port: e.target.value })}
                      placeholder="587"
                      className="rounded-xl mt-1 bg-white dark:bg-gray-800 border-gray-300 dark:border-gray-600 text-gray-900 dark:text-white"
                    />
                  </div>
                  <div>
                    <Label className="text-gray-700 dark:text-gray-300 text-sm">Email Address</Label>
                    <Input
                      type="email"
                      value={settingsForm.email_user}
                      onChange={(e) => setSettingsForm({ ...settingsForm, email_user: e.target.value })}
                      placeholder="your@email.com"
                      className="rounded-xl mt-1 bg-white dark:bg-gray-800 border-gray-300 dark:border-gray-600 text-gray-900 dark:text-white"
                    />
                  </div>
                  <div>
                    <Label className="text-gray-700 dark:text-gray-300 text-sm">Password</Label>
                    <Input
                      type="password"
                      value={settingsForm.email_pass}
                      onChange={(e) => setSettingsForm({ ...settingsForm, email_pass: e.target.value })}
                      placeholder="Password"
                      className="rounded-xl mt-1 bg-white dark:bg-gray-800 border-gray-300 dark:border-gray-600 text-gray-900 dark:text-white"
                    />
                  </div>
                </div>
              </div>
            )}

            <div className="flex justify-end gap-2 sticky bottom-0 bg-white dark:bg-gray-900 py-3 border-t border-gray-200 dark:border-gray-700 mt-2">
              <Button variant="outline" onClick={() => setSettingsDialogOpen(false)} className="rounded-xl border-gray-300 dark:border-gray-600 text-gray-700 dark:text-gray-300">
                Cancel
              </Button>
              <Button onClick={saveSettings} className="rounded-xl bg-gradient-to-r from-emerald-600 to-teal-600 text-white hover:from-emerald-700 hover:to-teal-700">
                Save Settings
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </ResponsiveLayout>
  );
}
