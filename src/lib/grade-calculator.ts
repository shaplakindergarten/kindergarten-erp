// src/lib/grade-calculator.ts

export interface GradeRule {
  id: string
  grade_name: string
  min_mark: number
  max_mark: number
  grade_point: number
  remarks: string | null
}

export interface SubjectConfig {
  id: string
  name: string
  full_mark: number
  pass_mark: number
  subject_code?: string
  subject_type?: 'compulsory' | 'elective' | 'optional'
}

export interface SubjectResult {
  subject_id: string
  subject_name: string
  full_mark: number
  obtained: number
  grade: string
  grade_point: number
  is_pass: boolean
  is_absent: boolean
  subject_type?: 'compulsory' | 'elective' | 'optional'
}

export interface FinalResult {
  student_id: string
  student_name: string
  admission_no: string
  class_name: string
  section_name: string
  exam_id: string
  exam_name: string
  exam_type: string
  total_obtained: number
  total_full_marks: number
  percentage: number
  gpa: number
  grade: string
  passed: boolean
  failed_subjects: number
  total_subjects: number
  subject_results: SubjectResult[]
  rank?: number
  remarks?: string
  gpa_breakdown?: GPABreakdown
}

export interface GPABreakdown {
  // Compulsory Subjects
  compulsory_gps: number[]
  compulsory_count: number
  total_compulsory_gp: number
  
  // Elective Subjects
  elective_gps: number[]
  elective_bonuses: number[]
  total_elective_bonus: number
  
  // Final Calculation
  total_gp_with_bonus: number
  final_gpa: number
  
  // Grade
  final_grade: string
  grade_point: number
  remarks: string
}

export interface MeritPosition {
  student_id: string
  student_name: string
  admission_no: string
  class_name: string
  section_name: string
  total_marks: number
  percentage: number
  gpa: number
  grade: string
  rank: number
}

export interface Statistics {
  totalStudents: number
  passedStudents: number
  failedStudents: number
  passPercentage: number
  averagePercentage: number
  highestPercentage: number
  lowestPercentage: number
  averageGPA: number
  highestGPA: number
  lowestGPA: number
  distinctionCount: number
  meritCount: number
  passCount: number
  failCount: number
}

/**
 * Default Grading Rules (Marks → Grade Point)
 * 80-100 → 5.00 → A+
 * 70-79  → 4.00 → A
 * 60-69  → 3.50 → A-
 * 50-59  → 3.00 → B
 * 40-49  → 2.00 → C
 * 33-39  → 1.00 → D
 * 0-32   → 0.00 → F
 */
export const DEFAULT_GRADING_RULES: GradeRule[] = [
  { id: '1', grade_name: 'A+', min_mark: 80, max_mark: 100, grade_point: 5.00, remarks: 'Excellent' },
  { id: '2', grade_name: 'A', min_mark: 70, max_mark: 79, grade_point: 4.00, remarks: 'Very Good' },
  { id: '3', grade_name: 'A-', min_mark: 60, max_mark: 69, grade_point: 3.50, remarks: 'Good' },
  { id: '4', grade_name: 'B', min_mark: 50, max_mark: 59, grade_point: 3.00, remarks: 'Satisfactory' },
  { id: '5', grade_name: 'C', min_mark: 40, max_mark: 49, grade_point: 2.00, remarks: 'Average' },
  { id: '6', grade_name: 'D', min_mark: 33, max_mark: 39, grade_point: 1.00, remarks: 'Pass' },
  { id: '7', grade_name: 'F', min_mark: 0, max_mark: 32, grade_point: 0.00, remarks: 'Fail' },
]

/**
 * GPA to Grade Mapping
 * 5.00    → A+
 * 4.00-4.99 → A
 * 3.50-3.99 → A-
 * 3.00-3.49 → B
 * 2.00-2.99 → C
 * 1.00-1.99 → D
 * 0.00-0.99 → F
 */
