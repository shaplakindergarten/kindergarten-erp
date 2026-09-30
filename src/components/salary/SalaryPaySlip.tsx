import React, { useState, useEffect } from 'react';
import { createClient } from '@/lib/supabase/client';

export default function SalaryPaySlip({ staffId, month, year }: { staffId: string; month: number; year: number }) {
  const supabase = createClient();
  const [payslip, setPayslip] = useState<any>(null);
  const [loading, setLoading] = useState<boolean>(true);

  useEffect(() => {
    async function fetchPayslip() {
      setLoading(true);
      const { data, error } = await supabase.rpc('get_staff_payslip_data', {
        p_staff_id: staffId,
        p_month: month,
        p_year: year
      });

      if (!error && data && data.length > 0) {
        setPayslip(data[0]);
      }
      setLoading(false);
    }

    if (staffId) fetchPayslip();
  }, [staffId, month, year]);

  if (loading) return <div className="p-4 text-center">পে-স্লিপ লোড হচ্ছে...</div>;
  if (!payslip) return <div className="p-4 text-center text-red-500">কোনো পে-স্লিপ ডাটা পাওয়া যায়নি।</div>;

  return (
    <div className="max-w-2xl mx-auto p-6 bg-white border rounded-lg shadow-md my-4 print:shadow-none print:border-none">
      {/* হেডার */}
      <div className="text-center border-b pb-4 mb-4">
        <h2 className="text-xl font-bold">শাপলা কিন্ডারগার্টেন এন্ড প্রি-ক্যাডেট</h2>
        <p className="text-sm text-gray-600">মাসিক বেতন রশিদ (Pay-Slip)</p>
        <p className="text-xs text-gray-500">মাস: {month}/{year}</p>
      </div>

      {/* স্টাফ তথ্য */}
      <div className="grid grid-cols-2 gap-4 mb-4 text-sm">
        <div><strong>স্টাফ ID:</strong> {payslip.staff_id}</div>
        <div><strong>পেমেন্ট তারিখ:</strong> {payslip.payment_date}</div>
        <div><strong>পেমেন্ট মেথড:</strong> {payslip.payment_method?.toUpperCase()}</div>
        <div><strong>রেফারেন্স নম্বর:</strong> {payslip.reference_no || 'N/A'}</div>
      </div>

      {/* স্যালারি ব্রেকডাউন টেবিল */}
      <table className="w-full text-left border-collapse border my-4 text-sm">
        <thead>
          <tr className="bg-gray-100 border-b">
            <th className="p-2 border">বিবরণ</th>
            <th className="p-2 border text-right">পরিমাণ (টাকা)</th>
          </tr>
        </thead>
        <tbody>
          <tr>
            <td className="p-2 border">মূল বেতন (Basic)</td>
            <td className="p-2 border text-right">{payslip.basic_salary}</td>
          </tr>
          <tr>
            <td className="p-2 border">অ্যালাউন্স (Allowances)</td>
            <td className="p-2 border text-right">+{payslip.allowances}</td>
          </tr>
          <tr>
            <td className="p-2 border">কর্তন (Deductions)</td>
            <td className="p-2 border text-right text-red-500">-{payslip.deductions}</td>
          </tr>
          <tr className="font-bold bg-gray-50">
            <td className="p-2 border">মোট প্রদেয় (Net Payable)</td>
            <td className="p-2 border text-right">{payslip.net_payable}</td>
          </tr>
          <tr className="font-bold text-green-600">
            <td className="p-2 border">পরিশোধিত (Paid Amount)</td>
            <td className="p-2 border text-right">{payslip.paid_amount}</td>
          </tr>
          <tr className="font-bold text-red-600">
            <td className="p-2 border">বকেয়া (Due Amount)</td>
            <td className="p-2 border text-right">{payslip.due_amount}</td>
          </tr>
        </tbody>
      </table>

      {/* প্রিন্ট বাটন */}
      <div className="text-right mt-6 print:hidden">
        <button 
          onClick={() => window.print()}
          className="bg-blue-600 text-white px-4 py-2 rounded hover:bg-blue-700 text-sm font-medium"
        >
          পে-স্লিপ প্রিন্ট করুন
        </button>
      </div>
    </div>
  );
}