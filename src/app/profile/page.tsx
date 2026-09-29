// src/app/profile/page.tsx
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { ResponsiveLayout } from "@/components/layout/responsive-layout";
import ProfileClient from "./profile-client";

export const metadata = {
  title: "আমার প্রোফাইল | KinderERP",
};

export default async function ProfilePage() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect("/login?redirect=/profile");

  const [profileResult, schoolResult] = await Promise.all([
    supabase.from("profiles").select("*").eq("id", user.id).single(),
    supabase.from("school_settings").select("school_name, school_address, school_logo, school_phone, school_email").limit(1).single(),
  ]);

  const profile = profileResult.data;
  const school = schoolResult.data;

  const userData = {
    id: user.id,
    name: profile?.full_name || user.user_metadata?.full_name || "User",
    email: profile?.email || user.email || "",
    phone: profile?.phone || "",
    role: profile?.role || "user",
    avatar: profile?.avatar_url || "",
    nid_no: profile?.nid_no || "",
    blood_group: profile?.blood_group || "",
    gender: profile?.gender || "",
    dob: profile?.dob || "",
    father_name: profile?.father_name || "",
    mother_name: profile?.mother_name || "",
    address: profile?.address || "",
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
      <ProfileClient user={userData} />
    </ResponsiveLayout>
  );
}