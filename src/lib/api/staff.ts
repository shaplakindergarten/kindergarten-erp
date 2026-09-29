// src/lib/api/staff.ts
import { createClient } from '@/lib/supabase/client'
import type { Staff } from '@/types'

// ============================================================
// STAFF CRUD OPERATIONS
// ============================================================

export async function getStaff() {
  const supabase = await createClient()
  
  const { data, error } = await supabase
    .from('staff')
    .select('*')
    .order('created_at', { ascending: false })

  if (error) {
    console.error('getStaff error:', error)
    return []
  }
  
  // Fetch salary categories separately
  if (data && data.length > 0) {
    const categoryIds = data
      .map(s => s.salary_category_id)
      .filter(id => id !== null && id !== undefined)
    
    if (categoryIds.length > 0) {
      const { data: categoriesData } = await supabase
        .from('salary_categories')
        .select('*')
        .in('id', categoryIds)
      
      if (categoriesData) {
        const categoryMap = new Map()
        categoriesData.forEach(cat => categoryMap.set(cat.id, cat))
        data.forEach(staff => {
          if (staff.salary_category_id && categoryMap.has(staff.salary_category_id)) {
            staff.salary_category = categoryMap.get(staff.salary_category_id)
          }
        })
      }
    }
  }
  
  return data || []
}

export async function getActiveStaff() {
  const supabase = await createClient()
  const { data, error } = await supabase
    .from('staff')
    .select('*')
    .in('status', ['active', 'on_leave'])
    .order('name', { ascending: true })

  if (error) {
    console.error('getActiveStaff error:', error)
    return []
  }
  return data || []
}

export async function getStaffById(id: string) {
  const supabase = await createClient()
  const { data, error } = await supabase
    .from('staff')
    .select('*')
    .eq('id', id)
    .single()

  if (error) {
    console.error('getStaffById error:', error)
    return null
  }
  
  if (data?.salary_category_id) {
    const { data: categoryData } = await supabase
      .from('salary_categories')
      .select('*')
      .eq('id', data.salary_category_id)
      .single()
    
    if (categoryData) {
      data.salary_category = categoryData
    }
  }
  
  return data
}

export async function getStaffByEmployeeId(employeeId: string) {
  const supabase = await createClient()
  const { data, error } = await supabase
    .from('staff')
    .select('*')
    .eq('employee_id', employeeId)
    .single()

  if (error) {
    console.error('getStaffByEmployeeId error:', error)
    return null
  }
  
  if (data?.salary_category_id) {
    const { data: categoryData } = await supabase
      .from('salary_categories')
      .select('*')
      .eq('id', data.salary_category_id)
      .single()
    
    if (categoryData) {
      data.salary_category = categoryData
    }
  }
  
  return data
}

// ============================================================
// CREATE STAFF
// ============================================================

export async function createStaff(staff: Partial<Staff>) {
  const supabase = await createClient()
  
  try {
    const year = new Date().getFullYear()
    let seq = 1
    
    try {
      const { data: empData, error: empError } = await supabase
        .from('staff')
        .select('employee_id')
        .order('created_at', { ascending: false })
        .limit(1)

      if (!empError && empData && empData.length > 0 && empData[0]?.employee_id) {
        const lastEmployeeId = empData[0].employee_id
        const parts = lastEmployeeId.split('-')
        if (parts.length === 3) {
          const lastSeq = parseInt(parts[2], 10)
          if (!isNaN(lastSeq)) {
            seq = lastSeq + 1
          }
        }
      }
    } catch (err) {
      console.warn('Could not fetch last employee_id, using default sequence:', err)
      seq = 1
    }
    
    const employeeId = `EMP-${year}-${seq.toString().padStart(3, '0')}`
    console.log('📝 Generated employee_id:', employeeId)

    const insertData: Record<string, any> = {
      employee_id: employeeId,
      name: staff.name || '',
      designation: staff.designation || '',
      contact: staff.contact || '',
      role: staff.role || 'teacher',
      status: 'active',
    }

    if (staff.gender) insertData.gender = staff.gender
    if (staff.qualification) insertData.qualification = staff.qualification
    if (staff.experience) insertData.experience = staff.experience
    if (staff.dob) insertData.dob = staff.dob
    if (staff.address) insertData.address = staff.address
    if (staff.email) insertData.email = staff.email
    if (staff.salary_category_id) insertData.salary_category_id = staff.salary_category_id
    if (staff.name_bn) insertData.name_bn = staff.name_bn
    if (staff.father_name) insertData.father_name = staff.father_name
    if (staff.mother_name) insertData.mother_name = staff.mother_name
    if (staff.nid_no) insertData.nid_no = staff.nid_no
    if (staff.joining_date) insertData.joining_date = staff.joining_date
    if (staff.village) insertData.village = staff.village
    if (staff.post_office) insertData.post_office = staff.post_office
    if (staff.police_station) insertData.police_station = staff.police_station
    if (staff.district) insertData.district = staff.district

    console.log('📤 Creating staff with data:', insertData)

    const { data, error } = await supabase
      .from('staff')
      .insert(insertData)
      .select()
      .single()

    if (error) {
      console.error('❌ Supabase insert error:', error.message)
      throw new Error(error.message)
    }
    
    // Auto-create leave balances for new staff
    await createLeaveBalancesForStaff(data.id)
    
    console.log('✅ Staff created successfully:', data)
    return { success: true, data }
  } catch (err: any) {
    console.error('❌ createStaff error:', err.message)
    throw err
  }
}

