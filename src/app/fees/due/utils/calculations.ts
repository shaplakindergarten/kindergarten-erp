// H:\kindergarten-erp\src\app\fees\due\utils\calculations.ts

// English currency format (BDT)
export function formatCurrency(amount: number): string {
  return new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency: 'BDT',
    minimumFractionDigits: 0,
    maximumFractionDigits: 0,
  }).format(amount);
}

// Keep original function name for backward compatibility
export const formatCurrencyBDT = formatCurrency;

export function getDueColor(amount: number): string {
  if (amount > 5000) return "bg-red-500/10 text-red-700 border-red-500/30";
  if (amount > 2000) return "bg-yellow-500/10 text-yellow-700 border-yellow-500/30";
  if (amount > 0) return "bg-orange-500/10 text-orange-700 border-orange-500/30";
  return "bg-green-500/10 text-green-700 border-green-500/30";
}

export function getUrgencyInfo(daysOverdue?: number) {
  if (!daysOverdue || daysOverdue <= 0) return null;
  if (daysOverdue > 30) return { 
    label: `${daysOverdue} days overdue`, 
    variant: "destructive" as const, 
    color: "bg-red-600 text-white" 
  };
  if (daysOverdue > 15) return { 
    label: `${daysOverdue} days overdue`, 
    variant: "warning" as const, 
    color: "bg-orange-500 text-white" 
  };
  return { 
    label: `${daysOverdue} days overdue`, 
    variant: "secondary" as const, 
    color: "bg-yellow-500 text-white" 
  };
}

export function sendWhatsAppReminder(phone: string, studentName: string, dueAmount: number, fatherName: string) {
  if (!phone) {
    console.error("No phone number provided");
    return false;
  }
  
  const message = encodeURIComponent(
    `Dear ${fatherName},\n\n` +
    `This is a reminder that fee for ${studentName} is due.\n` +
    `Due Amount: BDT ${dueAmount.toLocaleString()}\n` +
    `Please clear the dues at your earliest convenience.\n\n` +
    `Thank you,\nSchool Management System`
  );
  
  window.open(`https://wa.me/${phone}?text=${message}`, '_blank');
  return true;
}