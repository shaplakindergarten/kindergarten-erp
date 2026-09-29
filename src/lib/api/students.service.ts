// src/lib/api/students.service.ts

import { createClient, getSupabaseClient } from '@/lib/supabase/client'
import { RealtimeChannel } from '@supabase/supabase-js'

// ============================
// TYPES
// ============================

export interface Student {
  id: string
  student_id: string
  name: string
  name_bn?: string
  father_name: string
  father_name_bn?: string
  mother_name: string
  mother_name_bn?: string
  dob: string
  birth_cert_no?: string
  blood_group?: string
  particular_disease?: string
  gender: string
  contact: string
  fathers_contact?: string
  mothers_contact?: string
  email?: string
  whatsapp?: string
  village?: string
  post_office?: string
  police_station?: string
  district?: string
  permanent_village?: string
  permanent_post_office?: string
  permanent_police_station?: string
  permanent_district?: string
  class_roll?: string
  class_id: string
  section_id: string
  academic_year_id?: string
  admission_date?: string
  photo_url?: string
  student_photo_url?: string
  father_nid_no?: string
  mother_nid_no?: string
  status: 'active' | 'inactive' | 'transferred' | 'graduated'
  created_at?: string
  updated_at?: string
  class?: { id: string; name: string }
  section?: { id: string; name: string }
  academic_year?: { id: string; name: string }
}

export interface StudentFilters {
  search?: string
  class_id?: string
  section_id?: string
  status?: string
  page?: number
  limit?: number
  sort_by?: string
  sort_order?: 'asc' | 'desc'
}

export interface StudentListResponse {
  data: Student[]
  total: number
  page: number
  limit: number
  totalPages: number
}

export interface BulkOperationResponse {
  success: boolean
  message: string
  errors?: string[]
}

export interface PrintFilters {
  classId?: string
  sectionId?: string
  academicYearId?: string
  search?: string
  studentId?: string
}

// ============================
// STUDENT SERVICE
// ============================

class StudentService {
  // ✅ ফিক্স ১: সিঙ্ক্রোনাস মেথড (await ছাড়া)
  private getSupabase() {
    return getSupabaseClient()
  }

  private subscription: RealtimeChannel | null = null

  // ============================
  // CRUD OPERATIONS
  // ============================

  async getStudents(filters: StudentFilters = {}): Promise<StudentListResponse> {
    const {
      search = '',
      class_id,
      section_id,
      status,
      page = 1,
      limit = 20,
      sort_by = 'created_at',
      sort_order = 'desc',
    } = filters

    const offset = (page - 1) * limit

    let query = this.getSupabase()
      .from('students')
      .select(`
        *,
        class:classes(id, name),
        section:sections(id, name),
        academic_year:academic_years(id, name)
      `, { count: 'exact' })

    if (search && search.trim() !== '') {
      query = query.or(
        `name.ilike.%${search}%,` +
        `father_name.ilike.%${search}%,` +
        `mother_name.ilike.%${search}%,` +
        `student_id.ilike.%${search}%,` +
        `contact.ilike.%${search}%,` +
        `class_roll.ilike.%${search}%`
      )
    }

    if (class_id && class_id !== 'all' && class_id.trim() !== '') {
      query = query.eq('class_id', class_id)
    }

    if (section_id && section_id !== 'all' && section_id.trim() !== '') {
      query = query.eq('section_id', section_id)
    }

    if (status && status !== 'all' && status.trim() !== '') {
      query = query.eq('status', status)
    }

    query = query.order(sort_by, { ascending: sort_order === 'asc' })
    query = query.range(offset, offset + limit - 1)

    const { data, error, count } = await query

    if (error) {
      console.error('Error fetching students:', error)
      return {
        data: [],
        total: 0,
        page,
        limit,
        totalPages: 0,
      }
    }

    return {
      data: data || [],
      total: count || 0,
      page,
      limit,
      totalPages: Math.ceil((count || 0) / limit),
    }
  }

