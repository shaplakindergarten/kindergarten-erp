// src/app/api/receive-payment/route.ts
// ✅ FIXED: Accepts and stores frontend allocations

import { createClient } from '@supabase/supabase-js'
import { NextResponse } from 'next/server'

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || process.env.SUPABASE_URL
const supabaseSecretKey = process.env.SUPABASE_SERVICE_ROLE_KEY

if (!supabaseUrl) console.error('ERROR: Missing SUPABASE_URL environment variable')
if (!supabaseSecretKey) console.error('ERROR: Missing SUPABASE_SERVICE_ROLE_KEY environment variable')

const supabaseAdmin = createClient(supabaseUrl!, supabaseSecretKey!, {
  auth: { autoRefreshToken: false, persistSession: false }
})

// ============================================
// হেল্পার ফাংশন: receipt_no জেনারেটর
// ============================================
function generateReceiptNo(classPrefix?: string): string {
  const date = new Date()
  const year = date.getFullYear().toString()
  const month = String(date.getMonth() + 1).padStart(2, "0")
  const day = String(date.getDate()).padStart(2, "0")
  const random = Math.floor(Math.random() * 10000).toString().padStart(4, "0")
  const prefix = classPrefix ? classPrefix.charAt(0).toUpperCase() : "P"
  return `${year}${month}${day}-${prefix}-${random}`
}

async function generateReceiptNoFromDB(classPrefix?: string): Promise<string> {
  try {
    const { data, error } = await supabaseAdmin.rpc('generate_receipt_number', {
      p_prefix: classPrefix ? classPrefix.charAt(0).toUpperCase() : 'P'
    })

    if (error) {
      console.error('❌ DB receipt generation error:', error)
      return generateReceiptNo(classPrefix)
    }

    return data || generateReceiptNo(classPrefix)
  } catch (err) {
    console.error('❌ Receipt generation error:', err)
    return generateReceiptNo(classPrefix)
  }
}