export const GPA_GRADE_MAP: Array<{
  min_gpa: number
  max_gpa: number
  grade: string
  grade_point: number
  remarks: string
}> = [
  { min_gpa: 5.00, max_gpa: 5.00, grade: 'A+', grade_point: 5.00, remarks: 'Excellent' },
  { min_gpa: 4.00, max_gpa: 4.99, grade: 'A', grade_point: 4.00, remarks: 'Very Good' },
  { min_gpa: 3.50, max_gpa: 3.99, grade: 'A-', grade_point: 3.50, remarks: 'Good' },
  { min_gpa: 3.00, max_gpa: 3.49, grade: 'B', grade_point: 3.00, remarks: 'Satisfactory' },
  { min_gpa: 2.00, max_gpa: 2.99, grade: 'C', grade_point: 2.00, remarks: 'Average' },
  { min_gpa: 1.00, max_gpa: 1.99, grade: 'D', grade_point: 1.00, remarks: 'Pass' },
  { min_gpa: 0.00, max_gpa: 0.99, grade: 'F', grade_point: 0.00, remarks: 'Fail' },
]

export class GradeCalculator {
  private gradingRules: GradeRule[]
  private bonusThreshold: number

  constructor(gradingRules: GradeRule[] = DEFAULT_GRADING_RULES, bonusThreshold: number = 2) {
    this.gradingRules = [...gradingRules].sort((a, b) => b.min_mark - a.min_mark)
    this.bonusThreshold = bonusThreshold
  }

  /**
   * Get Grade Point (GP) from Marks
   * Marks → Percentage → Grade Point
   */
  getGradePointFromMarks(obtained: number, fullMark: number): {
    grade: string
    grade_point: number
    remarks: string
  } {
    if (obtained < 0) {
      return { grade: 'F', grade_point: 0, remarks: 'Fail' }
    }

    const validMarks = Math.min(Math.max(obtained, 0), fullMark)
    const percentage = (validMarks / fullMark) * 100

    const rule = this.gradingRules.find(
      r => percentage >= r.min_mark && percentage <= r.max_mark
    )

    if (rule) {
      return {
        grade: rule.grade_name,
        grade_point: rule.grade_point,
        remarks: rule.remarks || '',
      }
    }

    return { grade: 'F', grade_point: 0, remarks: 'Fail' }
  }

  /**
   * Get Final Grade from GPA
   * GPA → Grade (Using GPA_GRADE_MAP)
   */
  getGradeFromGPA(gpa: number): {
    grade: string
    grade_point: number
    remarks: string
  } {
    if (gpa <= 0) {
      return { grade: 'F', grade_point: 0, remarks: 'Fail' }
    }

    // Clamp GPA to 5.00 max
    const validGPA = Math.min(gpa, 5.00)

    const map = GPA_GRADE_MAP.find(
      r => validGPA >= r.min_gpa && validGPA <= r.max_gpa
    )

    if (map) {
      return {
        grade: map.grade,
        grade_point: map.grade_point,
        remarks: map.remarks,
      }
    }

    return { grade: 'F', grade_point: 0, remarks: 'Fail' }
  }

  /**
   * Calculate Elective Bonus
   * bonus = max(0, elective_gp - threshold)
   * 
   * Examples:
   * elective_gp = 5.00 → bonus = 3.00
   * elective_gp = 4.00 → bonus = 2.00
   * elective_gp = 3.50 → bonus = 1.50
   * elective_gp = 3.00 → bonus = 1.00
   * elective_gp = 2.00 → bonus = 0.00 (No bonus)
   * elective_gp = 1.00 → bonus = 0.00 (No bonus)
   */
  calculateElectiveBonus(electiveGP: number): number {
    if (electiveGP <= 0) return 0
    return Math.max(0, Math.round((electiveGP - this.bonusThreshold) * 100) / 100)
  }