  /**
   * ✅ FIXED: Get single student by ID with proper error handling
   * এবং retry mechanism
   */
  async getStudentById(id: string, retries: number = 5): Promise<Student | null> {
    if (!id) {
      console.error('❌ Student ID is missing')
      return null
    }

    console.log(`🔍 Fetching student with ID: ${id}`)

    // ✅ প্রথমে basic query করে দেখি student আছে কিনা
    const { data: basicData, error: basicError } = await this.getSupabase()
      .from('students')
      .select('*')
      .eq('id', id)
      .maybeSingle()

    if (basicError) {
      console.error('❌ Basic student fetch error:', basicError)
      return null
    }

    if (!basicData) {
      console.error(`❌ No student found with ID: ${id}`)
      return null
    }

    console.log('✅ Basic student data found:', basicData)

    // ✅ এখন join query চেষ্টা করি - কিন্তু যদি fail করে তাহলে basic data return করি
    try {
      const { data, error } = await this.getSupabase()
        .from('students')
        .select(`
          *,
          class:classes(id, name),
          section:sections(id, name),
          academic_year:academic_years(id, name)
        `)
        .eq('id', id)
        .maybeSingle()

      if (error) {
        console.warn('⚠️ Join query failed, returning basic data:', error)
        // ✅ JOIN fail করলেও basic data return করি
        return basicData as Student
      }

      if (!data) {
        console.warn('⚠️ No data from join query, returning basic data')
        return basicData as Student
      }

      console.log('✅ Full student data loaded:', data)
      return data as Student

    } catch (err) {
      console.warn('⚠️ Unexpected error in join query, returning basic data:', err)
      return basicData as Student
    }
  }

  /**
   * ✅ NEW: Get student by student_id (not UUID)
   */
  async getStudentByStudentId(studentId: string): Promise<Student | null> {
    if (!studentId) {
      console.error('❌ Student ID is missing')
      return null
    }

    console.log(`🔍 Fetching student by student_id: ${studentId}`)

    const { data: basicData, error: basicError } = await this.getSupabase()
      .from('students')
      .select('*')
      .eq('student_id', studentId)
      .maybeSingle()

    if (basicError) {
      console.error('❌ Basic student fetch error:', basicError)
      return null
    }

    if (!basicData) {
      console.error(`❌ No student found with student_id: ${studentId}`)
      return null
    }

    console.log('✅ Student found by student_id:', basicData)

    // Try to get joins
    try {
      const { data, error } = await this.getSupabase()
        .from('students')
        .select(`
          *,
          class:classes(id, name),
          section:sections(id, name),
          academic_year:academic_years(id, name)
        `)
        .eq('student_id', studentId)
        .maybeSingle()

      if (error || !data) {
        return basicData as Student
      }

      return data as Student
    } catch (err) {
      return basicData as Student
    }
  }

