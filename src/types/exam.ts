// ============================================
// FILE: src/types/exam.ts
// EXAM MODULE - COMPLETE TYPE DEFINITIONS (FINAL)
// ============================================

// ============================================
// 1. CORE TYPES (Exam Terms & Subjects)
// ============================================

/**
 * Exam Term - পরীক্ষার টার্ম (ডাইনামিক)
 * যেমন: 1st Term, 2nd Term, Mid Term, Final Exam
 */
export interface ExamTerm {
  id: string;
  academic_year_id: string;
  name: string;                    // '1st Term', 'Final Exam'
  term_code: string;               // 'term_1', 'final'
  weightage_percentage: number;    // চূড়ান্ত ফলের ওয়েটেজ
  start_date?: string;
  end_date?: string;
  status: 'upcoming' | 'ongoing' | 'completed' | 'locked';
  result_status: 'draft' | 'processing' | 'generated' | 'published' | 'archived';
  created_at: string;
  updated_at: string;
  
  // Joined fields (from API)
  academic_year?: {
    id: string;
    year_name: string;
    is_current: boolean;
  };
}

/**
 * Exam Subject - টার্ম অনুযায়ী সাবজেক্ট অ্যাসাইনমেন্ট
 */
export interface ExamSubject {
  id: string;
  term_id: string;
  class_id: string;
  section_id?: string;
  subject_id: string;
  subject_type: 'compulsory' | 'elective' | 'optional';
  full_marks: number;
  pass_marks: number;
  order_index: number;
  created_at: string;
  
  // Joined fields
  subject?: {
    id: string;
    name: string;
    code: string;
    subject_type?: string;
  };
  class?: ClassRef;
  section?: SectionRef;
}

// ============================================
// 2. MARKS ENTRY TYPES (FIXED - Full workflow)
// ============================================

/**
 * Marks Entry Status - সম্পূর্ণ ওয়ার্কফ্লো সাপোর্ট
 * draft → submitted → verified → locked
 */
export type MarksEntryStatus = 'draft' | 'submitted' | 'verified' | 'locked';

/**
 * Student Marks - নম্বর এন্ট্রি
 */
export interface StudentMark {
  id: string;
  student_id: string;
  term_id: string;
  exam_subject_id: string;
  marks_obtained: number;
  is_absent: boolean;
  entry_status: MarksEntryStatus;
  entered_by?: string;
  entered_at: string;
  verified_by?: string;
  verified_at?: string;
  locked_by?: string;
  locked_at?: string;
  remarks?: string;
  created_at: string;
  updated_at: string;
  
// Joined fields
student?: {
      id: string;
      name: string;
      class_roll: string;
      student_id: string;
      father_name: string;
      class_id: string;
      section_id: string;
    };
   exam_subject?: ExamSubject;
}

/**
 * Alias for StudentMark (DB naming alignment)
 */
export type StudentMarkEntity = StudentMark;

/**
 * Bulk Marks Entry Request
 */
export interface BulkMarksEntryRequest {
  term_id: string;
  exam_subject_id: string;
  marks: Array<{
    student_id: string;
    marks_obtained: number;
    is_absent: boolean;
  }>;
}

/**
 * Single Marks Update Request
 */
export interface UpdateMarksRequest {
  marks_id: string;
  marks_obtained: number;
  is_absent?: boolean;
  remarks?: string;
}

/**
 * Submit Marks for Verification Request
 */
export interface SubmitMarksRequest {
  term_id: string;
  class_id: string;
  subject_id: string;
}

/**
 * Verify Marks Request (Admin)
 */
export interface VerifyMarksRequest {
  marks_ids: string[];
  verified_by: string;
}

/**
 * Lock Marks Request
 */
export interface LockMarksRequest {
  term_id: string;
  class_id: string;
  subject_id: string;
}

/**
 * Lock Marks Response
 */
export interface LockMarksResponse {
  updated_count: number;
  message: string;
}

