// src/app/profile/actions.ts
"use server";

import { createClient } from "@/lib/supabase/server";
import { revalidatePath } from "next/cache";

export async function updateProfile(formData: {
  full_name: string;
  phone: string;
  address?: string;
  nid_no?: string;
  blood_group?: string;
  gender?: string;
  dob?: string;
  father_name?: string;
  mother_name?: string;
}) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return { error: "Not authenticated" };

  const { error } = await supabase
    .from("profiles")
    .update({
      full_name: formData.full_name,
      phone: formData.phone,
      address: formData.address || null,
      nid_no: formData.nid_no || null,
      blood_group: formData.blood_group || null,
      gender: formData.gender || null,
      dob: formData.dob || null,
      father_name: formData.father_name || null,
      mother_name: formData.mother_name || null,
      updated_at: new Date().toISOString(),
    })
    .eq("id", user.id);

  if (error) return { error: error.message };

  revalidatePath("/profile");
  return { success: true };
}

export async function uploadAvatar(file: File) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return { error: "Not authenticated" };

  // ✅ 3MB limit
  const MAX_SIZE = 3 * 1024 * 1024;
  if (file.size > MAX_SIZE) {
    return { error: "ছবি ৩MB এর কম হতে হবে" };
  }

  const ALLOWED_TYPES = ["image/png", "image/jpeg", "image/jpg", "image/webp"];
  if (!ALLOWED_TYPES.includes(file.type)) {
    return { error: "শুধু PNG, JPG, JPEG, WebP allowed" };
  }

  const fileExt = file.name.split(".").pop();
  const fileName = `${user.id}-${Date.now()}.${fileExt}`;

  // ✅ FIX: Removed "avatars/" prefix — bucket already named "avatars"
  // This makes RLS policy check simpler: name LIKE auth.uid()::text || '%'
  const filePath = fileName;

  const { error: uploadError } = await supabase.storage
    .from("avatars")
    .upload(filePath, file, {
      cacheControl: "3600",
      upsert: false,
    });

  if (uploadError) return { error: uploadError.message };

  const { data: { publicUrl } } = supabase.storage
    .from("avatars")
    .getPublicUrl(filePath);

  const { error: updateError } = await supabase
    .from("profiles")
    .update({ avatar_url: publicUrl, updated_at: new Date().toISOString() })
    .eq("id", user.id);

  if (updateError) return { error: updateError.message };

  revalidatePath("/profile");
  return { success: true, url: publicUrl };
}

export async function changePassword(newPassword: string) {
  const supabase = await createClient();

  const { error } = await supabase.auth.updateUser({
    password: newPassword,
  });

  if (error) return { error: error.message };
  return { success: true };
}