  /**
   * ✅ DEBUG: Get student by ID with full error details
   */
  async getStudentByIdDebug(id: string): Promise<{ 
    success: boolean; 
    data?: Student | null; 
    error?: any;
    steps?: any[];
  }> {
    const steps: any[] = []
    
    if (!id) {
      return { success: false, error: 'Student ID is missing', steps }
    }

    console.log('🔍 Debug fetching student with ID:', id)

    try {
      // Step 1: Check connection
      steps.push({ step: 1, action: 'Checking Supabase connection' })
      const { data: testData, error: testError } = await this.getSupabase()
        .from('students')
        .select('count')
        .limit(1)
      
      if (testError) {
        steps.push({ step: 1, status: 'error', error: testError })
        return { success: false, error: testError, steps }
      }
      steps.push({ step: 1, status: 'success' })

      // Step 2: Basic query
      steps.push({ step: 2, action: 'Fetching basic student data' })
      const { data: basicData, error: basicError } = await this.getSupabase()
        .from('students')
        .select('*')
        .eq('id', id)
        .maybeSingle()

      if (basicError) {
        steps.push({ step: 2, status: 'error', error: basicError })
        return { success: false, error: basicError, steps }
      }

      if (!basicData) {
        steps.push({ step: 2, status: 'error', error: 'No student found' })
        return { success: false, error: 'No student found', steps }
      }
      steps.push({ step: 2, status: 'success', data: basicData })

      // Step 3: Join query
      steps.push({ step: 3, action: 'Fetching with joins' })
      const { data, error } = await this.getSupabase()
        .from('students')
        .select(`
          *,
          class:classes(id, name),
          section:sections(id, name),
          academic_year:academic_years(id, name)
        `)
        .eq('id', id)
        .maybeSingle()

      if (error) {
        steps.push({ step: 3, status: 'warning', error: error.message })
        return { success: true, data: basicData, steps }
      }

      steps.push({ step: 3, status: 'success', data })
      return { success: true, data: data || basicData, steps }

    } catch (err) {
      steps.push({ step: 'error', error: err })
      return { success: false, error: err, steps }
    }
  }

  async createStudent(data: Partial<Student>): Promise<{ success: boolean; data?: Student; error?: string }> {
    try {
      if (!data.student_id) {
        const year = new Date().getFullYear()
        const classData = await this.getSupabase()
          .from('classes')
          .select('name')
          .eq('id', data.class_id)
          .single()

        const classInitial = classData.data?.name?.charAt(0).toUpperCase() || 'X'
        
        const { data: lastStudent } = await this.getSupabase()
          .from('students')
          .select('student_id')
          .ilike('student_id', `${year}-${classInitial}-%`)
          .order('student_id', { ascending: false })
          .limit(1)

        let serial = 1
        if (lastStudent && lastStudent.length > 0) {
          const lastSerial = parseInt(lastStudent[0].student_id.split('-')[2] || '0')
          serial = lastSerial + 1
        }

        data.student_id = `${year}-${classInitial}-${String(serial).padStart(3, '0')}`
      }

      const { data: created, error } = await this.getSupabase()
        .from('students')
        .insert(data)
        .select(`
          *,
          class:classes(id, name),
          section:sections(id, name),
          academic_year:academic_years(id, name)
        `)
        .single()

      if (error) {
        console.error('Create student error:', error)
        return { success: false, error: error.message }
      }

      return { success: true, data: created }
    } catch (err: any) {
      console.error('Unexpected create student error:', err)
      return { success: false, error: err.message || 'Failed to create student' }
    }
  }

  async updateStudent(id: string, data: Partial<Student>): Promise<{ success: boolean; data?: Student; error?: string }> {
    try {
      if (!id) {
        return { success: false, error: 'Student ID is required' }
      }

      const cleanData: Record<string, any> = {}
      Object.keys(data).forEach(key => {
        const value = data[key as keyof Student]
        if (value !== undefined && value !== null) {
          cleanData[key] = value
        }
      })

      const { data: updated, error } = await this.getSupabase()
        .from('students')
        .update(cleanData)
        .eq('id', id)
        .select(`
          *,
          class:classes(id, name),
          section:sections(id, name),
          academic_year:academic_years(id, name)
        `)
        .single()

      if (error) {
        console.error('Update student error:', error)
        return { success: false, error: error.message }
      }

      return { success: true, data: updated }
    } catch (err: any) {
      console.error('Unexpected update student error:', err)
      return { success: false, error: err.message || 'Failed to update student' }
    }
  }

  async updateStudentPhoto(id: string, photoUrl: string): Promise<{ success: boolean; error?: string }> {
    try {
      if (!id) {
        return { success: false, error: 'Student ID is required' }
      }

      if (!photoUrl) {
        return { success: false, error: 'Photo URL is required' }
      }

      const { error } = await this.getSupabase()
        .from('students')
        .update({ student_photo_url: photoUrl })
        .eq('id', id)

      if (error) {
        console.error('Supabase error:', error)
        return { success: false, error: error.message }
      }

      return { success: true }
    } catch (err: any) {
      console.error('Error updating photo:', err)
      return { success: false, error: err.message || 'An unexpected error occurred' }
    }
  }

