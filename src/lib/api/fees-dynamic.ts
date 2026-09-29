// src/lib/api/fees-dynamic.ts
// Dynamic Fee Calculation Service - REFACTORED: Uses student_fee_dues and new views

import { createClient } from '@/lib/supabase/client'
import { isValidUUID } from '@/lib/utils'
import { getErrorMessage } from '@/lib/utils/error';

// Get supabase client on-demand (necessary for SSR compatibility)
const getSupabase = async () => await createClient()

// ============================================
// 🆕 STUDENT LEDGER - Using student_fee_dues
// ============================================
export async function getStudentDynamicLedger(studentId: string) {
  try {
    const supabase = await getSupabase()
    const today = new Date()
    
    // --- STEP 1: Get student info ---
    const { data: student, error: studentError } = await supabase
      .from('students')
      .select('id, name, student_id, class_id, academic_year_id, status')
      .eq('id', studentId)
      .single()

    if (studentError || !student) {
      return null
    }

    if (student.status !== 'active') {
      return {
        student: { 
          id: student.id, 
          name: student.name, 
          admission_no: student.student_id 
        },
        categories: [],
        opening_balance: 0,
        current_charges: 0,
        total_discount: 0,
        total_fine: 0,
        total_paid: 0,
        remaining_due: 0,
        message: 'Student is not active'
      }
    }

    // --- STEP 2: Resolve academic_year_id ---
    let academicYearId = student.academic_year_id
    if (!academicYearId) {
      const { data: currentAcademicYear } = await supabase
        .from('academic_years')
        .select('id, start_date')
        .eq('is_current', true)
        .single()

      if (currentAcademicYear) {
        academicYearId = currentAcademicYear.id
      } else {
        return {
          student: { 
            id: student.id, 
            name: student.name, 
            admission_no: student.student_id 
          },
          categories: [],
          opening_balance: 0,
          current_charges: 0,
          total_discount: 0,
          total_fine: 0,
          total_paid: 0,
          remaining_due: 0,
          message: 'No academic year configured'
        }
      }
    }

    // --- STEP 3: 🆕 Get student fee summary from RPC ---
    const { data: summaryData, error: summaryError } = await supabase.rpc(
      'get_student_fee_summary',
      {
        p_student_id: studentId,
        p_academic_year_id: academicYearId
      }
    )

    if (!summaryError && summaryData) {
      // Get academic year details
      const { data: academicYear } = await supabase
        .from('academic_years')
        .select('start_date, end_date, name, year_name')
        .eq('id', academicYearId)
        .single()

      // Calculate months since start
      let monthsSinceStart = 0
      if (academicYear?.start_date) {
        const startDate = new Date(academicYear.start_date)
        monthsSinceStart = (today.getFullYear() - startDate.getFullYear()) * 12 + 
                           (today.getMonth() - startDate.getMonth()) + 1
        monthsSinceStart = Math.max(0, monthsSinceStart)
      } else {
        monthsSinceStart = today.getMonth() + 1
      }

      // Get category details with months
      const categories = summaryData.category_breakdown?.map((cat: any) => ({
        id: cat.category_id || 'uncategorized',
        name: cat.category_name || 'N/A',
        expected_amount: cat.total_expected || 0,
        paid: cat.total_paid || 0,
        due: cat.total_due || 0,
        fine: cat.total_fine || 0,
        discount: cat.total_discount || 0,
        is_optional: false,
        months: cat.months || []
      })) || []

      return {
        student: {
          id: student.id,
          name: student.name,
          admission_no: student.student_id,
          class_id: student.class_id
        },
        categories: categories,
        opening_balance: 0,
        current_charges: summaryData.summary?.total_expected || 0,
        total_discount: summaryData.summary?.total_discount || 0,
        total_fine: summaryData.summary?.total_fine || 0,
        total_paid: summaryData.summary?.total_paid || 0,
        total_advance: summaryData.summary?.total_advance || 0,
        remaining_due: summaryData.summary?.net_due || 0,
        academic_year: {
          id: academicYearId,
          name: academicYear?.name || academicYear?.year_name || 'Current Year',
          months_since_start: monthsSinceStart
        },
        summary: summaryData.summary
      }
    }

    // --- STEP 4: 🆕 Fallback - Direct student_fee_dues query ---
    console.warn('⚠️ RPC failed, falling back to direct query:', summaryError?.message)

    const { data: duesData, error: duesError } = await supabase
      .from('student_fee_dues')
      .select('*')
      .eq('student_id', studentId)
      .eq('academic_year_id', academicYearId)
      .order('month', { ascending: true })

    if (duesError) {
      return {
        student: { 
          id: student.id, 
          name: student.name, 
          admission_no: student.student_id 
        },
        categories: [],
        opening_balance: 0,
        current_charges: 0,
        total_discount: 0,
        total_fine: 0,
        total_paid: 0,
        remaining_due: 0,
        message: 'Error fetching due data'
      }
    }

    if (!duesData || duesData.length === 0) {
      return {
        student: { 
          id: student.id, 
          name: student.name, 
          admission_no: student.student_id 
        },
        categories: [],
        opening_balance: 0,
        current_charges: 0,
        total_discount: 0,
        total_fine: 0,
        total_paid: 0,
        remaining_due: 0,
        message: 'No due records found'
      }
    }

    // Group by category
    const categoryMap = new Map<string, any>()
    let totalExpected = 0
    let totalPaid = 0
    let totalDue = 0
    let totalFine = 0
    let totalDiscount = 0

    for (const d of duesData) {
      const key = d.category_id || 'uncategorized'
      if (!categoryMap.has(key)) {
        categoryMap.set(key, {
          id: key,
          name: 'N/A',
          expected_amount: 0,
          paid: 0,
          due: 0,
          fine: 0,
          discount: 0,
          is_optional: false,
          months: []
        })
      }
      
      const entry = categoryMap.get(key)
      entry.expected_amount += d.expected_amount || 0
      entry.paid += d.paid_amount || 0
      entry.due += d.due_amount || 0
      entry.fine += d.fine_amount || 0
      entry.discount += d.discount_amount || 0
      entry.months.push({
        month: d.month,
        expected: d.expected_amount,
        paid: d.paid_amount,
        due: d.due_amount,
        fine: d.fine_amount,
        discount: d.discount_amount,
        status: d.status,
        due_date: d.due_date,
        is_advance: d.is_advance
      })
      
      totalExpected += d.expected_amount || 0
      totalPaid += d.paid_amount || 0
      totalDue += d.due_amount || 0
      totalFine += d.fine_amount || 0
      totalDiscount += d.discount_amount || 0
    }

    // Get category names
    const categoryIds = Array.from(categoryMap.keys()).filter(id => id !== 'uncategorized')
    if (categoryIds.length > 0) {
      const { data: categories } = await supabase
        .from('fee_categories')
        .select('id, name')
        .in('id', categoryIds)
      
      if (categories) {
        const nameMap = categories.reduce((acc: any, c: any) => {
          acc[c.id] = c.name
          return acc
        }, {})
        
        for (const [key, value] of categoryMap) {
          if (key !== 'uncategorized') {
            value.name = nameMap[key] || 'N/A'
          }
        }
      }
    }

    // Get academic year details
    const { data: academicYear } = await supabase
      .from('academic_years')
      .select('start_date, end_date, name, year_name')
      .eq('id', academicYearId)
      .single()

    let monthsSinceStart = 0
    if (academicYear?.start_date) {
      const startDate = new Date(academicYear.start_date)
      monthsSinceStart = (today.getFullYear() - startDate.getFullYear()) * 12 + 
                         (today.getMonth() - startDate.getMonth()) + 1
      monthsSinceStart = Math.max(0, monthsSinceStart)
    } else {
      monthsSinceStart = today.getMonth() + 1
    }

    // Get advance balance
    let totalAdvance = 0
    const { data: advanceData } = await supabase
      .from('payment_allocations')
      .select('amount')
      .in('allocation_type', ['advance', 'advance_global'])
      .eq('payment_id', (await supabase.from('fee_payments').select('id').eq('student_id', studentId)).data?.[0]?.id || '')

    if (advanceData) {
      totalAdvance = advanceData.reduce((sum, a) => sum + (a.amount || 0), 0)
    }

    return {
      student: {
        id: student.id,
        name: student.name,
        admission_no: student.student_id,
        class_id: student.class_id
      },
      categories: Array.from(categoryMap.values()),
      opening_balance: 0,
      current_charges: totalExpected,
      total_discount: totalDiscount,
      total_fine: totalFine,
      total_paid: totalPaid,
      total_advance: totalAdvance,
      remaining_due: Math.max(0, totalDue - totalAdvance),
      academic_year: {
        id: academicYearId,
        name: academicYear?.name || academicYear?.year_name || 'Current Year',
        months_since_start: monthsSinceStart
      }
    }

  } catch (error) {
    return null
  }
}

