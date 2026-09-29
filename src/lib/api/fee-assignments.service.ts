/**
 * Fee Assignments API Service
 */

import { createClient } from '@/lib/supabase/client';
import {
  FeeStudentAssignment,
  FeeAssignmentWithDetails,
  FeeAssignmentStats,
  StudentForAssignment,
  FeeAssignmentFilters,
  CreateFeeAssignmentData,
  UpdateFeeAssignmentData,
  BulkAssignData,
  BulkAssignResult,
  AssignmentScope,
} from '@/types/fee-assignments';

interface AssignmentRow {
  id: string;
  student_id: string;
  fee_structure_id: string;
  academic_year_id: string;
  assigned_date: string;
  effective_from: string;
  effective_to: string | null;
  is_active: boolean;
  notes: string | null;
  created_by: string | null;
  created_at: string;
  updated_at: string;
  student?: Record<string, any>;
  fee_structure?: Record<string, any>;
  academic_year?: Record<string, any>;
}

async function getClassAndSectionLookups() {
  const supabase = await createClient()
  try {
    const [{ data: classes }, { data: sections }] = await Promise.all([
      supabase.from('classes').select('id, name').order('name', { ascending: true }),
      supabase.from('sections').select('id, name').order('name', { ascending: true }),
    ]);

    const classMap = new Map<string, string>((classes || []).map((item: Record<string, any>) => [item.id, item.name || 'N/A']));
    const sectionMap = new Map<string, string>((sections || []).map((item: Record<string, any>) => [item.id, item.name || 'N/A']));

    return { classMap, sectionMap };
  } catch {
    return { classMap: new Map<string, string>(), sectionMap: new Map<string, string>() };
  }
}

// ============================================
// FETCH FUNCTIONS
// ============================================

export async function getFeeAssignments(filters: FeeAssignmentFilters): Promise<{
  data: FeeAssignmentWithDetails[];
  total: number;
  page: number;
  limit: number;
  totalPages: number;
}> {
  const supabase = await createClient();
  const {
    search = '',
    class_id,
    section_id,
    academic_year_id,
    status = 'all',
    assigned = 'all',
    page = 1,
    limit = 20,
    sort_by = 'created_at',
    sort_order = 'desc',
  } = filters;

  const offset = (page - 1) * limit;

  let query = supabase
    .from('fee_student_assignments')
    .select(`
      *,
      student:student_id (
        id,
        student_id,
        name,
        class_roll,
        class_id,
        section_id,
        status,
        father_name,
        contact
      ),
      fee_structure:fee_structure_id (
        id,
        name,
        total_amount,
        is_active,
        academic_year_id,
        class_id,
        items:fee_structure_items (
          id,
          fee_structure_id,
          category_id,
          amount,
          frequency,
          name,
          is_optional
        )
      ),
      academic_year:academic_year_id (
        id,
        year_name,
        name
      )
    `, { count: 'exact' });

  query = query.eq('is_active', status === 'active');

  if (assigned === 'assigned') {
    query = query.is('fee_structure_id', 'not.null');
  } else if (assigned === 'unassigned') {
    query = query.is('fee_structure_id', null);
  }

  if (class_id && class_id !== 'all') {
    query = query.eq('student.class_id', class_id);
  }

  if (section_id && section_id !== 'all') {
    query = query.eq('student.section_id', section_id);
  }

  if (academic_year_id && academic_year_id !== 'all') {
    query = query.eq('academic_year_id', academic_year_id);
  }

  if (search && search.trim() !== '') {
    query = query.or(
      `student.name.ilike.%${search}%,` +
      `student.student_id.ilike.%${search}%,` +
      `student.class_roll.ilike.%${search}%`
    );
  }

  query = query
    .order(sort_by, { ascending: sort_order === 'asc' })
    .range(offset, offset + limit - 1);

  const { data, error, count } = await query;

  if (error) {
    console.error('Error fetching fee assignments:', error);
    return {
      data: [],
      total: 0,
      page,
      limit,
      totalPages: 0,
    };
  }

  return {
    data: (data || []) as FeeAssignmentWithDetails[],
    total: count || 0,
    page,
    limit,
    totalPages: count ? Math.ceil(count / limit) : 0,
  };
}