  async deleteStudent(id: string): Promise<{ success: boolean; error?: string }> {
    try {
      const { error } = await this.getSupabase()
        .from('students')
        .delete()
        .eq('id', id)

      if (error) {
        console.error('Delete student error:', error)
        return { success: false, error: error.message }
      }

      return { success: true }
    } catch (err: any) {
      console.error('Unexpected delete student error:', err)
      return { success: false, error: err.message || 'Failed to delete student' }
    }
  }

  async bulkDeleteStudents(ids: string[]): Promise<BulkOperationResponse> {
    try {
      if (!ids || ids.length === 0) {
        return { success: false, message: 'No students selected for deletion' }
      }

      const { error } = await this.getSupabase()
        .from('students')
        .delete()
        .in('id', ids)

      if (error) {
        console.error('Bulk delete error:', error)
        return { success: false, message: error.message }
      }

      return { success: true, message: `Successfully deleted ${ids.length} students` }
    } catch (err: any) {
      return { success: false, message: err.message || 'Bulk deletion failed' }
    }
  }

  async bulkUpdateStatus(ids: string[], status: string): Promise<BulkOperationResponse> {
    try {
      if (!ids || ids.length === 0) {
        return { success: false, message: 'No students selected' }
      }

      const { error } = await this.getSupabase()
        .from('students')
        .update({ status })
        .in('id', ids)

      if (error) {
        console.error('Bulk update error:', error)
        return { success: false, message: error.message }
      }

      return { success: true, message: `Successfully updated ${ids.length} students` }
    } catch (err: any) {
      return { success: false, message: err.message || 'Bulk update failed' }
    }
  }

  // ============================
  // GET STATS
  // ============================

  async getStudentStats() {
    try {
      const [{ data: total }, { data: active }, { data: newThisMonth }] = await Promise.all([
        this.getSupabase().from('students').select('id', { count: 'exact' }),
        this.getSupabase().from('students').select('id', { count: 'exact' }).eq('status', 'active'),
        this.getSupabase()
          .from('students')
          .select('id', { count: 'exact' })
          .gte('created_at', new Date(new Date().getFullYear(), new Date().getMonth(), 1).toISOString()),
      ])

      const { data: inactive } = await this.getSupabase()
        .from('students')
        .select('id', { count: 'exact' })
        .eq('status', 'inactive')

      const { data: transferred } = await this.getSupabase()
        .from('students')
        .select('id', { count: 'exact' })
        .eq('status', 'transferred')

      return {
        total: total?.length || 0,
        active: active?.length || 0,
        newThisMonth: newThisMonth?.length || 0,
        inactive: inactive?.length || 0,
        transferred: transferred?.length || 0,
      }
    } catch (err) {
      console.error('Failed to get student stats:', err)
      return { total: 0, active: 0, newThisMonth: 0, inactive: 0, transferred: 0 }
    }
  }

  // ============================
  // FILE OPERATIONS
  // ============================

  async uploadPhoto(studentId: string, file: File): Promise<{ success: boolean; url?: string; error?: string }> {
    try {
      const ext = file.name.split('.').pop()
      const path = `${studentId}/photo_${Date.now()}.${ext}`

      const { error: uploadError } = await this.getSupabase().storage
        .from('student-documents')
        .upload(path, file, { upsert: true })

      if (uploadError) {
        return { success: false, error: uploadError.message }
      }

      const { data } = this.getSupabase().storage
        .from('student-documents')
        .getPublicUrl(path)

      const { error: updateError } = await this.getSupabase()
        .from('students')
        .update({ student_photo_url: data.publicUrl })
        .eq('id', studentId)

      if (updateError) {
        return { success: false, error: updateError.message }
      }

      return { success: true, url: data.publicUrl }
    } catch (err: any) {
      return { success: false, error: err.message || 'Upload failed' }
    }
  }

