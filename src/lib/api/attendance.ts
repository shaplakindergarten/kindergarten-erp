import { createClient } from '@/lib/supabase/server'
import type { StudentAttendance, StaffAttendance } from '@/types'

export async function getStudentAttendance(filters?: { date?: string; classId?: string; sectionId?: string; academicYearId?: string }) {
  const supabase = await createClient()
  let query = supabase
    .from('student_attendance')
    .select(`
      *,
      student:students(id, name, admission_no, class:classes(id, name), section:sections(id, name))
    `)

  if (filters?.date) {
    query = query.eq('date', filters.date)
  }

  if (filters?.academicYearId) {
    query = query.eq('academic_year_id', filters.academicYearId)
  }

  const { data, error } = await query
  if (error) throw error
  return data
}

export async function markStudentAttendance(date: string, records: { studentId: string; status: 'present' | 'absent' | 'late'; remarks?: string }[]) {
  const supabase = await createClient()
  
  const deletes = records.map(r => 
    supabase.from('student_attendance').delete().eq('date', date).eq('student_id', r.studentId)
  )
  await Promise.all(deletes)

  const inserts = records.map(r => ({
    student_id: r.studentId,
    date,
    status: r.status,
    remarks: r.remarks,
  }))

  const { data, error } = await supabase
    .from('student_attendance')
    .insert(inserts)
    .select()

  if (error) throw error
  return data
}

export async function getStaffAttendance(filters?: { date?: string; academicYearId?: string }) {
  const supabase = await createClient()
  let query = supabase
    .from('staff_attendance')
    .select(`
      *,
      staff:staff(id, name, employee_id, designation, role)
    `)

  if (filters?.date) {
    query = query.eq('date', filters.date)
  }

  if (filters?.academicYearId) {
    query = query.eq('academic_year_id', filters.academicYearId)
  }

  const { data, error } = await query
  if (error) throw error
  return data
}

export async function markStaffAttendance(date: string, records: { staffId: string; status: 'present' | 'absent' | 'late'; remarks?: string }[]) {
  const supabase = await createClient()
  
  const deletes = records.map(r => 
    supabase.from('staff_attendance').delete().eq('date', date).eq('staff_id', r.staffId)
  )
  await Promise.all(deletes)

  const inserts = records.map(r => ({
    staff_id: r.staffId,
    date,
    status: r.status,
    remarks: r.remarks,
  }))

  const { data, error } = await supabase
    .from('staff_attendance')
    .insert(inserts)
    .select()

  if (error) throw error
  return data
}

export async function getAttendanceReport(filters: { startDate: string; endDate: string; classId?: string; academicYearId?: string }) {
  const supabase = await createClient()
  
  let query = supabase
    .from('student_attendance')
    .select(`
      *,
      student:students(id, name, admission_no, class:classes(id, name), section:sections(id, name))
    `)
    .gte('date', filters.startDate)
    .lte('date', filters.endDate)

  if (filters.classId) {
    query = query.eq('student.class_id', filters.classId)
  }

  if (filters.academicYearId) {
    query = query.eq('academic_year_id', filters.academicYearId)
  }

  const { data, error } = await query
  if (error) throw error
  
  const studentStats: Record<string, { student: Record<string, unknown>; present: number; absent: number; late: number; total: number }> = {}
  
  data?.forEach(record => {
    const studentId = record.student_id
    if (!studentStats[studentId]) {
      studentStats[studentId] = { 
        student: record.student, 
        present: 0, 
        absent: 0, 
        late: 0, 
        total: 0 
      }
    }
    studentStats[studentId][record.status as keyof typeof studentStats[typeof studentId]]++
    studentStats[studentId].total++
  })

  return Object.values(studentStats)
}

export async function getAttendanceStats(date?: string, academicYearId?: string) {
  const supabase = await createClient()
  const targetDate = date || new Date().toISOString().split('T')[0]

  let studentAttendanceQuery = supabase
    .from('student_attendance')
    .select('status')
    .eq('date', targetDate)

  if (academicYearId) {
    studentAttendanceQuery = studentAttendanceQuery.eq('academic_year_id', academicYearId)
  }

  let studentsQuery = supabase
    .from('students')
    .select('id', { count: 'exact' })
    .eq('status', 'active')

  if (academicYearId) {
    studentsQuery = studentsQuery.eq('academic_year_id', academicYearId)
  }

  const [{ data: attendance }, { count: totalStudents }, { count: totalStaff }] = await Promise.all([
    studentAttendanceQuery,
    studentsQuery,
    supabase.from('staff').select('id', { count: 'exact' }).eq('status', 'active'),
  ])

  const present = attendance?.filter(a => a.status === 'present').length || 0
  const absent = attendance?.filter(a => a.status === 'absent').length || 0
  const late = attendance?.filter(a => a.status === 'late').length || 0
  const total = attendance?.length || 0
  const percentage = total > 0 ? Math.round(((present + late) / total) * 100) : 0

  return {
    present,
    absent,
    late,
    percentage,
    totalPresent: totalStudents || 0,
    totalStaff: totalStaff || 0,
  }
}
