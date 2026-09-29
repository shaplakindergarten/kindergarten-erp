// src/app/dashboard/admissions/actions.ts
"use server";

import { createClient } from "@/lib/supabase/server";
import { revalidatePath } from "next/cache";

// ═══════════════════════════════════════════════════════════════════════
// TYPES
// ═══════════════════════════════════════════════════════════════════════
export type ApproveResult =
  | {
      success: true;
      studentId: string;      // "2025-P-001"
      studentUuid: string;    // uuid
      studentName: string;
    }
  | {
      success: false;
      error: string;
    };

export type RejectResult =
  | { success: true }
  | { success: false; error: string };

// ═══════════════════════════════════════════════════════════════════════
// HELPER: Verify admin/teacher role
// ═══════════════════════════════════════════════════════════════════════
async function verifyAdminOrTeacher(supabase: any) {
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return { ok: false, error: "Unauthorized: not logged in" };
  }

  const { data: profile, error } = await supabase
    .from("profiles")
    .select("role")
    .eq("id", user.id)
    .single();

  if (error || !profile) {
    return { ok: false, error: "Profile not found" };
  }

  const role = String(profile.role || "").toLowerCase();
  if (role !== "admin" && role !== "teacher") {
    return { ok: false, error: "Only admin or teacher can perform this action" };
  }

  return { ok: true, userId: user.id, role };
}

// ═══════════════════════════════════════════════════════════════════════
// HELPER: Generate unique student_id
// Format: YYYY-<CLASS_INITIAL>-<SERIAL>  (e.g., 2025-P-001)
// ═══════════════════════════════════════════════════════════════════════
async function generateStudentId(
  supabase: any,
  className: string,
  admissionYear: number
): Promise<string> {
  const classInitial = (className || "A").trim().charAt(0).toUpperCase() || "A";
  const prefix = `${admissionYear}-${classInitial}-`;

  // Find highest serial with this prefix
  const { data: lastStudents } = await supabase
    .from("students")
    .select("student_id")
    .like("student_id", `${prefix}%`)
    .order("student_id", { ascending: false })
    .limit(1);

  let nextSerial = 1;

  if (lastStudents && lastStudents.length > 0) {
    const lastId = String(lastStudents[0].student_id || "");
    const match = lastId.match(/-(\d+)$/);
    if (match) {
      nextSerial = parseInt(match[1], 10) + 1;
    }
  }

  // Retry if collision (in rare race condition)
  for (let attempt = 0; attempt < 5; attempt++) {
    const candidate = `${prefix}${String(nextSerial + attempt).padStart(3, "0")}`;

    const { data: existing } = await supabase
      .from("students")
      .select("id")
      .eq("student_id", candidate)
      .maybeSingle();

    if (!existing) {
      return candidate;
    }
  }

  // Fallback: use timestamp-based suffix
  return `${prefix}${Date.now().toString().slice(-4)}`;
}

