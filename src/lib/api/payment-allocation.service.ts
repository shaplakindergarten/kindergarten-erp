// src/lib/api/payment-allocation.service.ts
// ✅ FIXED: Removed duplicate RPC calls — trigger handles processing
// Payment Allocation Engine - Uses student_fee_dues and trigger-based processing

import { createClient } from '@/lib/supabase/server'

export interface PaymentAllocation {
  transaction_id: string
  category_id: string
  amount: number
  paid_amount: number
  due_amount: number
}

export interface ProcessPaymentParams {
  studentId: string
  allocations: Array<{
    category_id: string
    amount: number
  }>
  totalPaid: number
  paymentMethod: string
  receiptNo: string
  note?: string
  discountAmount?: number
  fineAmount?: number
}

// ============================================
// ✅ FIXED: Process payment using trigger (RECOMMENDED)
// Trigger trigger_process_fee_payment auto-fires on INSERT.
// DO NOT call process_fee_payment RPC manually — that causes double-processing.
// ============================================
export async function processPaymentWithRPC(params: ProcessPaymentParams) {
  const { studentId, totalPaid, paymentMethod, receiptNo, note, discountAmount, fineAmount } = params
  const supabase = await createClient()

  try {
    // --- STEP 1: Validate ---
    if (!studentId || !totalPaid || totalPaid <= 0) {
      return { success: false, error: 'Invalid payment data' }
    }

    // --- STEP 2: Insert payment — trigger auto-processes ---
    const { data: payment, error: paymentError } = await supabase
      .from('fee_payments')
      .insert({
        student_id: studentId,
        amount: totalPaid,
        payment_method: paymentMethod as any,
        receipt_no: receiptNo,
        note: note || null,
        payment_date: new Date().toISOString(),
        discount_amount: discountAmount || 0,
        fine_amount: fineAmount || 0
      })
      .select()
      .single()

    if (paymentError) {
      console.error('Payment insert error:', paymentError)
      return { success: false, error: paymentError.message }
    }

    // --- STEP 3: ✅ Verify trigger produced allocations ---
    const { data: allocations, error: allocError } = await supabase
      .from('payment_allocations')
      .select('*, category:category_id(id, name)')
      .eq('payment_id', payment.id)
      .order('created_at', { ascending: true })

    if (allocError) {
      console.error('Failed to fetch allocations:', allocError)
      return { success: false, error: allocError.message }
    }

    if (!allocations || allocations.length === 0) {
      console.error('⚠️ Trigger did not create allocations for payment', payment.id)
      return {
        success: false,
        error: 'Payment created but trigger produced no allocations'
      }
    }

    // --- STEP 4: Fetch updated payment state ---
    const { data: finalPayment } = await supabase
      .from('fee_payments')
      .select('paid_amount, amount')
      .eq('id', payment.id)
      .single()

    return {
      success: true,
      payment_id: payment.id,
      receipt_no: receiptNo,
      allocations: allocations || [],
      process_result: {
        total_allocated: finalPayment?.paid_amount || 0,
        allocation_count: allocations.length
      },
      message: 'Payment processed successfully by trigger'
    }

  } catch (error: any) {
    console.error('processPaymentWithRPC error:', error)
    return { success: false, error: error.message || 'Payment processing failed' }
  }
}

// ============================================
// ⚠️ DEPRECATED: Process payment with manual allocation
// ============================================
// This function CONFLICTS with trigger_process_fee_payment.
// Do NOT use it — it will cause double-processing bug.
// Kept only for reference.
// ============================================
export async function processPaymentWithAllocation(params: ProcessPaymentParams) {
  console.warn('⚠️ processPaymentWithAllocation is DEPRECATED. Use processPaymentWithRPC instead.')
  return processPaymentWithRPC(params)
}

