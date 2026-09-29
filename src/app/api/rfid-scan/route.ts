// src/app/api/rfid-scan/route.ts
import { NextRequest, NextResponse } from "next/server"
import { createClient } from "@/lib/supabase/server"

export async function POST(request: NextRequest) {
  try {
    const { rfid_uid, date, time } = await request.json()
    
    if (!rfid_uid || !date) {
      return NextResponse.json(
        { error: "RFID UID and date are required" },
        { status: 400 }
      )
    }
    
    const supabase = await createClient()
    
    // আরএফআইডি দ্বারা স্টুডেন্ট খোঁজা
    const { data: student, error: studentError } = await supabase
      .from("students")
      .select("id, name, student_id, class_id, section_id, parent_phone")
      .eq("rfid_uid", rfid_uid)
      .eq("status", "active")
      .single()
    
    if (studentError || !student) {
      return NextResponse.json(
        { error: "Invalid RFID card or student not found" },
        { status: 404 }
      )
    }
    
    // লেট চেক করা (যদি সময় ৯:৩০ এর পরে হয়)
    const currentTime = time || new Date().toTimeString().slice(0, 5)
    const lateThreshold = "09:30"
    const status = currentTime > lateThreshold ? "late" : "present"
    
    // অ্যাটেন্ডেন্স সেভ করা
    const { error: upsertError } = await supabase
      .from("student_attendance")
      .upsert({
        student_id: student.id,
        date: date,
        status: status,
        remarks: status === "late" ? `Arrived at ${currentTime}` : "Scanned via RFID",
        marked_via: "rfid",
        timestamp: new Date().toISOString()
      }, { onConflict: "student_id,date" })
    
    if (upsertError) {
      throw upsertError
    }
    
    return NextResponse.json({
      success: true,
      student: {
        id: student.id,
        name: student.name,
        admission_no: student.student_id
      },
      status: status,
      message: `${student.name} marked ${status} via RFID`
    })
    
  } catch (error) {
    console.error("RFID scan API Error:", error)
    return NextResponse.json(
      { error: "Failed to process RFID scan" },
      { status: 500 }
    )
  }
}