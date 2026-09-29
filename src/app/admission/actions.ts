// src/app/admission/actions.ts
"use server";

import { createClient } from "@/lib/supabase/server";
import { z } from "zod";
import { randomUUID } from "crypto";

// ═══════════════════════════════════════════════════════════════════════
// HELPER: Convert Bangla digits to English digits
// ═══════════════════════════════════════════════════════════════════════
function normalizeDigits(input: string): string {
  const banglaDigits: Record<string, string> = {
    "০": "0", "১": "1", "২": "2", "৩": "3", "৪": "4",
    "৫": "5", "৬": "6", "৭": "7", "৮": "8", "৯": "9",
  };
  return input.replace(/[০-৯]/g, (d) => banglaDigits[d] || d);
}

// ═══════════════════════════════════════════════════════════════════════
// VALIDATION SCHEMA (Zod v4)
// ═══════════════════════════════════════════════════════════════════════
const admissionSchema = z.object({
  name: z.string().trim().min(2, "Name is required").max(255, "Name too long"),
  name_bn: z.string().trim().max(255).optional().nullable().transform((v) => v || null),
  father_name: z.string().trim().min(2, "Father's name is required").max(255),
  father_name_bn: z.string().trim().max(255).optional().nullable().transform((v) => v || null),
  mother_name: z.string().trim().min(2, "Mother's name is required").max(255),
  mother_name_bn: z.string().trim().max(255).optional().nullable().transform((v) => v || null),
  dob: z.string().min(1, "Date of birth is required").refine(
    (date) => {
      const d = new Date(date);
      return !isNaN(d.getTime()) && d <= new Date();
    },
    { message: "Date of birth cannot be in the future" }
  ),
  gender: z.enum(["male", "female", "other"]),
  blood_group: z.string().trim().max(10).optional().nullable().transform((v) => v || null),
  particular_disease: z.string().trim().max(500).optional().nullable().transform((v) => v || null),
  birth_cert_no: z.string().trim().max(50).optional().nullable().transform((v) => v || null),

  class_id: z.string().uuid("Invalid class selection"),
  section_id: z.string().uuid("Invalid section selection"),
  academic_year_id: z.string().uuid("Invalid academic year").optional().nullable(),

  village: z.string().trim().max(255).optional().nullable().transform((v) => v || null),
  post_office: z.string().trim().max(255).optional().nullable().transform((v) => v || null),
  police_station: z.string().trim().max(255).optional().nullable().transform((v) => v || null),
  district: z.string().trim().max(100).optional().nullable().transform((v) => v || null),

  permanent_village: z.string().trim().max(255).optional().nullable().transform((v) => v || null),
  permanent_post_office: z.string().trim().max(255).optional().nullable().transform((v) => v || null),
  permanent_police_station: z.string().trim().max(255).optional().nullable().transform((v) => v || null),
  permanent_district: z.string().trim().max(100).optional().nullable().transform((v) => v || null),

  contact: z
    .string()
    .trim()
    .transform((v) => normalizeDigits(v))
    .pipe(
      z.string()
        .min(11, "Contact must be at least 11 digits")
        .max(20, "Contact too long")
        .regex(/^[0-9+\-\s()]+$/, "Only numbers and +-() allowed")
    ),
  fathers_contact: z
    .string()
    .trim()
    .transform((v) => (v ? normalizeDigits(v) : v))
    .optional()
    .nullable()
    .transform((v) => (v && v.length > 0 ? v : null)),
  mothers_contact: z
    .string()
    .trim()
    .transform((v) => (v ? normalizeDigits(v) : v))
    .optional()
    .nullable()
    .transform((v) => (v && v.length > 0 ? v : null)),
  email: z.string().trim().transform((v) => (v === "" ? null : v)).nullable()
    .refine((v) => v === null || /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(v), "Invalid email address")
    .optional(),
  whatsapp: z
    .string()
    .trim()
    .transform((v) => (v ? normalizeDigits(v) : v))
    .optional()
    .nullable()
    .transform((v) => (v && v.length > 0 ? v : null)),
  father_nid_no: z
    .string()
    .trim()
    .transform((v) => (v ? normalizeDigits(v) : v))
    .optional()
    .nullable()
    .transform((v) => v || null),
  mother_nid_no: z
    .string()
    .trim()
    .transform((v) => (v ? normalizeDigits(v) : v))
    .optional()
    .nullable()
    .transform((v) => v || null),
});

type AdmissionInput = z.infer<typeof admissionSchema>;

export type AdmissionActionResult =
  | { success: true; referenceNo: string; pendingId: string }
  | { success: false; error: string; fieldErrors?: Record<string, string> };

// ═══════════════════════════════════════════════════════════════════════
// HELPER: Generate unique reference number
// ═══════════════════════════════════════════════════════════════════════
function generateReferenceNo(): string {
  const now = new Date();
  const yy = String(now.getFullYear()).slice(-2);
  const mm = String(now.getMonth() + 1).padStart(2, "0");
  const dd = String(now.getDate()).padStart(2, "0");
  const random = Math.floor(1000 + Math.random() * 9000);
  return `ADM-${yy}${mm}${dd}-${random}`;
}

// ═══════════════════════════════════════════════════════════════════════
// HELPER: Validate file for upload
// ═══════════════════════════════════════════════════════════════════════
const ALLOWED_IMAGE_TYPES = ["image/jpeg", "image/png", "image/jpg", "image/webp"];
const MAX_FILE_SIZE = 2 * 1024 * 1024;

function validatePhoto(file: File): { valid: boolean; error?: string } {
  if (!ALLOWED_IMAGE_TYPES.includes(file.type)) {
    return { valid: false, error: "Only JPG, PNG, WEBP files are allowed" };
  }
  if (file.size > MAX_FILE_SIZE) {
    return { valid: false, error: "Photo size must be less than 2MB" };
  }
  return { valid: true };
}

