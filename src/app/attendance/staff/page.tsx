"use client"

import { useState, useEffect, useCallback, useRef } from "react"
import Link from "next/link"
import { 
  ArrowLeft,
  Calendar,
  Check,
  X,
  Clock,
  Loader2,
  Save,
  ChevronLeft,
  ChevronRight,
  Users,
  FileText,
  Printer,
  Filter,
  Search,
  RefreshCw,
  AlertCircle,
  Bell,
  Send,
  MessageSquare,
  Phone,
  Zap,
  QrCode,
  Wifi,
  Fingerprint,
  CalendarDays,
  TrendingUp,
  Lock,
  Edit,
  MoreHorizontal,
} from "lucide-react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Badge } from "@/components/ui/badge"
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog"
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar"
import { ResponsiveLayout } from "@/components/layout/responsive-layout"
import { getSchoolPrintHeader } from "@/components/print/SchoolPrintHeader"
import { createClient } from "@/lib/supabase/client"
import { useToastStore } from "@/store/useStore"
import { format, addDays, subDays } from "date-fns"
import { getStaff, updateStaffPhoto } from "@/lib/api/staff"
import { generatePDFWithPuppeteer, generateStaffReportHTML } from "@/lib/pdf-generator"

const supabase = createClient()

type AttendanceStatus = 'present' | 'absent' | 'late' | 'leave' | 'holiday'
type NotifyMethod = "sms" | "whatsapp" | "both"

interface Staff {
  id: string
  name: string
  employee_id: string
  designation: string
  role: string
  phone?: string
  email?: string
  photo_url?: string
  status: string
  joining_date?: string
}

interface StaffWithAttendance extends Staff {
  attendance_status?: AttendanceStatus
  attendance_remarks?: string
  check_in?: string
  check_out?: string
}

interface SchoolInfo {
  school_name: string
  school_address: string
  school_phone: string
  school_email?: string
  school_logo?: string
}

const todayStr = () => format(new Date(), "yyyy-MM-dd")
const fmtDisplay = (d: Date) => format(d, "dd MMMM yyyy")
const fmtTime = (t?: string) => t ? t.substring(0, 5) : ""

const STATUS_CFG: Record<AttendanceStatus, {
  label: string; Icon: any
  activeBg: string; activeText: string
  borderColor: string; dotColor: string
  printClass: string
}> = {
  present: {
    label: "Present", Icon: Check,
    activeBg: "bg-emerald-500", activeText: "text-white",
    borderColor: "border-emerald-400", dotColor: "bg-emerald-500",
    printClass: "pr",
  },
  late: {
    label: "Late", Icon: Clock,
    activeBg: "bg-amber-500", activeText: "text-white",
    borderColor: "border-amber-400", dotColor: "bg-amber-500",
    printClass: "la",
  },
  absent: {
    label: "Absent", Icon: X,
    activeBg: "bg-red-500", activeText: "text-white",
    borderColor: "border-red-400", dotColor: "bg-red-500",
    printClass: "ab",
  },
  leave: {
    label: "Leave", Icon: CalendarDays,
    activeBg: "bg-purple-500", activeText: "text-white",
    borderColor: "border-purple-400", dotColor: "bg-purple-500",
    printClass: "le",
  },
  holiday: {
    label: "Holiday", Icon: Calendar,
    activeBg: "bg-indigo-500", activeText: "text-white",
    borderColor: "border-indigo-400", dotColor: "bg-indigo-500",
    printClass: "hd",
  },
}