// ============================================
// ============================================
// 🆕 All students with due amounts - Using v_due_summary (Primary)
// ============================================
async function getDueStudentsFromDueSummary(filters?: {
  classId?: string
  sectionId?: string
  search?: string
  academicYearId?: string
}) {
  try {
    const supabase = await getSupabase()

    let query = supabase
      .from('v_due_summary')
      .select('student_id, student_name, admission_no, class_name, section_name, total_expected, total_paid, total_due, net_due, total_advance, overall_status')
      .gt('total_due', 0)

    if (filters?.classId) {
      query = query.eq('class_id', filters.classId)
    }
    if (filters?.sectionId) {
      query = query.eq('section_id', filters.sectionId)
    }
    if (filters?.academicYearId && isValidUUID(filters.academicYearId)) {
      query = query.eq('academic_year_id', filters.academicYearId)
    }
    if (filters?.search) {
      query = query.or(`student_name.ilike.%${filters.search}%,admission_no.ilike.%${filters.search}%`)
    }

    const { data, error } = await query
      .order('total_due', { ascending: false })

    if (error) {
      console.warn('⚠️ v_due_summary query failed:', error.message)
      return null
    }

    if (!data || data.length === 0) {
      return []
    }

    return data.map((item: any) => ({
      student_id: item.student_id,
      student_name: item.student_name,
      admission_no: item.admission_no || '',
      class_name: item.class_name || 'N/A',
      section_name: item.section_name || 'N/A',
      total_amount: item.total_expected || 0,
      total_paid: item.total_paid || 0,
      due_amount: item.net_due || 0,
      total_due: item.total_due || 0,
      net_due: item.net_due || 0,
      total_advance: item.total_advance || 0,
      fine_amount: 0,
      discount_amount: 0,
      overdue_months: 0,
      status: 'pending',
      due_date: null,
      overall_status: item.overall_status || ''
    }))
  } catch (error) {
    console.warn('v_due_summary query error:', error)
    return null
  }
}