export async function getStudentsForAssignment(params?: {
  classId?: string;
  sectionId?: string;
  academicYearId?: string;
  search?: string;
}): Promise<StudentForAssignment[]> {
  const supabase = await createClient();
  const { classId, sectionId, academicYearId, search } = params || {};

  let query = supabase
    .from('students')
    .select(`
      id,
      student_id,
      name,
      class_roll,
      class_id,
      section_id,
      status,
      father_name,
      contact
    `)
    .eq('status', 'active');

  if (classId && classId !== 'all') {
    query = query.eq('class_id', classId);
  }

  if (sectionId && sectionId !== 'all') {
    query = query.eq('section_id', sectionId);
  }

  if (search && search.trim() !== '') {
    query = query.or(
      `name.ilike.%${search}%,` +
      `student_id.ilike.%${search}%,` +
      `class_roll.ilike.%${search}%`
    );
  }

  const { data: students, error } = await query.order('name');

  if (error) {
    console.error('Error fetching students for assignment:', error);
    return [];
  }

  const studentIds = (students || []).map((s: any) => s.id);

  if (studentIds.length === 0) {
    return (students || []).map((s: any) => ({
      id: s.id,
      student_id: s.student_id,
      name: s.name,
      class_roll: s.class_roll,
      class_id: s.class_id,
      class_name: s.class_id,
      section_id: s.section_id,
      section_name: s.section_id,
      father_name: s.father_name,
      contact: s.contact,
      is_assigned: false,
      assignment_id: null,
      assigned_structure_id: null,
    }));
  }

  const { classMap, sectionMap } = await getClassAndSectionLookups();

  const { data: assignments, error: assignmentError } = await supabase
    .from('fee_student_assignments')
    .select('student_id, fee_structure_id, id')
    .in('student_id', studentIds)
    .eq('is_active', true);

  const assignmentMap = new Map<string, string>();
  if (assignments) {
    assignments.forEach((a: any) => {
      assignmentMap.set(a.student_id, a.fee_structure_id);
    });
  }

  return (students || []).map((s: any) => {
    const isAssigned = assignmentMap.has(s.id);
    return {
      id: s.id,
      student_id: s.student_id,
      name: s.name,
      class_roll: s.class_roll,
      class_id: s.class_id,
      class_name: classMap.get(s.class_id) || s.class_id,
      section_id: s.section_id,
      section_name: sectionMap.get(s.section_id) || s.section_id,
      father_name: s.father_name,
      contact: s.contact,
      is_assigned: isAssigned,
      assignment_id: isAssigned ? null : null,
      assigned_structure_id: isAssigned ? (assignmentMap.get(s.id) || null) : null,
    };
  });
}

