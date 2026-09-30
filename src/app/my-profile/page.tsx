// src/app/my-profile/page.tsx
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { ResponsiveLayout } from "@/components/layout/responsive-layout";
import MyProfileClient from "./my-profile-client";

export const metadata = {
  title: "আমার প্রোফাইল | KinderERP",
};

export default async function MyProfilePage() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect("/login?redirect=/my-profile");

  // Get profile
  const { data: profile } = await supabase
    .from("profiles")
    .select("*")
    .eq("id", user.id)
    .single();

  // Check role is student
  if (!profile || profile.role !== "student") {
    redirect("/profile");
  }

  // Get student record linked to this user
  const { data: student } = await supabase
    .from("students")
    .select(`
      id,
      student_id,
      name,
      name_bn,
      class_roll,
      admission_date,
      blood_group,
      gender,
      dob,
      contact,
      student_photo_url,
      class:classes(id, name),
      section:sections(id, name),
      academic_year:academic_years(id, name)
    `)
    .eq("user_id", user.id)
    .single();

  // Get school settings
  const { data: school } = await supabase
    .from("school_settings")
    .select("school_name, school_address, school_logo, school_phone, school_email")
    .limit(1)
    .single();

  // If no student record linked → error state
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

  const profileData = {
    id: user.id,
    name: student.name || profile.full_name || "Student",
    name_bn: student.name_bn || "",
    email: profile.email || user.email || "",
    phone: student.contact || profile.phone || "",
    role: profile.role,
    avatar: student.student_photo_url || profile.avatar_url || "",
    blood_group: student.blood_group || profile.blood_group || "",
    gender: student.gender || profile.gender || "",
    dob: student.dob || profile.dob || "",
    father_name: profile.father_name || "",
    mother_name: profile.mother_name || "",
    address: profile.address || "",
    academic: {
      studentId: student.student_id,
      classRoll: student.class_roll,
      className: (student as any).class?.[0]?.name || "—",
      sectionName: (student as any).section?.[0]?.name || "—",
      academicYear: (student as any).academic_year?.[0]?.name || "—",
      admissionDate: student.admission_date,
    },
    institution: {
      name: school?.school_name || "KinderERP",
      address: school?.school_address || "",
      logo: school?.school_logo || "",
      phone: school?.school_phone || "",
      email: school?.school_email || "",
    },
    joinedDate: new Date(user.created_at || Date.now()).toLocaleDateString("bn-BD", {
      year: "numeric",
      month: "long",
      day: "numeric",
    }),
    lastSignIn: user.last_sign_in_at
      ? new Date(user.last_sign_in_at).toLocaleDateString("bn-BD", {
          year: "numeric",
          month: "long",
          day: "numeric",
          hour: "2-digit",
          minute: "2-digit",
        })
      : "—",
  };

  return (
    <ResponsiveLayout>
      <MyProfileClient user={profileData} />
    </ResponsiveLayout>
  );
}