// ============================================================
// UPDATE STAFF
// ============================================================

export async function updateStaff(id: string, staff: Partial<Staff>) {
  const supabase = await createClient()
  const updateData: Record<string, any> = {}
  
  if (staff.name !== undefined) updateData.name = staff.name
  if (staff.name_bn !== undefined) updateData.name_bn = staff.name_bn
  if (staff.father_name !== undefined) updateData.father_name = staff.father_name
  if (staff.mother_name !== undefined) updateData.mother_name = staff.mother_name
  if (staff.nid_no !== undefined) updateData.nid_no = staff.nid_no
  if (staff.designation !== undefined) updateData.designation = staff.designation
  if (staff.role !== undefined) updateData.role = staff.role
  if (staff.qualification !== undefined) updateData.qualification = staff.qualification
  if (staff.experience !== undefined) updateData.experience = staff.experience
  if (staff.dob !== undefined) updateData.dob = staff.dob
  if (staff.gender !== undefined) updateData.gender = staff.gender
  if (staff.joining_date !== undefined) updateData.joining_date = staff.joining_date
  if (staff.address !== undefined) updateData.address = staff.address
  if (staff.village !== undefined) updateData.village = staff.village
  if (staff.post_office !== undefined) updateData.post_office = staff.post_office
  if (staff.police_station !== undefined) updateData.police_station = staff.police_station
  if (staff.district !== undefined) updateData.district = staff.district
  if (staff.contact !== undefined) updateData.contact = staff.contact
  if (staff.email !== undefined) updateData.email = staff.email
  if (staff.salary_category_id !== undefined) updateData.salary_category_id = staff.salary_category_id
  if (staff.status !== undefined) updateData.status = staff.status
  if (staff.photo_url !== undefined) updateData.photo_url = staff.photo_url

  console.log('📤 Updating staff with data:', updateData)
  
  const { data, error } = await supabase
    .from('staff')
    .update(updateData)
    .eq('id', id)
    .select()
    .single()

  if (error) {
    console.error('❌ Update staff error:', error)
    throw new Error(error.message)
  }
  
  console.log('✅ Staff updated successfully:', data)
  return data
}

// ============================================================
// DELETE STAFF
// ============================================================

export async function deleteStaff(id: string) {
  const supabase = await createClient()
  
  try {
    console.log(`🗑️ Deleting related records for staff: ${id}`)
    
    await supabase.from('salary_payments').delete().eq('staff_id', id)
    await supabase.from('staff_salaries').delete().eq('staff_id', id)
    await supabase.from('leaves').delete().eq('staff_id', id)
    await supabase.from('salary_advances').delete().eq('staff_id', id)
    await supabase.from('salary_increments').delete().eq('staff_id', id)
    await supabase.from('salary_promotions').delete().eq('staff_id', id)
    await supabase.from('salary_balances').delete().eq('staff_id', id)
    await supabase.from('salary_notifications').delete().eq('staff_id', id)
    await supabase.from('leave_balances').delete().eq('staff_id', id)
    await supabase.from('staff_attendance').delete().eq('staff_id', id)
    
    const { data: advances } = await supabase
      .from('salary_advances')
      .select('id')
      .eq('staff_id', id)
    
    if (advances && advances.length > 0) {
      const advanceIds = advances.map(a => a.id)
      await supabase.from('advance_installments').delete().in('advance_id', advanceIds)
    }
    
    const { error: staffError } = await supabase
      .from('staff')
      .delete()
      .eq('id', id)

    if (staffError) throw staffError
    
    console.log(`✅ Staff deleted successfully: ${id}`)
    return { success: true }
  } catch (err) {
    console.error('❌ Delete staff error:', err)
    throw err
  }
}

