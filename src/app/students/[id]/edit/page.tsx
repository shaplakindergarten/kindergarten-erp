// src/app/students/[id]/edit/page.tsx
"use client";

import { useEffect } from "react";
import { useRouter, useParams } from "next/navigation";
import { Loader2 } from "lucide-react";

export default function StudentEditRedirectPage() {
  const router = useRouter();
  const { id } = useParams();

  useEffect(() => {
    router.replace(`/students/${id}`);
  }, [router, id]);

  return (
    <div className="flex items-center justify-center min-h-screen">
      <Loader2 className="animate-spin h-8 w-8" />
    </div>
  );
}