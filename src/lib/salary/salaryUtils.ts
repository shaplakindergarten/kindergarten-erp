// src/lib/salary/salaryUtils.ts
// ERP Standard Salary Utilities - Fixed Version

export const formatCurrency = (amount: number): string => {
  return new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency: 'BDT',
    minimumFractionDigits: 0,
  }).format(amount);
};

export const months = [
  "January", "February", "March", "April", "May", "June",
  "July", "August", "September", "October", "November", "December"
];

export const getCurrentMonth = () => months[new Date().getMonth()];
export const getCurrentYear = () => new Date().getFullYear();

// ============================================================
// FIXED: সঠিক স্ট্যাটাস ব্যাজ
// balance = paid - expected
// Positive = Advance (paid > expected)
// Negative = Due (expected > paid)
// Zero = Settled
// ============================================================

export const getStatusBadge = (balance: number, status: string) => {
  // If status is explicitly set, use it first
  if (status === 'advance' || status === 'overpaid') {
    return { label: 'Advance', color: 'bg-blue-100 text-blue-800 dark:bg-blue-900/30 dark:text-blue-400' };
  }
  if (status === 'due' || status === 'partial') {
    return { label: 'Due', color: 'bg-red-100 text-red-800 dark:bg-red-900/30 dark:text-red-400' };
  }
  if (status === 'settled' || status === 'paid') {
    return { label: 'Settled', color: 'bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-400' };
  }
  
  // Fallback: calculate from balance
  if (balance > 0) {
    return { label: 'Advance', color: 'bg-blue-100 text-blue-800 dark:bg-blue-900/30 dark:text-blue-400' };
  }
  if (balance < 0) {
    return { label: 'Due', color: 'bg-red-100 text-red-800 dark:bg-red-900/30 dark:text-red-400' };
  }
  return { label: 'Settled', color: 'bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-400' };
};

export const getPaymentStatusBadge = (status: string) => {
  switch (status) {
    case 'paid':
      return { label: 'Paid', color: 'bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-400' };
    case 'pending':
      return { label: 'Pending', color: 'bg-yellow-100 text-yellow-800 dark:bg-yellow-900/30 dark:text-yellow-400' };
    case 'partial':
      return { label: 'Partial', color: 'bg-orange-100 text-orange-800 dark:bg-orange-900/30 dark:text-orange-400' };
    case 'advance':
      return { label: 'Advance', color: 'bg-blue-100 text-blue-800 dark:bg-blue-900/30 dark:text-blue-400' };
    case 'due':
      return { label: 'Due', color: 'bg-red-100 text-red-800 dark:bg-red-900/30 dark:text-red-400' };
    case 'settled':
      return { label: 'Settled', color: 'bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-400' };
    default:
      return { label: status || 'Unknown', color: 'bg-gray-100 text-gray-800 dark:bg-gray-800 dark:text-gray-400' };
  }
};

export const getAdvanceStatusBadge = (status: string) => {
  switch (status) {
    case 'active':
      return { label: 'Active', color: 'bg-blue-100 text-blue-800 dark:bg-blue-900/30 dark:text-blue-400' };
    case 'completed':
      return { label: 'Completed', color: 'bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-400' };
    case 'pending':
      return { label: 'Pending', color: 'bg-yellow-100 text-yellow-800 dark:bg-yellow-900/30 dark:text-yellow-400' };
    case 'rejected':
      return { label: 'Rejected', color: 'bg-red-100 text-red-800 dark:bg-red-900/30 dark:text-red-400' };
    default:
      return { label: status, color: 'bg-gray-100 text-gray-800 dark:bg-gray-800 dark:text-gray-400' };
  }
};

export const getNotificationTypeBadge = (type: string) => {
  switch (type) {
    case 'payment':
      return { label: 'Payment', color: 'bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-400' };
    case 'advance':
      return { label: 'Advance', color: 'bg-blue-100 text-blue-800 dark:bg-blue-900/30 dark:text-blue-400' };
    case 'increment':
      return { label: 'Increment', color: 'bg-purple-100 text-purple-800 dark:bg-purple-900/30 dark:text-purple-400' };
    case 'promotion':
      return { label: 'Promotion', color: 'bg-amber-100 text-amber-800 dark:bg-amber-900/30 dark:text-amber-400' };
    default:
      return { label: 'General', color: 'bg-gray-100 text-gray-800 dark:bg-gray-800 dark:text-gray-400' };
  }
};