export async function getUnassignedStudents(filters?: {
  class_id?: string;
  section_id?: string;
  search?: string;
  academic_year_id?: string;
  page?: number;
  limit?: number;
}): Promise<{
  data: StudentForAssignment[];
  total: number;
  page: number;
  limit: number;
  totalPages: number;
}> {
  const supabase = await createClient();
  const {
    class_id,
    section_id,
    search = '',
    academic_year_id,
    page = 1,
    limit = 100,
  } = filters || {};

  const offset = (page - 1) * limit;

  let query = supabase
    .from('students')
    .select(
      `id, student_id, name, class_roll, class_id, section_id, status, father_name, contact`,
      { count: 'exact' }
    )
    .eq('status', 'active')
    .not('class_id', 'is', null)
    .order('name');

  if (class_id && class_id !== 'all') {
    query = query.eq('class_id', class_id);
  }

  if (section_id && section_id !== 'all') {
    query = query.eq('section_id', section_id);
  }

  if (search && search.trim() !== '') {
    query = query.or(
      `name.ilike.%${search}%,` +
      `student_id.ilike.%${search}%,` +
      `class_roll.ilike.%${search}%`
    );
  }

  query = query.range(offset, offset + limit - 1);

  const { data: students, error, count } = await query;

  if (error) {
    console.error('Error fetching unassigned students:', error);
    return {
      data: [],
      total: 0,
      page,
      limit,
      totalPages: 0,
    };
  }

  const studentIds = (students || []).map((s: any) => s.id);

  if (studentIds.length === 0) {
    return {
      data: [],
      total: count || 0,
      page,
      limit,
      totalPages: count ? Math.ceil(count / limit) : 0,
    };
  }

  const { classMap, sectionMap } = await getClassAndSectionLookups();

  const { data: assignments, error: assignmentError } = await supabase
    .from('fee_student_assignments')
    .select('student_id')
    .in('student_id', studentIds)
    .eq('is_active', true);

  const assignedStudentIds = new Set<string>();
  if (assignments) {
    assignments.forEach((a: any) => {
      assignedStudentIds.add(a.student_id);
    });
  }

  const unassignedStudents: StudentForAssignment[] = (students || [])
    .filter((s: any) => !assignedStudentIds.has(s.id))
    .map((s: any) => ({
      id: s.id,
      student_id: s.student_id,
      name: s.name,
      class_roll: s.class_roll,
      class_id: s.class_id,
      class_name: classMap.get(s.class_id) || s.class_id,
      section_id: s.section_id,
      section_name: sectionMap.get(s.section_id) || s.section_id,
      father_name: s.father_name,
      contact: s.contact,
      is_assigned: false,
      assignment_id: null,
      assigned_structure_id: null,
    }));

  const unassignedCount = unassignedStudents.length;

  return {
    data: unassignedStudents,
    total: count || 0,
    page,
    limit,
    totalPages: count ? Math.ceil(count / limit) : 0,
  };
}

export async function getFeeAssignmentStats(): Promise<FeeAssignmentStats> {
  const supabase = await createClient();

  try {
    const { data: studentsData, error: studentsError } = await supabase
      .from('students')
      .select('id, class_id', { count: 'exact' })
      .eq('status', 'active');

    if (studentsError) throw studentsError;

    const totalStudents = studentsData?.length || 0;
    const allStudentIds = (studentsData || []).map((s: any) => s.id);

    if (allStudentIds.length === 0) {
      return {
        total_students: 0,
        assigned_students: 0,
        unassigned_students: 0,
        assignment_percentage: 0,
        total_structures_used: 0,
        by_class: [],
      };
    }

    const { data: assignments, error: assignmentError } = await supabase
      .from('fee_student_assignments')
      .select('student_id, fee_structure_id')
      .eq('is_active', true)
      .in('student_id', allStudentIds);

    if (assignmentError) throw assignmentError;

    const assignedStudentIds = new Set<string>();
    const structureIds = new Set<string>();
    assignments?.forEach((a: any) => {
      assignedStudentIds.add(a.student_id);
      structureIds.add(a.fee_structure_id);
    });

    const assignedCount = assignedStudentIds.size;
    const unassignedCount = totalStudents - assignedCount;

    const { data: classes, error: classError } = await supabase
      .from('classes')
      .select('id, name')
      .order('name');

    if (classError) throw classError;

    const byClass: FeeAssignmentStats['by_class'] = (classes || []).map((cls: any) => {
      const classStudents = allStudentIds.filter((_, idx) => {
        const student = studentsData[idx];
        return student?.class_id === cls.id;
      });
      const classAssigned = classStudents.filter(
        (id) => assignedStudentIds.has(id)
      ).length;
      const classTotal = classStudents.length;
      const classUnassigned = classTotal - classAssigned;
      return {
        class_id: cls.id,
        class_name: cls.name,
        total_students: classTotal,
        assigned_students: classAssigned,
        unassigned_students: classUnassigned,
        assignment_percentage: classTotal > 0 ? Math.round((classAssigned / classTotal) * 100) : 0,
      };
    });

    return {
      total_students: totalStudents,
      assigned_students: assignedCount,
      unassigned_students: unassignedCount,
      assignment_percentage: totalStudents > 0 ? Math.round((assignedCount / totalStudents) * 100) : 0,
      total_structures_used: structureIds.size,
      by_class: byClass,
    };
  } catch (error) {
    console.error('Error fetching fee assignment stats:', error);
    return {
      total_students: 0,
      assigned_students: 0,
      unassigned_students: 0,
      assignment_percentage: 0,
      total_structures_used: 0,
      by_class: [],
    };
  }
}