// ============================================
// POST: পেমেন্ট রিসিভ করুন
// ============================================
export async function POST(request: Request) {
  try {
    const {
      studentId,
      totalPaid,
      paymentMethod,
      receiptNo,
      note,
      allocations = [],       // 🆕 Accept allocations from frontend
      discountAmount = 0,
      fineAmount = 0
    } = await request.json()

    console.log('📥 Receive payment request:', { 
      studentId, 
      totalPaid, 
      paymentMethod, 
      receiptNo,
      allocationsCount: allocations.length 
    })

    // --- VALIDATION ---
    if (!studentId || !totalPaid || totalPaid <= 0) {
      return NextResponse.json(
        { success: false, error: 'Invalid payment data' },
        { status: 400 }
      )
    }

    // --- STEP 1: Get Student with Class Name ---
    const { data: student, error: studentError } = await supabaseAdmin
      .from('students')
      .select('id, name, student_id, class_id, academic_year_id, status, classes!inner(name)')
      .eq('id', studentId)
      .single()

    if (studentError || !student) {
      console.error('Student not found:', studentError)
      return NextResponse.json(
        { success: false, error: 'Student not found' },
        { status: 404 }
      )
    }

    if (student.status !== 'active') {
      return NextResponse.json(
        { success: false, error: 'Student is not active' },
        { status: 400 }
      )
    }

    // Extract class name safely
    let className = 'P'
    if (student.classes) {
      if (Array.isArray(student.classes) && student.classes.length > 0) {
        className = student.classes[0]?.name || 'P'
      } else if (typeof student.classes === 'object' && student.classes !== null) {
        className = (student.classes as any).name || 'P'
      }
    }

    console.log('📚 Student class name:', className)

    // --- STEP 2: Resolve academic_year_id ---
    let academicYearId = student.academic_year_id
    if (!academicYearId) {
      const { data: currentAcademicYear } = await supabaseAdmin
        .from('academic_years')
        .select('id')
        .eq('is_current', true)
        .single()

      if (currentAcademicYear) {
        academicYearId = currentAcademicYear.id
      }
    }

    if (!academicYearId) {
      return NextResponse.json(
        { success: false, error: 'No academic year configured for this student' },
        { status: 400 }
      )
    }

    // --- STEP 3: Check if student has active fee assignment ---
    const { data: feeAssignment, error: assignmentError } = await supabaseAdmin
      .from('fee_student_assignments')
      .select('id, fee_structure_id, effective_from, effective_to, is_active')
      .eq('student_id', studentId)
      .eq('academic_year_id', academicYearId)
      .eq('is_active', true)
      .maybeSingle()

    if (assignmentError) {
      console.error('Fee assignment error:', assignmentError)
    }

    if (!feeAssignment) {
      return NextResponse.json(
        { success: false, error: 'No active fee assignment found for this student' },
        { status: 400 }
      )
    }

    console.log('✅ Fee assignment found:', feeAssignment.id)

    // --- STEP 4: Get or generate receipt_no ---
    let finalReceiptNo = receiptNo

    if (!finalReceiptNo || finalReceiptNo.trim() === '') {
      try {
        finalReceiptNo = await generateReceiptNoFromDB(className)
        console.log('📝 Generated receipt_no from DB:', finalReceiptNo)
      } catch (err) {
        finalReceiptNo = generateReceiptNo(className)
        console.log('📝 Generated receipt_no (fallback):', finalReceiptNo)
      }
    }

    if (finalReceiptNo.length > 50) {
      console.warn('⚠️ receipt_no too long, truncating:', finalReceiptNo)
      finalReceiptNo = finalReceiptNo.slice(0, 50)
    }

    // --- STEP 5: Create payment record WITH allocations ---
    let payment: any = null
    let paymentError: any = null

    const paymentData = {
      student_id: studentId,
      amount: totalPaid,
      payment_method: paymentMethod || 'cash',
      receipt_no: finalReceiptNo,
      note: note || null,
      payment_date: new Date().toISOString(),
      discount_amount: discountAmount || 0,
      fine_amount: fineAmount || 0,
      is_advance: false,
      advance_month: null,
      allocations: allocations.length > 0 ? allocations : null  // 🆕 Store allocations
    }

    console.log('📝 Creating payment with data:', { 
      ...paymentData, 
      allocations: paymentData.allocations ? `${paymentData.allocations.length} items` : 'null'
    })

    const firstAttempt = await supabaseAdmin
      .from('fee_payments')
      .insert(paymentData)
      .select()
      .single()

    payment = firstAttempt.data
    paymentError = firstAttempt.error

    if (paymentError) {
      console.error('❌ Payment insert error:', paymentError)

      if (paymentError.code === '23505') {
        // Duplicate receipt_no — regenerate and retry
        console.log('🔄 Duplicate receipt_no, regenerating...')

        try {
          const newReceiptNo = await generateReceiptNoFromDB(className)
          console.log('📝 New receipt_no from DB:', newReceiptNo)

          const retryAttempt = await supabaseAdmin
            .from('fee_payments')
            .insert({ ...paymentData, receipt_no: newReceiptNo })
            .select()
            .single()

          if (retryAttempt.error) {
            console.error('❌ Retry payment insert error:', retryAttempt.error)
            return NextResponse.json(
              { success: false, error: 'Failed to create payment record: ' + retryAttempt.error.message },
              { status: 500 }
            )
          }

          payment = retryAttempt.data
          finalReceiptNo = newReceiptNo
          console.log('✅ Retry payment created with new receipt_no:', finalReceiptNo)
        } catch (retryError) {
          console.error('❌ Retry generation error:', retryError)
          return NextResponse.json(
            { success: false, error: 'Failed to generate unique receipt number' },
            { status: 500 }
          )
        }
      } else {
        return NextResponse.json(
          { success: false, error: 'Failed to create payment record: ' + paymentError.message },
          { status: 500 }
        )
      }
    }

    console.log('✅ Payment created:', payment.id, 'Receipt:', finalReceiptNo)

    // --- STEP 6: VERIFY trigger output ---
    const { data: verifyPayment, error: verifyError } = await supabaseAdmin
      .from('fee_payments')
      .select('id, paid_amount, amount')
      .eq('id', payment.id)
      .single()

    if (verifyError || !verifyPayment) {
      console.error('❌ Failed to verify payment:', verifyError)
      return NextResponse.json(
        {
          success: false,
          error: 'Payment created but verification failed',
          paymentId: payment.id,
          receiptNo: finalReceiptNo
        },
        { status: 500 }
      )
    }

    // Fetch allocations to verify trigger produced correct output
    const { data: allocCheck } = await supabaseAdmin
      .from('payment_allocations')
      .select('allocation_type, amount, category_id, month')
      .eq('payment_id', payment.id)

    const hasAllocations = allocCheck && allocCheck.length > 0
    const allocTypes = allocCheck?.map(a => a.allocation_type) || []

    console.log('📊 Trigger processing result:')
    console.log('   paid_amount:', verifyPayment.paid_amount)
    console.log('   allocations:', allocCheck?.length || 0)
    console.log('   types:', allocTypes.join(', '))

    if (!hasAllocations) {
      console.error('❌ Trigger did not create any allocations!')
      return NextResponse.json(
        {
          success: false,
          error: 'Payment created but trigger produced no allocations. Contact admin.',
          paymentId: payment.id,
          receiptNo: finalReceiptNo
        },
        { status: 500 }
      )
    }

    // --- STEP 7: Get updated due summary ---
    const { data: dueSummary } = await supabaseAdmin
      .from('v_due_summary')
      .select('*')
      .eq('student_id', studentId)
      .maybeSingle()

    // --- STEP 8: Get full allocations with category names ---
    const { data: paymentAllocations } = await supabaseAdmin
      .from('payment_allocations')
      .select('*, category:category_id(id, name)')
      .eq('payment_id', payment.id)
      .order('created_at', { ascending: true })

    // --- STEP 9: Return success with details ---
    return NextResponse.json({
      success: true,
      paymentId: payment.id,
      receiptNo: finalReceiptNo,
      payment: verifyPayment,
      allocations: paymentAllocations || [],
      dueSummary: dueSummary || null,
      processDetails: {
        total_allocated: verifyPayment.paid_amount,
        allocation_count: allocCheck?.length || 0,
        allocation_types: allocTypes
      },
      message: 'Payment received and processed successfully'
    })

  } catch (error: any) {
    console.error('❌ Payment Error:', error)
    return NextResponse.json(
      { success: false, error: error.message || 'Internal server error' },
      { status: 500 }
    )
  }
}

