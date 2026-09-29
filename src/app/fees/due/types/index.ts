// H:\kindergarten-erp\src\app\fees\due\types\index.ts

export interface DueStudent {
  id: string;
  student_id: string;
  student_name: string;
  name: string;
  admission_no: string;
  class_roll: string;
  
  class_id: string;
  class_name: string;
  section_id: string;
  section_name: string;
  
  father_name: string;
  mother_name: string;
  phone: string;
  email: string;
  
  total_fees: number;
  total_paid: number;
  due_amount: number;
  
  last_payment_date?: string;
  days_overdue: number;
  overdue_status: 'Critical' | 'High' | 'Medium' | 'Low' | 'Current';
  student_status: string;
  created_at: string;
}

export interface DueFilters {
  class_id?: string;
  section_id?: string;
  search?: string;
  min_due?: number;
  max_due?: number;
  status?: string;
}

// ✅ Updated DueStatsType with correct thresholds for school fee structure
export interface DueStatsType {
  totalDue: number;           // Total due amount (৳)
  totalFees: number;          // Total fees assigned (৳)
  totalPaid: number;          // Total paid amount (৳)
  collectionRate: number;     // Collection rate percentage (%)
  
  // Updated thresholds based on monthly fee = 400 Taka
  criticalOverdue: number;    // Due > 800 (3+ months)
  highDueCount: number;       // Due 501 - 800 (2-3 months)
  mediumDueCount: number;     // Due 201 - 500 (1-2 months)
  lowDueCount: number;        // Due 1 - 200 (up to 1 month)
  
  due_students_count: number; // Total number of students with due
  total_due: number;          // Alias for totalDue
  collection_rate: number;    // Alias for collectionRate
}

// ✅ Updated DueLevel for school fee structure
export type DueLevel = "critical" | "high" | "medium" | "low";

// Sort types
export type SortField = "name" | "due_amount" | "class_name" | "days_overdue";
export type SortOrder = "asc" | "desc";

// ✅ Optional: Due range presets for filters
export interface DueRange {
  label: string;
  min: number;
  max: number | null;
  level: DueLevel;
}

export const DUE_RANGES: DueRange[] = [
  { label: "Low (৳1 - ৳200)", min: 1, max: 200, level: "low" },
  { label: "Medium (৳201 - ৳500)", min: 201, max: 500, level: "medium" },
  { label: "High (৳501 - ৳800)", min: 501, max: 800, level: "high" },
  { label: "Critical (৳801+)", min: 801, max: null, level: "critical" },
];

// ✅ Helper function to get due level from amount
export function getDueLevelFromAmount(amount: number): DueLevel {
  if (amount > 800) return "critical";
  if (amount > 500) return "high";
  if (amount > 200) return "medium";
  return "low";
}

// ✅ Helper function to get due level label
export function getDueLevelLabel(level: DueLevel): string {
  const labels = {
    critical: "Critical",
    high: "High",
    medium: "Medium",
    low: "Low",
  };
  return labels[level];
}

// ✅ Helper function to get color for due level
export function getDueLevelColor(level: DueLevel): string {
  const colors = {
    critical: "bg-red-500/10 text-red-700 border-red-500/30",
    high: "bg-orange-500/10 text-orange-700 border-orange-500/30",
    medium: "bg-yellow-500/10 text-yellow-700 border-yellow-500/30",
    low: "bg-green-500/10 text-green-700 border-green-500/30",
  };
  return colors[level];
}