// ============================================
// Get dynamic fee dues for a student
// ============================================
export async function getStudentDynamicDues(studentId: string) {
  const supabase = await createClient()

  // --- STEP 1: Get student ---
  const { data: student, error: studentError } = await supabase
    .from('students')
    .select('id, class_id, academic_year_id, status')
    .eq('id', studentId)
    .single()

  if (studentError || !student) {
    return { success: false, error: 'Student not found' }
  }

  if (student.status !== 'active') {
    return {
      success: false,
      error: 'Student is not active',
      dues: []
    }
  }

  // --- STEP 2: Resolve academic_year_id ---
  let academicYearId = student.academic_year_id
  if (!academicYearId) {
    const { data: currentAcademicYear } = await supabase
      .from('academic_years')
      .select('id')
      .eq('is_current', true)
      .single()

    if (currentAcademicYear) {
      academicYearId = currentAcademicYear.id
    }
  }

  if (!academicYearId) {
    return {
      success: false,
      error: 'No academic year configured',
      dues: []
    }
  }

  // --- STEP 3: Get dues from student_fee_dues ---
  const { data: duesData, error: duesError } = await supabase
    .from('student_fee_dues')
    .select(`
      id,
      category_id,
      month,
      expected_amount,
      paid_amount,
      due_amount,
      fine_amount,
      discount_amount,
      status,
      due_date,
      is_advance
    `)
    .eq('student_id', studentId)
    .eq('academic_year_id', academicYearId)
    .gt('due_amount', 0)
    .order('month', { ascending: true })

  if (duesError) {
    console.error('Error fetching dues:', duesError)
    return { success: false, error: duesError.message, dues: [] }
  }

  if (!duesData || duesData.length === 0) {
    // Try to generate dues if none exist
    const { data: generateResult } = await supabase.rpc('generate_student_monthly_dues', {
      p_student_id: studentId,
      p_academic_year_id: academicYearId,
      p_up_to_month: new Date().toISOString().slice(0, 7)
    })

    if (generateResult) {
      const { data: retryData } = await supabase
        .from('student_fee_dues')
        .select(`
          id, category_id, month, expected_amount, paid_amount,
          due_amount, fine_amount, discount_amount, status,
          due_date, is_advance
        `)
        .eq('student_id', studentId)
        .eq('academic_year_id', academicYearId)
        .gt('due_amount', 0)
        .order('month', { ascending: true })

      if (retryData && retryData.length > 0) {
        const categoryIds = retryData.map(d => d.category_id).filter(Boolean)
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

        const dues = retryData.map((d: any) => ({
          id: d.id,
          category_id: d.category_id,
          category_name: d.category_id ? categoryMap[d.category_id] || 'N/A' : 'Advance',
          month: d.month,
          expected_amount: d.expected_amount,
          paid_amount: d.paid_amount,
          due_amount: d.due_amount,
          fine_amount: d.fine_amount,
          discount_amount: d.discount_amount,
          status: d.status,
          due_date: d.due_date,
          is_advance: d.is_advance
        }))

        return {
          success: true,
          dues,
          student_info: {
            id: student.id,
            academic_year_id: academicYearId,
            class_id: student.class_id
          },
          generated: true
        }
      }
    }

    return {
      success: true,
      dues: [],
      student_info: {
        id: student.id,
        academic_year_id: academicYearId,
        class_id: student.class_id
      },
      message: 'No dues found'
    }
  }

  // --- STEP 4: Get category names ---
  const categoryIds = duesData.map(d => d.category_id).filter(Boolean)
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

  const dues = duesData.map((d: any) => ({
    id: d.id,
    category_id: d.category_id,
    category_name: d.category_id ? categoryMap[d.category_id] || 'N/A' : 'Advance',
    month: d.month,
    expected_amount: d.expected_amount,
    paid_amount: d.paid_amount,
    due_amount: d.due_amount,
    fine_amount: d.fine_amount,
    discount_amount: d.discount_amount,
    status: d.status,
    due_date: d.due_date,
    is_advance: d.is_advance,
    priority: new Date(d.month + '-01').getTime()
  }))

  return {
    success: true,
    dues,
    student_info: {
      id: student.id,
      academic_year_id: academicYearId,
      class_id: student.class_id
    }
  }
}

// ============================================
// Get pending dues summary for a student
// ============================================
export async function getStudentPendingDues(studentId: string) {
  const supabase = await createClient()

  const { data, error } = await supabase
    .from('student_fee_dues')
    .select('id, category_id, month, due_amount, status, due_date, fine_amount')
    .eq('student_id', studentId)
    .gt('due_amount', 0)
    .order('month', { ascending: true })

  if (error) {
    console.error('Error fetching pending dues:', error)
    return { success: false, error: error.message, dues: [] }
  }

  const categoryIds = data?.map(d => d.category_id).filter(Boolean) || []
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

  const dues = data?.map((d: any) => ({
    id: d.id,
    category_id: d.category_id,
    category_name: d.category_id ? categoryMap[d.category_id] || 'N/A' : 'Advance',
    month: d.month,
    due_amount: d.due_amount,
    status: d.status,
    due_date: d.due_date,
    fine_amount: d.fine_amount || 0
  })) || []

  return {
    success: true,
    dues,
    total_due: dues.reduce((sum, d) => sum + d.due_amount, 0)
  }
}