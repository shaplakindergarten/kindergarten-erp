// src/app/signup/signup-client.tsx
"use client";

import { Suspense } from "react";
import SignupForm from "./signup-form";

function SignupFallback() {
  return (
    <div className="min-h-screen w-full grid place-items-center bg-slate-50 dark:bg-slate-950">
      <div className="flex flex-col items-center gap-3">
        <div className="h-10 w-10 animate-spin rounded-full border-4 border-indigo-600 border-t-transparent" />
        <p className="text-sm text-slate-500 dark:text-slate-400">লোড হচ্ছে...</p>
      </div>
    </div>
  );
}

export default function SignupClient() {
  return (
    <Suspense fallback={<SignupFallback />}>
      <SignupForm />
    </Suspense>
  );
}