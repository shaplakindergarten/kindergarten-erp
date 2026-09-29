// src/app/students/actions.ts
'use server'

import { createClient } from '@/lib/supabase/server'
import { revalidatePath } from 'next/cache'

export interface StudentAdmissionData {
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
  academic_year?: string
  admission_date?: string
  fathers_contact?: string
  mothers_contact?: string
  email?: string
  whatsapp?: string
  father_nid_no?: string
  mother_nid_no?: string
  fee_structure_id?: string // ✅ নতুন ফিল্ড যোগ করা হলো
}

function getClassInitial(className: string): string {
  const name = className.toLowerCase()
  const initials: Record<string, string> = {
    'play': 'P', 'nursery': 'N', 'kg': 'K', 'one': '1', 'two': '2',
    'three': '3', 'four': '4', 'five': '5', 'six': '6', 'seven': '7',
    'eight': '8', 'nine': '9', 'ten': '10',
  }
  return initials[name] || className.charAt(0).toUpperCase()
}

async function generateStudentId(className: string, academicYear: number): Promise<string> {
  const supabase = await createClient()
  const classInitial = getClassInitial(className)
  const prefix = `${academicYear}-${classInitial}-`

  const { data: existingStudents } = await supabase
    .from('students')
    .select('student_id')
    .like('student_id', `${prefix}%`)
    .order('student_id', { ascending: false })
    .limit(1)

  let serial = 1
  if (existingStudents && existingStudents.length > 0) {
    const lastId = existingStudents[0].student_id
    const lastSerial = parseInt(lastId.split('-').pop() || '0', 10)
    serial = lastSerial + 1
  }

  return `${prefix}${serial.toString().padStart(3, '0')}`
}

export async function submitAdmission(data: StudentAdmissionData) {
  const supabase = await createClient()
  
  try {
    console.log('📝 Starting admission submission...')
    
    // ✅ Required fields validation
    const requiredFields = ['name', 'father_name', 'mother_name', 'dob', 'gender', 'contact', 'class_id', 'section_id']
    for (const field of requiredFields) {
      if (!data[field as keyof StudentAdmissionData]) {
        console.error(`❌ Missing required field: ${field}`)
        return { success: false, error: `${field} is required` }
      }
    }

    const academicYear = new Date().getFullYear()
    
    let className = ''
    const { data: classData } = await supabase
      .from('classes')
      .select('name')
      .eq('id', data.class_id)
      .single()
    
    if (classData) className = classData.name
    
    const studentId = await generateStudentId(className, academicYear)
    console.log('🆔 Generated Student ID:', studentId)

    const academicYearId = data.academic_year_id

    // ✅ Student data preparation
    const studentData = {
      student_id: studentId,
      name: data.name,
      name_bn: data.name_bn || null,
      father_name: data.father_name,
      father_name_bn: data.father_name_bn || null,
      mother_name: data.mother_name,
      mother_name_bn: data.mother_name_bn || null,
      dob: data.dob,
      birth_cert_no: data.birth_cert_no || null,
      blood_group: data.blood_group || null,
      particular_disease: data.particular_disease || null,
      gender: data.gender,
      contact: data.contact,
      village: data.village || null,
      post_office: data.post_office || null,
      police_station: data.police_station || null,
      district: data.district || null,
      permanent_village: data.permanent_village || null,
      permanent_post_office: data.permanent_post_office || null,
      permanent_police_station: data.permanent_police_station || null,
      permanent_district: data.permanent_district || null,
      class_roll: data.class_roll || null,
      class_id: data.class_id,
      section_id: data.section_id,
      academic_year_id: academicYearId || null,
      admission_date: data.admission_date || new Date().toISOString().split('T')[0],
      fathers_contact: data.fathers_contact || null,
      mothers_contact: data.mothers_contact || null,
      email: data.email || null,
      whatsapp: data.whatsapp || null,
      student_photo_url: null,
      father_nid_no: data.father_nid_no || null,
      mother_nid_no: data.mother_nid_no || null,
      status: 'active',
    }

    console.log('💾 Inserting student data:', studentData)

    // ✅ Insert student
    const { data: insertedStudent, error } = await supabase
      .from('students')
      .insert(studentData)
      .select('id, student_id, name')
      .single()

    if (error) {
      console.error('❌ Database error:', error)
      return { success: false, error: error.message, details: error }
    }

    console.log('✅ Student inserted successfully:', insertedStudent)

    // ✅ NEW: Create fee assignment if fee_structure_id is provided
    if (data.fee_structure_id && insertedStudent?.id) {
      console.log('📋 Creating fee assignment for student...')
      
      const { error: assignmentError } = await supabase
        .from('fee_student_assignments')
        .insert({
          student_id: insertedStudent.id,
          fee_structure_id: data.fee_structure_id,
          academic_year_id: academicYearId,
          assigned_date: new Date().toISOString().split('T')[0],
          effective_from: null, // ✅ ট্রিগার স্বয়ংক্রিয় সেট করবে
          effective_to: null,   // ✅ ট্রিগার স্বয়ংক্রিয় সেট করবে
          is_active: true,
          notes: 'Auto-created from admission',
          created_by: null, // TODO: Add current user
        })
        .select()
        .single()

      if (assignmentError) {
        console.error('❌ Fee assignment error:', assignmentError)
        // ✅ Student created successfully but fee assignment failed
        // We'll return success but log the error
        return { 
          success: true, 
          studentId: insertedStudent.student_id,
          studentIdUuid: insertedStudent.id,
          student: insertedStudent,
          warning: 'Student created but fee assignment failed. Please assign fee structure manually.',
          warningDetails: assignmentError.message
        }
      }

      console.log('✅ Fee assignment created successfully')
    }

    // ✅ Revalidate paths
    revalidatePath('/students/list')
    revalidatePath('/students/new')
    
    return { 
      success: true, 
      studentId: insertedStudent?.student_id || studentId,
      studentIdUuid: insertedStudent?.id,
      student: insertedStudent
    }
  } catch (error) {
    console.error('🔥 Admission error:', error)
    return { success: false, error: error instanceof Error ? error.message : 'Failed to submit admission' }
  }
}

// ✅ NEW: Helper function to get fee structure for a class
export async function getFeeStructureForClass(classId: string, academicYearId: string) {
  const supabase = await createClient()
  
  try {
    const { data, error } = await supabase
      .from('fee_structures')
      .select('id, name, total_amount')
      .eq('class_id', classId)
      .eq('academic_year_id', academicYearId)
      .eq('is_active', true)
      .maybeSingle()
    
    if (error) throw error
    return { success: true, data }
  } catch (error) {
    console.error('Error fetching fee structure:', error)
    return { success: false, error: error instanceof Error ? error.message : 'Failed to fetch fee structure' }
  }
}