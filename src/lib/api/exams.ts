import { createClient } from '@/lib/supabase/server'
import type { Exam, ExamResult, Subject } from '@/types'

export async function getExams() {
  const supabase = await createClient()
  const { data, error } = await supabase
    .from('exams')
    .select(`
      *,
      academic_year:academic_years(id, name)
    `)
    .order('start_date', { ascending: false })

  if (error) throw error
  return data
}

export async function getExamById(id: string) {
  const supabase = await createClient()
  const { data, error } = await supabase
    .from('exams')
    .select(`
      *,
      academic_year:academic_years(id, name)
    `)
    .eq('id', id)
    .single()

  if (error) throw error
  return data
}

export async function createExam(exam: Partial<Exam>) {
  const supabase = await createClient()
  const { data, error } = await supabase
    .from('exam_terms')
    .insert({
      name: exam.name,
      term_code: (exam as any).type,
      start_date: exam.start_date,
      end_date: exam.end_date,
      academic_year_id: exam.academic_year_id,
    })
    .select()
    .single()

  if (error) throw error
  return data
}

export async function updateExam(id: string, exam: Partial<Exam>) {
  const supabase = await createClient()
  const { data, error } = await supabase
    .from('exam_terms')
    .update({
      name: exam.name,
      term_code: (exam as any).type,
      start_date: exam.start_date,
      end_date: exam.end_date,
      academic_year_id: exam.academic_year_id,
    })
    .eq('id', id)
    .select()
    .single()

  if (error) throw error
  return data
}

export async function deleteExam(id: string) {
  const supabase = await createClient()
  const { error } = await supabase
    .from('exams')
    .delete()
    .eq('id', id)

  if (error) throw error
}

export async function getSubjects() {
  const supabase = await createClient()
  const { data, error } = await supabase
    .from('subjects')
    .select(`
      *,
      class:classes(id, name)
    `)
    .order('name')

  if (error) throw error
  return data
}

export async function getExamResults(filters?: { examId?: string; studentId?: string; classId?: string }) {
  const supabase = await createClient()
  let query = supabase
    .from('exam_results')
    .select(`
      *,
      exam:exams(id, name, type),
      student:students(id, name, admission_no, class:classes(id, name), section:sections(id, name)),
      subject:subjects(id, name)
    `)

  if (filters?.examId) query = query.eq('exam_id', filters.examId)
  if (filters?.studentId) query = query.eq('student_id', filters.studentId)

  const { data, error } = await query
  if (error) throw error
  return data
}

export async function enterMarks(results: { examId: string; studentId: string; subjectId: string; marks: number }[]) {
  const supabase = await createClient()
  
  const grade = (marks: number) => {
    if (marks >= 90) return 'A+'
    if (marks >= 80) return 'A'
    if (marks >= 70) return 'A-'
    if (marks >= 60) return 'B'
    if (marks >= 50) return 'C'
    if (marks >= 40) return 'D'
    return 'F'
  }

  const inserts = results.map(r => ({
    exam_id: r.examId,
    student_id: r.studentId,
    subject_id: r.subjectId,
    marks: r.marks,
    grade: grade(r.marks),
  }))

  const { data, error } = await supabase
    .from('exam_results')
    .upsert(inserts, { onConflict: 'exam_id,student_id,subject_id' })
    .select()

  if (error) throw error
  return data
}

export async function getStudentResults(studentId: string) {
  const supabase = await createClient()
  const { data, error } = await supabase
    .from('exam_results')
    .select(`
      *,
      exam:exams(id, name, type),
      subject:subjects(id, name)
    `)
    .eq('student_id', studentId)

  if (error) throw error
  
  const resultsByExam: Record<string, { exam: any; subjects: any[]; total: number; maxMarks: number }> = {}
  data?.forEach(r => {
    if (!resultsByExam[r.exam_id]) {
      resultsByExam[r.exam_id] = { exam: r.exam, subjects: [], total: 0, maxMarks: 0 }
    }
    resultsByExam[r.exam_id].subjects.push(r)
    resultsByExam[r.exam_id].total += Number(r.marks)
    resultsByExam[r.exam_id].maxMarks += 100
  })

  return Object.values(resultsByExam)
}

export async function getExamStats() {
  const supabase = await createClient()
  
  const [{ data: total }, { data: completed }, { data: ongoing }] = await Promise.all([
    supabase.from('exams').select('id', { count: 'exact' }),
    supabase.from('exams').select('id', { count: 'exact' }).lte('end_date', new Date().toISOString().split('T')[0]),
    supabase.from('exams').select('id', { count: 'exact' }).lte('start_date', new Date().toISOString().split('T')[0]).gte('end_date', new Date().toISOString().split('T')[0]),
  ])

  const today = new Date().toISOString().split('T')[0]
  const upcoming = (total?.length || 0) - (completed?.length || 0) - (ongoing?.length || 0)

  return {
    total: total?.length || 0,
    completed: completed?.length || 0,
    ongoing: ongoing?.length || 0,
    upcoming,
  }
}
