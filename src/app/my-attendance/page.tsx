// src/app/my-attendance/page.tsx
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { ResponsiveLayout } from "@/components/layout/responsive-layout";
import { MyAttendanceClient } from "./my-attendance-client";

export const metadata = { title: "আমার হাজিরা | KinderERP" };

export default async function MyAttendancePage() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect("/login?redirect=/my-attendance");

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
          <p className="text-slate-500 mt-2">Admin-এর সাথে যোগাযোগ করুন।</p>
        </div>
      </ResponsiveLayout>
    );
  }

  // Fetch own attendance
  const { data: attendance } = await supabase
    .from("student_attendance")
    .select("id, date, status, remarks, check_in, check_out")
    .eq("student_id", student.id)
    .order("date", { ascending: false })
    .limit(90);

  return (
    <ResponsiveLayout>
      <MyAttendanceClient student={student} attendance={attendance || []} />
    </ResponsiveLayout>
  );
}