  /**
   * Calculate Subject Result
   */
  calculateSubjectResult(
    subject: SubjectConfig,
    obtainedMarks: number,
    isAbsent: boolean = false
  ): SubjectResult {
    if (isAbsent) {
      return {
        subject_id: subject.id,
        subject_name: subject.name,
        full_mark: subject.full_mark,
        obtained: 0,
        grade: 'F',
        grade_point: 0,
        is_pass: false,
        is_absent: true,
        subject_type: subject.subject_type || 'compulsory',
      }
    }

    const validMarks = Math.min(Math.max(obtainedMarks, 0), subject.full_mark)
    const { grade, grade_point, remarks } = this.getGradePointFromMarks(
      validMarks,
      subject.full_mark
    )
    const is_pass = validMarks >= subject.pass_mark

    return {
      subject_id: subject.id,
      subject_name: subject.name,
      full_mark: subject.full_mark,
      obtained: validMarks,
      grade,
      grade_point,
      is_pass,
      is_absent: false,
      subject_type: subject.subject_type || 'compulsory',
    }
  }

  /**
   * ★★★ MAIN GPA CALCULATION ★★★
   * 
   * সঠিক Formula:
   * 
   * Step 1: Check if any Compulsory Subject has F (GP = 0)
   *         IF YES → Final GPA = 0, Grade = F
   * 
   * Step 2: Collect all Compulsory GP
   * Step 3: Total Compulsory GP = Sum of all Compulsory GP
   * Step 4: For each Elective Subject, calculate bonus = max(0, elective_gp - 2)
   * Step 5: Total Elective Bonus = Sum of all Elective Bonuses
   * Step 6: Final GPA = (Total Compulsory GP + Total Elective Bonus) / Compulsory Count
   * Step 7: Final GPA = Math.min(5.00, Final GPA)
   */
  calculateGPA(subjectResults: SubjectResult[]): GPABreakdown {
    // 1. Check if any compulsory subject failed (GP = 0)
    const hasFailedCompulsory = subjectResults.some(
      s => (s.subject_type === 'compulsory' || !s.subject_type) && 
           s.grade_point === 0 && 
           !s.is_absent
    )

    if (hasFailedCompulsory) {
      return {
        compulsory_gps: [],
        compulsory_count: 0,
        total_compulsory_gp: 0,
        elective_gps: [],
        elective_bonuses: [],
        total_elective_bonus: 0,
        total_gp_with_bonus: 0,
        final_gpa: 0,
        final_grade: 'F',
        grade_point: 0,
        remarks: 'Failed in Compulsory Subject',
      }
    }

    // 2. Collect Compulsory GP
    const compulsorySubjects = subjectResults.filter(
      s => (s.subject_type === 'compulsory' || !s.subject_type) && 
           !s.is_absent
    )

    const compulsoryGPs = compulsorySubjects.map(s => s.grade_point)
    const compulsoryCount = compulsoryGPs.length
    const totalCompulsoryGP = compulsoryGPs.reduce((sum, gp) => sum + gp, 0)

    // No compulsory subjects
    if (compulsoryCount === 0) {
      return {
        compulsory_gps: [],
        compulsory_count: 0,
        total_compulsory_gp: 0,
        elective_gps: [],
        elective_bonuses: [],
        total_elective_bonus: 0,
        total_gp_with_bonus: 0,
        final_gpa: 0,
        final_grade: 'F',
        grade_point: 0,
        remarks: 'No Compulsory Subjects',
      }
    }

    // 3. Collect Elective GP and Calculate Bonuses
    const electiveSubjects = subjectResults.filter(
      s => (s.subject_type === 'elective' || s.subject_type === 'optional') && 
           !s.is_absent
    )

    const electiveGPs = electiveSubjects.map(s => s.grade_point)
    const electiveBonuses = electiveGPs.map(gp => this.calculateElectiveBonus(gp))
    const totalElectiveBonus = electiveBonuses.reduce((sum, bonus) => sum + bonus, 0)

    // 4. ★★★ Final GPA Calculation ★★★
    // Correct Formula: (Total Compulsory GP + Total Elective Bonus) / Compulsory Count
    const totalGPWithBonus = totalCompulsoryGP + totalElectiveBonus
    let finalGPA = totalGPWithBonus / compulsoryCount

    // 5. Cap at 5.00
    finalGPA = Math.min(5.00, Math.round(finalGPA * 100) / 100)

    // 6. Get Grade from GPA
    const gradeInfo = this.getGradeFromGPA(finalGPA)

    // 7. Build Remarks
    let remarks = gradeInfo.remarks
    if (totalElectiveBonus > 0) {
      remarks += ` (Elective Bonus: ${totalElectiveBonus.toFixed(2)})`
    }

    return {
      compulsory_gps: compulsoryGPs,
      compulsory_count: compulsoryCount,
      total_compulsory_gp: totalCompulsoryGP,
      elective_gps: electiveGPs,
      elective_bonuses: electiveBonuses,
      total_elective_bonus: totalElectiveBonus,
      total_gp_with_bonus: totalGPWithBonus,
      final_gpa: finalGPA,
      final_grade: gradeInfo.grade,
      grade_point: gradeInfo.grade_point,
      remarks,
    }
  }