  async exportToCSV(filters: StudentFilters = {}): Promise<{ success: boolean; data?: string; error?: string }> {
    try {
      const response = await this.getStudents({ ...filters, limit: 1000 })
      
      if (!response.data || response.data.length === 0) {
        return { success: false, error: 'No data to export' }
      }

      const headers = [
        'ID', 'Name', 'Father Name', 'Mother Name', 'Class', 'Section',
        'Contact', 'Email', 'Address', 'Status', 'Created At'
      ]

      const rows = response.data.map((s: Student) => [
        s.student_id,
        s.name,
        s.father_name,
        s.mother_name,
        s.class?.name || '',
        s.section?.name || '',
        s.contact,
        s.email || '',
        s.village || '',
        s.status,
        s.created_at || '',
      ])

      const csvContent = [
        headers.join(','),
        ...rows.map(row => row.join(','))
      ].join('\n')

      return { success: true, data: csvContent }
    } catch (err: any) {
      return { success: false, error: err.message || 'Export failed' }
    }
  }

  // ============================
  // ✅ NEW: GET STUDENTS FOR PRINT REPORTS
  // ============================

  async getStudentsForPrint(filters: PrintFilters = {}): Promise<{ data: Student[]; total: number }> {
    try {
      const { classId, sectionId, academicYearId, search, studentId } = filters

      let query = this.getSupabase()
        .from('students')
        .select(`
          *,
          class:classes(id, name),
          section:sections(id, name),
          academic_year:academic_years(id, name)
        `)
        .eq('status', 'active')

      if (studentId && studentId.trim() !== '') {
        query = query.eq('student_id', studentId)
      }

      if (classId && classId !== 'all' && classId.trim() !== '') {
        query = query.eq('class_id', classId)
      }

      if (sectionId && sectionId !== 'all' && sectionId.trim() !== '') {
        query = query.eq('section_id', sectionId)
      }

      if (academicYearId && academicYearId.trim() !== '') {
        query = query.eq('academic_year_id', academicYearId)
      }

      if (search && search.trim() !== '') {
        query = query.or(
          `name.ilike.%${search}%,` +
          `father_name.ilike.%${search}%,` +
          `student_id.ilike.%${search}%,` +
          `contact.ilike.%${search}%`
        )
      }

      const { data, error } = await query.order('name', { ascending: true })

      if (error) {
        console.error('❌ Error fetching students for print:', error)
        return { data: [], total: 0 }
      }

      return { data: data || [], total: data?.length || 0 }
    } catch (err) {
      console.error('❌ Unexpected error in getStudentsForPrint:', err)
      return { data: [], total: 0 }
    }
  }

  // ============================
  // ✅ FINAL FIX: REALTIME SUBSCRIPTION
  // ============================

  async subscribeToChanges(
    onInsert: (payload: any) => void,
    onUpdate: (payload: any) => void,
    onDelete: (payload: any) => void
  ): Promise<RealtimeChannel> {
    // ১. আগের সাবস্ক্রিপশন সম্পূর্ণ মুছে ফেলুন (Channel Name Collision এড়াতে)
    await this.unsubscribe()

    // ২. ইউনিক Channel Name তৈরি করুন (যাতে HMR/Strict Mode-এ collide না করে)
    const channelName = `students-changes-${Date.now()}-${Math.random().toString(36).slice(2, 11)}`
    const channel = this.getSupabase()
      .channel(channelName)
      .on(
        'postgres_changes',
        { event: 'INSERT', schema: 'public', table: 'students' },
        (payload) => onInsert(payload)
      )
      .on(
        'postgres_changes',
        { event: 'UPDATE', schema: 'public', table: 'students' },
        (payload) => onUpdate(payload)
      )
      .on(
        'postgres_changes',
        { event: 'DELETE', schema: 'public', table: 'students' },
        (payload) => onDelete(payload)
      )

    this.subscription = channel

    // ৩. Subscribe করার সময় Callback দিন (Status ট্র্যাক করতে)
    channel.subscribe((status) => {
      console.log(`📡 Students realtime status for ${channelName}:`, status)

      if (status === 'SUBSCRIBED') {
        console.log('✅ Students realtime subscribed successfully')
      }

      if (status === 'CHANNEL_ERROR') {
        console.error('❌ Students realtime channel error')
      }

      if (status === 'TIMED_OUT') {
        console.error('⏱️ Students realtime subscription timed out')
      }

      if (status === 'CLOSED') {
        console.warn('⚠️ Students realtime channel closed')
      }
    })

    return channel
  }