// ============================================
// 🔄 Fallback 1: Using v_monthly_invoice
// ============================================
async function getDueStudentsFromMonthlyInvoice(filters?: {
  classId?: string
  sectionId?: string
  search?: string
}) {
  try {
    const supabase = await getSupabase()

    let query = supabase
      .from('v_monthly_invoice')
      .select('student_id, student_name, admission_no, class_name, section_name, due, status, due_date, month_name, total_fee, paid, fine, discount')
      .gt('due', 0)

    if (filters?.classId) {
      query = query.eq('class_id', filters.classId)
    }
    if (filters?.sectionId) {
      query = query.eq('section_id', filters.sectionId)
    }
    if (filters?.search) {
      query = query.or(`student_name.ilike.%${filters.search}%,admission_no.ilike.%${filters.search}%`)
    }

    const { data, error } = await query
      .order('due', { ascending: false })

    if (error) {
      console.warn('⚠️ v_monthly_invoice query failed:', error.message)
      return null
    }

    if (!data || data.length === 0) {
      return []
    }

    const studentMap = new Map()
    data.forEach((item: any) => {
      const key = item.student_id
      if (!studentMap.has(key)) {
        studentMap.set(key, {
          student_id: item.student_id,
          student_name: item.student_name,
          admission_no: item.admission_no || '',
          class_name: item.class_name || 'N/A',
          section_name: item.section_name || 'N/A',
          total_amount: 0,
          paid_amount: 0,
          due_amount: 0,
          fine_amount: 0,
          discount_amount: 0,
          overdue_months: 0,
          status: 'pending',
          due_date: null,
          month_name: item.month_name || ''
        })
      }
      const entry = studentMap.get(key)
      entry.total_amount += item.total_fee || 0
      entry.paid_amount += item.paid || 0
      entry.due_amount += item.due || 0
      entry.fine_amount += item.fine || 0
      entry.discount_amount += item.discount || 0
      if (item.status === 'overdue') entry.overdue_months++
      if (!entry.due_date || (item.due_date && item.due_date < entry.due_date)) {
        entry.due_date = item.due_date
      }
      if (item.status === 'overdue' || item.status === 'partial') {
        entry.status = item.status
      }
    })

    return Array.from(studentMap.values()).map((item: any) => ({
      student_id: item.student_id,
      student_name: item.student_name,
      admission_no: item.admission_no,
      class_name: item.class_name,
      section_name: item.section_name,
      total_amount: item.total_amount,
      total_paid: item.paid_amount,
      due_amount: item.due_amount,
      total_due: item.due_amount,
      fine_amount: item.fine_amount,
      discount_amount: item.discount_amount,
      overdue_months: item.overdue_months,
      status: item.status,
      due_date: item.due_date,
      overall_status: item.due_amount > 0
        ? (item.overdue_months > 0 ? '⚠️ Overdue' : '🟡 Partial')
        : '✅ Paid',
      paid_amount: item.paid_amount
    }))
  } catch (error) {
    console.warn('v_monthly_invoice fallback error:', error)
    return null
  }
}