// ═══════════════════════════════════════════════════════════════════════
// ACTION 1: Approve Admission
// ═══════════════════════════════════════════════════════════════════════
export async function approveAdmission(pendingId: string): Promise<ApproveResult> {
  try {
    const supabase = await createClient();

    // ─── 1. Verify role ───
    const auth = await verifyAdminOrTeacher(supabase);
    if (!auth.ok) {
      return { success: false, error: auth.error || "Permission denied" };
    }

    // ─── 2. Fetch pending admission ───
    const { data: pending, error: fetchError } = await supabase
      .from("pending_admissions")
      .select(
        `
        *,
        classes (id, name),
        sections (id, name)
      `
      )
      .eq("id", pendingId)
      .maybeSingle();

    if (fetchError || !pending) {
      return { success: false, error: "আবেদন খুঁজে পাওয়া যায়নি" };
    }

    if (pending.status !== "pending") {
      return {
        success: false,
        error: `এই আবেদন ইতিমধ্যে ${pending.status} অবস্থায় আছে`,
      };
    }

    // ─── 3. Fetch current academic year ───
    const { data: academicYear } = await supabase
      .from("academic_years")
      .select("id, year_name, start_date")
      .eq("is_current", true)
      .maybeSingle();

    // ─── 4. Verify class + section still exist ───
    if (!pending.class_id || !pending.section_id) {
      return {
        success: false,
        error: "শ্রেণি অথবা শাখা তথ্য অসম্পূর্ণ",
      };
    }

    const { data: sectionCheck } = await supabase
      .from("sections")
      .select("id, class_id")
      .eq("id", pending.section_id)
      .maybeSingle();

    if (!sectionCheck) {
      return {
        success: false,
        error: "নির্বাচিত শাখা আর সিস্টেমে নেই। আবেদনকারীকে জানান।",
      };
    }

    if (sectionCheck.class_id !== pending.class_id) {
      return {
        success: false,
        error: "শ্রেণি ও শাখার সম্পর্ক এখন আর সঠিক নয়",
      };
    }

    // ─── 5. Generate student ID ───
    const admissionYear = new Date().getFullYear();
    const className = pending.classes?.name || "Class";
    const studentId = await generateStudentId(supabase, className, admissionYear);

    // ═══════════════════════════════════════════════════════════════
    // Auto-generate class_roll for the new student
    // Format: zero-padded 3-digit string (e.g., "001", "002", "100")
    // Uniqueness: scoped to (class_id, section_id) via unique constraint
    // ═══════════════════════════════════════════════════════════════
    let generatedClassRoll: string | null = null;

    try {
      const { data: rollData, error: rollError } = await supabase
        .from("students")
        .select("class_roll")
        .eq("class_id", pending.class_id)
        .eq("section_id", pending.section_id)
        .not("class_roll", "is", null)
        .order("class_roll", { ascending: false })
        .limit(50); // fetch a window, we'll compute max from this

      if (!rollError && rollData && rollData.length > 0) {
        // Find the highest numeric roll (ignore non-numeric values)
        let maxRoll = 0;
        for (const row of rollData) {
          const raw = String(row.class_roll || "").trim();
          if (/^\d+$/.test(raw)) {
            const num = parseInt(raw, 10);
            if (num > maxRoll) maxRoll = num;
          }
        }
        generatedClassRoll = String(maxRoll + 1).padStart(3, "0");
      } else {
        // No existing rolls in this class+section → start from 001
        generatedClassRoll = "001";
      }
    } catch (rollGenErr) {
      console.error("[Approve] class_roll generation failed:", rollGenErr);
      generatedClassRoll = null; // fall back to NULL — non-fatal
    }

    // ─── 6. Prepare students insert payload ───
    const insertPayload: Record<string, any> = {
      student_id: studentId,
      name: String(pending.name).trim(),
      name_bn: pending.name_bn || null,
      father_name_bn: pending.father_name_bn || null,
      mother_name_bn: pending.mother_name_bn || null,
      father_nid_no: pending.father_nid_no || null,
      mother_nid_no: pending.mother_nid_no || null,
      father_name: String(pending.father_name).trim(),
      mother_name: String(pending.mother_name).trim(),
      dob: pending.dob,
      gender: pending.gender,
      blood_group: pending.blood_group || null,
      particular_disease: pending.particular_disease || null,
      birth_cert_no: pending.birth_cert_no || null,

      class_id: pending.class_id,
      section_id: pending.section_id,
      academic_year_id: academicYear?.id || null,

      village: pending.village || null,
      post_office: pending.post_office || null,
      police_station: pending.police_station || null,
      district: pending.district || null,

      permanent_village: pending.permanent_village || null,
      permanent_post_office: pending.permanent_post_office || null,
      permanent_police_station: pending.permanent_police_station || null,
      permanent_district: pending.permanent_district || null,

      contact: String(pending.contact).trim(),
      fathers_contact: pending.fathers_contact || null,
      mothers_contact: pending.mothers_contact || null,
      email: pending.email || null,
      whatsapp: pending.whatsapp || null,

      student_photo_url: pending.photo_url || null,
      class_roll: generatedClassRoll,

      status: "active",
      admission_date: new Date().toISOString().split("T")[0],
    };

    // ─── 7. Insert into students (with retry on class_roll collision) ───
    let newStudent: any = null;
    let insertError: any = null;

    for (let attempt = 0; attempt < 5; attempt++) {
      const { data, error } = await supabase
        .from("students")
        .insert(insertPayload)
        .select("id, student_id, name")
        .single();

      if (!error) {
        newStudent = data;
        insertError = null;
        break;
      }

      insertError = error;

      // Retry only on unique_class_section_roll collision
      const isRollCollision =
        error.code === "23505" &&
        (error.message?.includes("unique_class_section_roll") ||
          error.details?.includes("unique_class_section_roll"));

      if (!isRollCollision) {
        break; // different error → give up
      }

      // Bump roll by 1 and retry
      const currentRaw = String(insertPayload.class_roll || "0").trim();
      const currentNum = /^\d+$/.test(currentRaw) ? parseInt(currentRaw, 10) : 0;
      insertPayload.class_roll = String(currentNum + 1).padStart(3, "0");
    }

    if (insertError || !newStudent) {
      console.error("[Approve] Insert failed:", insertError);

      // Provide user-friendly error
      let message = "শিক্ষার্থী তৈরি করতে সমস্যা হয়েছে।";

      if (insertError?.code === "23505") {
        // Unique violation
        if (insertError.message?.includes("unique_student_identity")) {
          message = "একই নাম, পিতা ও মাতার নামে একজন শিক্ষার্থী ইতিমধ্যে আছে।";
        } else if (insertError.message?.includes("student_id")) {
          message = "একই Student ID তৈরি হয়েছে। আবার চেষ্টা করুন।";
        }
      } else if (insertError?.code === "23503") {
        message = "শ্রেণি বা শাখা তথ্য সঠিক নয়।";
      } else if (insertError?.message) {
        message = `DB Error: ${insertError.message}`;
      }

      return { success: false, error: message };
    }

    // ─── 8. Update pending_admissions ───
    const { error: updateError } = await supabase
      .from("pending_admissions")
      .update({
        status: "approved",
        reviewed_by: auth.userId,
        reviewed_at: new Date().toISOString(),
        approved_student_id: newStudent.id,
      })
      .eq("id", pendingId);

    if (updateError) {
      console.error("[Approve] Update pending failed:", updateError);

      // Roll back student creation to keep consistency
      await supabase.from("students").delete().eq("id", newStudent.id);

      return {
        success: false,
        error: "স্টেটাস আপডেট করতে সমস্যা হয়েছে। অনুগ্রহ করে আবার চেষ্টা করুন।",
      };
    }

    // ─── 9. Revalidate paths ───
    revalidatePath("/dashboard");
    revalidatePath("/dashboard/admissions");
    revalidatePath("/students/list");

    return {
      success: true,
      studentId: newStudent.student_id,
      studentUuid: newStudent.id,
      studentName: newStudent.name,
    };
  } catch (err: any) {
    console.error("[Approve] Unexpected error:", err);
    return {
      success: false,
      error: err?.message || "অজানা সমস্যা হয়েছে",
    };
  }
}

