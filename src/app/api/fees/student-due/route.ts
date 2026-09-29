// src/app/api/fees/student-due/route.ts
// Student Fee Due API - Refactored to use RPC and student_fee_dues
// UPDATED: Added advance_allocations + academic_year.start_date/end_date

import { createClient } from '@supabase/supabase-js'
import { NextResponse } from 'next/server'

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || process.env.SUPABASE_URL
const supabaseSecretKey = process.env.SUPABASE_SERVICE_ROLE_KEY

if (!supabaseUrl) {
  console.error('ERROR: Missing SUPABASE_URL environment variable')
}

if (!supabaseSecretKey) {
  console.error('ERROR: Missing SUPABASE_SERVICE_ROLE_KEY environment variable')
}

const supabaseAdmin = createClient(supabaseUrl!, supabaseSecretKey!, {
  auth: { autoRefreshToken: false, persistSession: false }
})

export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url)
    const studentId = searchParams.get('student_id')
    const academicYearId = searchParams.get('academic_year_id')

    if (!studentId) {
      return NextResponse.json(
        { success: false, error: 'Student ID is required' },
        { status: 400 }
      )
    }

    console.log('=== STUDENT DUE CALCULATION (REFACTORED) ===')
    console.log('Student ID:', studentId)

    // --- STEP 1: Get Student Record ---
    const { data: student, error: studentError } = await supabaseAdmin
      .from('students')
      .select('id, name, student_id, father_name, class_id, section_id, academic_year_id, status')
      .eq('id', studentId)
      .single()

    if (studentError || !student) {
      console.log('Student not found:', studentError?.message)
      return NextResponse.json({
        success: true,
        student: { id: studentId, name: 'Unknown', student_id: null, father_name: null },
        opening_balance: 0,
        current_charges: 0,
        discount: 0,
        fine: 0,
        total_payable: 0,
        total_paid: 0,
        remaining_due: 0,
        categories: [],
        due_details: [],
        advance_allocations: [],
        academic_year: null,
      })
    }

    if (student.status !== 'active') {
      return NextResponse.json({
        success: true,
        student: {
          id: student.id,
          name: student.name,
          student_id: student.student_id,
          father_name: student.father_name,
        },
        opening_balance: 0,
        current_charges: 0,
        discount: 0,
        fine: 0,
        total_payable: 0,
        total_paid: 0,
        remaining_due: 0,
        categories: [],
        due_details: [],
        advance_allocations: [],
        academic_year: null,
        message: 'Student is not active',
      })
    }

    console.log('Student found:', student.name)

    // --- STEP 2: Resolve academic_year_id ---
    let resolvedAcademicYearId = academicYearId || student.academic_year_id

    if (!resolvedAcademicYearId) {
      console.log('No academic_year_id, fetching current')
      const { data: ay } = await supabaseAdmin
        .from('academic_years')
        .select('id, start_date, end_date, name')
        .eq('is_current', true)
        .single()
      resolvedAcademicYearId = ay?.id || null
    }

    if (!resolvedAcademicYearId) {
      return NextResponse.json({
        success: true,
        student: {
          id: student.id,
          name: student.name,
          student_id: student.student_id,
          father_name: student.father_name,
        },
        opening_balance: 0,
        current_charges: 0,
        discount: 0,
        fine: 0,
        total_payable: 0,
        total_paid: 0,
        remaining_due: 0,
        categories: [],
        due_details: [],
        advance_allocations: [],
        academic_year: null,
        message: 'No academic year configured',
      })
    }

    // --- STEP 3: Get Academic Year Details (with start_date + end_date) ---
    const { data: academicYear, error: ayError } = await supabaseAdmin
      .from('academic_years')
      .select('id, start_date, end_date, name, year_name')
      .eq('id', resolvedAcademicYearId)
      .single()

    if (ayError) {
      console.error('Error fetching academic year:', ayError)
    }

    // --- STEP 4: Get Student Fee Summary using RPC ---
    console.log('🔄 Calling get_student_fee_summary RPC...')

    const { data: summaryData, error: summaryError } = await supabaseAdmin.rpc(
      'get_student_fee_summary',
      {
        p_student_id: studentId,
        p_academic_year_id: resolvedAcademicYearId,
      }
    )

    let dueDetails: any[] = []
    let totalExpected = 0
    let totalPaid = 0
    let totalDue = 0
    let totalFine = 0
    let totalDiscount = 0
    let totalAdvance = 0
    let categoryBreakdown: any[] = []

    if (!summaryError && summaryData) {
      console.log('✅ get_student_fee_summary RPC successful')

      totalExpected = summaryData.summary?.total_expected || 0
      totalPaid = summaryData.summary?.total_paid || 0
      totalDue = summaryData.summary?.total_due || 0
      totalFine = summaryData.summary?.total_fine || 0
      totalDiscount = summaryData.summary?.total_discount || 0
      totalAdvance = summaryData.summary?.total_advance || 0

      categoryBreakdown = summaryData.category_breakdown || []

      const { data: duesData, error: duesError } = await supabaseAdmin
        .from('student_fee_dues')
        .select('*')
        .eq('student_id', studentId)
        .eq('academic_year_id', resolvedAcademicYearId)
        .gt('due_amount', 0)
        .order('month', { ascending: true })

      if (!duesError && duesData) {
        dueDetails = duesData.map((d: any) => ({
          id: d.id,
          month: d.month,
          category_id: d.category_id,
          expected_amount: d.expected_amount,
          paid_amount: d.paid_amount,
          due_amount: d.due_amount,
          fine_amount: d.fine_amount,
          discount_amount: d.discount_amount,
          status: d.status,
          due_date: d.due_date,
          is_advance: d.is_advance,
        }))
      }
    } else {
      // Fallback: Direct student_fee_dues query
      console.warn('⚠️ RPC failed, falling back to direct query:', summaryError?.message)

      const { data: duesData, error: duesError } = await supabaseAdmin
        .from('student_fee_dues')
        .select('*')
        .eq('student_id', studentId)
        .eq('academic_year_id', resolvedAcademicYearId)
        .order('month', { ascending: true })

      if (duesError) {
        console.error('Error fetching dues:', duesError)
      }

      if (duesData && duesData.length > 0) {
        const categoryMap = new Map<string, any>()

        for (const d of duesData) {
          const key = d.category_id || 'uncategorized'
          if (!categoryMap.has(key)) {
            categoryMap.set(key, {
              category_id: d.category_id,
              total_expected: 0,
              total_paid: 0,
              total_due: 0,
              total_fine: 0,
              total_discount: 0,
              months: [],
            })
          }

          const entry = categoryMap.get(key)
          entry.total_expected += d.expected_amount || 0
          entry.total_paid += d.paid_amount || 0
          entry.total_due += d.due_amount || 0
          entry.total_fine += d.fine_amount || 0
          entry.total_discount += d.discount_amount || 0
          entry.months.push({
            month: d.month,
            expected: d.expected_amount,
            paid: d.paid_amount,
            due: d.due_amount,
            fine: d.fine_amount,
            discount: d.discount_amount,
            status: d.status,
            due_date: d.due_date,
            is_advance: d.is_advance,
          })
        }

        categoryBreakdown = Array.from(categoryMap.values())

        totalExpected = duesData.reduce((sum, d) => sum + (d.expected_amount || 0), 0)
        totalPaid = duesData.reduce((sum, d) => sum + (d.paid_amount || 0), 0)
        totalDue = duesData.reduce((sum, d) => sum + (d.due_amount || 0), 0)
        totalFine = duesData.reduce((sum, d) => sum + (d.fine_amount || 0), 0)
        totalDiscount = duesData.reduce((sum, d) => sum + (d.discount_amount || 0), 0)

        dueDetails = duesData.map((d: any) => ({
          id: d.id,
          month: d.month,
          category_id: d.category_id,
          expected_amount: d.expected_amount,
          paid_amount: d.paid_amount,
          due_amount: d.due_amount,
          fine_amount: d.fine_amount,
          discount_amount: d.discount_amount,
          status: d.status,
          due_date: d.due_date,
          is_advance: d.is_advance,
        }))
      }
    }

    // --- STEP 5: Get Opening Balance (previous academic years) ---
    let openingBalance = 0

    if (academicYear) {
      const { data: previousDues } = await supabaseAdmin
        .from('student_fee_dues')
        .select('due_amount')
        .eq('student_id', studentId)
        .neq('academic_year_id', resolvedAcademicYearId)
        .gt('due_amount', 0)

      if (previousDues && previousDues.length > 0) {
        openingBalance = previousDues.reduce((sum, d) => sum + (d.due_amount || 0), 0)
      }
    }

    // --- STEP 6: Calculate Fine ---
    let totalFineAmount = totalFine || 0

    const { data: fineRules } = await supabaseAdmin
      .from('fine_rules')
      .select('*')
      .eq('is_active', true)

    if (totalFineAmount === 0 && dueDetails.length > 0) {
      const overdueDues = dueDetails.filter((d) => d.status === 'overdue')
      if (overdueDues.length > 0 && fineRules && fineRules.length > 0) {
        const overdueAmount = overdueDues.reduce((sum, d) => sum + d.due_amount, 0)
        for (const rule of fineRules) {
          if (rule.fine_type === 'percentage') {
            totalFineAmount += (overdueAmount * rule.fine_value) / 100
          } else if (rule.fine_type === 'fixed') {
            totalFineAmount += rule.fine_value
          }
          if (rule.max_fine && totalFineAmount > rule.max_fine) {
            totalFineAmount = rule.max_fine
          }
        }
      }
    }

    // --- STEP 7: Calculate Final Amounts ---
    const totalPayable = totalExpected + openingBalance + totalFineAmount
    const remainingDue = Math.max(0, totalPayable - totalPaid)

    // --- STEP 8: Fetch Actual Advance Allocations from DB ---
    // ═══════════════════════════════════════════════════════════════
    // 🆕 এই section-এ actual advance allocations আনা হবে
    // payment_allocations + fee_payments + fee_categories join করে
    // ═══════════════════════════════════════════════════════════════
    let advanceAllocations: Array<{
      category_id: string
      category_name: string
      month: string
      amount: number
      allocation_type: string
      payment_id: string
      receipt_no: string | null
      payment_date: string | null
    }> = []

    try {
      const { data: advanceData, error: advanceError } = await supabaseAdmin
        .from('payment_allocations')
        .select(`
          id,
          category_id,
          amount,
          month,
          allocation_type,
          payment_id,
          category:fee_categories(id, name),
          payment:fee_payments!inner(id, student_id, receipt_no, payment_date)
        `)
        .in('allocation_type', ['advance', 'advance_global'])
        .eq('payment.student_id', studentId)
        .order('month', { ascending: true })

      if (!advanceError && advanceData) {
        advanceAllocations = advanceData.map((a: any) => ({
          category_id: a.category_id,
          category_name:
            a.category?.name ||
            (a.allocation_type === 'advance_global' ? 'Advance (Global)' : 'Fee'),
          month: a.month || '',
          amount: Number(a.amount) || 0,
          allocation_type: a.allocation_type,
          payment_id: a.payment_id,
          receipt_no: a.payment?.receipt_no || null,
          payment_date: a.payment?.payment_date || null,
        }))

        console.log('📊 Advance allocations fetched:', advanceAllocations.length)
      } else if (advanceError) {
        console.warn('⚠️ Advance allocations fetch failed:', advanceError.message)

        // Fallback: Manual filter
        const { data: fallbackAllocs } = await supabaseAdmin
          .from('payment_allocations')
          .select(`
            id, category_id, amount, month, allocation_type, payment_id,
            category:fee_categories(id, name)
          `)
          .in('allocation_type', ['advance', 'advance_global'])

        if (fallbackAllocs && fallbackAllocs.length > 0) {
          const paymentIds = [...new Set(fallbackAllocs.map((a: any) => a.payment_id))]

          const { data: paymentsData } = await supabaseAdmin
            .from('fee_payments')
            .select('id, student_id, receipt_no, payment_date')
            .in('id', paymentIds)
            .eq('student_id', studentId)

          const paymentMap = new Map(
            (paymentsData || []).map((p: any) => [p.id, p])
          )

          advanceAllocations = fallbackAllocs
            .filter((a: any) => paymentMap.has(a.payment_id))
            .map((a: any) => {
              const p: any = paymentMap.get(a.payment_id)
              return {
                category_id: a.category_id,
                category_name:
                  a.category?.name ||
                  (a.allocation_type === 'advance_global' ? 'Advance (Global)' : 'Fee'),
                month: a.month || '',
                amount: Number(a.amount) || 0,
                allocation_type: a.allocation_type,
                payment_id: a.payment_id,
                receipt_no: p?.receipt_no || null,
                payment_date: p?.payment_date || null,
              }
            })
            .sort((a, b) => a.month.localeCompare(b.month))

          console.log('📊 Advance allocations (fallback):', advanceAllocations.length)
        }
      }
    } catch (err) {
      console.error('Error fetching advance allocations:', err)
    }

    // --- STEP 9: Build Category details for response ---
    const categories = categoryBreakdown.map((cat: any) => {
      let categoryName = 'N/A'

      // If category_id missing, try to look up name from fee_categories
      if (cat.category_name) {
        categoryName = cat.category_name
      }

      return {
        id: cat.category_id || 'uncategorized',
        name: categoryName,
        amount: cat.total_expected || 0,
        paid: cat.total_paid || 0,
        due: cat.total_due || 0,
        fine: cat.total_fine || 0,
        discount: cat.total_discount || 0,
        is_optional: false,
        months: cat.months || [],
      }
    })

    // --- STEP 10: Return Response ---
    return NextResponse.json({
      success: true,
      student: {
        id: student.id,
        name: student.name,
        student_id: student.student_id,
        father_name: student.father_name,
        class_id: student.class_id,
        section_id: student.section_id,
      },
      opening_balance: openingBalance,
      current_charges: totalExpected,
      discount: totalDiscount,
      fine: totalFineAmount,
      total_payable: totalPayable,
      total_paid: totalPaid,
      remaining_due: remainingDue,
      advance_balance: totalAdvance || 0,
      categories: categories,
      due_details: dueDetails,
      discount_applied: totalDiscount > 0,
      discount_amount: totalDiscount,

      // 🆕 Advance allocations — actual month-wise breakdown
      advance_allocations: advanceAllocations,

      // 🆕 Academic year with start/end dates
      academic_year: {
        id: resolvedAcademicYearId,
        name: academicYear?.name || academicYear?.year_name || 'Current Year',
        start_date: academicYear?.start_date || null,
        end_date: academicYear?.end_date || null,
      },

      summary: {
        total_expected: totalExpected,
        total_paid: totalPaid,
        total_due: totalDue,
        total_fine: totalFineAmount,
        total_discount: totalDiscount,
        total_advance: totalAdvance || 0,
        net_due: remainingDue,
      },
    })
  } catch (error: any) {
    console.error('❌ API Error:', error)
    return NextResponse.json(
      {
        success: false,
        error: error.message || 'Internal server error',
        details: process.env.NODE_ENV === 'development' ? error.stack : undefined,
      },
      { status: 500 }
    )
  }
}