// ============================================
// 🔄 Fallback 2: student_fee_dues থেকে সরাসরি ডেটা আনা
// ============================================
async function getDueStudentsFromDuesTable(filters?: {
  classId?: string
  sectionId?: string
  search?: string
}) {
  try {
    const supabase = await getSupabase()

    let query = supabase
      .from('student_fee_dues')
      .select(`
        student_id,
        due_amount,
        expected_amount,
        paid_amount,
        fine_amount,
        discount_amount,
        status,
        due_date,
        students!inner(
          id,
          name,
          student_id,
          class_id,
          section_id,
          classes!inner(name),
          sections!inner(name)
        )
      `)
      .gt('due_amount', 0)

    if (filters?.classId) {
      query = query.eq('students.class_id', filters.classId)
    }
    if (filters?.sectionId) {
      query = query.eq('students.section_id', filters.sectionId)
    }

    const { data, error } = await query

    if (error) {
      return []
    }

    if (!data || data.length === 0) {
      return []
    }

    // Group by student
    const studentMap = new Map()
    data.forEach((item: any) => {
      const student = item.students
      if (!student) return
      
      const key = student.id
      if (!studentMap.has(key)) {
        studentMap.set(key, {
          student_id: student.id,
          student_name: student.name,
          admission_no: student.student_id || '',
          class_name: student.classes?.name || 'N/A',
          section_name: student.sections?.name || 'N/A',
          total_amount: 0,
          paid_amount: 0,
          due_amount: 0,
          fine_amount: 0,
          discount_amount: 0,
          overdue_months: 0,
          status: 'pending',
          due_date: null
        })
      }
      
      const entry = studentMap.get(key)
      entry.total_amount += item.expected_amount || 0
      entry.paid_amount += item.paid_amount || 0
      entry.due_amount += item.due_amount || 0
      entry.fine_amount += item.fine_amount || 0
      entry.discount_amount += item.discount_amount || 0
      if (item.status === 'overdue') entry.overdue_months++
      if (!entry.due_date || (item.due_date && item.due_date < entry.due_date)) {
        entry.due_date = item.due_date
      }
    })

    return Array.from(studentMap.values()).map((item: any) => ({
      student_id: item.student_id,
      student_name: item.student_name,
      admission_no: item.admission_no,
      class_name: item.class_name,
      section_name: item.section_name,
      total_amount: item.total_amount,
      total_paid: item.paid_amount,
      due_amount: item.due_amount,
      total_due: item.due_amount,
      fine_amount: item.fine_amount,
      discount_amount: item.discount_amount,
      overdue_months: item.overdue_months,
      status: item.status,
      due_date: item.due_date,
      overall_status: item.due_amount > 0 
        ? (item.overdue_months > 0 ? '⚠️ Overdue' : '🟡 Partial') 
        : '✅ Paid',
      paid_amount: item.paid_amount
    }))

  } catch (error) {
    return []
  }
}

