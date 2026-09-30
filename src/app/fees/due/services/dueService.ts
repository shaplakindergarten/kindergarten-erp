// H:\kindergarten-erp\src\app\fees\due\services\dueService.ts

import { DueStudent, DueFilters } from "../types";
import { fetchJson } from "@/lib/utils";
import { isValidUUID } from "@/lib/utils";

export class DueService {
  private static instance: DueService;
  private realtimeChannel: any;
  private autoRefreshInterval: NodeJS.Timeout | null = null;

  static getInstance(): DueService {
    if (!DueService.instance) {
      DueService.instance = new DueService();
    }
    return DueService.instance;
  }

  // API Route এর মাধ্যমে ডাটা আনা
  async getDueStudents(filters: DueFilters = {}): Promise<DueStudent[]> {
    try {
      console.log('Fetching due students from API route...');
      
      // Build query string from filters
      const queryParams = new URLSearchParams();
      if (filters.class_id && filters.class_id !== 'all') {
        if (!isValidUUID(filters.class_id)) {
          console.warn('Invalid class UUID, skipping class filter:', filters.class_id);
        } else {
          queryParams.append('class_id', filters.class_id);
        }
      }
      if (filters.section_id && filters.section_id !== 'all') {
        if (!isValidUUID(filters.section_id)) {
          console.warn('Invalid section UUID, skipping section filter:', filters.section_id);
        } else {
          queryParams.append('section_id', filters.section_id);
        }
      }
      if (filters.search) queryParams.append('search', filters.search);
      if (filters.min_due) queryParams.append('min_due', filters.min_due.toString());
      if (filters.max_due) queryParams.append('max_due', filters.max_due.toString());
      
      const queryString = queryParams.toString();
      const url = `/api/fees/due${queryString ? `?${queryString}` : ''}`;
      
      console.log('📡 Fetching URL:', url); // ✅ লগ যোগ করা হয়েছে
      
      const result = await fetchJson<{ success: boolean; data: any[] }>(url);
      console.log('📡 API result count:', result.data?.length || 0);
      
      if (!result.success || !result.data) {
        console.error('Invalid API response:', result);
        return [];
      }
      
      // Convert to DueStudent format
      const dueStudents: DueStudent[] = result.data.map((item: any) => ({
        id: item.id,
        student_id: item.id,
        student_name: item.student_name,
        name: item.student_name,
        admission_no: item.admission_no || '',
        class_roll: item.class_roll || '',
        class_name: item.class_name || 'N/A',
        section_name: item.section_name || 'N/A',
        total_fees: Number(item.total_fees) || 0,
        total_paid: Number(item.total_paid) || 0,
        due_amount: Number(item.due_amount) || 0,
        days_overdue: item.days_overdue || 0,
        overdue_status: item.overdue_status || (Number(item.due_amount) > 800 ? 'Critical' : Number(item.due_amount) > 500 ? 'High' : Number(item.due_amount) > 200 ? 'Medium' : Number(item.due_amount) > 0 ? 'Low' : 'Current'),
        father_name: item.father_name || '',
        mother_name: item.mother_name || '',
        phone: item.phone || '',
        email: item.email || '',
        class_id: item.class_id || '',
        section_id: item.section_id || '',
        student_status: 'active',
        created_at: new Date().toISOString()
      }));
      
      console.log(`✅ Found ${dueStudents.length} due students`);
      return dueStudents;
      
    } catch (error) {
      console.error('❌ Error in getDueStudents:', error);
      return [];
    }
  }

  // Dashboard Stats
  async getDashboardStats(filters: DueFilters = {}) {
    const dueStudents = await this.getDueStudents(filters);
    const totalDue = dueStudents.reduce((s, c) => s + c.due_amount, 0);
    const totalFees = dueStudents.reduce((s, c) => s + c.total_fees, 0);
    const totalPaid = dueStudents.reduce((s, c) => s + c.total_paid, 0);

    return {
      total_due: totalDue,
      total_expected: totalFees,
      total_collected: totalPaid,
      collection_rate: totalFees > 0 ? (totalPaid / totalFees) * 100 : 0,
      due_students_count: dueStudents.length,
      // Updated thresholds for school fee structure
      high_due_count: dueStudents.filter(s => s.due_amount > 500 && s.due_amount <= 800).length,
      medium_due_count: dueStudents.filter(s => s.due_amount > 200 && s.due_amount <= 500).length,
      low_due_count: dueStudents.filter(s => s.due_amount > 0 && s.due_amount <= 200).length,
      critical_overdue: dueStudents.filter(s => s.due_amount > 800).length
    };
  }

