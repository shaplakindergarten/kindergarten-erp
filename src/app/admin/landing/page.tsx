// src/app/admin/landing/page.tsx
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { HeroSectionForm } from "./_components/HeroSectionForm";
import { LeadershipForm } from "./_components/LeadershipForm";
import { GoalsTargetsForm } from "./_components/GoalsTargetsForm";
import { SeoForm } from "./_components/SeoForm";
import { FeaturesManager } from "./_components/FeaturesManager";
import { DownloadsManager } from "./_components/DownloadsManager";
import { GalleryManager } from "./_components/GalleryManager";
import { CommitteeManager } from "./_components/CommitteeManager";
import { Globe } from "lucide-react";
import { ResponsiveLayout } from "@/components/layout/responsive-layout";

export default async function AdminLandingPage() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  
  if (!user) redirect("/login");

  const { data: profile } = await supabase
    .from("profiles").select("role").eq("id", user.id).maybeSingle();
    
  if (profile?.role !== "admin") redirect("/dashboard");

  const [landingRes, featuresRes, downloadsRes, galleryRes, committeeRes] = await Promise.all([
    supabase.from("landing_settings").select("*").eq("id", 1).maybeSingle(),
    supabase.from("school_features").select("*").order("display_order"),
    supabase.from("download_items").select("*").order("display_order"),
    supabase.from("gallery_images").select("*").order("display_order"),
    supabase.from("landing_committee").select("*").order("display_order"),
  ]);

  // Fallbacks in case DB has errors
  const landingData = landingRes.data || {};
  const featuresData = featuresRes.data || [];
  const downloadsData = downloadsRes.data || [];
  const galleryData = galleryRes.data || [];
  const committeeData = committeeRes.data || [];

  return (
    <ResponsiveLayout>
      <div className="min-h-screen bg-slate-50 dark:bg-slate-950 py-8">
        <div className="max-w-5xl mx-auto px-4">
          <div className="mb-8">
            <div className="flex items-center gap-2 text-slate-900 dark:text-slate-100">
              <Globe className="w-6 h-6 text-indigo-600" />
              <h1 className="text-2xl font-bold">Landing Page Settings</h1>
            </div>
            <p className="text-sm text-slate-600 dark:text-slate-400 mt-1">
              এখানে যা পরিবর্তন করবেন, সাথে সাথে ল্যান্ডিং পেজে দেখা যাবে।
            </p>
          </div>

          <div className="space-y-6">
            <HeroSectionForm initial={landingData} />
            <LeadershipForm initial={landingData} />
            <GoalsTargetsForm initial={landingData} />
            <CommitteeManager initial={committeeData} />
            <SeoForm initial={landingData} />
            <FeaturesManager initial={featuresData} />
            <DownloadsManager initial={downloadsData} />
            <GalleryManager initial={galleryData} />
          </div>
        </div>
      </div>
    </ResponsiveLayout>
  );
}