  /**
   * Calculate Complete Final Result
   */
  calculateFinalResult(
    studentId: string,
    studentName: string,
    admissionNo: string,
    className: string,
    sectionName: string,
    examId: string,
    examName: string,
    examType: string,
    marksData: Record<string, number>,
    subjects: SubjectConfig[],
    absentSubjects: string[] = []
  ): FinalResult {
    let totalObtained = 0
    let totalFullMarks = 0
    let failedSubjects = 0
    const subjectResults: SubjectResult[] = []

    for (const subject of subjects) {
      const obtained = marksData[subject.id] || 0
      const isAbsent = absentSubjects.includes(subject.id)
      const result = this.calculateSubjectResult(subject, obtained, isAbsent)

      totalObtained += result.obtained
      totalFullMarks += result.full_mark

      if (!result.is_pass) {
        failedSubjects++
      }

      subjectResults.push(result)
    }

    const percentage = totalFullMarks > 0
      ? Math.round((totalObtained / totalFullMarks) * 100 * 100) / 100
      : 0

    // ★★★ Calculate GPA using the correct formula ★★★
    const gpaBreakdown = this.calculateGPA(subjectResults)
    const finalGPA = gpaBreakdown.final_gpa
    const grade = gpaBreakdown.final_grade
    const passed = failedSubjects === 0 && finalGPA > 0

    // Overall Remarks
    let finalRemarks = ''
    if (!passed) {
      finalRemarks = 'Failed'
    } else if (finalGPA >= 4.50) {
      finalRemarks = 'Excellent'
    } else if (finalGPA >= 4.00) {
      finalRemarks = 'Very Good'
    } else if (finalGPA >= 3.50) {
      finalRemarks = 'Good'
    } else if (finalGPA >= 3.00) {
      finalRemarks = 'Satisfactory'
    } else if (finalGPA >= 2.00) {
      finalRemarks = 'Average'
    } else if (finalGPA >= 1.00) {
      finalRemarks = 'Pass'
    } else {
      finalRemarks = 'Fail'
    }

    return {
      student_id: studentId,
      student_name: studentName,
      admission_no: admissionNo,
      class_name: className,
      section_name: sectionName,
      exam_id: examId,
      exam_name: examName,
      exam_type: examType,
      total_obtained: totalObtained,
      total_full_marks: totalFullMarks,
      percentage,
      gpa: finalGPA,
      grade,
      passed,
      failed_subjects: failedSubjects,
      total_subjects: subjects.length,
      subject_results: subjectResults,
      remarks: finalRemarks,
      gpa_breakdown: gpaBreakdown,
    }
  }