// ============================================
// 3. RESULT TYPES (FIXED - No pass/fail in status)
// ============================================

/**
 * Result Status - শুধু workflow status (NOT pass/fail)
 */
export type ResultStatus = 'pending' | 'generated' | 'published' | 'archived';

/**
 * Pass/Fail Status - আলাদা টাইপ
 */
export type PassFailStatus = 'passed' | 'failed' | 'passed_with_elective_fail';

/**
 * Failed Subject Info
 */
export interface FailedSubject {
  subject_id: string;
  subject_name: string;
  subject_type: string;
  marks_obtained: number;
  pass_marks: number;
}

/**
 * Compiled Result - সেন্ট্রাল রেজাল্ট ইঞ্জিন
 */
export interface CompiledResult {
  id: string;
  student_id: string;
  term_id: string;
  academic_year_id: string;
  total_marks_obtained: number;
  total_full_marks: number;
  percentage: number;
  gpa: number;
  letter_grade: string;
  class_rank?: number;
  section_rank?: number;
  result_status: ResultStatus;
  pass_fail_status: PassFailStatus;  // আলাদা ফিল্ড
  is_published: boolean;
  published_at?: string;
  failed_subjects: FailedSubject[];
  has_failed_compulsory: boolean;
  merit_position?: number;
  created_at: string;
  updated_at: string;
  
// Joined fields
  student?: {
     id: string;
     name: string;
     class_roll: string;
     student_id: string;
     father_name: string;
     class?: ClassRef;
     section?: SectionRef;
   };
  term?: ExamTerm;
}

/**
 * Generate Result Request
 */
export interface GenerateResultRequest {
  term_id: string;
}

/**
 * Generate Result Response
 */
export interface GenerateResultResponse {
  processed_students: number;
  failed_count: number;
  passed_count: number;
  message: string;
}

/**
 * Publish Result Request
 */
export interface PublishResultRequest {
  term_id: string;
  class_ids?: string[];
  section_ids?: string[];
  send_notification?: boolean;
}

/**
 * Publish Result Response
 */
export interface PublishResultResponse {
  published_count: number;
  message: string;
}

// ============================================
// 4. AUDIT META (ERP Standard)
// ============================================

/**
 * Audit Meta - Reusable audit fields
 */
export interface AuditMeta {
  created_by?: string;
  created_at?: string;
  updated_by?: string;
  updated_at?: string;
  locked_by?: string;
  locked_at?: string;
  verified_by?: string;
  verified_at?: string;
}

// ============================================
// 5. REFERENCE TYPES (Reusable)
// ============================================

/**
 * Class Reference
 */
export interface ClassRef {
  id: string;
  name: string;
  numeric_order?: number;
}

/**
 * Section Reference
 */
export interface SectionRef {
  id: string;
  name: string;
  class_id?: string;
}

/**
 * Subject Reference
 */
export interface SubjectRef {
  id: string;
  name: string;
  code: string;
  subject_type?: string;
}

/**
 * Student Reference
 */
export interface StudentRef {
   id: string;
   name: string;
   class_roll: string;
   student_id: string;
   father_name: string;
   class_id: string;
   section_id?: string;
 }

// ============================================
// 6. GRADING & SETTINGS TYPES (FIXED - Generic)
// ============================================

/**
 * Grading Rule
 */
export interface GradingRule {
  id: string;
  academic_year_id?: string;
  grade_name: string;
  min_mark: number;
  max_mark: number;
  grade_point: number;
  remarks?: string;
  is_default: boolean;
  is_active: boolean;
  created_at: string;
}

/**
 * Bonus Policy Settings
 */
export interface BonusPolicy {
  elective_bonus_points: number;
  apply_bonus_if_all_elective_pass: boolean;
  max_bonus_limit?: number;
}

/**
 * Result Publish Policy
 */
export interface ResultPublishPolicy {
  require_admin_approval: boolean;
  auto_publish_when_all_locked: boolean;
  notify_parents_on_publish?: boolean;
}