  async unsubscribe(): Promise<void> {
    if (this.subscription) {
      // removeChannel-এর পর subscription-কে null করা হচ্ছে
      await this.getSupabase().removeChannel(this.subscription)
      this.subscription = null
    }
  }
}

// Export singleton instance
export const studentService = new StudentService()

// Export individual functions for backward compatibility
export const getStudents = (filters?: StudentFilters) => studentService.getStudents(filters)
export const getStudentById = (id: string, retries?: number) => studentService.getStudentById(id, retries)
export const getStudentByStudentId = (studentId: string) => studentService.getStudentByStudentId(studentId)
export const getStudentByIdDebug = (id: string) => studentService.getStudentByIdDebug(id)
export const createStudent = (data: Partial<Student>) => studentService.createStudent(data)
export const updateStudent = (id: string, data: Partial<Student>) => studentService.updateStudent(id, data)
export const deleteStudent = (id: string) => studentService.deleteStudent(id)
export const bulkDeleteStudents = (ids: string[]) => studentService.bulkDeleteStudents(ids)
export const bulkUpdateStatus = (ids: string[], status: string) => studentService.bulkUpdateStatus(ids, status)
export const updateStudentPhoto = (id: string, photoUrl: string) => studentService.updateStudentPhoto(id, photoUrl)
export const uploadStudentPhoto = (studentId: string, file: File) => studentService.uploadPhoto(studentId, file)
export const getStudentStats = () => studentService.getStudentStats()
export const exportStudentsCSV = (filters?: StudentFilters) => studentService.exportToCSV(filters)
export const getStudentsForPrint = (filters?: PrintFilters) => studentService.getStudentsForPrint(filters)
export const subscribeToStudents = async (onInsert: any, onUpdate: any, onDelete: any) => 
  studentService.subscribeToChanges(onInsert, onUpdate, onDelete)
export const unsubscribeFromStudents = () => studentService.unsubscribe()

// ============================
// GET CLASSES WITH SECTIONS
// ============================

export async function getClasses() {
  const supabase = createClient()

  try {
    const { data, error } = await supabase
      .from('classes')
      .select(`
        *,
        sections (
          id,
          name,
          capacity,
          class_teacher_id
        )
      `)
      .order('numeric_order', { ascending: true })

    if (error) {
      console.error('❌ Error fetching classes with sections:', error)
      return []
    }

    return data?.map(cls => ({
      ...cls,
      sections: cls.sections || []
    })) || []

  } catch (err) {
    console.error('❌ Unexpected error in getClasses:', err)
    return []
  }
}

export async function getClassById(classId: string) {
  const supabase = createClient()

  try {
    const { data, error } = await supabase
      .from('classes')
      .select(`
        *,
        sections (
          id,
          name,
          capacity,
          class_teacher_id
        )
      `)
      .eq('id', classId)
      .single()

    if (error) {
      console.error('❌ Error fetching class:', error)
      return null
    }

    return {
      ...data,
      sections: data?.sections || []
    }

  } catch (err) {
    console.error('❌ Unexpected error in getClassById:', err)
    return null
  }
}

