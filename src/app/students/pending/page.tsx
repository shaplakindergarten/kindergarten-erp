// src/app/students/pending/page.tsx
"use client";

import { ResponsiveLayout } from "@/components/layout/responsive-layout";
import { PendingAdmissionsTab } from "./components/PendingAdmissionsTab";

export default function PendingAdmissionsPage() {
  return (
    <ResponsiveLayout>
      <PendingAdmissionsTab />
    </ResponsiveLayout>
  );
}