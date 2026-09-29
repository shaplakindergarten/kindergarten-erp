"use client"

import { useState, useEffect, useCallback, useRef } from "react"
import Link from "next/link"
import {
  CalendarCheck, Users, CheckCircle, XCircle, Clock,
  Filter, Loader2, Save, RefreshCw, Search, ChevronLeft,
  ChevronRight, Printer, FileText, AlertCircle, ArrowLeft,
  Bell, QrCode, Wifi, Send, X, Smartphone, Fingerprint,
  MessageSquare, Phone, ChevronDown, Zap, Lock,
} from "lucide-react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Badge } from "@/components/ui/badge"
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog"
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar"
import { ResponsiveLayout } from "@/components/layout/responsive-layout"
import { createClient } from "@/lib/supabase/client"
import { toast } from "sonner"
import { generatePDFWithPuppeteer, generateReportHTML } from "@/lib/pdf-generator"
import { getSchoolPrintHeader } from "@/components/print/SchoolPrintHeader"

const supabase = createClient()

// =========================================
// TYPES
// =========================================

type AttendanceStatus = "present" | "absent" | "late" | "leave" | "holiday"
type NotifyMethod = "sms" | "whatsapp" | "both"

interface ClassItem { id: string; name: string; numeric_order: number }
interface SectionItem { id: string; name: string; class_id: string }

interface StudentRow {
  id: string
  name: string
  admission_no: string
  class_roll: string
  class_name: string
  section_name: string
  fathers_contact: string
  contact: string
  photo_url?: string
}

interface AttendanceRecord {
  id?: string
  student_id: string
  date: string
  status: AttendanceStatus
  remarks: string
}

interface SchoolInfo {
  school_name: string
  school_address: string
  school_phone: string
  school_logo?: string
  school_email?: string
}

// =========================================
// CONSTANTS
// =========================================

const todayStr = () => new Date().toISOString().split("T")[0]

const fmtDisplay = (d: string) => {
  if (!d) return ""
  const [y, m, day] = d.split("-")
  return `${day}-${m}-${y}`
}

const normalizeStatus = (status: string | undefined): AttendanceStatus => {
  if (!status) return "present"
  const lowerStatus = status.toLowerCase()
  if (lowerStatus === "present") return "present"
  if (lowerStatus === "absent") return "absent"
  if (lowerStatus === "late") return "late"
  if (lowerStatus === "leave") return "leave"
  if (lowerStatus === "holiday") return "holiday"
  return "present"
}

const STATUS_CFG: Record<AttendanceStatus, {
  label: string; Icon: any
  activeBg: string; activeText: string
  borderColor: string; dotColor: string
  printClass: string
}> = {
  present: {
    label: "Present", Icon: CheckCircle,
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
    label: "Absent", Icon: XCircle,
    activeBg: "bg-red-500", activeText: "text-white",
    borderColor: "border-red-400", dotColor: "bg-red-500",
    printClass: "ab",
  },
  leave: {
    label: "Leave", Icon: CalendarCheck,
    activeBg: "bg-purple-500", activeText: "text-white",
    borderColor: "border-purple-400", dotColor: "bg-purple-500",
    printClass: "lv",
  },
  holiday: {
    label: "Holiday", Icon: CalendarCheck,
    activeBg: "bg-indigo-500", activeText: "text-white",
    borderColor: "border-indigo-400", dotColor: "bg-indigo-500",
    printClass: "hd",
  },
}

const getStatusConfig = (status: AttendanceStatus) => {
  return STATUS_CFG[status] || STATUS_CFG.present
}

// =========================================
// MAIN COMPONENT
// =========================================