// ============================================================
// RESIGN STAFF - COMPLETE HR WORKFLOW
// ============================================================

export async function resignStaff(id: string, resignDate: string, resignReason: string) {
  const supabase = await createClient()
  
  try {
    // 1. Check if staff exists and is active
    const { data: staffMember, error: checkError } = await supabase
      .from('staff')
      .select('status, name, employee_id')
      .eq('id', id)
      .single()
    
    if (checkError) throw checkError
    
    if (staffMember?.status === 'resigned' || staffMember?.status === 'terminated') {
      throw new Error('Staff is already resigned or terminated')
    }
    
    // 2. Update staff status to resigned
    const { data, error } = await supabase
      .from('staff')
      .update({
        status: 'resigned',
        resign_date: resignDate,
        resign_reason: resignReason,
        updated_at: new Date().toISOString(),
      })
      .eq('id', id)
      .select()
      .single()

    if (error) throw error
    
    // 3. Update all active advances to completed
    await supabase
      .from('salary_advances')
      .update({ 
        status: 'completed',
        updated_at: new Date().toISOString()
      })
      .eq('staff_id', id)
      .eq('status', 'active')
    
    // 4. Update all pending leaves to rejected
    await supabase
      .from('leaves')
      .update({ 
        status: 'rejected',
        reason: `Staff resigned - ${resignReason || 'No reason provided'}`,
        updated_at: new Date().toISOString()
      })
      .eq('staff_id', id)
      .eq('status', 'pending')
    
    // 5. Update all future leaves to rejected
    await supabase
      .from('leaves')
      .update({ 
        status: 'rejected',
        reason: `Staff resigned - ${resignReason || 'No reason provided'}`,
        updated_at: new Date().toISOString()
      })
      .eq('staff_id', id)
      .eq('status', 'approved')
      .gte('start_date', new Date().toISOString().split('T')[0])
    
    // 6. Create resignation notification
    await supabase
      .from('salary_notifications')
      .insert({
        staff_id: id,
        type: 'general',
        title: 'Staff Resigned',
        message: `${staffMember?.name} (${staffMember?.employee_id}) has resigned effective ${new Date(resignDate).toLocaleDateString()}. Reason: ${resignReason || 'Not specified'}`,
        sent_via: 'system',
        sent_at: new Date().toISOString(),
        status: 'sent',
        is_read: false,
      })
    
    console.log(`✅ Staff resigned successfully: ${id}`)
    return data
  } catch (err) {
    console.error('❌ Resign staff error:', err)
    throw err
  }
}

// ============================================================
// LEAVE BALANCE FUNCTIONS
// ============================================================

export async function createLeaveBalancesForStaff(staffId: string) {
  const supabase = await createClient()
  
  try {
    const { data: categories } = await supabase
      .from('leave_categories')
      .select('name, days_per_year')
    
    if (!categories || categories.length === 0) return
    
    const balances = categories.map(cat => ({
      staff_id: staffId,
      category_name: cat.name,
      total_days: cat.days_per_year,
      used_days: 0,
      remaining_days: cat.days_per_year,
    }))
    
    await supabase
      .from('leave_balances')
      .insert(balances)
    
    console.log(`✅ Leave balances created for staff: ${staffId}`)
  } catch (err) {
    console.error('❌ Error creating leave balances:', err)
  }
}

export async function getStaffLeaveBalances(staffId: string) {
  const supabase = await createClient()
  
  const { data, error } = await supabase
    .from('leave_balances')
    .select('*')
    .eq('staff_id', staffId)
  
  if (error) {
    console.error('Error fetching leave balances:', error)
    return []
  }
  return data || []
}

// ============================================================
// STAFF STATS
// ============================================================

export async function getStaffStats() {
  const supabase = await createClient()
  
  try {
    const { count: total } = await supabase
      .from('staff')
      .select('*', { count: 'exact', head: true })
    
    const { count: active } = await supabase
      .from('staff')
      .select('*', { count: 'exact', head: true })
      .eq('status', 'active')
    
    const { count: onLeave } = await supabase
      .from('staff')
      .select('*', { count: 'exact', head: true })
      .eq('status', 'on_leave')
    
    const { count: resigned } = await supabase
      .from('staff')
      .select('*', { count: 'exact', head: true })
      .in('status', ['resigned', 'terminated'])
    
    const { count: teachers } = await supabase
      .from('staff')
      .select('*', { count: 'exact', head: true })
      .eq('role', 'teacher')
      .eq('status', 'active')

    return {
      total: total || 0,
      active: active || 0,
      onLeave: onLeave || 0,
      resigned: resigned || 0,
      teachers: teachers || 0,
      adminStaff: (active || 0) - (teachers || 0),
    }
  } catch (err) {
    console.error('getStaffStats error:', err)
    return {
      total: 0,
      active: 0,
      onLeave: 0,
      resigned: 0,
      teachers: 0,
      adminStaff: 0,
    }
  }
}