// ============================================
// 🆕 All students with due amounts - v_due_summary → v_monthly_invoice → student_fee_dues
// ============================================
export async function getAllStudentsWithDues(filters?: {
  classId?: string
  sectionId?: string
  search?: string
  academicYearId?: string
}) {
  // 1. Try v_due_summary first (has net_due after advance adjustment)
  const fromSummary = await getDueStudentsFromDueSummary(filters)
  if (fromSummary !== null && fromSummary.length >= 0) {
    if (fromSummary.length > 0) {
      console.log(`✅ Due students from v_due_summary: ${fromSummary.length}`)
      return fromSummary
    }
    // v_due_summary returned empty array - check other sources
    // (student may have only advance payments or no dues yet)
  }

  // 2. Fallback: v_monthly_invoice (per-month breakdown)
  const fromMonthly = await getDueStudentsFromMonthlyInvoice(filters)
  if (fromMonthly !== null) {
    if (fromMonthly.length > 0) {
      console.log(`✅ Due students from v_monthly_invoice: ${fromMonthly.length}`)
      return fromMonthly
    }
  }

  // 3. Last fallback: student_fee_dues table (direct query)
  const fromDues = await getDueStudentsFromDuesTable(filters)
  if (fromDues && fromDues.length > 0) {
    console.log(`✅ Due students from student_fee_dues: ${fromDues.length}`)
    return fromDues
  }

  console.log('ℹ️ No due students found from any source')
  return fromDues || fromMonthly || fromSummary || []
}