export async function getFeeAssignmentById(id: string): Promise<FeeAssignmentWithDetails | null> {
  const supabase = await createClient();

  const { data, error } = await supabase
    .from('fee_student_assignments')
    .select(`
      *,
      student:student_id (
        id,
        student_id,
        name,
        class_roll,
        class_id,
        section_id,
        status,
        father_name,
        contact
      ),
      fee_structure:fee_structure_id (
        id,
        name,
        total_amount,
        is_active,
        academic_year_id,
        class_id,
        items:fee_structure_items (
          id,
          fee_structure_id,
          category_id,
          amount,
          frequency,
          name,
          is_optional
        )
      ),
      academic_year:academic_year_id (
        id,
        year_name,
        name
      )
    `)
    .eq('id', id)
    .single();

  if (error) {
    console.error('Error fetching fee assignment by ID:', error);
    return null;
  }

  return data as FeeAssignmentWithDetails;
}

export async function getAssignmentHistory(studentId: string): Promise<FeeAssignmentWithDetails[]> {
  const supabase = await createClient();

  const { data, error } = await supabase
    .from('fee_student_assignments')
    .select(`
      *,
      student:student_id (
        id,
        student_id,
        name,
        class_roll,
        class_id,
        section_id,
        status,
        father_name,
        contact
      ),
      fee_structure:fee_structure_id (
        id,
        name,
        total_amount,
        is_active,
        academic_year_id,
        class_id,
        items:fee_structure_items (
          id,
          fee_structure_id,
          category_id,
          amount,
          frequency,
          name,
          is_optional
        )
      ),
      academic_year:academic_year_id (
        id,
        year_name,
        name
      )
    `)
    .eq('student_id', studentId)
    .order('created_at', { ascending: false });

  if (error) {
    console.error('Error fetching assignment history:', error);
    return [];
  }

  return (data || []) as FeeAssignmentWithDetails[];
}

// ============================================
// MUTATION FUNCTIONS
// ============================================

export async function createFeeAssignment(data: CreateFeeAssignmentData): Promise<{
  success: boolean;
  data?: FeeStudentAssignment;
  error?: string;
}> {
  const supabase = await createClient();

  try {
    const { data: assignment, error } = await supabase
      .from('fee_student_assignments')
      .insert({
        student_id: data.student_id,
        fee_structure_id: data.fee_structure_id,
        academic_year_id: data.academic_year_id,
        assigned_date: new Date().toISOString(),
        effective_from: data.effective_from,
        effective_to: data.effective_to || null,
        is_active: true,
        notes: data.notes || null,
        created_by: null,
      })
      .select()
      .single();

    if (error) throw error;

    return { success: true, data: assignment };
  } catch (error: any) {
    console.error('Error creating fee assignment:', error);
    return { success: false, error: error.message || 'Failed to create assignment' };
  }
}