// ============================================================
// SALARY CATEGORIES
// ============================================================

export async function getSalaryCategories() {
  const supabase = await createClient()
  const { data, error } = await supabase
    .from('salary_categories')
    .select('*')
    .order('name')

  if (error) {
    console.error('getSalaryCategories error:', error)
    return []
  }
  return data || []
}

export async function createSalaryCategory(category: any) {
  const supabase = await createClient()
  const { data, error } = await supabase
    .from('salary_categories')
    .insert(category)
    .select()
    .single()

  if (error) throw error
  return data
}

export async function updateSalaryCategory(id: string, category: any) {
  const supabase = await createClient()
  const { data, error } = await supabase
    .from('salary_categories')
    .update(category)
    .eq('id', id)
    .select()
    .single()

  if (error) throw error
  return data
}

export async function deleteSalaryCategory(id: string) {
  const supabase = await createClient()
  const { error } = await supabase
    .from('salary_categories')
    .delete()
    .eq('id', id)

  if (error) throw error
  return { success: true }
}

// ============================================================
// STAFF SALARY HISTORY
// ============================================================

export async function getStaffSalaryHistory(staffId: string) {
  const supabase = await createClient()
  const { data, error } = await supabase
    .from('staff_salaries')
    .select('*')
    .eq('staff_id', staffId)
    .order('effective_from', { ascending: false })

  if (error) {
    console.error('getStaffSalaryHistory error:', error)
    return []
  }
  return data || []
}

export async function getStaffPaymentHistory(staffId: string) {
  const supabase = await createClient()
  const { data, error } = await supabase
    .from('salary_payments')
    .select('*')
    .eq('staff_id', staffId)
    .order('payment_date', { ascending: false })

  if (error) {
    console.error('getStaffPaymentHistory error:', error)
    return []
  }
  return data || []
}

export async function getStaffAdvances(staffId: string) {
  const supabase = await createClient()
  const { data, error } = await supabase
    .from('salary_advances')
    .select('*, installments:advance_installments(*)')
    .eq('staff_id', staffId)
    .order('created_at', { ascending: false })

  if (error) {
    console.error('getStaffAdvances error:', error)
    return []
  }
  return data || []
}

// ============================================================
// PHOTO UPDATE
// ============================================================

export async function updateStaffPhoto(id: string, photoUrl: string) {
  const supabase = await createClient()
  const { error } = await supabase
    .from('staff')
    .update({ photo_url: photoUrl })
    .eq('id', id)

  if (error) {
    console.error('Failed to update staff photo:', error)
    return { success: false, error: error.message }
  }
  return { success: true }
}

// ============================================================
// CHECK IF STAFF IS ACTIVE
// ============================================================

export async function isStaffActive(staffId: string): Promise<boolean> {
  const supabase = await createClient()
  const { data, error } = await supabase
    .from('staff')
    .select('status')
    .eq('id', staffId)
    .single()

  if (error) {
    console.error('Error checking staff status:', error)
    return false
  }

  return data?.status === 'active' || data?.status === 'on_leave'
}

// ============================================================
// GET STAFF SALARY
// ============================================================

export async function getStaffCurrentSalary(staffId: string): Promise<number> {
  const supabase = await createClient()
  
  // Try to get from staff_salaries first
  const { data: salaryData } = await supabase
    .from('staff_salaries')
    .select('*')
    .eq('staff_id', staffId)
    .order('effective_from', { ascending: false })
    .limit(1)
    .single()

  if (salaryData) {
    return (salaryData.basic || 0) + (salaryData.hra || 0) + (salaryData.da || 0) + 
           (salaryData.allowances || 0) + (salaryData.personal_allowance || 0) + 
           (salaryData.special_allowance || 0) - (salaryData.other_deductions || 0)
  }

  // Fallback to salary_category
  const { data: staffData } = await supabase
    .from('staff')
    .select('*, salary_category:salary_category_id(*)')
    .eq('id', staffId)
    .single()

  if (staffData?.salary_category) {
    const cat = staffData.salary_category
    return (cat.basic || 0) + (cat.hra || 0) + (cat.da || 0) + (cat.allowances || 0) - (cat.deductions || 0)
  }

  return 0
}