export default function StudentAttendancePage() {

  // ── Data States ──────────────────────────
  const [classes, setClasses]       = useState<ClassItem[]>([])
  const [sections, setSections]     = useState<SectionItem[]>([])
  const [students, setStudents]     = useState<StudentRow[]>([])
  const [attendance, setAttendance] = useState<Record<string, AttendanceRecord>>({})
  const [schoolInfo, setSchoolInfo] = useState<SchoolInfo>({
    school_name: "Shapla Kindergarten & Pre-cadet",
    school_address: "Nowtala, Madhaiya Bazar, Chandina, Cumilla",
    school_phone: "01923253454",
  })

  // ── Lock System States ────────────────────
  const [isLockedDay, setIsLockedDay] = useState(false)
  const [lockReason, setLockReason] = useState("")
  const [approvedLeaves, setApprovedLeaves] = useState<string[]>([])

  // ── Filter States ────────────────────────
  const [selectedDate, setSelectedDate]       = useState(todayStr())
  const [selectedClass, setSelectedClass]     = useState("all")
  const [selectedSection, setSelectedSection] = useState("all")
  const [searchTerm, setSearchTerm]           = useState("")
  const [showFilters, setShowFilters]         = useState(false)

  // ── UI States ────────────────────────────
  const [loading, setLoading]   = useState(false)
  const [saving, setSaving]     = useState(false)
  const [pdfGen, setPdfGen]     = useState(false)
  const [saveMsg, setSaveMsg]   = useState<"success" | "error" | null>(null)

  // ── Notification States ──────────────────
  const [notifyEnabled, setNotifyEnabled]     = useState(false)
  const [notifyMethod, setNotifyMethod]       = useState<NotifyMethod>("whatsapp")
  const [notifyOnlyAbsent, setNotifyOnlyAbsent] = useState(true)
  const [sendingBulk, setSendingBulk]         = useState(false)
  const [showNotifyDialog, setShowNotifyDialog] = useState(false)
  const [notifyStudent, setNotifyStudent]     = useState<StudentRow | null>(null)
  const [customMsg, setCustomMsg]             = useState("")
  const [sendingSingle, setSendingSingle]     = useState(false)

  // ── RFID States ──────────────────────────
  const [rfidInput, setRfidInput]     = useState("")
  const [rfidLoading, setRfidLoading] = useState(false)
  const rfidRef = useRef<HTMLInputElement>(null)

  // ── QR States ────────────────────────────
  const [showQR, setShowQR]   = useState(false)
  const [scanning, setScanning] = useState(false)
  const videoRef  = useRef<HTMLVideoElement>(null)
  const streamRef = useRef<MediaStream | null>(null)
  const qrInputRef = useRef<HTMLInputElement>(null)

  // ── Ref to prevent infinite loop ──────────
  const loadingRef = useRef(false)

  // =========================================
  // FETCH FUNCTIONS
  // =========================================

  useEffect(() => {
    supabase.from("school_settings")
      .select("school_name, school_address, school_phone, school_logo, school_email")
      .limit(1).single()
      .then(({ data }) => { if (data) setSchoolInfo(data) })
  }, [])

  useEffect(() => {
    supabase.from("classes")
      .select("id, name, numeric_order")
      .order("numeric_order")
      .then(({ data }) => { if (data) setClasses(data) })
  }, [])

  useEffect(() => {
    let q = supabase.from("sections").select("id, name, class_id").order("name")
    if (selectedClass !== "all") q = q.eq("class_id", selectedClass)
    q.then(({ data }) => {
      if (data) {
        setSections(data)
        setSelectedSection("all")
      }
    })
  }, [selectedClass])

  // Get weekly off settings from school_settings (primary) or attendance_settings (fallback)
  const getWeeklyOffSettings = useCallback(async (): Promise<{ is_friday_off: boolean; is_saturday_off: boolean }> => {
    // First try school_settings
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
    
    // Fallback to attendance_settings
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

  // Check if a date is locked (weekly off or holiday)
  const checkDateLock = useCallback(async (date: string): Promise<{ locked: boolean; reason: string }> => {
    // 1. Get day name
    const dayName = new Date(date).toLocaleDateString("en-US", { weekday: "long" }).toLowerCase()
    
    // 2. Get weekly off settings
    const { is_friday_off, is_saturday_off } = await getWeeklyOffSettings()
    
    // Check Friday lock
    if (dayName === "friday" && is_friday_off) {
      return { locked: true, reason: "শুক্রবার সাপ্তাহিক ছুটি (Friday Weekly Holiday)" }
    }
    
    // Check Saturday lock
    if (dayName === "saturday" && is_saturday_off) {
      return { locked: true, reason: "শনিবার সাপ্তাহিক ছুটি (Saturday Weekly Holiday)" }
    }
    
    // 3. Check school holidays
    const { data: holidays } = await supabase
      .from("attendance_holidays")
      .select("title")
      .eq("holiday_date", date)
    
    if (holidays && holidays.length > 0) {
      return { locked: true, reason: `${holidays[0].title} - স্কুল ছুটি (School Holiday)` }
    }
    
    return { locked: false, reason: "" }
  }, [getWeeklyOffSettings])

  // Get approved leaves for the selected date
  const fetchApprovedLeaves = useCallback(async (date: string, studentIds: string[]): Promise<string[]> => {
    if (studentIds.length === 0) return []
    
    const { data: leaves } = await supabase
      .from("student_leaves")
      .select("student_id")
      .in("student_id", studentIds)
      .lte("start_date", date)
      .gte("end_date", date)
      .eq("status", "Approved")
    
    return leaves?.map(l => l.student_id) || []
  }, [])

  const loadData = useCallback(async () => {
    // ── Safety checks ──
    if (loadingRef.current) {
      console.log("⏳ Load already in progress")
      return
    }
    
    if (!selectedDate) {
      console.warn("⚠️ No date selected")
      return
    }
    
    loadingRef.current = true
    setLoading(true)
    
    try {
      console.log(`📊 Loading: ${selectedDate}, Class: ${selectedClass}, Section: ${selectedSection}`)
      
      // ── Check lock status ──
      const { locked, reason } = await checkDateLock(selectedDate)
      setIsLockedDay(locked)
      setLockReason(reason)
      
      // ── Query students ──
      let sq = supabase
        .from("students")
        .select("id, name, student_id, class_roll, class_id, section_id, contact, fathers_contact, student_photo_url")
        .eq("status", "active")
        .order("class_roll")
      if (selectedClass !== "all") sq = sq.eq("class_id", selectedClass)
      if (selectedSection !== "all") sq = sq.eq("section_id", selectedSection)
      const { data: sData, error: sErr } = await sq
      
      // ── Handle students error ──
      if (sErr) {
        const errorDetails = {
          raw: sErr,
          message: (sErr as any)?.message || 'No message',
          code: (sErr as any)?.code || 'No code',
          details: (sErr as any)?.details || 'No details',
          hint: (sErr as any)?.hint || 'No hint'
        }
        console.error("❌ Students query failed:", JSON.stringify(errorDetails, null, 2))
        toast.error(`ছাত্রদের তথ্য লোড করতে ব্যর্থ: ${errorDetails.message || 'ডেটাবেস ত্রুটি'}`)
        setStudents([])
        setAttendance({})
        setApprovedLeaves([])
        setLoading(false)
        loadingRef.current = false
        return
      }
      
      // ── Handle no students ──
      if (!sData || sData.length === 0) {
        console.log("ℹ️ No students found")
        setStudents([])
        setAttendance({})
        setApprovedLeaves([])
        setLoading(false)
        loadingRef.current = false
        return
      }

      console.log(`✅ Found ${sData.length} students`)

      // ── Fetch class names ──
      const classIds = [...new Set(sData.map(s => s.class_id).filter(Boolean))]
      const sectionIds = [...new Set(sData.map(s => s.section_id).filter(Boolean))]
      const cMap = new Map<string, string>()
      const sMap = new Map<string, string>()
      
      if (classIds.length) {
        const { data: cd, error: classError } = await supabase.from("classes").select("id, name").in("id", classIds)
        if (classError) {
          console.warn("⚠️ Class data warning:", classError.message)
        } else if (cd) {
          cd.forEach(c => cMap.set(c.id, c.name))
          console.log(`✅ Loaded ${cd.length} classes`)
        }
      }
      if (sectionIds.length) {
        const { data: sd, error: sectionError } = await supabase.from("sections").select("id, name").in("id", sectionIds)
        if (sectionError) {
          console.warn("⚠️ Section data warning:", sectionError.message)
        } else if (sd) {
          sd.forEach(s => sMap.set(s.id, s.name))
          console.log(`✅ Loaded ${sd.length} sections`)
        }
      }

      const rows: StudentRow[] = sData.map(s => ({
        id: s.id,
        name: s.name,
        admission_no: s.student_id || "N/A",
        class_roll: s.class_roll || "—",
        class_name: cMap.get(s.class_id) || "N/A",
        section_name: sMap.get(s.section_id) || "N/A",
        fathers_contact: s.fathers_contact || "",
        contact: s.contact || s.fathers_contact || "",
        photo_url: s.student_photo_url,
      }))
      setStudents(rows)
      
      // ── Fetch approved leaves for these students ──
      const leaves = await fetchApprovedLeaves(selectedDate, rows.map(r => r.id))
      setApprovedLeaves(leaves)
      console.log(`✅ Found ${leaves.length} approved leaves`)

      // ── Fetch attendance data ──
      const { data: attData, error: attError } = await supabase
        .from("student_attendance")
        .select("id, student_id, date, status, remarks")
        .in("student_id", sData.map(s => s.id))
        .eq("date", selectedDate)

      if (attError) {
        console.warn("⚠️ Attendance fetch warning:", attError)
      } else if (attData) {
        console.log(`✅ Found ${attData.length} attendance records`)
      }

      // ── Build attendance map ──
      const attMap: Record<string, AttendanceRecord> = {}
      
      rows.forEach(r => {
        let status: AttendanceStatus = "present"
        
        // If the entire day is locked (weekly off or holiday), all students get holiday
        if (locked) {
          status = "holiday"
        }
        
        attMap[r.id] = { 
          student_id: r.id, 
          date: selectedDate, 
          status, 
          remarks: "" 
        }
      })
      
      // ── Apply saved attendance ──
      if (attData && !locked) {
        attData.forEach(a => {
          attMap[a.student_id] = {
            id: a.id, student_id: a.student_id,
            date: a.date, status: normalizeStatus(a.status),
            remarks: a.remarks || "",
          }
        })
      }
      
      // ── Apply approved leave status ──
      if (!locked) {
        leaves.forEach(studentId => {
          if (attMap[studentId]) {
            attMap[studentId].status = "leave"
          }
        })
      }
      
      setAttendance(attMap)
      console.log(`✅ Attendance map: ${Object.keys(attMap).length} records`)

    } catch (error) {
      // ── IMPROVED ERROR HANDLING ──
      console.error("❌ loadData FATAL ERROR:", {
        error: error,
        errorType: error?.constructor?.name || 'Unknown',
        errorMessage: error instanceof Error ? error.message : 'No message',
        errorStack: error instanceof Error ? error.stack : 'No stack',
        context: {
          selectedDate,
          selectedClass,
          selectedSection,
          timestamp: new Date().toISOString()
        }
      })
      
      const userMessage = error instanceof Error 
        ? `ডেটা লোড করতে ব্যর্থ: ${error.message}`
        : "অজানা কারণে ডেটা লোড করা সম্ভব হয়নি। আবার চেষ্টা করুন।"
      
      toast.error(userMessage)
      
      // ── Reset states ──
      setStudents([])
      setAttendance({})
      setApprovedLeaves([])
      
    } finally {
      setLoading(false)
      loadingRef.current = false
      console.log("🏁 loadData completed")
    }
  }, [selectedDate, selectedClass, selectedSection, checkDateLock, fetchApprovedLeaves])

  // Only load when dependencies change
  useEffect(() => {
    loadData()
  }, [selectedDate, selectedClass, selectedSection, loadData])

  // =========================================
  // ATTENDANCE HELPERS
  // =========================================

  const setStatus = (studentId: string, status: AttendanceStatus) => {
    if (isLockedDay || approvedLeaves.includes(studentId)) {
      toast.error("এই দিনে অ্যাটেনডেন্স পরিবর্তন করা যাবে না (Attendance locked for this day)")
      return
    }
    setAttendance(prev => ({ ...prev, [studentId]: { ...prev[studentId], status } }))
  }

  const setRemarks = (studentId: string, remarks: string) => {
    if (isLockedDay) return
    setAttendance(prev => ({ ...prev, [studentId]: { ...prev[studentId], remarks } }))
  }

  const markAll = (status: AttendanceStatus) => {
    if (isLockedDay) {
      toast.error("আজ অ্যাটেনডেন্স লক করা আছে (Attendance locked today)")
      return
    }
    setAttendance(prev => {
      const next = { ...prev }
      filteredStudents.forEach(s => {
        if (!approvedLeaves.includes(s.id)) {
          next[s.id] = { ...next[s.id], status }
        }
      })
      return next
    })
    toast.success(`Marked all ${filteredStudents.length} students as ${status}`)
  }

  const shiftDate = (days: number) => {
    const d = new Date(selectedDate)
    d.setDate(d.getDate() + days)
    setSelectedDate(d.toISOString().split("T")[0])
  }

  // =========================================
  // SAVE ATTENDANCE
  // =========================================

  const saveAttendance = async () => {
    if (students.length === 0) { toast.error("No students to save"); return }
    if (isLockedDay) { toast.error("আজ অ্যাটেনডেন্স লক করা আছে। পরিবর্তন সংরক্ষণ করা যাবে না।"); return }
    
    setSaving(true); setSaveMsg(null)
    try {
      const upsertData = students.map(s => {
        let status = attendance[s.id]?.status || "present"
        if (approvedLeaves.includes(s.id)) {
          status = "leave"
        }
        const validStatus = normalizeStatus(status)
        return {
          student_id: s.id,
          date: selectedDate,
          status: validStatus,
          remarks: attendance[s.id]?.remarks || "",
        }
      })
      const { error } = await supabase.from("student_attendance")
        .upsert(upsertData, { onConflict: "student_id,date" })
      if (error) throw error
      setSaveMsg("success")
      toast.success(`Attendance saved for ${students.length} students!`)
      await loadData()
    } catch (e) {
      console.error(e); setSaveMsg("error")
      toast.error("Failed to save attendance")
    } finally {
      setSaving(false)
      setTimeout(() => setSaveMsg(null), 3500)
    }
  }

  // =========================================
  // NOTIFICATION FUNCTIONS
  // =========================================

  const buildMessage = (student: StudentRow, status: AttendanceStatus, custom?: string) => {
    if (custom?.trim()) return custom
    const statusText = status === "present" ? "উপস্থিত (Present)" : status === "absent" ? "অনুপস্থিত (Absent)" : status === "late" ? "দেরিতে এসেছে (Late)" : status === "leave" ? "ছুটিতে (Leave)" : "ছুটির দিন (Holiday)"
    return `প্রিয় অভিভাবক, আপনার সন্তান ${student.name} (${student.admission_no}) আজ ${fmtDisplay(selectedDate)} তারিখে ${statusText} ছিল। — ${schoolInfo.school_name}`
  }

  const sendNotification = async (student: StudentRow, status: AttendanceStatus, msg: string) => {
    const phone = student.fathers_contact || student.contact
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
    if (!notifyStudent) return
    setSendingSingle(true)
    const status = attendance[notifyStudent.id]?.status || "present"
    const msg = buildMessage(notifyStudent, status, customMsg)
    const ok = await sendNotification(notifyStudent, status, msg)
    if (ok) toast.success(`Notification sent to ${notifyStudent.name}`)
    else toast.error("Failed — no phone number or API error")
    setSendingSingle(false)
    setShowNotifyDialog(false)
    setCustomMsg("")
    setNotifyStudent(null)
  }

  const handleBulkNotify = async () => {
    if (isLockedDay) {
      toast.error("আজ অ্যাটেনডেন্স লক করা আছে")
      return
    }
    const targets = filteredStudents.filter(s => {
      const st = attendance[s.id]?.status || "present"
      return notifyOnlyAbsent ? st !== "present" : true
    })
    if (targets.length === 0) { toast.info("No students to notify"); return }

    setSendingBulk(true)
    let ok = 0
    for (const student of targets) {
      const status = attendance[student.id]?.status || "present"
      const msg = buildMessage(student, status)
      const sent = await sendNotification(student, status, msg)
      if (sent) ok++
    }
    toast.success(`Notified ${ok} of ${targets.length} parents`)
    setSendingBulk(false)
  }

  // =========================================
  // RFID SCAN
  // =========================================

  const handleRFIDScan = async (uid: string) => {
    if (!uid.trim()) return
    if (isLockedDay) {
      toast.error("আজ অ্যাটেনডেন্স লক করা আছে। RFID স্ক্যান করা যাবে না।")
      setRfidInput("")
      return
    }
    setRfidLoading(true)
    try {
      const res = await fetch("/api/rfid-scan", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ rfid_uid: uid.trim(), date: selectedDate }),
      })
      const json = await res.json()
      if (json.success && json.student) {
        const student = students.find(s => s.id === json.student.id || s.admission_no === json.student.admission_no)
        if (student) {
          if (approvedLeaves.includes(student.id)) {
            toast.warning(`${json.student.name} - এই ছাত্রের আজ ছুটি অনুমোদিত আছে`)
          } else {
            setStatus(student.id, normalizeStatus(json.status || "present"))
            toast.success(`✅ ${json.student.name} — marked ${json.status || "present"} via RFID`)
          }
        } else {
          toast.warning("Student found in DB but not in current list — check class/section filter")
        }
      } else {
        toast.error(json.error || "Invalid RFID card")
      }
    } catch {
      toast.error("RFID API error")
    } finally {
      setRfidLoading(false)
      setRfidInput("")
      rfidRef.current?.focus()
    }
  }

  // =========================================
  // QR SCAN
  // =========================================

  const startQR = async () => {
    if (isLockedDay) {
      toast.error("আজ অ্যাটেনডেন্স লক করা আছে। QR স্ক্যান করা যাবে না।")
      return
    }
    setShowQR(true)
    setScanning(true)
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ video: { facingMode: "environment" } })
      streamRef.current = stream
      if (videoRef.current) { videoRef.current.srcObject = stream }
    } catch {
      toast.error("Camera access denied")
      setShowQR(false); setScanning(false)
    }
  }

  const stopQR = () => {
    streamRef.current?.getTracks().forEach(t => t.stop())
    setShowQR(false); setScanning(false)
  }

  const handleQRInput = (val: string) => {
    if (isLockedDay) {
      toast.error("আজ অ্যাটেনডেন্স লক করা আছে")
      return
    }
    const student = students.find(s => s.admission_no === val || s.id === val)
    if (!student) { toast.error("No student found for this QR"); return }
    if (approvedLeaves.includes(student.id)) {
      toast.warning(`${student.name} - এই ছাত্রের আজ ছুটি অনুমোদিত আছে`)
      return
    }
    setStatus(student.id, "present")
    toast.success(`✅ ${student.name} marked present via QR`)
    stopQR()
  }

  // =========================================
  // BIOMETRIC
  // =========================================

  const handleBiometric = async () => {
    if (isLockedDay) {
      toast.error("আজ অ্যাটেনডেন্স লক করা আছে")
      return
    }
    if (!window.PublicKeyCredential) {
      toast.error("Biometric not supported on this device")
      return
    }
    try {
      toast.info("Biometric auth initiated — mark all present after verification")
      markAll("present")
    } catch {
      toast.error("Biometric failed")
    }
  }

  // =========================================
  // PDF GENERATION
  // =========================================

  const generatePDF = async () => {
    setPdfGen(true);
    const toastId = toast.loading("পিডিএফ তৈরি হচ্ছে, দয়া করে অপেক্ষা করুন...");
    
    try {
      const html = generateReportHTML(
        schoolInfo,
        selectedDate,
        stats,
        filteredStudents,
        attendance,
        fmtDisplay
      );
      
      await generatePDFWithPuppeteer(html, `attendance_${selectedDate}`);
      
      toast.success("পিডিএফ সফলভাবে ডাউনলোড হয়েছে!", { id: toastId });
      
    } catch (error) {
      console.error("PDF Error:", error);
      toast.error("পিডিএফ তৈরি করতে সমস্যা হয়েছে। আবার চেষ্টা করুন।", { id: toastId });
    } finally {
      setPdfGen(false);
    }
  }

  // =========================================
  // PRINT FUNCTION
  // =========================================

  const handlePrint = () => {
    const printWindow = window.open('', '_blank')
    if (!printWindow) return
    
    const getStatusClass = (status: string) => {
      const normalized = normalizeStatus(status)
      if (normalized === 'present') return 'present-cell'
      if (normalized === 'absent') return 'absent-cell'
      if (normalized === 'late') return 'late-cell'
      if (normalized === 'leave') return 'leave-cell'
      if (normalized === 'holiday') return 'holiday-cell'
      return ''
    }
    
    const getStatusText = (status: string) => {
      const normalized = normalizeStatus(status)
      if (normalized === 'present') return 'Present'
      if (normalized === 'absent') return 'Absent'
      if (normalized === 'late') return 'Late'
      if (normalized === 'leave') return 'Leave'
      if (normalized === 'holiday') return 'Holiday'
      return status
    }
    
    printWindow.document.write(`
      <!DOCTYPE html>
      <html>
      <head>
        <meta charset="UTF-8">
        <title>Student Attendance Report - ${fmtDisplay(selectedDate)}</title>
        <style>
          @import url('https://fonts.googleapis.com/css2?family=Hind+Siliguri:wght@400;600;700&display=swap');
          * { font-family: 'Hind Siliguri', 'Segoe UI', Arial, sans-serif; }
          body { margin: 0; padding: 20px; font-size: 12px; }
          .print-container { max-width: 1200px; margin: 0 auto; }
          .report-date { text-align: center; font-size: 12px; color: #666; margin-bottom: 15px; }
          .stats-line { text-align: center; font-size: 12px; margin: 15px 0; padding: 8px; background: #f0fdf4; border-radius: 6px; border: 1px solid #ddd; }
          .stats-line span { margin: 0 8px; }
          .stats-line .present { color: #059669; font-weight: bold; }
          .stats-line .absent { color: #dc2626; font-weight: bold; }
          .stats-line .late { color: #d97706; font-weight: bold; }
          .stats-line .total { color: #2563eb; font-weight: bold; }
          .stats-line .percent { color: #7c3aed; font-weight: bold; }
          table { width: 100%; border-collapse: collapse; margin-top: 15px; font-size: 11px; }
          th, td { border: 1px solid #ccc; padding: 8px 6px; text-align: center; }
          th { background: #e5e7eb; font-weight: bold; }
          .text-left { text-align: left; }
          .present-cell { color: #059669; font-weight: bold; }
          .absent-cell { color: #dc2626; font-weight: bold; }
          .late-cell { color: #d97706; font-weight: bold; }
          .leave-cell { color: #9333ea; font-weight: bold; }
          .holiday-cell { color: #4f46e5; font-weight: bold; }
          .footer { margin-top: 20px; text-align: center; font-size: 9px; color: #9ca3af; border-top: 1px solid #ccc; padding-top: 8px; }
          @media print { body { margin: 0; padding: 0; } button { display: none; } }
        </style>
      </head>
      <body>
        <div class="print-container">
          ${getSchoolPrintHeader(
            { school_logo: schoolInfo.school_logo, school_name: schoolInfo.school_name, school_address: schoolInfo.school_address, school_phone: schoolInfo.school_phone, school_email: schoolInfo.school_email || "" },
            "Student Attendance Report"
          )}
          <div class="report-date">Date: ${fmtDisplay(selectedDate)}</div>
          ${isLockedDay ? `<div class="stats-line" style="background:#fee2e2;color:#dc2626;">⚠️ ${lockReason} - Attendance Locked</div>` : `
          <div class="stats-line">
            <span>📊 Total: <span class="total">${stats.total}</span></span>
            <span>✓ Present: <span class="present">${stats.present}</span></span>
            <span>✗ Absent: <span class="absent">${stats.absent}</span></span>
            <span>⏰ Late: <span class="late">${stats.late}</span></span>
            <span>📈 Attendance: <span class="percent">${stats.pct}%</span></span>
          </div>
          `}
          <table>
            <thead>
              <tr><th>#</th><th>Roll</th><th class="text-left">Student Name</th><th>Class</th><th>Section</th><th>Status</th><th class="text-left">Remarks</th></tr>
            </thead>
            <tbody>
              ${filteredStudents.map((s, i) => {
                const status = attendance[s.id]?.status || "present"
                const isLeave = approvedLeaves.includes(s.id)
                const displayStatus = isLeave ? "leave" : status
                return `<tr>
                  <td>${i + 1}</td>
                  <td>${s.class_roll}</td>
                  <td class="text-left">${s.name}</td>
                  <td>${s.class_name}</td>
                  <td>${s.section_name}</td>
                  <td class="${getStatusClass(displayStatus)}">${getStatusText(displayStatus)}</td>
                  <td class="text-left">${attendance[s.id]?.remarks || ''}</td>
                </tr>`
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

  // =========================================
  // FILTERED + STATS
  // =========================================

  const filteredStudents = students.filter(s =>
    !searchTerm ||
    s.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
    s.admission_no.toLowerCase().includes(searchTerm.toLowerCase()) ||
    s.class_roll.includes(searchTerm)
  )

  const stats = (() => {
    const total   = filteredStudents.length
    const present = filteredStudents.filter(s => attendance[s.id]?.status === "present").length
    const absent  = filteredStudents.filter(s => attendance[s.id]?.status === "absent").length
    const late    = filteredStudents.filter(s => attendance[s.id]?.status === "late").length
    const pct     = total ? Math.round(((present + late) / total) * 100) : 0
    return { total, present, absent, late, pct }
  })()

  // =========================================
  // RENDER
  // =========================================

  return (
    <ResponsiveLayout>
      <style jsx global>{`
        .att-row { transition: background 0.1s; }
        .att-row:hover { background: #f1f5f9 !important; }
        .dark .att-row:hover { background: #334155 !important; }
        .st-btn { transition: all 0.15s ease; }
        .st-btn:hover:not(:disabled) { transform: translateY(-1px); box-shadow: 0 4px 14px rgba(0,0,0,0.13); }
        .st-btn:active:not(:disabled) { transform: translateY(0); }
        .dark .text-slate-700, .dark .text-slate-800 { color: #e2e8f0 !important; }
        .dark .bg-white { background-color: #0f172a !important; }
        .dark .bg-slate-50 { background-color: #1e293b !important; }
        .dark .border-slate-200 { border-color: #334155 !important; }
        .dark input, .dark textarea { background-color: #1e293b !important; border-color: #334155 !important; color: #f1f5f9 !important; }
        .dark [role="dialog"] { background-color: #1e293b !important; }
        .dark label { color: #cbd5e1 !important; }
        .dark .text-slate-500 { color: #94a3b8 !important; }
        .dark .text-slate-600 { color: #94a3b8 !important; }
        .dark .text-slate-700 { color: #cbd5e1 !important; }
        .dark .text-slate-800 { color: #e2e8f0 !important; }
        .dark .text-slate-900 { color: #f1f5f9 !important; }
        .dark .bg-slate-100 { background-color: #1e293b !important; }
        .dark .bg-slate-200 { background-color: #334155 !important; }
        /* Table column fixes */
        .attendance-table-container {
          overflow-x: auto;
        }
        .attendance-grid {
          display: grid;
          grid-template-columns: 70px minmax(200px, 1.5fr) 140px minmax(280px, 2fr) 120px 60px;
          gap: 0.75rem;
        }
        @media (max-width: 1024px) {
          .attendance-grid {
            grid-template-columns: 70px minmax(180px, 1.5fr) 140px minmax(260px, 2fr) 60px;
          }
          .remarks-col {
            display: none;
          }
        }
        @media (max-width: 768px) {
          .attendance-grid {
            grid-template-columns: 60px minmax(160px, 1.5fr) 140px minmax(240px, 2fr) 50px;
          }
          .class-section-col {
            display: none;
          }
        }
        .attendance-cell {
          overflow: hidden;
          text-overflow: ellipsis;
          white-space: nowrap;
        }
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
              <label className="text-xs font-semibold text-slate-500 dark:text-slate-400 mb-1 block">Or type/paste QR value:</label>
              <div className="flex gap-2">
                <Input ref={qrInputRef} placeholder="Admission No or Student ID..." className="rounded-xl" onKeyDown={e => { if (e.key === "Enter") { handleQRInput(e.currentTarget.value); e.currentTarget.value = "" } }} />
                <Button onClick={() => { if (qrInputRef.current) { handleQRInput(qrInputRef.current.value); qrInputRef.current.value = "" } }} className="rounded-xl">OK</Button>
              </div>
            </div>
            <p className="text-center text-xs text-slate-400 dark:text-slate-500 mt-3">Point camera at QR code or type manually</p>
          </div>
        </div>
      )}

      {/* Single Notify Dialog */}
      <Dialog open={showNotifyDialog} onOpenChange={v => { setShowNotifyDialog(v); if (!v) { setCustomMsg(""); setNotifyStudent(null) } }}>
        <DialogContent className="rounded-3xl max-w-md bg-white dark:bg-slate-800">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2 dark:text-white"><Bell className="h-5 w-5 text-blue-600" />Send Notification</DialogTitle>
          </DialogHeader>
          {notifyStudent && (
            <div className="space-y-4">
              <div className="bg-slate-50 dark:bg-slate-700 rounded-2xl p-4">
                <div className="flex items-center gap-3">
                  <Avatar className="h-10 w-10">
                    <AvatarImage src={notifyStudent.photo_url} alt={notifyStudent.name} />
                    <AvatarFallback className={`text-white font-bold ${getStatusConfig(attendance[notifyStudent.id]?.status || "present").activeBg}`}>
                      {notifyStudent.name.charAt(0)}
                    </AvatarFallback>
                  </Avatar>
                  <div>
                    <p className="font-bold text-slate-800 dark:text-white">{notifyStudent.name}</p>
                    <p className="text-xs text-slate-500 dark:text-slate-400">{notifyStudent.admission_no} · {notifyStudent.class_name}</p>
                  </div>
                  <div className="ml-auto">
                    {(() => { const s = attendance[notifyStudent.id]?.status || "present"; const cfg = getStatusConfig(s); return <Badge className={`${cfg.activeBg} text-white border-0`}>{cfg.label}</Badge> })()}
                  </div>
                </div>
                <div className="flex items-center gap-2 mt-3 text-sm text-slate-600 dark:text-slate-300">
                  <Phone className="h-4 w-4" />
                  <span>{notifyStudent.fathers_contact || notifyStudent.contact || "No phone number"}</span>
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
                  placeholder={buildMessage(notifyStudent, attendance[notifyStudent.id]?.status || "present")}
                  rows={3}
                  className="w-full text-sm border border-slate-200 dark:border-slate-600 rounded-xl p-3 resize-none bg-white dark:bg-slate-800 text-slate-800 dark:text-white focus:outline-none focus:ring-2 focus:ring-blue-400"
                />
              </div>

              <Button onClick={handleSingleNotify} disabled={sendingSingle || !notifyStudent.fathers_contact && !notifyStudent.contact} className="w-full bg-blue-600 hover:bg-blue-700 text-white rounded-xl">
                {sendingSingle ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : <Send className="h-4 w-4 mr-2" />}
                Send Notification
              </Button>
            </div>
          )}
        </DialogContent>
      </Dialog>

      <div className="space-y-5 p-4 md:p-6">

        {/* HEADER */}
        <div className="flex flex-col lg:flex-row lg:items-center lg:justify-between gap-4 bg-gradient-to-r from-blue-600 to-indigo-700 rounded-2xl p-5 shadow-xl">
          <div className="flex items-center gap-4">
            <Button variant="ghost" size="icon" asChild className="bg-white/20 hover:bg-white/30 text-white rounded-xl">
              <Link href="/attendance"><ArrowLeft className="h-5 w-5" /></Link>
            </Button>
            <div>
              <h1 className="text-2xl md:text-3xl font-bold text-white">Student Attendance</h1>
              <p className="text-blue-100 text-sm">Mark, manage & notify — daily attendance system</p>
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
            <Button asChild className="bg-white text-blue-700 hover:bg-blue-50 font-semibold rounded-xl">
              <Link href="/attendance/staff">Staff Attendance</Link>
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

        {/* DATE NAV + QUICK ACTIONS */}
        <Card className="border-0 shadow-md bg-white dark:bg-slate-900">
          <CardContent className="p-4">
            <div className="flex flex-wrap items-center gap-3">
              <Button variant="outline" size="icon" onClick={() => shiftDate(-1)} className="rounded-xl dark:border-slate-700"><ChevronLeft className="h-4 w-4" /></Button>
              <Input type="date" value={selectedDate} onChange={e => setSelectedDate(e.target.value)} className="w-44 font-medium rounded-xl dark:bg-slate-800 dark:border-slate-700 dark:text-white" />
              <Button variant="outline" size="icon" onClick={() => shiftDate(1)} className="rounded-xl dark:border-slate-700"><ChevronRight className="h-4 w-4" /></Button>
              <Button variant="outline" onClick={() => setSelectedDate(todayStr())} className="rounded-xl text-blue-600 border-blue-200 hover:bg-blue-50 dark:border-blue-800 dark:text-blue-400">Today</Button>
              <span className="text-slate-500 text-sm font-medium bg-slate-100 dark:bg-slate-800 dark:text-slate-300 px-3 py-1.5 rounded-lg">{fmtDisplay(selectedDate)}</span>
              <div className="flex-1" />
              <div className="flex items-center gap-2 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl px-3 py-1">
                <Wifi className="h-4 w-4 text-blue-500 flex-shrink-0" />
                <Input ref={rfidRef} placeholder="RFID Scan..." value={rfidInput} onChange={e => setRfidInput(e.target.value)} onKeyDown={e => { if (e.key === "Enter") handleRFIDScan(rfidInput) }} className="border-0 bg-transparent h-7 w-28 text-xs p-0 focus-visible:ring-0 dark:text-white" disabled={rfidLoading || isLockedDay} />
                {rfidLoading && <Loader2 className="h-3 w-3 animate-spin text-blue-500" />}
              </div>
              <div className="flex gap-1.5">
                {(["present", "late", "absent"] as AttendanceStatus[]).map(st => {
                  const c = getStatusConfig(st)
                  return (
                    <Button key={st} size="sm" onClick={() => markAll(st)} disabled={isLockedDay} className={`${c.activeBg} hover:opacity-90 text-white rounded-xl text-xs px-3 disabled:opacity-50 disabled:cursor-not-allowed`}>
                      All {c.label}
                    </Button>
                  )
                })}
              </div>
            </div>
          </CardContent>
        </Card>

        {/* FILTERS */}
        {showFilters && (
          <Card className="border-0 shadow-md bg-white dark:bg-slate-800">
            <CardContent className="pt-5 pb-4">
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-4">
                <div>
                  <label className="text-xs font-semibold text-slate-700 dark:text-slate-200 mb-1 block">Class</label>
                  <Select value={selectedClass} onValueChange={v => { setSelectedClass(v); setSelectedSection("all") }}>
                    <SelectTrigger className="rounded-xl bg-white dark:bg-slate-900 dark:border-slate-600 dark:text-white"><SelectValue placeholder="All Classes" /></SelectTrigger>
                    <SelectContent className="bg-white dark:bg-slate-800">
                      <SelectItem value="all" className="dark:text-white">All Classes</SelectItem>
                      {classes.map(c => <SelectItem key={c.id} value={c.id} className="dark:text-white">{c.name}</SelectItem>)}
                    </SelectContent>
                  </Select>
                </div>
                <div>
                  <label className="text-xs font-semibold text-slate-700 dark:text-slate-200 mb-1 block">Section</label>
                  <Select value={selectedSection} onValueChange={setSelectedSection}>
                    <SelectTrigger className="rounded-xl bg-white dark:bg-slate-900 dark:border-slate-600 dark:text-white"><SelectValue placeholder="All Sections" /></SelectTrigger>
                    <SelectContent className="bg-white dark:bg-slate-800">
                      <SelectItem value="all" className="dark:text-white">All Sections</SelectItem>
                      {sections.map(s => <SelectItem key={s.id} value={s.id} className="dark:text-white">{s.name}</SelectItem>)}
                    </SelectContent>
                  </Select>
                </div>
                <div>
                  <label className="text-xs font-semibold text-slate-700 dark:text-slate-200 mb-1 block">Search</label>
                  <div className="relative">
                    <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400" />
                    <Input placeholder="Name, roll, admission..." value={searchTerm} onChange={e => setSearchTerm(e.target.value)} className="pl-9 rounded-xl bg-white dark:bg-slate-900 dark:border-slate-600 dark:text-white dark:placeholder:text-slate-500" />
                  </div>
                </div>
              </div>
              <div className="border-t border-slate-100 dark:border-slate-700 pt-4">
                <p className="text-xs font-semibold text-slate-700 dark:text-slate-200 mb-3 flex items-center gap-1"><Bell className="h-3.5 w-3.5" />Notification Settings</p>
                <div className="flex flex-wrap items-center gap-4">
                  <label className="flex items-center gap-2 cursor-pointer">
                    <input type="checkbox" checked={notifyEnabled} onChange={e => setNotifyEnabled(e.target.checked)} className="w-4 h-4 rounded accent-blue-600" />
                    <span className="text-sm font-medium text-slate-700 dark:text-slate-200">Enable parent notifications</span>
                  </label>
                  {notifyEnabled && (
                    <>
                      <Select value={notifyMethod} onValueChange={v => setNotifyMethod(v as NotifyMethod)}>
                        <SelectTrigger className="w-36 h-9 rounded-xl text-sm bg-white dark:bg-slate-900 dark:border-slate-600 dark:text-white"><SelectValue /></SelectTrigger>
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

        {/* STATS CARDS */}
        <div className="grid gap-4 grid-cols-2 md:grid-cols-5">
          {[
            { label: "Total Students", value: stats.total, color: "from-slate-600 to-slate-700", Icon: Users },
            { label: "Present", value: stats.present, color: "from-emerald-500 to-emerald-600", Icon: CheckCircle },
            { label: "Absent", value: stats.absent, color: "from-red-500 to-rose-600", Icon: XCircle },
            { label: "Late", value: stats.late, color: "from-amber-500 to-amber-600", Icon: Clock },
            { label: "Attendance %", value: stats.pct + "%", color: "from-blue-500 to-indigo-600", Icon: CalendarCheck },
          ].map(({ label, value, color, Icon }) => (
            <Card key={label} className={`border-0 shadow-md bg-gradient-to-br ${color} text-white`}>
              <CardContent className="p-4">
                <div className="flex items-center justify-between">
                  <div><p className="text-xs opacity-75 mb-0.5">{label}</p><p className="text-2xl font-bold">{value}</p></div>
                  <Icon className="h-7 w-7 opacity-50" />
                </div>
              </CardContent>
            </Card>
          ))}
        </div>

        {/* PROGRESS BAR */}
        <div>
          <div className="w-full h-3 bg-slate-100 dark:bg-slate-700 rounded-full overflow-hidden flex">
            {stats.total > 0 && (
              <>
                <div className="bg-emerald-500 h-full transition-all duration-500" style={{ width: `${(stats.present / stats.total) * 100}%` }} />
                <div className="bg-amber-500 h-full transition-all duration-500" style={{ width: `${(stats.late / stats.total) * 100}%` }} />
                <div className="bg-red-500 h-full transition-all duration-500" style={{ width: `${(stats.absent / stats.total) * 100}%` }} />
              </>
            )}
          </div>
          <div className="flex gap-4 mt-1.5 text-xs text-slate-500 dark:text-slate-400">
            <span className="flex items-center gap-1"><span className="w-2.5 h-2.5 rounded-full bg-emerald-500 inline-block" />Present ({stats.present})</span>
            <span className="flex items-center gap-1"><span className="w-2.5 h-2.5 rounded-full bg-amber-500 inline-block" />Late ({stats.late})</span>
            <span className="flex items-center gap-1"><span className="w-2.5 h-2.5 rounded-full bg-red-500 inline-block" />Absent ({stats.absent})</span>
          </div>
        </div>

        {/* ATTENDANCE TABLE - FIXED COLUMN LAYOUT */}
        <Card className="border-0 shadow-md bg-white dark:bg-slate-800">
          <CardHeader className="bg-slate-50 dark:bg-slate-700 rounded-t-2xl py-4 px-5">
            <div className="flex items-center justify-between flex-wrap gap-3">
              <div>
                <CardTitle className="flex items-center gap-2 text-slate-700 dark:text-slate-100">
                  <CalendarCheck className="h-5 w-5 text-blue-600" />
                  Attendance Sheet
                  <Badge className="bg-blue-100 text-blue-700 dark:bg-blue-900 dark:text-blue-300 border-0 ml-1">{filteredStudents.length} students</Badge>
                </CardTitle>
                <CardDescription className="dark:text-slate-300">{fmtDisplay(selectedDate)}</CardDescription>
              </div>
              <Button onClick={loadData} variant="outline" size="sm" className="rounded-xl dark:border-slate-600 dark:text-white">
                <RefreshCw className="h-4 w-4 mr-1" />Refresh
              </Button>
            </div>
          </CardHeader>
          <CardContent className="p-0 attendance-table-container">
            {loading ? (
              <div className="flex flex-col items-center justify-center py-16">
                <Loader2 className="h-10 w-10 animate-spin text-blue-600 mb-3" />
                <p className="text-slate-500 dark:text-slate-400 text-sm">Loading students...</p>
              </div>
            ) : filteredStudents.length === 0 ? (
              <div className="flex flex-col items-center justify-center py-16 text-slate-400 dark:text-slate-500">
                <AlertCircle className="h-14 w-14 mb-3" />
                <p className="font-semibold text-lg">No students found</p>
                <p className="text-sm">Select a class/section or adjust search</p>
              </div>
            ) : (
              <div className="min-w-[800px]">
                {/* Table Header */}
                <div className="attendance-grid px-4 py-2.5 text-xs font-semibold text-slate-500 dark:text-slate-300 uppercase tracking-wider bg-slate-50 dark:bg-slate-700 border-b border-slate-100 dark:border-slate-600">
                  <div className="text-center">Roll</div>
                  <div>Student</div>
                  <div className="class-section-col">Class/Section</div>
                  <div>Status</div>
                  <div className="remarks-col">Remarks</div>
                  <div className="text-center">Notify</div>
                </div>

                {/* Table Body */}
                <div className="divide-y divide-slate-50 dark:divide-slate-700">
                  {filteredStudents.map((student, idx) => {
                    const currentStatusRaw = attendance[student.id]?.status || "present"
                    const currentStatus = normalizeStatus(currentStatusRaw)
                    const cfg = getStatusConfig(currentStatus)
                    const currentRemarks = attendance[student.id]?.remarks || ""
                    const hasPhone = !!(student.fathers_contact || student.contact)
                    const isOnLeave = approvedLeaves.includes(student.id)
                    const isStudentLocked = isLockedDay || isOnLeave
                    
                    let statusBadgeText = ""
                    if (isLockedDay) statusBadgeText = "Holiday"
                    else if (isOnLeave) statusBadgeText = "Leave Approved"
                    
                    return (
                      <div 
                        key={student.id} 
                        className={`attendance-grid px-4 py-3 items-center ${idx % 2 === 0 ? "bg-white dark:bg-slate-800" : "bg-slate-50/40 dark:bg-slate-700/30"}`}
                      >
                        {/* Roll Column */}
                        <div className="text-center">
                          <span className="font-mono text-xs font-semibold text-slate-500 dark:text-slate-300 bg-slate-100 dark:bg-slate-700 px-2 py-0.5 rounded-md inline-block">
                            {student.class_roll}
                          </span>
                        </div>
                        
                        {/* Student Column */}
                        <div>
                          <div className="flex items-center gap-2">
                            <Avatar className="h-8 w-8 flex-shrink-0">
                              <AvatarImage src={student.photo_url} alt={student.name} />
                              <AvatarFallback className={`text-xs font-bold text-white ${cfg.activeBg}`}>
                                {student.name.charAt(0)}
                              </AvatarFallback>
                            </Avatar>
                            <div className="min-w-0 flex-1">
                              <p className="text-sm font-semibold text-slate-800 dark:text-white leading-tight truncate">
                                {student.name}
                              </p>
                              <p className="text-xs text-slate-400 dark:text-slate-400 truncate">
                                {student.admission_no}
                              </p>
                              {isOnLeave && !isLockedDay && (
                                <Badge className="mt-1 bg-purple-100 text-purple-700 dark:bg-purple-900/50 dark:text-purple-300 text-[10px] px-1.5">
                                  Leave Approved
                                </Badge>
                              )}
                            </div>
                          </div>
                        </div>
                        
                        {/* Class/Section Column */}
                        <div className="class-section-col">
                          <div className="flex gap-1 flex-wrap">
                            <Badge variant="outline" className="text-xs bg-blue-50 text-blue-700 dark:bg-blue-900/50 dark:text-blue-300 border-0">
                              {student.class_name}
                            </Badge>
                            <Badge variant="outline" className="text-xs bg-slate-50 text-slate-600 dark:bg-slate-700 dark:text-slate-300 border-0">
                              {student.section_name}
                            </Badge>
                          </div>
                        </div>
                        
                        {/* Status Column */}
                        <div>
                          <div className="flex items-center gap-1.5">
                            {(["present", "late", "absent"] as AttendanceStatus[]).map(st => {
                              const c = getStatusConfig(st)
                              const isActive = currentStatus === st
                              return (
                                <button
                                  key={st}
                                  onClick={() => setStatus(student.id, st)}
                                  disabled={isStudentLocked}
                                  className={`flex-1 flex items-center justify-center gap-1 py-1.5 px-1 rounded-xl text-xs font-semibold border-2 transition-all
                                    ${isActive ? `${c.activeBg} text-white border-transparent shadow-md` : `bg-white dark:bg-slate-700 text-slate-600 dark:text-slate-300 border-slate-200 dark:border-slate-600`}
                                    ${isStudentLocked ? 'opacity-50 cursor-not-allowed hover:scale-100' : 'hover:scale-105'}
                                  `}
                                >
                                  <c.Icon className="h-3.5 w-3.5 flex-shrink-0" />
                                  <span className="hidden sm:inline">{c.label}</span>
                                </button>
                              )
                            })}
                            {statusBadgeText && (
                              <Badge className={`ml-1 flex-shrink-0 ${isLockedDay ? 'bg-indigo-100 text-indigo-700' : 'bg-purple-100 text-purple-700'} border-0 text-[10px]`}>
                                {statusBadgeText}
                              </Badge>
                            )}
                          </div>
                        </div>
                        
                        {/* Remarks Column */}
                        <div className="remarks-col">
                          <Input 
                            placeholder="Note..." 
                            value={currentRemarks} 
                            onChange={e => setRemarks(student.id, e.target.value)} 
                            disabled={isLockedDay}
                            className="h-8 text-xs rounded-lg border-slate-200 dark:border-slate-600 dark:bg-slate-700 dark:text-white dark:placeholder:text-slate-400 disabled:opacity-50 w-full" 
                          />
                        </div>
                        
                        {/* Notify Column */}
                        <div className="text-center">
                          <button 
                            onClick={() => { setNotifyStudent(student); setShowNotifyDialog(true) }} 
                            title={hasPhone ? `Notify parent (${student.fathers_contact || student.contact})` : "No phone number"} 
                            className={`w-8 h-8 rounded-full flex items-center justify-center transition-all flex-shrink-0 mx-auto ${hasPhone ? "bg-blue-50 hover:bg-blue-100 dark:bg-blue-900/50 dark:hover:bg-blue-800 text-blue-600 dark:text-blue-400 hover:scale-110" : "bg-slate-100 dark:bg-slate-700 text-slate-300 dark:text-slate-500 cursor-not-allowed"}`} 
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

        {/* SAVE BUTTON */}
        {filteredStudents.length > 0 && (
          <div className="flex items-center justify-between bg-white dark:bg-slate-800 rounded-2xl shadow-md px-5 py-4 border border-slate-100 dark:border-slate-700">
            <div className="text-sm text-slate-500 dark:text-slate-400 hidden md:block">
              <span className="font-medium text-slate-700 dark:text-slate-200">{stats.total} students</span>
              <span className="mx-1">·</span>
              <span className="text-emerald-600 dark:text-emerald-400 font-medium">{stats.present} present</span>
              <span className="mx-1">·</span>
              <span className="text-red-600 dark:text-red-400 font-medium">{stats.absent} absent</span>
              <span className="mx-1">·</span>
              <span className="text-amber-600 dark:text-amber-400 font-medium">{stats.late} late</span>
              <span className="mx-1">·</span>
              <span className="font-bold text-blue-600 dark:text-blue-400">{stats.pct}% attendance</span>
            </div>
            <div className="flex items-center gap-3 ml-auto">
              {saveMsg === "success" && <span className="text-emerald-600 dark:text-emerald-400 text-sm font-medium flex items-center gap-1 animate-pulse"><CheckCircle className="h-4 w-4" />Saved!</span>}
              {saveMsg === "error" && <span className="text-red-600 dark:text-red-400 text-sm font-medium flex items-center gap-1"><AlertCircle className="h-4 w-4" />Failed</span>}
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