// ═══════════════════════════════════════════════════════════════════════
// ACTION 2: Reject Admission
// ═══════════════════════════════════════════════════════════════════════
export async function rejectAdmission(
  pendingId: string,
  reason: string
): Promise<RejectResult> {
  try {
    const trimmed = String(reason || "").trim();

    if (trimmed.length < 3) {
      return {
        success: false,
        error: "বাতিলের কারণ কমপক্ষে ৩ অক্ষর হতে হবে",
      };
    }

    if (trimmed.length > 500) {
      return { success: false, error: "কারণ ৫০০ অক্ষরের কম হতে হবে" };
    }

    const supabase = await createClient();

    // ─── Verify role ───
    const auth = await verifyAdminOrTeacher(supabase);
    if (!auth.ok) {
      return { success: false, error: auth.error || "Permission denied" };
    }

    // ─── Fetch to verify status ───
    const { data: pending, error: fetchError } = await supabase
      .from("pending_admissions")
      .select("id, status, reference_no")
      .eq("id", pendingId)
      .maybeSingle();

    if (fetchError || !pending) {
      return { success: false, error: "আবেদন খুঁজে পাওয়া যায়নি" };
    }

    if (pending.status !== "pending") {
      return {
        success: false,
        error: `এই আবেদন ইতিমধ্যে ${pending.status} অবস্থায় আছে`,
      };
    }

    // ─── Update ───
    const { error: updateError } = await supabase
      .from("pending_admissions")
      .update({
        status: "rejected",
        rejection_reason: trimmed,
        reviewed_by: auth.userId,
        reviewed_at: new Date().toISOString(),
      })
      .eq("id", pendingId);

    if (updateError) {
      console.error("[Reject] Update failed:", updateError);
      return {
        success: false,
        error: "বাতিল করতে সমস্যা হয়েছে। আবার চেষ্টা করুন।",
      };
    }

    revalidatePath("/dashboard");
    revalidatePath("/dashboard/admissions");

    return { success: true };
  } catch (err: any) {
    console.error("[Reject] Unexpected error:", err);
    return {
      success: false,
      error: err?.message || "অজানা সমস্যা হয়েছে",
    };
  }
}