/**
 * Position Rules Settings
 */
export interface PositionRules {
  include_absent_students: boolean;
  merit_list_min_gpa: number;
  tie_breaker?: 'total_marks' | 'percentage' | 'attendance';
}

/**
 * Exam Setting Keys
 */
export type ExamSettingKey = 
  | 'bonus_policy' 
  | 'result_publish_policy' 
  | 'position_rules';

/**
 * Exam Setting - Generic for future expansion
 */
export interface ExamSetting<T = any> {
  id: string;
  academic_year_id: string;
  setting_key: ExamSettingKey;
  setting_value: T;
  description?: string;
  updated_by?: string;
  updated_at: string;
}

/**
 * Alias for ExamSetting (DB naming alignment)
 */
export type ExamSettingEntity = ExamSetting;

// ============================================
// 7. REPORT & TABULATION TYPES
// ============================================

/**
 * Tabulation Filters
 */
export interface TabulationFilters {
  term_id: string;
  class_id?: string;
  section_id?: string;
  pass_fail_status?: PassFailStatus;
  search?: string;
}

/**
 * Tabulation Row - ট্যাবুলেশন শীটের জন্য
 */
export interface TabulationRow {
   rank: number;
   id: string;
   student_name: string;
   class_roll: string;
   student_id: string;
   father_name: string;
   total_marks: number;
   percentage: number;
   gpa: number;
   grade: string;
   pass_fail_status: PassFailStatus;
   section_rank?: number;
   class_rank?: number;
  }

/**
 * Progress Card Data
 */
export interface ProgressCardData {
  student: StudentRef;
  term: ExamTerm;
  academic_year: {
    id: string;
    year_name: string;
  };
  subjects: Array<{
    subject_id: string;
    subject_name: string;
    subject_type: string;
    full_marks: number;
    pass_marks: number;
    marks_obtained: number;
    percentage: number;
    grade: string;
    gpa: number;
    is_absent: boolean;
  }>;
  summary: {
    total_marks_obtained: number;
    total_full_marks: number;
    percentage: number;
    gpa: number;
    letter_grade: string;
    rank: number;
    pass_fail_status: PassFailStatus;
    failed_subjects: FailedSubject[];
  };
}

/**
 * Transcript Data - ট্রান্সক্রিপ্ট
 */
export interface TranscriptData {
  student: StudentRef;
  academic_year: {
    id: string;
    year_name: string;
    start_date: string;
    end_date: string;
  };
  terms: Array<{
    term: ExamTerm;
    gpa: number;
    grade: string;
    total_marks: number;
    percentage: number;
    rank: number;
  }>;
  cumulative: {
    total_terms: number;
    average_gpa: number;
    final_grade: string;
    total_marks_obtained: number;
    total_full_marks: number;
    overall_percentage: number;
  };
}

/**
 * Merit List Data
 */
export interface MeritListData {
  term_id: string;
  term_name: string;
  class_id?: string;
  class_name?: string;
  section_id?: string;
  section_name?: string;
students: Array<{
     rank: number;
     student_id: string;
     student_name: string;
     class_roll: string;
     father_name: string;
     gpa: number;
     total_marks: number;
     percentage: number;
     grade: string;
   }>;
   generated_at: string;
}

/**
 * Subject Analysis Data
 */
export interface SubjectAnalysisData {
  subject_id: string;
  subject_name: string;
  subject_type: string;
  full_marks: number;
  pass_marks: number;
  total_students: number;
  passed_students: number;
  failed_students: number;
  absent_students: number;
  pass_percentage: number;
  highest_marks: number;
  lowest_marks: number;
  average_marks: number;
  grade_distribution: {
    grade: string;
    count: number;
  }[];
}

// ============================================
// 8. CERTIFICATE TYPES
// ============================================

/**
 * Certificate Template Type
 */
export type CertificateType = 'merit' | 'passing' | 'participation';

/**
 * Signature Settings
 */