export default function StaffAttendancePage() {
  const [selectedDate, setSelectedDate] = useState(new Date())
  const [staff, setStaff] = useState<StaffWithAttendance[]>([])
  
  // Lock System States
  const [isLockedDay, setIsLockedDay] = useState(false)
  const [lockReason, setLockReason] = useState("")
  const [approvedLeaves, setApprovedLeaves] = useState<string[]>([])
  
  const [searchTerm, setSearchTerm] = useState("")
  const [showFilters, setShowFilters] = useState(false)
  const [loading, setLoading] = useState(false)
  const [saving, setSaving] = useState(false)
  const [pdfGen, setPdfGen] = useState(false)
  const [saveMsg, setSaveMsg] = useState<"success" | "error" | null>(null)
  
  // School Info
  const [schoolInfo, setSchoolInfo] = useState<SchoolInfo>({
    school_name: "Loading...",
    school_address: "",
    school_phone: "",
    school_email: "",
  })
  
  // Notification states
  const [notifyEnabled, setNotifyEnabled] = useState(false)
  const [notifyMethod, setNotifyMethod] = useState<NotifyMethod>("whatsapp")
  const [notifyOnlyAbsent, setNotifyOnlyAbsent] = useState(true)
  const [sendingBulk, setSendingBulk] = useState(false)
  const [showNotifyDialog, setShowNotifyDialog] = useState(false)
  const [notifyStaff, setNotifyStaff] = useState<StaffWithAttendance | null>(null)
  const [customMsg, setCustomMsg] = useState("")
  const [sendingSingle, setSendingSingle] = useState(false)
  
  // QR States
  const [showQR, setShowQR] = useState(false)
  const [scanning, setScanning] = useState(false)
  const videoRef = useRef<HTMLVideoElement>(null)
  const streamRef = useRef<MediaStream | null>(null)
  const qrInputRef = useRef<HTMLInputElement>(null)
  
  // RFID States
  const [rfidInput, setRfidInput] = useState("")
  const [rfidLoading, setRfidLoading] = useState(false)
  const rfidRef = useRef<HTMLInputElement>(null)
  
  // Ref to prevent infinite loop
  const loadingRef = useRef(false)
  
  const addToast = useToastStore((state) => state.addToast)

// Fetch school info
   useEffect(() => {
       Promise.resolve(supabase.from("school_settings")
        .select("school_name, school_address, school_phone, school_email, school_logo")
        .limit(1).single()
        .then(({ data }) => { if (data) setSchoolInfo(data) }))
        .catch(() => {
         setSchoolInfo({
           school_name: "School Name",
           school_address: "",
           school_phone: "",
           school_email: "",
           school_logo: "",
         })
       })
   }, [])

  // Get weekly off settings
  const getWeeklyOffSettings = useCallback(async (): Promise<{ is_friday_off: boolean; is_saturday_off: boolean }> => {
    const { data: schoolData } = await supabase
      .from("school_settings")
      .select("is_friday_off, is_saturday_off")
      .limit(1)
      .single()
    
    if (schoolData && (schoolData.is_friday_off !== null || schoolData.is_saturday_off !== null)) {
      return {
        is_friday_off: schoolData.is_friday_off ?? true,
        is_saturday_off: schoolData.is_saturday_off ?? false,
      }
    }
    
    const { data: attData } = await supabase
      .from("attendance_settings")
      .select("is_friday_off, is_saturday_off")
      .limit(1)
      .single()
    
    return {
      is_friday_off: attData?.is_friday_off ?? true,
      is_saturday_off: attData?.is_saturday_off ?? false,
    }
  }, [])

  // Check if a date is locked
  const checkDateLock = useCallback(async (date: Date): Promise<{ locked: boolean; reason: string }> => {
    const dateStr = format(date, "yyyy-MM-dd")
    const dayName = format(date, "EEEE").toLowerCase()
    
    const { is_friday_off, is_saturday_off } = await getWeeklyOffSettings()
    
    if (dayName === "friday" && is_friday_off) {
      return { locked: true, reason: "শুক্রবার সাপ্তাহিক ছুটি (Friday Weekly Holiday)" }
    }
    
    if (dayName === "saturday" && is_saturday_off) {
      return { locked: true, reason: "শনিবার সাপ্তাহিক ছুটি (Saturday Weekly Holiday)" }
    }
    
    const { data: holidays } = await supabase
      .from("attendance_holidays")
      .select("title")
      .eq("holiday_date", dateStr)
    
    if (holidays && holidays.length > 0) {
      return { locked: true, reason: `${holidays[0].title} - স্কুল ছুটি (School Holiday)` }
    }
    
    return { locked: false, reason: "" }
  }, [getWeeklyOffSettings])

  // Get approved leaves for staff
  const fetchApprovedLeaves = useCallback(async (date: Date, staffIds: string[]): Promise<string[]> => {
    if (staffIds.length === 0) return []
    
    const dateStr = format(date, "yyyy-MM-dd")
    
    const { data: leaves } = await supabase
      .from("leaves")
      .select("staff_id")
      .in("staff_id", staffIds)
      .lte("start_date", dateStr)
      .gte("end_date", dateStr)
      .eq("status", "approved")
      .eq("user_type", "staff")
    
    return leaves?.map(l => l.staff_id) || []
  }, [])

  // Load data
  const loadData = useCallback(async () => {
    if (loadingRef.current) return
    
    loadingRef.current = true
    setLoading(true)
    
    try {
      const { locked, reason } = await checkDateLock(selectedDate)
      setIsLockedDay(locked)
      setLockReason(reason)
      
      const staffData = await getStaff()
      
      const leaves = await fetchApprovedLeaves(selectedDate, staffData.map(s => s.id))
      setApprovedLeaves(leaves)
      
      const dateStr = format(selectedDate, "yyyy-MM-dd")
      const { data: attendanceData } = await supabase
        .from('staff_attendance')
        .select('*')
        .eq('date', dateStr)
      
      const attendanceMap = new Map<string, any>()
      attendanceData?.forEach(att => {
        attendanceMap.set(att.staff_id, att)
      })
      
      const staffWithAttendance: StaffWithAttendance[] = staffData.map(s => {
        const attendance = attendanceMap.get(s.id)
        let status: AttendanceStatus = attendance?.status as AttendanceStatus || 'absent'
        
        if (locked) {
          status = 'holiday'
        }
        
        if (!locked && leaves.includes(s.id)) {
          status = 'leave'
        }
        
        return {
          ...s,
          attendance_status: status,
          attendance_remarks: attendance?.remarks,
          check_in: attendance?.check_in,
          check_out: attendance?.check_out,
        }
      })
      
      setStaff(staffWithAttendance)
      
    } catch (err) {
      console.error("Failed to load data:", err)
      addToast({ type: 'error', title: 'Error', message: 'Failed to load staff data' })
    } finally {
      setLoading(false)
      loadingRef.current = false
    }
  }, [selectedDate, addToast, checkDateLock, fetchApprovedLeaves])

  useEffect(() => { loadData() }, [loadData])

  const setStatus = (staffId: string, status: AttendanceStatus) => {
    if (isLockedDay) {
      addToast({ type: 'info', title: 'Locked', message: 'Cannot mark attendance on holiday/weekly off' })
      return
    }
    if (approvedLeaves.includes(staffId)) {
      addToast({ type: 'info', title: 'Leave', message: 'This staff member has approved leave' })
      return
    }
    setStaff(prev => prev.map(s => 
      s.id === staffId ? { ...s, attendance_status: status } : s
    ))
  }

  const setCheckIn = (staffId: string, checkIn: string) => {
    if (isLockedDay || approvedLeaves.includes(staffId)) return
    setStaff(prev => prev.map(s => 
      s.id === staffId ? { ...s, check_in: checkIn } : s
    ))
  }

  const setCheckOut = (staffId: string, checkOut: string) => {
    if (isLockedDay || approvedLeaves.includes(staffId)) return
    setStaff(prev => prev.map(s => 
      s.id === staffId ? { ...s, check_out: checkOut } : s
    ))
  }

  const setRemarks = (staffId: string, remark: string) => {
    if (isLockedDay) return
    setStaff(prev => prev.map(s => 
      s.id === staffId ? { ...s, attendance_remarks: remark } : s
    ))
  }

  const markAll = (status: AttendanceStatus) => {
    if (isLockedDay) {
      addToast({ type: 'info', title: 'Locked', message: 'Cannot mark attendance on holiday/weekly off' })
      return
    }
    setStaff(prev => prev.map(s => {
      if (approvedLeaves.includes(s.id)) return s
      return { ...s, attendance_status: status }
    }))
    addToast({ type: 'success', title: 'Marked', message: `All staff marked as ${status}` })
  }

  const shiftDate = (days: number) => {
    setSelectedDate(prev => days > 0 ? addDays(prev, days) : subDays(prev, Math.abs(days)))
  }

  const saveAttendance = async () => {
    if (isLockedDay) {
      addToast({ type: 'info', title: 'Locked', message: 'Cannot save attendance on holiday/weekly off' })
      return
    }
    
    if (staff.length === 0) { 
      addToast({ type: 'error', title: 'Error', message: "No staff to save" }); 
      return 
    }
    
    setSaving(true); setSaveMsg(null)
    try {
      const dateStr = format(selectedDate, "yyyy-MM-dd")
      const upsertData = filteredStaff.map(s => {
        let status = s.attendance_status || 'absent'
        if (approvedLeaves.includes(s.id)) {
          status = 'leave'
        }
        return {
          staff_id: s.id,
          date: dateStr,
          status: status,
          remarks: s.attendance_remarks || '',
          check_in: s.check_in || null,
          check_out: s.check_out || null,
        }
      })
      
      const { error } = await supabase
        .from('staff_attendance')
        .upsert(upsertData, { onConflict: 'staff_id,date' })
      
      if (error) throw error
      
      setSaveMsg("success")
      addToast({ type: 'success', title: 'Saved', message: `Attendance saved for ${upsertData.length} staff members.` })
      await loadData()
    } catch (err) {
      console.error(err); setSaveMsg("error")
      addToast({ type: 'error', title: 'Failed', message: 'Failed to save attendance.' })
    } finally {
      setSaving(false)
      setTimeout(() => setSaveMsg(null), 3500)
    }
  }

  // Build message for notification
  const buildMessage = (staffMember: StaffWithAttendance, status: AttendanceStatus, custom?: string) => {
    if (custom?.trim()) return custom
    const statusText = status === "present" ? "Present" : status === "absent" ? "Absent" : status === "late" ? "Late" : status === "leave" ? "Leave" : "Holiday"
    const timeInfo = staffMember.check_in ? ` Check-in: ${staffMember.check_in}` : ''
    return `Dear ${staffMember.name} (${staffMember.employee_id}), you were marked ${statusText} on ${fmtDisplay(selectedDate)}.${timeInfo} - ${schoolInfo.school_name}`
  }

  const sendNotification = async (staffMember: StaffWithAttendance, status: AttendanceStatus, msg: string) => {
    const phone = staffMember.phone
    if (!phone) return false
    try {
      if (notifyMethod === "sms" || notifyMethod === "both") {
        await fetch("/api/send-sms", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ to: phone, message: msg }),
        })
      }
      if (notifyMethod === "whatsapp" || notifyMethod === "both") {
        await fetch("/api/send-whatsapp", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ to: phone, message: msg }),
        })
      }
      return true
    } catch { return false }
  }

  const handleSingleNotify = async () => {
    if (!notifyStaff) return
    setSendingSingle(true)
    const status = notifyStaff.attendance_status || "present"
    const msg = buildMessage(notifyStaff, status, customMsg)
    const ok = await sendNotification(notifyStaff, status, msg)
    if (ok) addToast({ type: 'success', title: 'Sent', message: `Notification sent to ${notifyStaff.name}` })
    else addToast({ type: 'error', title: 'Failed', message: "Failed — no phone number or API error" })
    setSendingSingle(false)
    setShowNotifyDialog(false)
    setCustomMsg("")
    setNotifyStaff(null)
  }

  const handleBulkNotify = async () => {
    if (isLockedDay) {
      addToast({ type: 'info', title: 'Locked', message: 'Cannot send notifications on holiday/weekly off' })
      return
    }
    
    const targets = filteredStaff.filter(s => {
      const st = s.attendance_status || "present"
      return notifyOnlyAbsent ? st !== "present" : true
    }).filter(s => s.phone)
    
    if (targets.length === 0) { 
      addToast({ type: 'info', title: 'Info', message: "No staff to notify" }); 
      return 
    }

    setSendingBulk(true)
    let ok = 0
    for (const staffMember of targets) {
      const status = staffMember.attendance_status || "present"
      const msg = buildMessage(staffMember, status)
      const sent = await sendNotification(staffMember, status, msg)
      if (sent) ok++
    }
    addToast({ type: 'success', title: 'Notified', message: `Notified ${ok} of ${targets.length} staff` })
    setSendingBulk(false)
  }

  // QR Scan
  const startQR = async () => {
    if (isLockedDay) {
      addToast({ type: 'info', title: 'Locked', message: 'Cannot scan QR on holiday/weekly off' })
      return
    }
    setShowQR(true)
    setScanning(true)
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ video: { facingMode: "environment" } })
      streamRef.current = stream
      if (videoRef.current) { videoRef.current.srcObject = stream }
    } catch {
      addToast({ type: 'error', title: 'Error', message: "Camera access denied" })
      setShowQR(false); setScanning(false)
    }
  }

  const stopQR = () => {
    streamRef.current?.getTracks().forEach(t => t.stop())
    setShowQR(false); setScanning(false)
  }

  const handleQRInput = (val: string) => {
    if (isLockedDay) {
      addToast({ type: 'info', title: 'Locked', message: 'Cannot mark attendance on holiday/weekly off' })
      return
    }
    const staffMember = staff.find(s => s.employee_id === val || s.id === val)
    if (!staffMember) { 
      addToast({ type: 'error', title: 'Error', message: "No staff found for this QR" }); 
      return 
    }
    if (approvedLeaves.includes(staffMember.id)) {
      addToast({ type: 'info', title: 'Leave', message: `${staffMember.name} has approved leave today` })
      return
    }
    const currentTime = new Date().toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit', hour12: false })
    setStatus(staffMember.id, "present")
    setCheckIn(staffMember.id, currentTime)
    addToast({ type: 'success', title: 'Success', message: `✅ ${staffMember.name} marked present via QR at ${currentTime}` })
    stopQR()
  }

  // RFID Scan
  const handleRFIDScan = async (uid: string) => {
    if (!uid.trim()) return
    if (isLockedDay) {
      addToast({ type: 'info', title: 'Locked', message: 'Cannot scan RFID on holiday/weekly off' })
      setRfidInput("")
      return
    }
    setRfidLoading(true)
    try {
      const staffMember = staff.find(s => s.employee_id === uid.trim())
      if (!staffMember) {
        addToast({ type: 'error', title: 'Error', message: "Invalid RFID / Employee ID" })
        setRfidInput("")
        return
      }
      if (approvedLeaves.includes(staffMember.id)) {
        addToast({ type: 'info', title: 'Leave', message: `${staffMember.name} has approved leave today` })
        setRfidInput("")
        return
      }
      const currentTime = new Date().toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit', hour12: false })
      setStatus(staffMember.id, "present")
      setCheckIn(staffMember.id, currentTime)
      addToast({ type: 'success', title: 'Success', message: `✅ ${staffMember.name} marked present via RFID at ${currentTime}` })
    } catch {
      addToast({ type: 'error', title: 'Error', message: "RFID API error" })
    } finally {
      setRfidLoading(false)
      setRfidInput("")
      rfidRef.current?.focus()
    }
  }

  // Biometric
  const handleBiometric = async () => {
    if (isLockedDay) {
      addToast({ type: 'info', title: 'Locked', message: 'Cannot use biometric on holiday/weekly off' })
      return
    }
    if (!window.PublicKeyCredential) {
      addToast({ type: 'error', title: 'Error', message: "Biometric not supported on this device" })
      return
    }
    try {
      addToast({ type: 'info', title: 'Info', message: "Biometric auth initiated — marking all present" })
      markAll("present")
      
      const currentTime = new Date().toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit', hour12: false })
      setStaff(prev => prev.map(s => {
        if (approvedLeaves.includes(s.id)) return s
        return { ...s, check_in: currentTime, attendance_status: "present" }
      }))
    } catch {
      addToast({ type: 'error', title: 'Error', message: "Biometric failed" })
    }
  }

  // PDF Generation
  const generatePDF = async () => {
    setPdfGen(true)
    addToast({ type: 'info', title: 'Loading', message: "Generating PDF, please wait..." })
    
    try {
      const html = generateStaffReportHTML(
        schoolInfo,
        selectedDate,
        stats,
        filteredStaff,
        fmtDisplay
      )
      
      await generatePDFWithPuppeteer(html, `staff_attendance_${format(selectedDate, "yyyy-MM-dd")}`)
      addToast({ type: 'success', title: 'PDF Ready', message: "Staff attendance report downloaded" })
    } catch (error) {
      console.error("PDF Error:", error)
      addToast({ type: 'error', title: 'Failed', message: "PDF generation failed" })
    } finally {
      setPdfGen(false)
    }
  }