// ═══════════════════════════════════════════════════════════════════════
// MAIN ACTION: Submit Public Admission
// ═══════════════════════════════════════════════════════════════════════
export async function submitPublicAdmission(
  rawFormData: unknown,
  photoFile?: File | null
): Promise<AdmissionActionResult> {
  try {
    const supabase = await createClient();

    // ─── Step 1: Validate input ───
    const parsed = admissionSchema.safeParse(rawFormData);

    if (!parsed.success) {
      const fieldErrors: Record<string, string> = {};
      for (const issue of parsed.error.issues) {
        const path = issue.path.join(".");
        if (path && !fieldErrors[path]) {
          fieldErrors[path] = issue.message;
        }
      }
      const firstError = parsed.error.issues[0]?.message || "Please fill the form correctly";
      console.error("[Admission] Validation errors:", fieldErrors);
      return { success: false, error: firstError, fieldErrors };
    }

    const data: AdmissionInput = parsed.data;

    // ─── Step 2: Verify class + section ───
    const { data: sectionCheck, error: sectionError } = await supabase
      .from("sections")
      .select("id, class_id, name")
      .eq("id", data.section_id)
      .maybeSingle();

    if (sectionError || !sectionCheck) {
      console.error("[Admission] Section check failed:", sectionError);
      return { success: false, error: "Selected section not found in system" };
    }
    if (sectionCheck.class_id !== data.class_id) {
      return { success: false, error: "Class and section do not match." };
    }

    // ─── Step 3: Get current academic year ───
    const { data: academicYear, error: yearError } = await supabase
      .from("academic_years")
      .select("id")
      .eq("is_current", true)
      .maybeSingle();

    if (yearError) {
      console.error("[Admission] Academic year fetch failed:", yearError);
    }

    // ─── Step 4: Upload photo ───
    let photoUrl: string | null = null;
    if (photoFile && photoFile.size > 0) {
      const validation = validatePhoto(photoFile);
      if (!validation.valid) {
        return { success: false, error: validation.error || "Invalid photo" };
      }

      const fileExt = photoFile.name.split(".").pop()?.toLowerCase() || "jpg";
      const fileName = `pending/${Date.now()}-${Math.random().toString(36).substring(2, 10)}.${fileExt}`;

      const { data: uploadData, error: uploadError } = await supabase.storage
        .from("admission-photos")
        .upload(fileName, photoFile, {
          cacheControl: "3600",
          upsert: false,
          contentType: photoFile.type,
        });

      if (uploadError) {
        console.error("[Admission] Photo upload failed:", uploadError);
      } else if (uploadData) {
        const { data: urlData } = supabase.storage
          .from("admission-photos")
          .getPublicUrl(uploadData.path);
        photoUrl = urlData.publicUrl;
      }
    }

    // ─── Step 5: Generate unique reference number ───
    let referenceNo = generateReferenceNo();
    let isUnique = false;
    for (let attempt = 0; attempt < 10; attempt++) {
      const { data: existing } = await supabase
        .from("pending_admissions")
        .select("id")
        .eq("reference_no", referenceNo)
        .maybeSingle();
      if (!existing) {
        isUnique = true;
        break;
      }
      referenceNo = generateReferenceNo();
    }
    if (!isUnique) {
      return { success: false, error: "System is busy. Please try again later." };
    }

    // ─── Step 6: Insert into pending_admissions ───
    // Generate UUID client-side so we don't need .select() (which requires SELECT privilege for anon)
    const newId = randomUUID();

    const { error: insertError } = await supabase
      .from("pending_admissions")
      .insert({
        id: newId,
        reference_no: referenceNo,
        name: data.name,
        name_bn: data.name_bn,
        father_name_bn: data.father_name_bn,
        mother_name_bn: data.mother_name_bn,
        father_name: data.father_name,
        mother_name: data.mother_name,
        father_nid_no: data.father_nid_no,
        mother_nid_no: data.mother_nid_no,
        dob: data.dob,
        gender: data.gender,
        blood_group: data.blood_group,
        particular_disease: data.particular_disease,
        birth_cert_no: data.birth_cert_no,
        class_id: data.class_id,
        section_id: data.section_id,
        academic_year_id: academicYear?.id || null,
        village: data.village,
        post_office: data.post_office,
        police_station: data.police_station,
        district: data.district,
        permanent_village: data.permanent_village,
        permanent_post_office: data.permanent_post_office,
        permanent_police_station: data.permanent_police_station,
        permanent_district: data.permanent_district,
        contact: data.contact,
        fathers_contact: data.fathers_contact,
        mothers_contact: data.mothers_contact,
        email: data.email,
        whatsapp: data.whatsapp,
        photo_url: photoUrl,
        status: "pending",
        source: "public_form",
        applied_at: new Date().toISOString(),
      });

    if (insertError) {
      console.error("[Admission] Insert failed:", insertError);
      // Photo cleanup on failure
      if (photoUrl) {
        try {
          const path = photoUrl.split("/admission-photos/")[1];
          if (path) await supabase.storage.from("admission-photos").remove([path]);
        } catch (cleanupErr) {
          console.error("[Admission] Photo cleanup failed:", cleanupErr);
        }
      }
      return {
        success: false,
        error: `Failed to submit application: ${insertError.message}`,
      };
    }

    return {
      success: true,
      referenceNo: referenceNo,
      pendingId: newId,
    };
  } catch (err) {
    console.error("[Admission] Unexpected error:", err);
    const message = err instanceof Error ? err.message : "Unknown error occurred";
    return { success: false, error: message };
  }
}