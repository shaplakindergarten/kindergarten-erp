// src/app/api/fees/due/route.ts
// Due List API - Refactored to use v_due_summary and RPC

import { createClient } from '@supabase/supabase-js'
import { NextResponse } from 'next/server'
import { isValidUUID } from '@/lib/utils'

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || process.env.SUPABASE_URL
const supabaseSecretKey = process.env.SUPABASE_SERVICE_ROLE_KEY

if (!supabaseUrl) {
  console.error('ERROR: Missing SUPABASE_URL environment variable')
}

if (!supabaseSecretKey) {
  console.error('ERROR: Missing SUPABASE_SERVICE_ROLE_KEY environment variable')
}

const supabaseAdmin = createClient(supabaseUrl!, supabaseSecretKey!, {
  auth: {
    autoRefreshToken: false,
    persistSession: false
  }
})

// ============================================
// GET: ডিউ ছাত্র তালিকা
// ============================================
export async function GET(request: Request) {
  const startTime = Date.now()
  console.time("Due API execution")
  
  try {
    const { searchParams } = new URL(request.url)
    
    // Get filter parameters
    const classId = searchParams.get('class_id')
    const sectionId = searchParams.get('section_id')
    const search = searchParams.get('search')
    const studentId = searchParams.get('student_id')
    const minDue = searchParams.get('min_due')
    const maxDue = searchParams.get('max_due')
    const status = searchParams.get('status') // 'overdue' | 'partial' | 'pending'
    const academicYearId = searchParams.get('academic_year_id')

        // ============================================
    // Method 1: v_due_summary view query (preferred)
    // ============================================
    let query = supabaseAdmin
      .from('v_due_summary')
      .select('*')
      .gt('total_due', 0)

    // Apply filters
    if (academicYearId && isValidUUID(academicYearId)) {
      query = query.eq('academic_year_id', academicYearId)
    }
    if (classId && classId !== 'all' && isValidUUID(classId)) {
      query = query.eq('class_id', classId)
    }
    if (sectionId && sectionId !== 'all' && isValidUUID(sectionId)) {
      query = query.eq('section_id', sectionId)
    }

    // Search filter
    if (search) {
      const searchLower = search.toLowerCase()
      query = query.or(
        `student_name.ilike.%${search}%,admission_no.ilike.%${search}%,roll_no.ilike.%${search}%,father_name.ilike.%${search}%,phone.ilike.%${search}%`
      )
    }

    // Due amount range filter
    if (minDue) {
      query = query.gte('total_due', parseFloat(minDue))
    }
    if (maxDue) {
      query = query.lte('total_due', parseFloat(maxDue))
    }

    const { data: viewData, error: viewError } = await query
      .order('total_due', { ascending: false })

    if (viewError) {
      console.error('v_due_summary query error:', viewError)
    }

    if (viewData && viewData.length > 0) {
      console.log('✅ Using v_due_summary view')

      // Filter by student ID after query
      let filteredData = viewData
      if (studentId && isValidUUID(studentId)) {
        filteredData = filteredData.filter((s: any) => s.student_id === studentId)
      }

      // Convert to expected format
      const dueStudents = filteredData.map((s: any) => ({
        id: s.student_id,
        student_id: s.student_id,
        student_name: s.student_name,
        name: s.student_name,
        admission_no: s.admission_no || '',
        class_roll: s.roll_no || '',
        class_id: s.class_id,
        class_name: s.class_name || 'N/A',
        section_id: s.section_id,
        section_name: s.section_name || 'N/A',
        father_name: s.father_name || '',
        mother_name: '',
        phone: s.phone || '',
        email: '',
        total_fees: Number(s.total_expected) || 0,
        total_paid: Number(s.total_paid) || 0,
        due_amount: Number(s.total_due) || 0,
        total_due: Number(s.total_due) || 0,
        net_due: Number(s.net_due) || 0,
        total_fine: Number(s.total_fine) || 0,
        total_discount: Number(s.total_discount) || 0,
        total_advance: Number(s.total_advance) || 0,
        last_payment_date: null,
        days_overdue: Number(s.earliest_due_date) ? Math.floor((Date.now() - new Date(s.earliest_due_date).getTime()) / (1000 * 60 * 60 * 24)) : 0,
        overdue_status: s.overall_status === '⚠️ Overdue' ? 'Critical' :
                        s.overall_status === '🔴 Pending' ? 'Medium' :
                        s.overall_status === '🟡 Partial' ? 'High' : 'Current',
        student_status: s.student_status || 'active',
        created_at: new Date().toISOString(),
        overdue_months: Number(s.overdue_months) || 0,
        partial_months: Number(s.partial_months) || 0,
        pending_months: Number(s.pending_months) || 0,
        paid_months: Number(s.paid_months) || 0,
        earliest_due_date: s.earliest_due_date,
        overall_status: s.overall_status || 'pending',
        months: []
      }))

      // Sort by due amount descending
      dueStudents.sort((a: any, b: any) => b.due_amount - a.due_amount)

      const totalTime = Date.now() - startTime
      console.log(`✅ Found ${dueStudents.length} students with due (view, time: ${totalTime}ms)`)
      console.timeEnd("Due API execution")

      return NextResponse.json({
        success: true,
        data: dueStudents,
        count: dueStudents.length,
        timestamp: new Date().toISOString(),
        performance: {
          method: 'view',
          totalMs: totalTime
        }
      })
    }

    console.warn('⚠️ v_due_summary view returned no data or failed, falling back to direct student_fee_dues query:', viewError?.message)

    // ============================================
    // Method 3: Final fallback - direct student_fee_dues query
    // ============================================
    console.log('🔄 Falling back to direct student_fee_dues query...')
    let duesQuery = supabaseAdmin
        .from('student_fee_dues')
         .select(`
           student_id,
           month,
           expected_amount,
           paid_amount,
           due_amount,
           fine_amount,
           discount_amount,
           status,
           due_date,
           is_advance,
           students!inner(
             id,
             name,
             student_id,
             class_roll,
             class_id,
             section_id,
             father_name,
             mother_name,
             fathers_contact,
             mothers_contact,
             email,
             classes!inner(name),
             sections!inner(name)
           )
         `)
        .gt('due_amount', 0)

      if (studentId && isValidUUID(studentId)) {
        duesQuery = duesQuery.eq('student_id', studentId)
      }

      const { data: duesData, error: duesError } = await duesQuery

      if (duesError) {
        console.error('❌ Final fallback error:', duesError)
        return NextResponse.json(
          { success: false, error: duesError.message },
          { status: 500 }
        )
      }

      // Group by student
      const studentMap = new Map()
      duesData?.forEach((d: any) => {
        const student = d.students
        if (!student) return
        
        const key = student.id
        if (!studentMap.has(key)) {
          studentMap.set(key, {
            id: student.id,
            student_id: student.id,
            student_name: student.name,
            name: student.name,
            admission_no: student.student_id || '',
            class_roll: student.class_roll || '',
            class_id: student.class_id,
            class_name: student.classes?.name || 'N/A',
            section_id: student.section_id,
            section_name: student.sections?.name || 'N/A',
            father_name: student.father_name || '',
            mother_name: student.mother_name || '',
            phone: student.fathers_contact || student.mothers_contact || '',
            email: student.email || '',
            total_fees: 0,
            total_paid: 0,
            due_amount: 0,
            days_overdue: 0,
            overdue_status: 'Current',
            student_status: 'active',
            created_at: new Date().toISOString(),
            months: []
          })
        }
        
        const entry = studentMap.get(key)
        entry.total_fees += d.expected_amount || 0
        entry.total_paid += d.paid_amount || 0
        entry.due_amount += d.due_amount || 0
        entry.months.push({
          month: d.month,
          due_amount: d.due_amount,
          status: d.status,
          due_date: d.due_date
        })
        
        if (d.status === 'overdue') {
          entry.overdue_status = 'Critical'
        } else if (d.status === 'partial' && entry.overdue_status !== 'Critical') {
          entry.overdue_status = 'High'
        } else if (d.status === 'pending' && entry.overdue_status === 'Current') {
          entry.overdue_status = 'Medium'
        }
      })

      // Apply search filter
      let finalData = Array.from(studentMap.values())
      if (search) {
        const searchLower = search.toLowerCase()
        finalData = finalData.filter((s: any) =>
          s.student_name?.toLowerCase().includes(searchLower) ||
          s.admission_no?.toLowerCase().includes(searchLower)
        )
      }

      // Apply min/max filter
      if (minDue) {
        finalData = finalData.filter((s: any) => s.due_amount >= parseFloat(minDue))
      }
      if (maxDue) {
        finalData = finalData.filter((s: any) => s.due_amount <= parseFloat(maxDue))
      }

      // Sort
      finalData.sort((a, b) => b.due_amount - a.due_amount)

      const totalTime = Date.now() - startTime
      console.log(`✅ Found ${finalData.length} students with due (fallback, time: ${totalTime}ms)`)
      console.timeEnd("Due API execution")

      return NextResponse.json({
        success: true,
        data: finalData,
        count: finalData.length,
        timestamp: new Date().toISOString(),
        performance: {
          method: 'fallback',
          totalMs: totalTime
        }
      })

    } catch (error) {
    console.error('❌ API Error:', error)
    console.timeEnd("Due API execution")
    return NextResponse.json(
      { success: false, error: 'Internal server error', details: String(error) },
      { status: 500 }
    )
  }
}