  /**
   * Calculate Merit List
   */
  calculateMeritList(results: FinalResult[]): MeritPosition[] {
    const sorted = [...results].sort((a, b) => {
      if (a.gpa !== b.gpa) return b.gpa - a.gpa
      return b.percentage - a.percentage
    })

    let rank = 1
    let previousGPA = -1

    return sorted.map((result, index) => {
      if (result.gpa !== previousGPA) {
        rank = index + 1
      }
      previousGPA = result.gpa

      return {
        student_id: result.student_id,
        student_name: result.student_name,
        admission_no: result.admission_no,
        class_name: result.class_name,
        section_name: result.section_name,
        total_marks: result.total_obtained,
        percentage: result.percentage,
        gpa: result.gpa,
        grade: result.grade,
        rank,
      }
    })
  }

  /**
   * Calculate Statistics
   */
  calculateStatistics(results: FinalResult[]): Statistics {
    const totalStudents = results.length
    const passedStudents = results.filter(r => r.passed).length
    const failedStudents = totalStudents - passedStudents

    const totalPercentage = results.reduce((sum, r) => sum + r.percentage, 0)
    const averagePercentage = totalStudents > 0 ? totalPercentage / totalStudents : 0

    const percentages = results.map(r => r.percentage)
    const highestPercentage = percentages.length > 0 ? Math.max(...percentages) : 0
    const lowestPercentage = percentages.length > 0 ? Math.min(...percentages) : 0

    const totalGPA = results.reduce((sum, r) => sum + r.gpa, 0)
    const averageGPA = totalStudents > 0 ? totalGPA / totalStudents : 0
    const gpas = results.map(r => r.gpa)
    const highestGPA = gpas.length > 0 ? Math.max(...gpas) : 0
    const lowestGPA = gpas.length > 0 ? Math.min(...gpas) : 0

    const distinctionCount = results.filter(r => r.percentage >= 80).length
    const meritCount = results.filter(r => r.percentage >= 60 && r.percentage < 80).length
    const passCount = results.filter(r => r.percentage >= 40 && r.percentage < 60).length
    const failCount = results.filter(r => r.percentage < 40).length

    return {
      totalStudents,
      passedStudents,
      failedStudents,
      passPercentage: totalStudents > 0 ? (passedStudents / totalStudents) * 100 : 0,
      averagePercentage,
      highestPercentage,
      lowestPercentage,
      averageGPA,
      highestGPA,
      lowestGPA,
      distinctionCount,
      meritCount,
      passCount,
      failCount,
    }
  }

  /**
   * Get Grade Distribution
   */
  getGradeDistribution(results: FinalResult[]): Record<string, number> {
    const distribution: Record<string, number> = {}
    for (const result of results) {
      const grade = result.grade
      distribution[grade] = (distribution[grade] || 0) + 1
    }
    return distribution
  }

  /**
   * Update Grading Rules
   */
  updateGradingRules(rules: GradeRule[]): void {
    this.gradingRules = [...rules].sort((a, b) => b.min_mark - a.min_mark)
  }

  /**
   * Update Bonus Threshold
   */
  updateBonusThreshold(threshold: number): void {
    this.bonusThreshold = threshold
  }

  /**
   * Get Current Grading Rules
   */
  getGradingRules(): GradeRule[] {
    return this.gradingRules
  }

  /**
   * Get Current Bonus Threshold
   */
  getBonusThreshold(): number {
    return this.bonusThreshold
  }
}

// ============================================
// UTILITY FUNCTIONS
// ============================================

/**
 * Format marks for display
 */
export const formatMarks = (marks: number): string => {
  if (marks === undefined || marks === null) return '-'
  return marks.toString()
}

/**
 * Get grade color class for UI
 */
