// src/app/my-results/page.tsx
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { ResponsiveLayout } from "@/components/layout/responsive-layout";
import { MyResultsClient } from "./my-results-client";

export const metadata = { title: "আমার ফলাফল | KinderERP" };

export default async function MyResultsPage() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect("/login?redirect=/my-results");

  // Get student record linked to this user
  const { data: student } = await supabase
    .from("students")
    .select("id, name, student_id, class_id, section_id, class_roll, student_photo_url")
    .eq("user_id", user.id)
    .single();

  if (!student) {
    return (
      <ResponsiveLayout>
        <div className="max-w-3xl mx-auto p-6 text-center">
          <h1 className="text-xl font-bold text-red-600">❌ Student record not found</h1>
          <p className="text-slate-500 mt-2">
            আপনার account-এর সাথে কোনো student record link করা নেই।
            <br />
            Admin-এর সাথে যোগাযোগ করুন।
          </p>
        </div>
      </ResponsiveLayout>
    );
  }

  // Fetch compiled results for this student
  const { data: results } = await supabase
    .from("compiled_results")
    .select(`
      id, term_id, total_marks_obtained, total_full_marks,
      percentage, gpa, letter_grade, class_rank, section_rank,
      result_status, is_published, published_at,
      failed_subjects, has_failed_compulsory,
      exam_terms:term_id (id, name, term_code)
    `)
    .eq("student_id", student.id)
    .eq("is_published", true)
    .order("published_at", { ascending: false });

  return (
    <ResponsiveLayout>
      <MyResultsClient student={student} results={results || []} />
    </ResponsiveLayout>
  );
}