// ═══════════════════════════════════════════════════════════════════════
// ACTION 3: Mark as "Reviewing" (optional - for status tracking)
// ═══════════════════════════════════════════════════════════════════════
export async function markAsReviewing(pendingId: string): Promise<RejectResult> {
  try {
    const supabase = await createClient();

    const auth = await verifyAdminOrTeacher(supabase);
    if (!auth.ok) {
      return { success: false, error: auth.error || "Permission denied" };
    }

    const { error } = await supabase
      .from("pending_admissions")
      .update({ status: "reviewing" })
      .eq("id", pendingId)
      .eq("status", "pending"); // only if currently pending

    if (error) {
      return { success: false, error: "স্টেটাস পরিবর্তন করা যায়নি" };
    }

    revalidatePath("/dashboard/admissions");
    return { success: true };
  } catch (err: any) {
    return { success: false, error: err?.message || "অজানা সমস্যা" };
  }
}

// ═══════════════════════════════════════════════════════════════════════
// ACTION 4: Delete Admission (admin only, permanent)
// ═══════════════════════════════════════════════════════════════════════
export async function deleteAdmission(pendingId: string): Promise<RejectResult> {
  try {
    const supabase = await createClient();

    // Only admin can delete
    const {
      data: { user },
    } = await supabase.auth.getUser();

    if (!user) return { success: false, error: "Unauthorized" };

    const { data: profile } = await supabase
      .from("profiles")
      .select("role")
      .eq("id", user.id)
      .single();

    if (String(profile?.role || "").toLowerCase() !== "admin") {
      return { success: false, error: "Only admin can delete admissions" };
    }

    // Fetch photo URL for cleanup
    const { data: pending } = await supabase
      .from("pending_admissions")
      .select("photo_url")
      .eq("id", pendingId)
      .maybeSingle();

    // Delete from storage (non-fatal)
    if (pending?.photo_url) {
      try {
        const path = pending.photo_url.split("/admission-photos/")[1];
        if (path) {
          await supabase.storage.from("admission-photos").remove([path]);
        }
      } catch (cleanupErr) {
        console.error("[Delete] Photo cleanup failed:", cleanupErr);
      }
    }

    const { error } = await supabase
      .from("pending_admissions")
      .delete()
      .eq("id", pendingId);

    if (error) {
      return { success: false, error: "Delete failed" };
    }

    revalidatePath("/dashboard/admissions");
    return { success: true };
  } catch (err: any) {
    return { success: false, error: err?.message || "অজানা সমস্যা" };
  }
}