export const getGradeColorClass = (grade: string): string => {
  const colors: Record<string, string> = {
    'A+': 'bg-emerald-100 text-emerald-700 dark:bg-emerald-900/50 dark:text-emerald-300',
    'A': 'bg-blue-100 text-blue-700 dark:bg-blue-900/50 dark:text-blue-300',
    'A-': 'bg-cyan-100 text-cyan-700 dark:bg-cyan-900/50 dark:text-cyan-300',
    'B': 'bg-green-100 text-green-700 dark:bg-green-900/50 dark:text-green-300',
    'C': 'bg-yellow-100 text-yellow-700 dark:bg-yellow-900/50 dark:text-yellow-300',
    'D': 'bg-orange-100 text-orange-700 dark:bg-orange-900/50 dark:text-orange-300',
    'F': 'bg-red-100 text-red-700 dark:bg-red-900/50 dark:text-red-300',
  }
  return colors[grade] || 'bg-gray-100 text-gray-700 dark:bg-gray-800 dark:text-gray-300'
}

/**
 * Get grade text color for UI
 */
export const getGradeTextColor = (grade: string): string => {
  const colors: Record<string, string> = {
    'A+': 'text-emerald-600 dark:text-emerald-400',
    'A': 'text-blue-600 dark:text-blue-400',
    'A-': 'text-cyan-600 dark:text-cyan-400',
    'B': 'text-green-600 dark:text-green-400',
    'C': 'text-yellow-600 dark:text-yellow-400',
    'D': 'text-orange-600 dark:text-orange-400',
    'F': 'text-red-600 dark:text-red-400',
  }
  return colors[grade] || 'text-gray-600 dark:text-gray-400'
}

/**
 * Get GPA badge color
 */
export const getGpaBadgeColor = (gpa: number): string => {
  if (gpa >= 4.50) return 'bg-emerald-500'
  if (gpa >= 4.00) return 'bg-blue-500'
  if (gpa >= 3.50) return 'bg-cyan-500'
  if (gpa >= 3.00) return 'bg-green-500'
  if (gpa >= 2.00) return 'bg-yellow-500'
  if (gpa >= 1.00) return 'bg-orange-500'
  return 'bg-red-500'
}

/**
 * Get rank suffix
 */
export const getRankSuffix = (rank: number): string => {
  if (rank === 1) return 'st'
  if (rank === 2) return 'nd'
  if (rank === 3) return 'rd'
  return 'th'
}

/**
 * Format GPA for display
 */
export const formatGPA = (gpa: number): string => {
  return gpa.toFixed(2)
}

/**
 * Check if student is promoted
 */
export const isPromoted = (
  result: FinalResult,
  minPassingSubjects: number = 0,
  minGPA: number = 2.0
): { promoted: boolean; reason: string } => {
  if (!result.passed) {
    return { promoted: false, reason: 'Failed in one or more subjects' }
  }

  if (result.gpa < minGPA) {
    return {
      promoted: false,
      reason: `GPA (${result.gpa.toFixed(2)}) below required minimum (${minGPA})`,
    }
  }

  const failedSubjects = result.subject_results.filter(sr => !sr.is_pass).length
  if (failedSubjects > minPassingSubjects) {
    return {
      promoted: false,
      reason: `Failed in ${failedSubjects} subjects`,
    }
  }

  return { promoted: true, reason: 'Meets promotion criteria' }
}

/**
 * Singleton instance
 */
let gradeCalculatorInstance: GradeCalculator | null = null

export const getGradeCalculator = (
  rules?: GradeRule[],
  bonusThreshold?: number
): GradeCalculator => {
  if (!gradeCalculatorInstance) {
    gradeCalculatorInstance = new GradeCalculator(
      rules || DEFAULT_GRADING_RULES,
      bonusThreshold || 2
    )
  }
  return gradeCalculatorInstance
}

export const resetGradeCalculator = (): void => {
  gradeCalculatorInstance = null
}