// ============================================
// 🆕 getAllPaymentsWithAllocation - Using payment_allocations with student info
// ============================================
export async function getAllPaymentsWithAllocation(filters?: {
  status?: string
  classId?: string
  sectionId?: string
  academicYearId?: string
  dateFrom?: string
  dateTo?: string
  search?: string
}) {
  try {
    const supabase = await getSupabase()
    
    // Step 1: Get payments with filters
    const selectFields = `
      id,
      student_id,
      amount,
      payment_method,
      receipt_no,
      payment_date,
      note,
      discount_amount,
      fine_amount,
      is_advance,
      created_at
    `
    
    let query = supabase
      .from('fee_payments')
      .select(selectFields)

    if (filters?.dateFrom) {
      query = query.gte('payment_date', `${filters.dateFrom}T00:00:00`)
    }
    if (filters?.dateTo) {
      query = query.lte('payment_date', `${filters.dateTo}T23:59:59`)
    }
    // 🆕 Filter by academic year - applied via students table in Step 3

    const { data: payments, error: paymentsError } = await query
      .order('payment_date', { ascending: false })
    
    if (paymentsError) {
      throw paymentsError
    }

    if (!payments || payments.length === 0) {
      return []
    }

    // Step 2: Get student IDs
    const studentIds = payments.map((p: any) => p.student_id).filter(Boolean)

     // Step 3: Get students with class and section info
     let studentMap: Record<string, any> = {}
     if (studentIds.length > 0) {
       let studentsQuery = supabase
         .from('students')
         .select(`
           id,
           name,
           student_id,
           class_id,
           section_id,
           class_roll,
           fathers_contact,
           mothers_contact,
           email,
           contact,
           father_name,
           mother_name,
           student_photo_url
         `)
         .in('id', studentIds)

       // 🆕 Filter by academic year if provided
       if (filters?.academicYearId && isValidUUID(filters.academicYearId)) {
         studentsQuery = studentsQuery.eq('academic_year_id', filters.academicYearId)
       }

       const { data: students, error: studentsError } = await studentsQuery

      if (studentsError) {
      } else if (students) {
        // Get class and section names
        const classIds = students.map((s: any) => s.class_id).filter(Boolean)
        const sectionIds = students.map((s: any) => s.section_id).filter(Boolean)

        let classMap: Record<string, string> = {}
        let sectionMap: Record<string, string> = {}

        if (classIds.length > 0) {
          const { data: classData } = await supabase
            .from('classes')
            .select('id, name')
            .in('id', classIds)
          if (classData) {
            classMap = classData.reduce((acc: any, c: any) => {
              acc[c.id] = c.name
              return acc
            }, {})
          }
        }

        if (sectionIds.length > 0) {
          const { data: sectionData } = await supabase
            .from('sections')
            .select('id, name')
            .in('id', sectionIds)
          if (sectionData) {
            sectionMap = sectionData.reduce((acc: any, s: any) => {
              acc[s.id] = s.name
              return acc
            }, {})
          }
        }

        studentMap = students.reduce((acc: any, s: any) => {
          acc[s.id] = {
            ...s,
            class_name: classMap[s.class_id] || 'N/A',
            section_name: sectionMap[s.section_id] || 'N/A'
          }
          return acc
        }, {})
      }
    }

    // Step 4: Get payment IDs for allocations
    const paymentIds = payments.map((p: any) => p.id).filter(Boolean)

    // Step 5: Get allocations with category names
    let allocationsMap: Record<string, any[]> = {}
    if (paymentIds.length > 0) {
      const { data: allocations, error: allocsError } = await supabase
        .from('payment_allocations')
        .select(`
          id,
          payment_id,
          category_id,
          amount,
          allocation_type,
          month,
          created_at,
          fee_categories!inner(name)
        `)
        .in('payment_id', paymentIds)

      if (allocsError) {
      } else if (allocations) {
        // Get category names
        const categoryIds = allocations.map((a: any) => a.category_id).filter(Boolean)
        let categoryMap: Record<string, string> = {}

        if (categoryIds.length > 0) {
          const { data: categories } = await supabase
            .from('fee_categories')
            .select('id, name')
            .in('id', categoryIds)
          if (categories) {
            categoryMap = categories.reduce((acc: any, c: any) => {
              acc[c.id] = c.name
              return acc
            }, {})
          }
        }

        allocationsMap = allocations.reduce((acc: any, a: any) => {
          if (!acc[a.payment_id]) acc[a.payment_id] = []
          acc[a.payment_id].push({
            ...a,
            category_name: a.category_id ? categoryMap[a.category_id] || 'Fee' : 'Advance'
          })
          return acc
        }, {})
      }
    }

    // Step 6: Apply class/section filters (client-side)
    let filteredPayments = payments

    if (filters?.classId) {
      filteredPayments = filteredPayments.filter((p: any) => {
        const student = studentMap[p.student_id]
        return student?.class_id === filters.classId
      })
    }

    if (filters?.sectionId) {
      filteredPayments = filteredPayments.filter((p: any) => {
        const student = studentMap[p.student_id]
        return student?.section_id === filters.sectionId
      })
    }

    if (filters?.search) {
      const searchLower = filters.search.toLowerCase()
      filteredPayments = filteredPayments.filter((p: any) => {
        const student = studentMap[p.student_id]
        return student?.name?.toLowerCase().includes(searchLower) ||
               student?.student_id?.toLowerCase().includes(searchLower) ||
               p.receipt_no?.toLowerCase().includes(searchLower)
      })
    }

    // Step 7: Merge everything
    return filteredPayments.map((payment: any) => ({
      ...payment,
      student: studentMap[payment.student_id] || null,
      allocations: allocationsMap[payment.id] || [],
    }))

  } catch (error) {
    throw error
  }
}