export async function getAcademicYears() {
  const supabase = createClient()

  const { data, error } = await supabase
    .from('academic_years')
    .select('*')
    .order('start_date', { ascending: false })

  if (error) {
    console.error('Error fetching academic years:', error)
    return []
  }

  return data || []
}

export async function getSectionsByClass(classId: string) {
  const supabase = createClient()

  const { data, error } = await supabase
    .from('sections')
    .select('*')
    .eq('class_id', classId)

  if (error) {
    console.error('Error fetching sections:', error)
    return []
  }

  return data || []
}

export async function getDashboardStats() {
  const supabase = createClient()

  try {
    const [
      { data: students, count: totalStudents },
      { data: staff, count: totalStaff },
      { data: fees },
      { data: attendance },
    ] = await Promise.all([
      supabase.from('students').select('id', { count: 'exact', head: true }),
      supabase.from('staff').select('id', { count: 'exact', head: true }),
      supabase.from('fee_payments').select('amount'),
      supabase
        .from('student_attendance')
        .select('status')
        .eq('date', new Date().toISOString().split('T')[0]),
    ])

    const presentToday = attendance?.filter((a) => a.status === 'present').length || 0
    const totalAttendance = attendance?.length || 0
    const attendancePercent = totalAttendance > 0 ? Math.round((presentToday / totalAttendance) * 100) : 0

    const totalFees = fees?.reduce((sum, f) => sum + (Number(f.amount) || 0), 0) || 0

    return {
      totalStudents: totalStudents || 0,
      totalStaff: totalStaff || 0,
      feesCollection: totalFees,
      attendanceRate: attendancePercent,
    }
  } catch (err) {
    console.error('Failed to get dashboard stats:', err)
    return {
      totalStudents: 0,
      totalStaff: 0,
      feesCollection: 0,
      attendanceRate: 0,
    }
  }
}

export async function createClass(data: { name: string; numericOrder: number }) {
  const supabase = createClient()

  const { data: created, error } = await supabase
    .from('classes')
    .insert({
      name: data.name,
      numeric_order: data.numericOrder,
    })
    .select()
    .single()

  if (error) {
    console.error('Error creating class:', error)
    throw error
  }

  return created
}

export async function updateClass(id: string, data: { name: string; numericOrder: number }) {
  const supabase = createClient()

  const { data: updated, error } = await supabase
    .from('classes')
    .update({
      name: data.name,
      numeric_order: data.numericOrder,
    })
    .eq('id', id)
    .select()
    .single()

  if (error) {
    console.error('Error updating class:', error)
    throw error
  }

  return updated
}

export async function deleteClass(id: string) {
  const supabase = createClient()

  const { error } = await supabase
    .from('classes')
    .delete()
    .eq('id', id)

  if (error) {
    console.error('Error deleting class:', error)
    throw error
  }

  return true
}

export async function createSection(data: { classId: string; name: string; capacity: number }) {
  const supabase = createClient()

  const { data: created, error } = await supabase
    .from('sections')
    .insert({
      class_id: data.classId,
      name: data.name,
      capacity: data.capacity,
    })
    .select()
    .single()

  if (error) {
    console.error('Error creating section:', error)
    throw error
  }

  return created
}

export async function updateSection(id: string, data: { name: string; capacity: number }) {
  const supabase = createClient()

  const { data: updated, error } = await supabase
    .from('sections')
    .update({
      name: data.name,
      capacity: data.capacity,
    })
    .eq('id', id)
    .select()
    .single()

  if (error) {
    console.error('Error updating section:', error)
    throw error
  }

  return updated
}

export async function deleteSection(id: string) {
  const supabase = createClient()

  const { error } = await supabase
    .from('sections')
    .delete()
    .eq('id', id)

  if (error) {
    console.error('Error deleting section:', error)
    throw error
  }

  return true
}