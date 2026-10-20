// src/app/admin/landing/actions.ts
"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";

type ActionResult = { ok: boolean; error?: string };

async function requireAdmin() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) throw new Error("Not authenticated: Please login again.");

  const { data: profile } = await supabase
    .from("profiles").select("role").eq("id", user.id).maybeSingle();

  if (!profile || profile.role !== "admin") {
    throw new Error("Admin access required. Your role is: " + (profile?.role || "none"));
  }
  return supabase;
}

export async function saveLandingSettings(
  payload: Record<string, unknown>
): Promise<ActionResult> {
  try {
    const supabase = await requireAdmin();
    const { error } = await supabase
      .from("landing_settings")
      .update(payload)
      .eq("id", 1);
      
    if (error) {
      console.error("Supabase Error Detail:", error);
      throw new Error(error.message + " (Code: " + error.code + ")");
    }

    revalidatePath("/");
    revalidatePath("/admin/landing");
    return { ok: true };
  } catch (err: any) {
    console.error("[saveLandingSettings] Error:", err);
    return { ok: false, error: err?.message || "Save failed" };
  }
}

export async function upsertFeature(
  data: { id?: string; title: string; description: string; icon_name: string; color_class: string; display_order: number; is_active: boolean }
): Promise<ActionResult> {
  try {
    const supabase = await requireAdmin();
    const op = data.id
      ? supabase.from("school_features").update(data).eq("id", data.id)
      : supabase.from("school_features").insert(data);
      
    const { error } = await op;
    if (error) throw new Error(error.message);
    
    revalidatePath("/");
    revalidatePath("/admin/landing");
    return { ok: true };
  } catch (err: any) {
    console.error("[upsertFeature] Error:", err);
    return { ok: false, error: err?.message || "Save failed" };
  }
}

export async function deleteFeature(id: string): Promise<ActionResult> {
  try {
    const supabase = await requireAdmin();
    const { error } = await supabase.from("school_features").delete().eq("id", id);
    if (error) throw new Error(error.message);
    
    revalidatePath("/");
    revalidatePath("/admin/landing");
    return { ok: true };
  } catch (err: any) {
    console.error("[deleteFeature] Error:", err);
    return { ok: false, error: err?.message || "Delete failed" };
  }
}

export async function upsertDownload(
  data: { id?: string; title: string; subtitle: string; icon_color: string; card_bg: string; card_border: string; button_bg: string; file_url: string; display_order: number; is_active: boolean }
): Promise<ActionResult> {
  try {
    const supabase = await requireAdmin();
    const op = data.id
      ? supabase.from("download_items").update(data).eq("id", data.id)
      : supabase.from("download_items").insert(data);
      
    const { error } = await op;
    if (error) throw new Error(error.message);
    
    revalidatePath("/");
    revalidatePath("/admin/landing");
    return { ok: true };
  } catch (err: any) {
    console.error("[upsertDownload] Error:", err);
    return { ok: false, error: err?.message || "Save failed" };
  }
}

export async function deleteDownload(id: string): Promise<ActionResult> {
  try {
    const supabase = await requireAdmin();
    const { error } = await supabase.from("download_items").delete().eq("id", id);
    if (error) throw new Error(error.message);
    
    revalidatePath("/");
    revalidatePath("/admin/landing");
    return { ok: true };
  } catch (err: any) {
    console.error("[deleteDownload] Error:", err);
    return { ok: false, error: err?.message || "Delete failed" };
  }
}

export async function addGalleryImage(data: {
  image_url: string;
  alt_text?: string;
  caption?: string;
  display_order?: number;
}): Promise<ActionResult> {
  try {
    const supabase = await requireAdmin();
    const { error } = await supabase.from("gallery_images").insert({
      ...data,
      is_active: true,
    });
    if (error) throw new Error(error.message);
    
    revalidatePath("/");
    revalidatePath("/admin/landing");
    return { ok: true };
  } catch (err: any) {
    console.error("[addGalleryImage] Error:", err);
    return { ok: false, error: err?.message || "Save failed" };
  }
}

export async function deleteGalleryImage(id: string): Promise<ActionResult> {
  try {
    const supabase = await requireAdmin();
    const { error } = await supabase.from("gallery_images").delete().eq("id", id);
    if (error) throw new Error(error.message);
    
    revalidatePath("/");
    revalidatePath("/admin/landing");
    return { ok: true };
  } catch (err: any) {
    console.error("[deleteGalleryImage] Error:", err);
    return { ok: false, error: err?.message || "Delete failed" };
  }
}

// 🆕 নতুন যুক্ত করা হলো
export async function upsertCommittee(data: {
  id?: string; name: string; role: string; phone: string; photo_url: string; display_order: number;
}): Promise<ActionResult> {
  try {
    const supabase = await requireAdmin();
    const op = data.id
      ? supabase.from("landing_committee").update(data).eq("id", data.id)
      : supabase.from("landing_committee").insert(data);
    const { error } = await op;
    if (error) throw new Error(error.message);
    revalidatePath("/");
    revalidatePath("/admin/landing");
    return { ok: true };
  } catch (err: any) {
    console.error("[upsertCommittee] Error:", err);
    return { ok: false, error: err?.message || "Save failed" };
  }
}

// 🆕 নতুন যুক্ত করা হলো
export async function deleteCommittee(id: string): Promise<ActionResult> {
  try {
    const supabase = await requireAdmin();
    const { error } = await supabase.from("landing_committee").delete().eq("id", id);
    if (error) throw new Error(error.message);
    revalidatePath("/");
    revalidatePath("/admin/landing");
    return { ok: true };
  } catch (err: any) {
    console.error("[deleteCommittee] Error:", err);
    return { ok: false, error: err?.message || "Delete failed" };
  }
}