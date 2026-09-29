// src/app/my-fees/page.tsx
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { ResponsiveLayout } from "@/components/layout/responsive-layout";
import { MyFeesClient } from "./my-fees-client";

export const metadata = { title: "আমার ফি | KinderERP" };

export default async function MyFeesPage() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect("/login?redirect=/my-fees");

  const { data: student } = await supabase
    .from("students")
    .select("id, name, student_id, class_roll, student_photo_url")
    .eq("user_id", user.id)
    .single();

  if (!student) {
    return (
      <ResponsiveLayout>
        <div className="max-w-3xl mx-auto p-6 text-center">
          <h1 className="text-xl font-bold text-red-600">❌ Student record not found</h1>
        </div>
      </ResponsiveLayout>
    );
  }

  // Fetch dues
  const { data: dues } = await supabase
    .from("student_fee_dues")
    .select("id, month, expected_amount, paid_amount, due_amount, fine_amount, discount_amount, status, due_date")
    .eq("student_id", student.id)
    .order("month", { ascending: false });

  // Fetch payments
  const { data: payments } = await supabase
    .from("fee_payments")
    .select("id, amount, payment_date, receipt_no, payment_method, note")
    .eq("student_id", student.id)
    .order("payment_date", { ascending: false })
    .limit(50);

  return (
    <ResponsiveLayout>
      <MyFeesClient
        student={student}
        dues={dues || []}
        payments={payments || []}
      />
    </ResponsiveLayout>
  );
}