/**
 * Fee Assignment Types
 */

export interface FeeStudentAssignment {
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
 }

export interface FeeAssignmentWithDetails extends FeeStudentAssignment {
   student: {
     id: string;
     student_id: string;
     name: string;
     class_roll: string;
     class_id: string;
     class_name: string;
     section_id: string;
     section_name: string;
     status: string;
     father_name: string;
   };
   fee_structure: {
     id: string;
     name: string;
     total_amount: number;
     is_active: boolean;
     academic_year_id: string;
     class_id: string;
     items: FeeStructureItemWithCategory[];
   };
   academic_year: {
     id: string;
     year_name: string;
     name: string;
   };
   total_items: number;
}

export interface FeeStructureItemWithCategory {
  id: string;
  fee_structure_id: string;
  category_id: string;
  category_name: string;
  amount: number;
  frequency: string;
  is_optional: boolean;
  name: string;
}

export interface StudentForAssignment {
  id: string;
  student_id: string;
  name: string;
  class_roll: string;
  class_id: string;
  class_name: string;
  section_id: string;
  section_name: string;
  father_name: string;
  contact: string;
  is_assigned: boolean;
  assignment_id: string | null;
  assigned_structure_id: string | null;
}

export interface FeeAssignmentStats {
  total_students: number;
  assigned_students: number;
  unassigned_students: number;
  assignment_percentage: number;
  total_structures_used: number;
  by_class: {
    class_id: string;
    class_name: string;
    total_students: number;
    assigned_students: number;
    unassigned_students: number;
    assignment_percentage: number;
  }[];
}

export interface AssignmentScope {
  mode: 'whole_class' | 'whole_section' | 'selected_students' | 'individual';
  class_id?: string;
  section_id?: string;
  student_ids?: string[];
}

export interface CreateFeeAssignmentData {
  student_id: string;
  fee_structure_id: string;
  academic_year_id: string;
  effective_from: string;
  effective_to?: string | null;
  notes?: string;
}

export interface BulkAssignData {
  scope: AssignmentScope;
  fee_structure_id: string;
  academic_year_id: string;
  effective_from: string;
  effective_to?: string | null;
  notes?: string;
}

export interface BulkAssignResult {
  success: boolean;
  total: number;
  assigned: number;
  skipped: number;
  failed: number;
  results: {
    student_id: string;
    success: boolean;
    message?: string;
  }[];
}

export interface UpdateFeeAssignmentData {
  fee_structure_id?: string;
  effective_from?: string;
  effective_to?: string | null;
  is_active?: boolean;
  notes?: string;
}

export interface FeeAssignmentFilters {
  search?: string;
  class_id?: string;
  section_id?: string;
  academic_year_id?: string;
  status?: 'all' | 'active' | 'inactive';
  assigned?: 'all' | 'assigned' | 'unassigned';
  page?: number;
  limit?: number;
  sort_by?: string;
  sort_order?: 'asc' | 'desc';
}