  // ============================================
  // Send Reminder with proper WhatsApp integration
  // ============================================
  async sendReminder(data: {
    student_name: string;
    due_amount: number;
    phone: string;
    father_name: string;
    email?: string;
    type: string;
  }): Promise<{ success: boolean; message?: string }> {
    try {
      // Format amount with BDT
      const amount = new Intl.NumberFormat('en-US', {
        style: 'currency',
        currency: 'BDT',
        minimumFractionDigits: 0,
      }).format(data.due_amount);
      
      // Professional reminder message
      const message = `Dear ${data.father_name || 'Guardian'},\n\n` +
        `This is a friendly reminder that the fee for ${data.student_name} is due.\n\n` +
        `📌 Due Amount: ${amount}\n\n` +
        `Please clear the dues at your earliest convenience to avoid any late fees.\n\n` +
        `Thank you for your cooperation.\n\n` +
        `Best regards,\nSchool Management System`;
      
      // Handle WhatsApp
      if (data.type === 'whatsapp' && data.phone) {
        // Clean phone number (remove any non-digit characters)
        const cleanPhone = data.phone.replace(/[^0-9]/g, '');
        // Add country code if not present (BD = 88)
        const finalPhone = cleanPhone.startsWith('88') ? cleanPhone : `88${cleanPhone}`;
        const encodedMessage = encodeURIComponent(message);
        const whatsappUrl = `https://wa.me/${finalPhone}?text=${encodedMessage}`;
        
        // Open WhatsApp in new tab
        window.open(whatsappUrl, '_blank');
        return { success: true, message: 'WhatsApp opened successfully' };
      }
      
      // For SMS/Email simulation (log for now)
      console.log('Reminder message:', message);
      console.log(`Reminder sent via ${data.type} to ${data.phone || data.email}`);
      
      return { success: true, message: `${data.type} reminder sent successfully` };
      
    } catch (error) {
      console.error('Error sending reminder:', error);
      return { success: false, message: 'Failed to send reminder' };
    }
  }

  // Export to CSV
  exportToCSV(students: DueStudent[], selectedIds?: string[]): string {
    const dataToExport = selectedIds 
      ? students.filter(s => selectedIds.includes(s.id))
      : students;
    
    const headers = ['Admission No', 'Student Name', 'Class Roll', 'Class', 'Section', 'Father Name', 'Mobile', 'Total Fees', 'Paid', 'Due Amount', 'Status', 'Days Overdue'];
    const rows = dataToExport.map(s => [
      s.admission_no,
      s.student_name,
      s.class_roll || '',
      s.class_name,
      s.section_name,
      s.father_name || '',
      s.phone || '',
      s.total_fees.toString(),
      s.total_paid.toString(),
      s.due_amount.toString(),
      s.overdue_status,
      s.days_overdue.toString()
    ]);
    
    return [headers, ...rows].map(row => row.join(',')).join('\n');
  }

  downloadCSV(csvContent: string, filename: string): void {
    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const link = document.createElement('a');
    const url = URL.createObjectURL(blob);
    link.href = url;
    link.setAttribute('download', filename);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
  }

  // Get single student details
  async getStudentDetails(studentId: string): Promise<DueStudent | null> {
    try {
      const result = await fetchJson<{ success: boolean; data: any[] }>(`/api/fees/due?student_id=${studentId}`);
      
      if (result.success && result.data && result.data.length > 0) {
        const student = result.data[0];
return {
        id: student.id,
        student_id: student.id,
        student_name: student.student_name,
        name: student.student_name,
        admission_no: student.admission_no || '',
        class_roll: student.class_roll || '',
        class_name: student.class_name || 'N/A',
        section_name: student.section_name || 'N/A',
        total_fees: Number(student.total_fees) || 0,
        total_paid: Number(student.total_paid) || 0,
        due_amount: Number(student.due_amount) || 0,
        days_overdue: student.days_overdue || 0,
        overdue_status: student.overdue_status || 'Current',
        father_name: student.father_name || '',
        mother_name: student.mother_name || '',
        phone: student.phone || '',
        email: student.email || '',
        class_id: student.class_id || '',
        section_id: student.section_id || '',
        student_status: 'active',
        created_at: new Date().toISOString()
      };
      }
      return null;
    } catch (error) {
      console.error('Error getting student details:', error);
      return null;
    }
  }

  // ============================================
  // Auto-refresh disabled - Manual refresh only
  // ============================================
  
  setupRealtimeSubscription(onChange: () => void): void {
    // Auto-refresh সম্পূর্ণ বন্ধ - শুধু ম্যানুয়াল রিফ্রেশ
    console.log('🔄 Auto-refresh is disabled. Use manual refresh button only.');
    
    // No automatic interval - user must click refresh button
    this.realtimeChannel = { 
      unsubscribe: () => {
        console.log('Realtime channel cleaned up');
      } 
    };
  }

  cleanupRealtime(): void {
    if (this.autoRefreshInterval) {
      clearInterval(this.autoRefreshInterval);
      this.autoRefreshInterval = null;
    }
    if (this.realtimeChannel) {
      this.realtimeChannel.unsubscribe();
      this.realtimeChannel = null;
    }
    console.log('Auto-refresh completely disabled');
  }
  
  // Manual refresh only
  async manualRefresh(filters: DueFilters = {}): Promise<DueStudent[]> {
    console.log('🔄 Manual refresh triggered by user');
    return this.getDueStudents(filters);
  }
}

export const dueService = DueService.getInstance();