export async function bulkAssignFeeStructure(data: BulkAssignData): Promise<BulkAssignResult> {
  const supabase = await createClient();
  const { scope, fee_structure_id, academic_year_id, effective_from, effective_to, notes } = data;

  try {
    let studentIds: string[] = [];

    if (scope.mode === 'whole_class' && scope.class_id) {
      const { data: students, error } = await supabase
        .from('students')
        .select('id')
        .eq('class_id', scope.class_id)
        .eq('status', 'active');

      if (error) throw error;
      studentIds = (students || []).map((s: any) => s.id);
    } else if (scope.mode === 'whole_section' && scope.class_id && scope.section_id) {
      const { data: students, error } = await supabase
        .from('students')
        .select('id')
        .eq('class_id', scope.class_id)
        .eq('section_id', scope.section_id)
        .eq('status', 'active');

      if (error) throw error;
      studentIds = (students || []).map((s: any) => s.id);
    } else if (
      (scope.mode === 'selected_students' || scope.mode === 'individual') &&
      scope.student_ids
    ) {
      studentIds = scope.student_ids;
    } else {
      studentIds = scope.student_ids || [];
    }

    const existingAssignments = await supabase
      .from('fee_student_assignments')
      .select('student_id')
      .eq('fee_structure_id', fee_structure_id)
      .eq('is_active', true)
      .in('student_id', studentIds);

    const alreadyAssigned = new Set(
      (existingAssignments.data || []).map((a: any) => a.student_id)
    );

    const toAssign = studentIds.filter((id) => !alreadyAssigned.has(id));
    const skipped = studentIds.filter((id) => alreadyAssigned.has(id));

    const results: BulkAssignResult['results'] = [];
    let failed = 0;
    let assigned = 0;

    for (const studentId of toAssign) {
      try {
        const { error } = await supabase
          .from('fee_student_assignments')
          .insert({
            student_id: studentId,
            fee_structure_id,
            academic_year_id,
            assigned_date: new Date().toISOString(),
            effective_from,
            effective_to: effective_to || null,
            is_active: true,
            notes: notes || null,
            created_by: null,
          });

        if (error) {
          failed++;
          results.push({ student_id: studentId, success: false, message: error.message });
        } else {
          assigned++;
          results.push({ student_id: studentId, success: true });
        }
      } catch (err: any) {
        failed++;
        results.push({ student_id: studentId, success: false, message: err.message });
      }
    }

    for (const studentId of skipped) {
      results.push({ student_id: studentId, success: true, message: 'Already assigned (skipped)' });
    }

    return {
      success: true,
      total: studentIds.length,
      assigned,
      skipped: skipped.length,
      failed,
      results,
    };
  } catch (error: any) {
    console.error('Error in bulk assign:', error);
    return {
      success: false,
      total: 0,
      assigned: 0,
      skipped: 0,
      failed: 1,
      results: [],
    };
  }
}

export async function updateFeeAssignment(
  id: string,
  data: UpdateFeeAssignmentData
): Promise<{
  success: boolean;
  data?: FeeStudentAssignment;
  error?: string;
}> {
  const supabase = await createClient();

  try {
    const updateData: Record<string, any> = {};
    if (data.fee_structure_id !== undefined) updateData.fee_structure_id = data.fee_structure_id;
    if (data.effective_from !== undefined) updateData.effective_from = data.effective_from;
    if (data.effective_to !== undefined) updateData.effective_to = data.effective_to;
    if (data.is_active !== undefined) updateData.is_active = data.is_active;
    if (data.notes !== undefined) updateData.notes = data.notes;

    updateData.updated_at = new Date().toISOString();

    const { data: assignment, error } = await supabase
      .from('fee_student_assignments')
      .update(updateData)
      .eq('id', id)
      .select()
      .single();

    if (error) throw error;

    return { success: true, data: assignment };
  } catch (error: any) {
    console.error('Error updating fee assignment:', error);
    return { success: false, error: error.message || 'Failed to update assignment' };
  }
}

export async function deleteFeeAssignment(id: string): Promise<{
  success: boolean;
  error?: string;
}> {
  const supabase = await createClient();

  try {
    const { error } = await supabase
      .from('fee_student_assignments')
      .update({ is_active: false, updated_at: new Date().toISOString() })
      .eq('id', id);

    if (error) throw error;

    return { success: true };
  } catch (error: any) {
    console.error('Error deleting fee assignment:', error);
    return { success: false, error: error.message || 'Failed to delete assignment' };
  }
}

export async function updateStudentAssignment(
  assignmentId: string,
  updates: UpdateFeeAssignmentData
): Promise<{ success: boolean; error?: string }> {
  return updateFeeAssignment(assignmentId, updates);
}

export async function removeAssignment(
  assignmentId: string
): Promise<{ success: boolean; error?: string }> {
  return deleteFeeAssignment(assignmentId);
}

export async function bulkRemoveAssignments(
  assignmentIds: string[]
): Promise<{ success: boolean; removed: number; error?: string }> {
  const supabase = await createClient();

  try {
    const { error } = await supabase
      .from('fee_student_assignments')
      .update({ is_active: false, updated_at: new Date().toISOString() })
      .in('id', assignmentIds);

    if (error) throw error;

    return { success: true, removed: assignmentIds.length };
  } catch (error: any) {
    console.error('Error removing assignments:', error);
    return { success: false, removed: 0, error: error.message || 'Failed to remove assignments' };
  }
}