// Print Handler
   const handlePrint = () => {
    const printWindow = window.open('', '_blank')
    if (!printWindow) return
    
    const getStatusClass = (status: string) => {
      if (status === 'present') return 'present-cell'
      if (status === 'absent') return 'absent-cell'
      if (status === 'late') return 'late-cell'
      if (status === 'leave') return 'leave-cell'
      if (status === 'holiday') return 'holiday-cell'
      return ''
    }
    
    const getStatusText = (status: string) => {
      if (status === 'present') return 'Present'
      if (status === 'absent') return 'Absent'
      if (status === 'late') return 'Late'
      if (status === 'leave') return 'Leave'
      if (status === 'holiday') return 'Holiday'
      return status
    }
    
    printWindow.document.write(`
      <!DOCTYPE html>
      <html>
      <head>
        <meta charset="UTF-8">
        <title>Staff Attendance Report - ${fmtDisplay(selectedDate)}</title>
        <link href="https://fonts.googleapis.com/css2?family=Hind+Siliguri:wght@400;500;600;700&display=swap" rel="stylesheet">
        <style>
          * { font-family: 'Hind Siliguri', 'Segoe UI', Arial, sans-serif; }
          body { margin: 0; padding: 20px; font-size: 12px; }
          .print-container { max-width: 1200px; margin: 0 auto; }
          .report-title { font-size: 16px; font-weight: bold; margin: 10px 0 5px; text-align: center; }
          .report-date { text-align: center; font-size: 12px; color: #666; margin-bottom: 15px; }
          ${isLockedDay ? `.stats-line { text-align: center; font-size: 12px; margin: 15px 0; padding: 8px; background: #fee2e2; border-radius: 6px; border: 1px solid #fecaca; color: #dc2626; }` : `
          .stats-line { text-align: center; font-size: 12px; margin: 15px 0; padding: 8px; background: #f0fdf4; border-radius: 6px; border: 1px solid #ddd; }
          .stats-line .present { color: #059669; font-weight: bold; }
          .stats-line .absent { color: #dc2626; font-weight: bold; }
          .stats-line .late { color: #d97706; font-weight: bold; }
          .stats-line .leave { color: #8b5cf6; font-weight: bold; }
          .stats-line .total { color: #2563eb; font-weight: bold; }
          .stats-line .percent { color: #7c3aed; font-weight: bold; }
          `}
          table { width: 100%; border-collapse: collapse; margin-top: 15px; font-size: 10px; }
          th, td { border: 1px solid #ccc; padding: 8px 6px; text-align: center; }
          th { background: #e5e7eb; font-weight: bold; }
          .text-left { text-align: left; }
          .present-cell { color: #059669; font-weight: bold; }
          .absent-cell { color: #dc2626; font-weight: bold; }
          .late-cell { color: #d97706; font-weight: bold; }
          .leave-cell { color: #8b5cf6; font-weight: bold; }
          .holiday-cell { color: #4f46e5; font-weight: bold; }
          .footer { margin-top: 20px; text-align: center; font-size: 9px; color: #9ca3af; border-top: 1px solid #ccc; padding-top: 8px; }
          @media print { body { margin: 0; padding: 0; } button { display: none; } }
        </style>
      </head>
      <body>
        <div class="print-container">
          ${getSchoolPrintHeader(schoolInfo, "Staff Attendance Report")}
          <div class="report-title">Staff Attendance Report</div>
          <div class="report-date">Date: ${fmtDisplay(selectedDate)}</div>
          ${isLockedDay ? `<div class="stats-line">⚠️ ${lockReason} - Attendance Locked</div>` : `
          <div class="stats-line">
            <span>📊 Total: <span class="total">${stats.total}</span></span>
            <span>✓ Present: <span class="present">${stats.present}</span></span>
            <span>✗ Absent: <span class="absent">${stats.absent}</span></span>
            <span>⏰ Late: <span class="late">${stats.late}</span></span>
            <span>🌴 Leave: <span class="leave">${stats.leave}</span></span>
            <span>📈 Attendance: <span class="percent">${stats.pct}%</span></span>
          </div>
          `}
          <table>
            <thead>
              <tr><th>#</th><th>ID</th><th class="text-left">Name</th><th>Designation</th><th>Status</th><th>Check-In</th><th>Check-Out</th><th class="text-left">Remarks</th></tr>
            </thead>
            <tbody>
              ${filteredStaff.map((s, i) => {
                const isLeave = approvedLeaves.includes(s.id)
                let status = s.attendance_status || "absent"
                if (isLockedDay) status = "holiday"
                else if (isLeave) status = "leave"
                return `
                  <tr>
                    <td>${i + 1}</td>
                    <td>${s.employee_id}</td>
                    <td class="text-left">${s.name}${isLeave && !isLockedDay ? ' (Leave)' : ''}${isLockedDay ? ' (Holiday)' : ''}</td>
                    <td class="text-left">${s.designation || '-'}</td>
                    <td class="${getStatusClass(status)}">${getStatusText(status)}</td>
                    <td class="text-center">${s.check_in || '-'}</td>
                    <td class="text-center">${s.check_out || '-'}</td>
                    <td class="text-left">${s.attendance_remarks || ''}</td>
                  </tr>
                `
              }).join('')}
            </tbody>
          </table>
          <div class="footer">Generated on ${new Date().toLocaleString()} | ${schoolInfo.school_name}</div>
          <script>window.print(); setTimeout(() => window.close(), 1000);<\/script>
        </div>
      </body>
      </html>
    `)
    printWindow.document.close()
  }

  const filteredStaff = staff.filter(s =>
    !searchTerm ||
    s.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
    s.employee_id?.toLowerCase().includes(searchTerm.toLowerCase()) ||
    s.designation?.toLowerCase().includes(searchTerm.toLowerCase())
  )

  const stats = (() => {
    const total = filteredStaff.length
    const present = filteredStaff.filter(s => s.attendance_status === "present").length
    const absent = filteredStaff.filter(s => s.attendance_status === "absent").length
    const late = filteredStaff.filter(s => s.attendance_status === "late").length
    const leave = filteredStaff.filter(s => s.attendance_status === "leave").length
    const pct = total ? Math.round(((present + late) / total) * 100) : 0
    return { total, present, absent, late, leave, pct }
  })()

  return (
    <ResponsiveLayout>
      <style jsx global>{`
        .staff-row { transition: background 0.1s; }
        .staff-row:hover { background: #f1f5f9 !important; }
        .dark .staff-row:hover { background: #334155 !important; }
        .st-btn { transition: all 0.15s ease; }
        .st-btn:hover:not(:disabled) { transform: translateY(-1px); box-shadow: 0 4px 14px rgba(0,0,0,0.13); }
        .st-btn:active:not(:disabled) { transform: translateY(0); }
        .dark .text-slate-700, .dark .text-slate-800 { color: #e2e8f0 !important; }
        .dark .bg-slate-50 { background-color: #1e293b !important; }
        .dark .bg-white { background-color: #0f172a !important; }
        .dark .border-slate-200 { border-color: #334155 !important; }
        .dark input, .dark textarea { background-color: #1e293b !important; border-color: #334155 !important; color: #f1f5f9 !important; }
        .dark [role="dialog"] { background-color: #1e293b !important; }
        .dark label { color: #cbd5e1 !important; }
        .dark .text-slate-600 { color: #94a3b8 !important; }
        .dark .text-slate-500 { color: #64748b !important; }
      `}</style>

      {/* QR Scanner Modal */}
      {showQR && (
        <div className="fixed inset-0 bg-black/85 z-[100] flex items-center justify-center p-4">
          <div className="bg-white dark:bg-slate-900 rounded-3xl p-6 w-full max-w-md shadow-2xl">
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-lg font-bold flex items-center gap-2 dark:text-white"><QrCode className="h-5 w-5 text-blue-600" />QR Scanner</h3>
              <Button variant="ghost" size="icon" onClick={stopQR} className="rounded-full dark:text-white"><X className="h-5 w-5" /></Button>
            </div>
            <video ref={videoRef} autoPlay playsInline className="w-full rounded-2xl bg-black aspect-square object-cover" />
            <div className="mt-4">
              <label className="text-xs font-semibold text-slate-500 dark:text-slate-400 mb-1 block">Or type/paste Employee ID:</label>
              <div className="flex gap-2">
                <Input ref={qrInputRef} placeholder="Employee ID..." className="rounded-xl" onKeyDown={e => { if (e.key === "Enter") { handleQRInput(e.currentTarget.value); e.currentTarget.value = "" } }} />
                <Button onClick={() => { if (qrInputRef.current) { handleQRInput(qrInputRef.current.value); qrInputRef.current.value = "" } }} className="rounded-xl">OK</Button>
              </div>
            </div>
            <p className="text-center text-xs text-slate-400 dark:text-slate-500 mt-3">Point camera at QR code or type employee ID</p>
          </div>
        </div>
      )}

      {/* Single Notify Dialog */}
      <Dialog open={showNotifyDialog} onOpenChange={v => { setShowNotifyDialog(v); if (!v) { setCustomMsg(""); setNotifyStaff(null) } }}>
        <DialogContent className="rounded-3xl max-w-md bg-white dark:bg-slate-800">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2 dark:text-white"><Bell className="h-5 w-5 text-blue-600" />Send Notification</DialogTitle>
          </DialogHeader>
          {notifyStaff && (
            <div className="space-y-4">
              <div className="bg-slate-50 dark:bg-slate-700 rounded-2xl p-4">
                <div className="flex items-center gap-3">
                  <Avatar className="h-10 w-10">
                    <AvatarImage src={notifyStaff.photo_url} alt={notifyStaff.name} />
                    <AvatarFallback className={`text-white font-bold ${STATUS_CFG[notifyStaff.attendance_status || "present"].activeBg}`}>
                      {notifyStaff.name.charAt(0)}
                    </AvatarFallback>
                  </Avatar>
                  <div>
                    <p className="font-bold text-slate-800 dark:text-white">{notifyStaff.name}</p>
                    <p className="text-xs text-slate-500 dark:text-slate-400">{notifyStaff.employee_id} · {notifyStaff.designation}</p>
                  </div>
                  <div className="ml-auto">
                    <Badge className={`${STATUS_CFG[notifyStaff.attendance_status || "present"].activeBg} text-white border-0`}>
                      {STATUS_CFG[notifyStaff.attendance_status || "present"].label}
                    </Badge>
                  </div>
                </div>
                {notifyStaff.check_in && (
                  <div className="flex items-center gap-2 mt-2 text-xs text-slate-500 dark:text-slate-400">
                    <Clock className="h-3 w-3" />
                    <span>Check-in: {notifyStaff.check_in}</span>
                  </div>
                )}
                <div className="flex items-center gap-2 mt-1 text-sm text-slate-600 dark:text-slate-300">
                  <Phone className="h-4 w-4" />
                  <span>{notifyStaff.phone || "No phone number"}</span>
                </div>
              </div>

              <div>
                <label className="text-xs font-semibold text-slate-600 dark:text-slate-300 mb-1 block">Notification Method</label>
                <Select value={notifyMethod} onValueChange={v => setNotifyMethod(v as NotifyMethod)}>
                  <SelectTrigger className="rounded-xl dark:bg-slate-800 dark:border-slate-600 dark:text-white"><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="sms"><span className="flex items-center gap-2"><MessageSquare className="h-4 w-4 text-blue-500" />SMS</span></SelectItem>
                    <SelectItem value="whatsapp"><span className="flex items-center gap-2"><Phone className="h-4 w-4 text-green-500" />WhatsApp</span></SelectItem>
                    <SelectItem value="both"><span className="flex items-center gap-2"><Zap className="h-4 w-4 text-purple-500" />Both</span></SelectItem>
                  </SelectContent>
                </Select>
              </div>

              <div>
                <label className="text-xs font-semibold text-slate-600 dark:text-slate-300 mb-1 block">Custom Message (optional)</label>
                <textarea
                  value={customMsg}
                  onChange={e => setCustomMsg(e.target.value)}
                  placeholder={buildMessage(notifyStaff, notifyStaff.attendance_status || "present")}
                  rows={3}
                  className="w-full text-sm border border-slate-200 dark:border-slate-600 rounded-xl p-3 resize-none bg-white dark:bg-slate-800 text-slate-800 dark:text-white focus:outline-none focus:ring-2 focus:ring-blue-400"
                />
              </div>

              <Button onClick={handleSingleNotify} disabled={sendingSingle || !notifyStaff.phone} className="w-full bg-blue-600 hover:bg-blue-700 text-white rounded-xl">
                {sendingSingle ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : <Send className="h-4 w-4 mr-2" />}
                Send Notification
              </Button>
            </div>
          )}
        </DialogContent>
      </Dialog>

      <div className="space-y-5 p-4 md:p-6">
        
        {/* Header */}
        <div className="flex flex-col lg:flex-row lg:items-center lg:justify-between gap-4 bg-gradient-to-r from-blue-600 to-indigo-700 rounded-2xl p-5 shadow-xl">
          <div className="flex items-center gap-4">
            <Button variant="ghost" size="icon" asChild className="bg-white/20 hover:bg-white/30 text-white rounded-xl">
              <Link href="/attendance"><ArrowLeft className="h-5 w-5" /></Link>
            </Button>
            <div>
              <h1 className="text-2xl md:text-3xl font-bold text-white">Staff Attendance</h1>
              <p className="text-blue-100 text-sm">Mark, manage & notify staff attendance with check-in/out</p>
            </div>
          </div>
          <div className="flex flex-wrap gap-2">
            <Button onClick={() => setShowFilters(!showFilters)} className="bg-white/20 hover:bg-white/30 text-white border border-white/30 rounded-xl">
              <Filter className="h-4 w-4 mr-1" />{showFilters ? "Hide" : "Filters"}
            </Button>
            <Button onClick={startQR} disabled={isLockedDay} className="bg-white/20 hover:bg-white/30 text-white border border-white/30 rounded-xl disabled:opacity-50 disabled:cursor-not-allowed">
              <QrCode className="h-4 w-4 mr-1" />Scan QR
            </Button>
            <Button onClick={handleBiometric} disabled={isLockedDay} className="bg-white/20 hover:bg-white/30 text-white border border-white/30 rounded-xl disabled:opacity-50 disabled:cursor-not-allowed">
              <Fingerprint className="h-4 w-4 mr-1" />Biometric
            </Button>
            <Button onClick={generatePDF} disabled={pdfGen} className="bg-white/20 hover:bg-white/30 text-white border border-white/30 rounded-xl">
              {pdfGen ? <Loader2 className="h-4 w-4 animate-spin mr-1" /> : <FileText className="h-4 w-4 mr-1" />}PDF
            </Button>
            <Button onClick={handlePrint} className="bg-white/20 hover:bg-white/30 text-white border border-white/30 rounded-xl">
              <Printer className="h-4 w-4 mr-1" />Print
            </Button>
          </div>
        </div>

        {/* LOCK DAY WARNING */}
        {isLockedDay && (
          <div className="rounded-2xl border border-red-200 bg-red-50 dark:bg-red-900/20 dark:border-red-800 p-4">
            <div className="flex items-start gap-3">
              <Lock className="h-5 w-5 text-red-600 dark:text-red-400 mt-0.5" />
              <div>
                <p className="font-bold text-red-700 dark:text-red-400">Attendance Locked</p>
                <p className="text-sm text-red-600 dark:text-red-300">{lockReason}</p>
                <p className="text-xs text-red-500 dark:text-red-400 mt-1">আপনি এই দিনে কোনো অ্যাটেনডেন্স পরিবর্তন করতে পারবেন না</p>
              </div>
            </div>
          </div>
        )}

        {/* Date Navigation + Quick Actions */}
        <Card className="border-0 shadow-md bg-white dark:bg-slate-900">
          <CardContent className="p-4">
            <div className="flex flex-wrap items-center gap-3">
              <Button variant="outline" size="icon" onClick={() => shiftDate(-1)} className="rounded-xl dark:border-slate-700"><ChevronLeft className="h-4 w-4" /></Button>
              <Input type="date" value={format(selectedDate, "yyyy-MM-dd")} onChange={e => setSelectedDate(new Date(e.target.value))} className="w-44 font-medium rounded-xl dark:bg-slate-800 dark:border-slate-700 dark:text-white" />
              <Button variant="outline" size="icon" onClick={() => shiftDate(1)} className="rounded-xl dark:border-slate-700"><ChevronRight className="h-4 w-4" /></Button>
              <Button variant="outline" onClick={() => setSelectedDate(new Date())} className="rounded-xl text-blue-600 border-blue-200 hover:bg-blue-50 dark:border-blue-800 dark:text-blue-400">Today</Button>
              <span className="text-slate-500 dark:text-slate-400 text-sm font-medium bg-slate-100 dark:bg-slate-800 px-3 py-1.5 rounded-lg">{fmtDisplay(selectedDate)}</span>
              <div className="flex-1" />

              {/* RFID Input */}
              <div className="flex items-center gap-2 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl px-3 py-1">
                <Wifi className="h-4 w-4 text-blue-500 flex-shrink-0" />
                <Input
                  ref={rfidRef}
                  placeholder="RFID / Employee ID..."
                  value={rfidInput}
                  onChange={e => setRfidInput(e.target.value)}
                  onKeyDown={e => { if (e.key === "Enter") handleRFIDScan(rfidInput) }}
                  className="border-0 bg-transparent h-7 w-32 text-xs p-0 focus-visible:ring-0 dark:text-white"
                  disabled={rfidLoading || isLockedDay}
                />
                {rfidLoading && <Loader2 className="h-3 w-3 animate-spin text-blue-500" />}
              </div>

              {/* Mark All Buttons */}
              <div className="flex gap-1.5">
                {(["present", "late", "absent", "leave"] as AttendanceStatus[]).map(st => {
                  const c = STATUS_CFG[st]
                  return (
                    <Button 
                      key={st} 
                      size="sm" 
                      onClick={() => markAll(st)} 
                      disabled={isLockedDay}
                      className={`${c.activeBg} hover:opacity-90 text-white rounded-xl text-xs px-3 disabled:opacity-50 disabled:cursor-not-allowed`}
                    >
                      All {c.label}
                    </Button>
                  )
                })}
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Filters */}
        {showFilters && (
          <Card className="border-0 shadow-md bg-white dark:bg-slate-800">
            <CardContent className="pt-5 pb-4">
              <div className="grid grid-cols-1 gap-4">
                <div>
                  <label className="text-xs font-semibold text-slate-700 dark:text-slate-200 mb-1 block">Search Staff</label>
                  <div className="relative">
                    <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400" />
                    <Input 
                      placeholder="Name, ID, designation..." 
                      value={searchTerm} 
                      onChange={e => setSearchTerm(e.target.value)} 
                      className="pl-9 rounded-xl bg-white dark:bg-slate-900 dark:border-slate-600 dark:text-white dark:placeholder:text-slate-500"
                    />
                  </div>
                </div>
              </div>

              {/* Notification Settings */}
              <div className="border-t border-slate-100 dark:border-slate-700 pt-4 mt-4">
                <p className="text-xs font-semibold text-slate-700 dark:text-slate-200 mb-3 flex items-center gap-1"><Bell className="h-3.5 w-3.5" />Notification Settings</p>
                <div className="flex flex-wrap items-center gap-4">
                  <label className="flex items-center gap-2 cursor-pointer">
                    <input type="checkbox" checked={notifyEnabled} onChange={e => setNotifyEnabled(e.target.checked)} className="w-4 h-4 rounded accent-blue-600" />
                    <span className="text-sm font-medium text-slate-700 dark:text-slate-200">Enable staff notifications</span>
                  </label>
                  {notifyEnabled && (
                    <>
                      <Select value={notifyMethod} onValueChange={v => setNotifyMethod(v as NotifyMethod)}>
                        <SelectTrigger className="w-36 h-9 rounded-xl text-sm bg-white dark:bg-slate-900 dark:border-slate-600 dark:text-white">
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent className="bg-white dark:bg-slate-800">
                          <SelectItem value="sms" className="dark:text-white">📱 SMS</SelectItem>
                          <SelectItem value="whatsapp" className="dark:text-white">💬 WhatsApp</SelectItem>
                          <SelectItem value="both" className="dark:text-white">⚡ Both</SelectItem>
                        </SelectContent>
                      </Select>
                      <label className="flex items-center gap-2 cursor-pointer">
                        <input type="checkbox" checked={notifyOnlyAbsent} onChange={e => setNotifyOnlyAbsent(e.target.checked)} className="w-4 h-4 rounded accent-blue-600" />
                        <span className="text-sm text-slate-700 dark:text-slate-200">Only absent/late</span>
                      </label>
                      <Button onClick={handleBulkNotify} disabled={sendingBulk || isLockedDay} size="sm" className="bg-blue-600 hover:bg-blue-700 text-white rounded-xl disabled:opacity-50">
                        {sendingBulk ? <Loader2 className="h-3.5 w-3.5 animate-spin mr-1" /> : <Send className="h-3.5 w-3.5 mr-1" />}
                        Bulk Notify {notifyOnlyAbsent ? "(Absent/Late)" : "(All)"}
                      </Button>
                    </>
                  )}
                </div>
              </div>
            </CardContent>
          </Card>
        )}

        {/* Stats Cards */}
        <div className="grid gap-4 grid-cols-2 sm:grid-cols-3 md:grid-cols-6">
          <Card className="bg-gradient-to-br from-slate-600 to-slate-700 text-white">
            <CardContent className="p-3">
              <div className="flex items-center justify-between">
                <div><p className="text-xs opacity-75">Total Staff</p><p className="text-xl font-bold">{stats.total}</p></div>
                <Users className="h-6 w-6 opacity-50" />
              </div>
            </CardContent>
          </Card>
          <Card className="bg-gradient-to-br from-emerald-500 to-emerald-600 text-white">
            <CardContent className="p-3">
              <div className="flex items-center justify-between">
                <div><p className="text-xs opacity-75">Present</p><p className="text-xl font-bold">{stats.present}</p></div>
                <Check className="h-6 w-6 opacity-50" />
              </div>
            </CardContent>
          </Card>
          <Card className="bg-gradient-to-br from-red-500 to-rose-600 text-white">
            <CardContent className="p-3">
              <div className="flex items-center justify-between">
                <div><p className="text-xs opacity-75">Absent</p><p className="text-xl font-bold">{stats.absent}</p></div>
                <X className="h-6 w-6 opacity-50" />
              </div>
            </CardContent>
          </Card>
          <Card className="bg-gradient-to-br from-amber-500 to-amber-600 text-white">
            <CardContent className="p-3">
              <div className="flex items-center justify-between">
                <div><p className="text-xs opacity-75">Late</p><p className="text-xl font-bold">{stats.late}</p></div>
                <Clock className="h-6 w-6 opacity-50" />
              </div>
            </CardContent>
          </Card>
          <Card className="bg-gradient-to-br from-purple-500 to-purple-600 text-white">
            <CardContent className="p-3">
              <div className="flex items-center justify-between">
                <div><p className="text-xs opacity-75">Leave</p><p className="text-xl font-bold">{stats.leave}</p></div>
                <CalendarDays className="h-6 w-6 opacity-50" />
              </div>
            </CardContent>
          </Card>
          <Card className="bg-gradient-to-br from-blue-500 to-indigo-600 text-white">
            <CardContent className="p-3">
              <div className="flex items-center justify-between">
                <div><p className="text-xs opacity-75">Attendance</p><p className="text-xl font-bold">{stats.pct}%</p></div>
                <TrendingUp className="h-6 w-6 opacity-50" />
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Progress Bar */}
        <div>
          <div className="w-full h-3 bg-slate-100 dark:bg-slate-700 rounded-full overflow-hidden flex">
            {stats.total > 0 && (
              <>
                <div className="bg-emerald-500 h-full" style={{ width: `${(stats.present / stats.total) * 100}%` }} />
                <div className="bg-amber-500 h-full" style={{ width: `${(stats.late / stats.total) * 100}%` }} />
                <div className="bg-red-500 h-full" style={{ width: `${(stats.absent / stats.total) * 100}%` }} />
                <div className="bg-purple-500 h-full" style={{ width: `${(stats.leave / stats.total) * 100}%` }} />
              </>
            )}
          </div>
          <div className="flex flex-wrap gap-3 mt-1.5 text-xs text-slate-500 dark:text-slate-400">
            <span className="flex items-center gap-1"><span className="w-2 h-2 rounded-full bg-emerald-500" />Present ({stats.present})</span>
            <span className="flex items-center gap-1"><span className="w-2 h-2 rounded-full bg-amber-500" />Late ({stats.late})</span>
            <span className="flex items-center gap-1"><span className="w-2 h-2 rounded-full bg-red-500" />Absent ({stats.absent})</span>
            <span className="flex items-center gap-1"><span className="w-2 h-2 rounded-full bg-purple-500" />Leave ({stats.leave})</span>
          </div>
        </div>

        {/* Staff Attendance Table - COMPLETE WITH ALL COLUMNS */}
        <Card className="border-0 shadow-md bg-white dark:bg-slate-800">
          <CardHeader className="bg-slate-50 dark:bg-slate-700 rounded-t-2xl py-4 px-5">
            <div className="flex items-center justify-between flex-wrap gap-3">
              <div>
                <CardTitle className="flex items-center gap-2 text-slate-700 dark:text-slate-100">
                  <Calendar className="h-5 w-5 text-blue-600" />
                  Staff Attendance List
                  <Badge className="bg-blue-100 text-blue-700 dark:bg-blue-900 dark:text-blue-300 border-0 ml-1">{filteredStaff.length} staff</Badge>
                </CardTitle>
                <CardDescription className="dark:text-slate-300">Mark attendance with check-in/out time</CardDescription>
              </div>
              <Button onClick={loadData} variant="outline" size="sm" className="rounded-xl dark:border-slate-600 dark:text-white">
                <RefreshCw className="h-4 w-4 mr-1" />Refresh
              </Button>
            </div>
          </CardHeader>
          <CardContent className="p-0 overflow-x-auto">
            {loading ? (
              <div className="flex flex-col items-center justify-center py-16">
                <Loader2 className="h-10 w-10 animate-spin text-blue-600 mb-3" />
                <p className="text-slate-500 dark:text-slate-400 text-sm">Loading staff...</p>
              </div>
            ) : filteredStaff.length === 0 ? (
              <div className="flex flex-col items-center justify-center py-16 text-slate-400 dark:text-slate-500">
                <AlertCircle className="h-14 w-14 mb-3" />
                <p className="font-semibold text-lg">No staff found</p>
                <p className="text-sm">Adjust search or check staff records</p>
              </div>
            ) : (
              <div className="min-w-[1100px]">
                {/* Table Header - COMPLETE COLUMNS */}
                <div className="grid grid-cols-13 gap-2 px-4 py-2.5 text-xs font-semibold text-slate-500 dark:text-slate-300 uppercase tracking-wider bg-slate-50 dark:bg-slate-700 border-b border-slate-100 dark:border-slate-600">
                  <div className="col-span-1 text-center">#</div>
                  <div className="col-span-1 text-center">Photo</div>
                  <div className="col-span-2">ID</div>
                  <div className="col-span-2">Name</div>
                  <div className="col-span-2 hidden md:block">Designation</div>
                  <div className="col-span-3 text-center">Status</div>
                  <div className="col-span-1 text-center">In</div>
                  <div className="col-span-1 text-center">Out</div>
                  <div className="col-span-1 text-center">Notify</div>
                </div>

                <div className="divide-y divide-slate-50 dark:divide-slate-700">
                  {filteredStaff.map((member, idx) => {
                    const currentStatusRaw = member.attendance_status || "absent"
                    let currentStatus = currentStatusRaw
                    let isLockedForStaff = false
                    let lockMessage = ""
                    
                    if (isLockedDay) {
                      currentStatus = "holiday"
                      isLockedForStaff = true
                      lockMessage = "Holiday"
                    } else if (approvedLeaves.includes(member.id)) {
                      currentStatus = "leave"
                      isLockedForStaff = true
                      lockMessage = "Leave"
                    }
                    
                    const hasPhone = !!member.phone
                    const cfg = STATUS_CFG[currentStatus]
                    
                    return (
                      <div
                        key={member.id}
                        className={`staff-row grid grid-cols-13 gap-2 px-4 py-3 items-center ${idx % 2 === 0 ? "bg-white dark:bg-slate-800" : "bg-slate-50/40 dark:bg-slate-700/30"}`}
                      >
                        {/* # - Serial Number */}
                        <div className="col-span-1 text-center">
                          <span className="font-mono text-xs font-semibold text-slate-500 dark:text-slate-300 bg-slate-100 dark:bg-slate-700 px-2 py-0.5 rounded-md inline-block">
                            {idx + 1}
                          </span>
                        </div>
                        
                        {/* Photo */}
                        <div className="col-span-1 flex justify-center">
                          <Avatar className="h-8 w-8">
                            <AvatarImage src={member.photo_url} alt={member.name} />
                            <AvatarFallback className={`text-xs font-bold text-white ${cfg.activeBg}`}>
                              {member.name.charAt(0)}
                            </AvatarFallback>
                          </Avatar>
                        </div>
                        
                        {/* Employee ID */}
                        <div className="col-span-2">
                          <span className="text-sm font-medium text-slate-700 dark:text-slate-200">{member.employee_id}</span>
                        </div>
                        
                        {/* Name */}
                        <div className="col-span-2">
                          <div>
                            <p className="text-sm font-medium text-slate-800 dark:text-white truncate">
                              {member.name}
                            </p>
                            {lockMessage && (
                              <Badge className={`mt-1 ${isLockedDay ? 'bg-indigo-100 text-indigo-700 dark:bg-indigo-900/50 dark:text-indigo-300' : 'bg-purple-100 text-purple-700 dark:bg-purple-900/50 dark:text-purple-300'} border-0 text-[10px]`}>
                                {lockMessage}
                              </Badge>
                            )}
                          </div>
                        </div>
                        
                        {/* Designation */}
                        <div className="col-span-2 hidden md:block">
                          <Badge variant="outline" className="text-xs bg-blue-50 text-blue-700 dark:bg-blue-900/50 dark:text-blue-300 border-0">
                            {member.designation || "-"}
                          </Badge>
                        </div>
                        
                        {/* Status Buttons */}
                        <div className="col-span-3 flex gap-1">
                          {(["present", "late", "absent", "leave"] as AttendanceStatus[]).map(st => {
                            const c = STATUS_CFG[st]
                            const isActive = currentStatus === st
                            const isDisabled = isLockedDay || approvedLeaves.includes(member.id)
                            return (
                              <button
                                key={st}
                                onClick={() => setStatus(member.id, st)}
                                disabled={isDisabled}
                                className={`flex-1 flex items-center justify-center gap-1 py-1.5 px-1 rounded-lg text-xs font-semibold border transition-all 
                                  ${isActive ? `${c.activeBg} text-white border-transparent shadow-sm` : `bg-white dark:bg-slate-700 text-slate-600 dark:text-slate-300 border-slate-200 dark:border-slate-600 hover:bg-slate-50 dark:hover:bg-slate-600`}
                                  ${isDisabled ? 'opacity-50 cursor-not-allowed hover:scale-100' : ''}
                                `}
                              >
                                <c.Icon className="h-3 w-3" />
                                <span className="hidden sm:inline">{c.label}</span>
                              </button>
                            )
                          })}
                        </div>
                        
                        {/* Check-In Time */}
                        <div className="col-span-1">
                          <Input
                            type="time"
                            value={member.check_in || ""}
                            onChange={e => setCheckIn(member.id, e.target.value)}
                            className="h-8 text-xs rounded-lg border-slate-200 dark:border-slate-600 dark:bg-slate-700 dark:text-white text-center w-full px-1"
                            placeholder="--:--"
                            disabled={isLockedDay || approvedLeaves.includes(member.id)}
                          />
                        </div>
                        
                        {/* Check-Out Time */}
                        <div className="col-span-1">
                          <Input
                            type="time"
                            value={member.check_out || ""}
                            onChange={e => setCheckOut(member.id, e.target.value)}
                            className="h-8 text-xs rounded-lg border-slate-200 dark:border-slate-600 dark:bg-slate-700 dark:text-white text-center w-full px-1"
                            placeholder="--:--"
                            disabled={isLockedDay || approvedLeaves.includes(member.id)}
                          />
                        </div>
                        
                        {/* Notify Button */}
                        <div className="col-span-1 flex justify-center">
                          <button
                            onClick={() => { setNotifyStaff(member); setShowNotifyDialog(true) }}
                            title={hasPhone ? `Notify (${member.phone})` : "No phone number"}
                            className={`w-8 h-8 rounded-full flex items-center justify-center transition-all ${hasPhone ? "bg-blue-50 hover:bg-blue-100 dark:bg-blue-900/50 dark:hover:bg-blue-800 text-blue-600 dark:text-blue-400 hover:scale-110" : "bg-slate-100 dark:bg-slate-700 text-slate-300 dark:text-slate-500 cursor-not-allowed"}`}
                            disabled={!hasPhone}
                          >
                            <Send className="h-3.5 w-3.5" />
                          </button>
                        </div>
                      </div>
                    )
                  })}
                </div>
              </div>
            )}
          </CardContent>
        </Card>

        {/* Save Bar */}
        {filteredStaff.length > 0 && (
          <div className="flex items-center justify-between bg-white dark:bg-slate-800 rounded-2xl shadow-md px-5 py-4 border border-slate-100 dark:border-slate-700">
            <div className="text-sm text-slate-500 dark:text-slate-400 hidden md:block">
              <span className="font-medium text-slate-700 dark:text-slate-200">{stats.total} staff</span>
              <span className="mx-1">·</span>
              <span className="text-emerald-600 dark:text-emerald-400">{stats.present} present</span>
              <span className="mx-1">·</span>
              <span className="text-red-600 dark:text-red-400">{stats.absent} absent</span>
              <span className="mx-1">·</span>
              <span className="text-amber-600 dark:text-amber-400">{stats.late} late</span>
              <span className="mx-1">·</span>
              <span className="text-purple-600 dark:text-purple-400">{stats.leave} leave</span>
              <span className="mx-1">·</span>
              <span className="font-bold text-blue-600 dark:text-blue-400">{stats.pct}% attendance</span>
            </div>
            <div className="flex items-center gap-3 ml-auto">
              {saveMsg === "success" && (
                <span className="text-emerald-600 dark:text-emerald-400 text-sm font-medium flex items-center gap-1 animate-pulse">
                  <Check className="h-4 w-4" />Saved!
                </span>
              )}
              {saveMsg === "error" && (
                <span className="text-red-600 dark:text-red-400 text-sm font-medium flex items-center gap-1">
                  <AlertCircle className="h-4 w-4" />Failed
                </span>
              )}
              <Button 
                onClick={saveAttendance} 
                disabled={saving || loading || isLockedDay} 
                size="lg" 
                className="bg-blue-600 hover:bg-blue-700 text-white rounded-xl px-8 shadow-lg font-semibold disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {saving ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : <Save className="h-4 w-4 mr-2" />}
                Save Attendance
              </Button>
            </div>
          </div>
        )}

      </div>
    </ResponsiveLayout>
  )
}
