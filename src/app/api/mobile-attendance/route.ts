import { NextRequest, NextResponse } from "next/server"
import { createClient } from "@/lib/supabase/server"

export async function POST(request: NextRequest) {
  try {
    const { student_id, date, status, remarks, marked_by_id } = await request.json()
    
    if (!student_id || !date || !status) {
      return NextResponse.json({ error: "Missing required fields" }, { status: 400 })
    }
    
    const supabase = await createClient()
    
    const { data, error } = await supabase
      .from("student_attendance")
      .upsert({
        student_id: student_id,
        date: date,
        status: status,
        remarks: remarks || "",
        marked_by: marked_by_id,
        marked_via: "mobile_app",
        timestamp: new Date().toISOString()
      }, { onConflict: "student_id,date" })
      .select()
    
    if (error) throw error
    
    return NextResponse.json({ success: true, data })
    
  } catch (error) {
    console.error("Mobile attendance error:", error)
    return NextResponse.json({ error: "Failed to mark attendance" }, { status: 500 })
  }
}

// GET endpoint for fetching today's students list for mobile
export async function GET(request: NextRequest) {
  try {
    const searchParams = request.nextUrl.searchParams
    const teacherId = searchParams.get("teacherId")
    const date = searchParams.get("date") || new Date().toISOString().split("T")[0]
    
    const supabase = await createClient()
    
    // Get teacher's assigned class/section
    const { data: teacher } = await supabase
      .from("teacher_profiles")
      .select("class_id, section_id")
      .eq("user_id", teacherId)
      .single()
    
    let query = supabase
      .from("students")
      .select("id, name, student_id, class_roll, student_photo_url, fathers_contact")
      .eq("status", "active")
      .order("class_roll")
    
    if (teacher?.class_id) query = query.eq("class_id", teacher.class_id)
    if (teacher?.section_id) query = query.eq("section_id", teacher.section_id)
    
    const { data: students } = await query
    
    // Get today's existing attendance
    const { data: attendance } = await supabase
      .from("student_attendance")
      .select("student_id, status, remarks")
      .in("student_id", students?.map(s => s.id) || [])
      .eq("date", date)
    
    const attendanceMap = new Map(attendance?.map(a => [a.student_id, a]))
    
    const enrichedStudents = students?.map(s => ({
      ...s,
      admission_no: s.student_id,
      photo_url: s.student_photo_url,
      status: attendanceMap.get(s.id)?.status || "pending",
      remarks: attendanceMap.get(s.id)?.remarks || ""
    }))
    
    return NextResponse.json({ success: true, students: enrichedStudents, date })
    
  } catch (error) {
    console.error("Mobile fetch error:", error)
    return NextResponse.json({ error: "Failed to fetch data" }, { status: 500 })
  }
}