export interface SignatureSettings {
  principal_signature: boolean;
  teacher_signature: boolean;
  date: boolean;
  custom_signatures?: Array<{
    label: string;
    position: 'left' | 'center' | 'right';
  }>;
}

/**
 * Certificate Template
 */
export interface CertificateTemplate {
  id: string;
  name: string;
  template_type: CertificateType;
  header_html?: string;
  body_html?: string;
  footer_html?: string;
  signature_settings: SignatureSettings;
  is_active: boolean;
  created_at: string;
}

/**
 * Generate Certificate Request
 */
export interface GenerateCertificateRequest {
  student_id: string;
  term_id: string;
  template_id?: string;
  certificate_type?: CertificateType;
}

// ============================================
// 9. API REQUEST/RESPONSE TYPES
// ============================================

/**
 * API Response Wrapper
 */
export interface ApiResponse<T> {
  success: boolean;
  data?: T;
  error?: string;
  message?: string;
}

/**
 * Paginated Response
 */
export interface PaginatedResponse<T> {
  data: T[];
  total: number;
  page: number;
  page_size: number;
  total_pages: number;
}

/**
 * Marks Entry Sheet Request
 */
export interface MarksEntrySheetRequest {
  term_id: string;
  class_id: string;
  subject_id: string;
  section_id?: string;
}

/**
 * Marks Entry Sheet Response
 */
export interface MarksEntrySheetResponse {
   term: ExamTerm;
   subject: SubjectRef & { full_marks: number; pass_marks: number };
   class: ClassRef;
   section?: SectionRef;
   students: Array<{
     student_id: string;
     student_name: string;
     class_roll: string;
     admission_no: string;
     marks_obtained?: number;
     is_absent?: boolean;
     marks_id?: string;
     entry_status?: MarksEntryStatus;
   }>;
 }

// ============================================
// 10. FILTERS & QUERY PARAMS
// ============================================

/**
 * Exam Terms Query Filters
 */
export interface ExamTermsFilters {
  academic_year_id?: string;
  status?: ExamTerm['status'];
  result_status?: ExamTerm['result_status'];
  search?: string;
}

/**
 * Results Query Filters
 */
export interface ResultsFilters {
  term_id: string;
  class_id?: string;
  section_id?: string;
  pass_fail_status?: PassFailStatus;
  is_published?: boolean;
  search?: string;
  page?: number;
  page_size?: number;
}

// ============================================
// 11. DASHBOARD TYPES
// ============================================

/**
 * Dashboard Stats
 */
export interface ExamDashboardStats {
  total_terms: number;
  active_terms: number;
  completed_terms: number;
  published_results: number;
  total_students: number;
  avg_gpa: number;
  top_performer?: {
    student_id: string;
    student_name: string;
    gpa: number;
    term_name: string;
  };
}

/**
 * Recent Result
 */
export interface RecentResult {
  id: string;
  term_name: string;
  class_name: string;
  section_name?: string;
  published_at: string;
  published_by: string;
  total_students: number;
  passed_count: number;
  failed_count: number;
}

// ============================================
// 12. UTILITY TYPES
// ============================================

/**
 * Grade Info - গ্রেড ক্যালকুলেশনের জন্য
 */
export interface GradeInfo {
  grade_name: string;
  grade_point: number;
  min_mark: number;
  max_mark: number;
  remarks: string;
}

/**
 * Subject Wise Marks Summary
 */
export interface SubjectWiseMarksSummary {
  subject_id: string;
  subject_name: string;
  full_marks: number;
  pass_marks: number;
  obtained_marks: number;
  percentage: number;
  grade: string;
  gpa: number;
  is_absent: boolean;
  is_failed: boolean;
}

/**
 * Student Result Summary
 */
export interface StudentResultSummary {
   student_id: string;
   student_name: string;
   class_roll: string;
   class_name: string;
   section_name: string;
   total_marks: number;
   percentage: number;
   gpa: number;
   grade: string;
   rank: number;
   pass_fail_status: PassFailStatus;
 }