// ============================================
// GET: পেমেন্ট ডিটেইলস
// ============================================
export async function GET(request: Request) {
  try {
    const url = new URL(request.url)
    const paymentId = url.searchParams.get('id')
    const studentId = url.searchParams.get('studentId')

    if (paymentId) {
      const { data: payment, error } = await supabaseAdmin
        .from('fee_payments')
        .select(`
          *,
          allocations:payment_allocations(
            *,
            category:category_id(id, name)
          )
        `)
        .eq('id', paymentId)
        .single()

      if (error) {
        return NextResponse.json(
          { success: false, error: error.message },
          { status: 404 }
        )
      }

      return NextResponse.json({ success: true, data: payment })
    }

    if (studentId) {
      const { data: payments, error } = await supabaseAdmin
        .from('fee_payments')
        .select(`
          *,
          allocations:payment_allocations(
            *,
            category:category_id(id, name)
          )
        `)
        .eq('student_id', studentId)
        .order('payment_date', { ascending: false })

      if (error) {
        return NextResponse.json(
          { success: false, error: error.message },
          { status: 500 }
        )
      }

      return NextResponse.json({ success: true, data: payments })
    }

    return NextResponse.json(
      { success: false, error: 'Missing id or studentId parameter' },
      { status: 400 }
    )

  } catch (error: any) {
    console.error('❌ GET Payment Error:', error)
    return NextResponse.json(
      { success: false, error: error.message || 'Internal server error' },
      { status: 500 }
    )
  }
}

// ============================================
// DELETE: পেমেন্ট ডিলিট (রিভার্স)
// ============================================
export async function DELETE(request: Request) {
  try {
    const url = new URL(request.url)
    const paymentId = url.searchParams.get('id')
    const reason = url.searchParams.get('reason') || 'Payment deleted'

    if (!paymentId) {
      return NextResponse.json(
        { success: false, error: 'Payment ID required' },
        { status: 400 }
      )
    }

    const { data: payment, error: fetchError } = await supabaseAdmin
      .from('fee_payments')
      .select('id, student_id, amount, receipt_no')
      .eq('id', paymentId)
      .single()

    if (fetchError || !payment) {
      return NextResponse.json(
        { success: false, error: 'Payment not found' },
        { status: 404 }
      )
    }

    const { data: userData } = await supabaseAdmin.auth.getUser()

    const { data: refundData, error: reverseError } = await supabaseAdmin.rpc('reverse_payment', {
      p_payment_id: paymentId,
      p_reason: reason,
      p_approved_by: userData?.user?.id || null
    })

    if (reverseError) {
      console.error('❌ Reverse payment error:', reverseError)
      return NextResponse.json(
        { success: false, error: 'Failed to reverse payment: ' + reverseError.message },
        { status: 500 }
      )
    }

    return NextResponse.json({
      success: true,
      message: 'Payment reversed successfully',
      refund: refundData
    })

  } catch (error: any) {
    console.error('❌ DELETE Payment Error:', error)
    return NextResponse.json(
      { success: false, error: error.message || 'Internal server error' },
      { status: 500 }
    )
  }
}