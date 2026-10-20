// src/lib/api/academic-year-context.ts
//
// Academic Year Context Resolver
//
// Purpose: Single source of truth for "which academic year are we in?"
// The ERP needs TWO different year concepts:
//   1. Operational Year  — the year whose classes/attendance/fees are running NOW
//   2. Admission Year    — the year whose admissions are OPEN (may be next year)
//
// Rule: NEVER silently fall back to is_current. If no year resolves, throw.
// This prevents accidentally writing 2026 data into 2027 (or vice versa).
//
// Created: 2026-10-20
// Part of: Phase 2 — read-path year isolation

import type { SupabaseClient } from "@supabase/supabase-js";

// ─────────────────────────────────────────────────────────────
// Types
// ─────────────────────────────────────────────────────────────

export interface AcademicYearRecord {
  id: string;
  year_name: string;
  start_date: string | null;
  end_date: string | null;
  is_current: boolean;
  is_active: boolean;
}

export class AcademicYearResolutionError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "AcademicYearResolutionError";
  }
}

// ─────────────────────────────────────────────────────────────
// Helper: today's date in ISO format (YYYY-MM-DD)
// ─────────────────────────────────────────────────────────────

function todayISO(): string {
  return new Date().toISOString().split("T")[0];
}

// ─────────────────────────────────────────────────────────────
// getOperationalYear
//
// Returns the academic year whose date range contains TODAY
// and is marked is_current + is_active.
//
// Use for: attendance, fees received, class activities, exams
// ─────────────────────────────────────────────────────────────

export async function getOperationalYear(
  supabase: SupabaseClient
): Promise<AcademicYearRecord> {
  const today = todayISO();

  const { data, error } = await supabase
    .from("academic_years")
    .select("id, year_name, start_date, end_date, is_current, is_active")
    .eq("is_current", true)
    .eq("is_active", true)
    .lte("start_date", today)
    .gte("end_date", today)
    .order("start_date", { ascending: false })
    .limit(2);

  if (error) {
    throw new AcademicYearResolutionError(
      `Failed to fetch operational academic year: ${error.message}`
    );
  }

  if (!data || data.length === 0) {
    throw new AcademicYearResolutionError(
      `No operational academic year found for date ${today}. ` +
        `Ensure exactly one row in academic_years has is_current=true, ` +
        `is_active=true, and its date range includes today.`
    );
  }

  if (data.length > 1) {
    throw new AcademicYearResolutionError(
      `Multiple operational academic years found for date ${today}: ` +
        data.map((y) => y.year_name).join(", ") +
        `. Only one year should be is_current=true.`
    );
  }

  return data[0] as AcademicYearRecord;
}

// ─────────────────────────────────────────────────────────────
// getOperationalYearId — convenience wrapper
// ─────────────────────────────────────────────────────────────

export async function getOperationalYearId(
  supabase: SupabaseClient
): Promise<string> {
  const year = await getOperationalYear(supabase);
  return year.id;
}

// ─────────────────────────────────────────────────────────────
// getAdmissionYear
//
// Returns the FUTURE academic year whose admissions are open.
// Typically the next year whose start_date is after today.
//
// Use for: admission form, new pending_admissions records
// ─────────────────────────────────────────────────────────────

export async function getAdmissionYear(
  supabase: SupabaseClient
): Promise<AcademicYearRecord> {
  const today = todayISO();

  const { data, error } = await supabase
    .from("academic_years")
    .select("id, year_name, start_date, end_date, is_current, is_active")
    .eq("is_active", true)
    .gt("start_date", today)
    .order("start_date", { ascending: true })
    .limit(1);

  if (error) {
    throw new AcademicYearResolutionError(
      `Failed to fetch admission academic year: ${error.message}`
    );
  }

  if (!data || data.length === 0) {
    throw new AcademicYearResolutionError(
      `No future academic year found for admissions. ` +
        `Create the next year in academic_years with start_date > ${today}.`
    );
  }

  return data[0] as AcademicYearRecord;
}

// ─────────────────────────────────────────────────────────────
// getAdmissionYearId — convenience wrapper
// ─────────────────────────────────────────────────────────────

export async function getAdmissionYearId(
  supabase: SupabaseClient
): Promise<string> {
  const year = await getAdmissionYear(supabase);
  return year.id;
}

// ─────────────────────────────────────────────────────────────
// getAllActiveYears — for UI year selectors
//
// Returns every active year, sorted chronologically.
// Use to populate a dropdown: "Which year are you working on?"
// ─────────────────────────────────────────────────────────────

export async function getAllActiveYears(
  supabase: SupabaseClient
): Promise<AcademicYearRecord[]> {
  const { data, error } = await supabase
    .from("academic_years")
    .select("id, year_name, start_date, end_date, is_current, is_active")
    .eq("is_active", true)
    .order("start_date", { ascending: false });

  if (error) {
    throw new AcademicYearResolutionError(
      `Failed to fetch active academic years: ${error.message}`
    );
  }

  return (data ?? []) as AcademicYearRecord[];
}

// ─────────────────────────────────────────────────────────────
// resolveYearFromParam
//
// Safely resolves a year ID passed from the URL.
// Validates that the ID actually exists and is active.
// Throws on invalid ID — never silently falls back.
// ─────────────────────────────────────────────────────────────

export async function resolveYearFromParam(
  supabase: SupabaseClient,
  yearIdOrNull: string | null | undefined
): Promise<AcademicYearRecord> {
  if (!yearIdOrNull || yearIdOrNull.trim() === "") {
    // No year in URL — use operational year as default
    return getOperationalYear(supabase);
  }

  const { data, error } = await supabase
    .from("academic_years")
    .select("id, year_name, start_date, end_date, is_current, is_active")
    .eq("id", yearIdOrNull)
    .eq("is_active", true)
    .maybeSingle();

  if (error) {
    throw new AcademicYearResolutionError(
      `Failed to resolve year ID ${yearIdOrNull}: ${error.message}`
    );
  }

  if (!data) {
    throw new AcademicYearResolutionError(
      `Invalid or inactive academic year ID: ${yearIdOrNull}`
    );
  }

  return data as AcademicYearRecord;
}