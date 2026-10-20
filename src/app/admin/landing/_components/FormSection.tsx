"use client";

import { ReactNode } from "react";

interface Props {
  title: string;
  description?: string;
  children: ReactNode;
}

export function FormSection({ title, description, children }: Props) {
  return (
    <section className="bg-white dark:bg-slate-900 rounded-xl border border-slate-200 dark:border-slate-800 shadow-sm">
      <div className="px-5 py-4 border-b border-slate-200 dark:border-slate-800">
        <h2 className="font-semibold text-slate-900 dark:text-slate-100">{title}</h2>
        {description && (
          <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">{description}</p>
        )}
      </div>
      <div className="p-5">{children}</div>
    </section>
  );
}