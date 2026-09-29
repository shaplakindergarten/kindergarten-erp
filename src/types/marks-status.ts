// src/types/marks-status.ts
export const MARK_STATUS = {
  DRAFT: 'draft',
  SUBMITTED: 'submitted',
  VERIFIED: 'verified',
  LOCKED: 'locked',
} as const;

export type MarkStatus = typeof MARK_STATUS[keyof typeof MARK_STATUS];

// Status transition rules (backend mirror)
export const STATUS_TRANSITIONS: Record<MarkStatus, MarkStatus[]> = {
  [MARK_STATUS.DRAFT]: [MARK_STATUS.SUBMITTED],
  [MARK_STATUS.SUBMITTED]: [MARK_STATUS.VERIFIED],
  [MARK_STATUS.VERIFIED]: [MARK_STATUS.LOCKED],
  [MARK_STATUS.LOCKED]: [],
};

// Allowed statuses for each action
export const ALLOWED_STATUS: Record<'SUBMIT' | 'VERIFY' | 'LOCK' | 'EDIT', MarkStatus[]> = {
  SUBMIT: [MARK_STATUS.DRAFT],
  VERIFY: [MARK_STATUS.SUBMITTED],
  LOCK: [MARK_STATUS.VERIFIED],
  EDIT: [MARK_STATUS.DRAFT, MARK_STATUS.SUBMITTED],
};

// Status badge configuration
export const STATUS_BADGE_CONFIG: Record<MarkStatus, { label: string; color: string; bgColor: string }> = {
  [MARK_STATUS.DRAFT]: { label: 'ড্রাফ্ট', color: 'text-gray-700', bgColor: 'bg-gray-100' },
  [MARK_STATUS.SUBMITTED]: { label: 'জমা দেওয়া', color: 'text-blue-700', bgColor: 'bg-blue-100' },
  [MARK_STATUS.VERIFIED]: { label: 'ভেরিফাইড', color: 'text-green-700', bgColor: 'bg-green-100' },
  [MARK_STATUS.LOCKED]: { label: 'লকড', color: 'text-red-700', bgColor: 'bg-red-100' },
};

// Check if transition is valid
export function isValidTransition(
  currentStatus: MarkStatus,
  newStatus: MarkStatus
): boolean {
  return STATUS_TRANSITIONS[currentStatus]?.includes(newStatus) ?? false;
}

// Check if status allows editing
export function canEdit(status: MarkStatus): boolean {
  return ALLOWED_STATUS.EDIT.includes(status);
}

// Check if status allows submission
export function canSubmit(status: MarkStatus): boolean {
  return ALLOWED_STATUS.SUBMIT.includes(status);
}

// Check if status allows verification
export function canVerify(status: MarkStatus): boolean {
  return ALLOWED_STATUS.VERIFY.includes(status);
}

// Check if status allows locking
export function canLock(status: MarkStatus): boolean {
  return ALLOWED_STATUS.LOCK.includes(status);
}