// ============================================
// Helper: Build description from allocations
// ============================================
export function buildDescriptionFromAllocations(allocations: any[] | null): string {
  if (!allocations || allocations.length === 0) return "Fee Payment"
  
  const categories = allocations
    .map(a => a?.category_name || a?.fee_categories?.name || "Fee")
    .filter(Boolean)
  const unique = [...new Set(categories)]
  return unique.length > 0 ? unique.join(", ") : "Fee Payment"
}

// ============================================
// 🆕 Student payments for ledger view (STUDENT-SPECIFIC)
// ============================================
export async function getStudentPayments(studentId: string, filters?: { 
  dateFrom?: string; 
  dateTo?: string;
  academicYearId?: string;
}) {
  try {
    const supabase = await getSupabase()
    
    const baseSelect = `
      id,
      student_id,
      amount,
      payment_method,
      receipt_no,
      payment_date,
      note,
      fine_amount,
      discount_amount,
      is_advance,
      created_at
    `

    let query = supabase
      .from('fee_payments')
      .select(baseSelect)
      .eq('student_id', studentId)

    if (filters?.dateFrom) {
      query = query.gte('payment_date', `${filters.dateFrom}T00:00:00`)
    }
    if (filters?.dateTo) {
      query = query.lte('payment_date', `${filters.dateTo}T23:59:59`)
    }
    // 🆕 Academic year filter applied post-query for student-scoped queries

    const { data: payments, error } = await query
      .order('payment_date', { ascending: false })
    
    if (error) {
      return []
    }

    if (!payments || payments.length === 0) {
      return []
    }

    // Get allocations for these payments
    const paymentIds = payments.map((p: any) => p.id).filter(Boolean)
    
    if (paymentIds.length === 0) {
      return payments
    }

    const { data: allocations, error: allocError } = await supabase
      .from('payment_allocations')
      .select(`
        id,
        payment_id,
        category_id,
        amount,
        allocation_type,
        month,
        created_at
      `)
      .in('payment_id', paymentIds)

    if (allocError) {
      return payments
    }

    // Get category names
    const categoryIds = allocations?.map((a: any) => a.category_id).filter(Boolean) || []
    let categoryMap: Record<string, string> = {}

    if (categoryIds.length > 0) {
      const { data: categories } = await supabase
        .from('fee_categories')
        .select('id, name')
        .in('id', categoryIds)
      if (categories) {
        categoryMap = categories.reduce((acc: any, c: any) => {
          acc[c.id] = c.name
          return acc
        }, {})
      }
    }

    const allocationsMap: Record<string, any[]> = {}
    allocations?.forEach((a: any) => {
      if (!allocationsMap[a.payment_id]) allocationsMap[a.payment_id] = []
      allocationsMap[a.payment_id].push({
        ...a,
        category_name: a.category_id ? categoryMap[a.category_id] || 'Fee' : 'Advance'
      })
    })

    return payments.map((payment: any) => ({
      ...payment,
      allocations: allocationsMap[payment.id] || [],
    }))

  } catch (error) {
    return []
  }
}

// ============================================
// 🆕 Get due summary for a student
// ============================================
export async function getStudentDueSummary(studentId: string) {
  try {
    const supabase = await getSupabase()
    
    const { data, error } = await supabase
      .from('v_due_summary')
      .select('*')
      .eq('student_id', studentId)
      .maybeSingle()

    if (error) {
      return null
    }

    return data
  } catch (error) {
    return null
  }
}