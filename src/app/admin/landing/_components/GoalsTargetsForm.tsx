"use client";

import { useState, useTransition } from "react";
import { Loader2, Save, Plus, Trash2 } from "lucide-react";
import { toast } from "sonner";
import { FormSection } from "./FormSection";
import { saveLandingSettings } from "../actions";

type Row = Record<string, unknown> | null;

function toArray(v: unknown): string[] {
  return Array.isArray(v) ? v.map(String) : [];
}

export function GoalsTargetsForm({ initial }: { initial: Row }) {
  const [isPending, startTransition] = useTransition();
  const [goals, setGoals] = useState<string[]>(toArray(initial?.goals));
  const [targets, setTargets] = useState<string[]>(toArray(initial?.targets));

  const save = () => {
    startTransition(async () => {
      const res = await saveLandingSettings({
        goals: goals.filter(g => g.trim()),
        targets: targets.filter(t => t.trim()),
      });
      if (res.ok) toast.success("Goals & Targets saved!");
      else toast.error(res.error || "Save failed");
    });
  };

  const renderList = (
    items: string[], setItems: (v: string[]) => void, label: string, color: string
  ) => (
    <div>
      <h3 className={`text-sm font-semibold mb-2 ${color}`}>{label}</h3>
      <div className="space-y-2">
        {items.map((it, i) => (
          <div key={i} className="flex gap-2">
            <input
              value={it}
              onChange={(e) => {
                const copy = [...items]; copy[i] = e.target.value; setItems(copy);
              }}
              className="flex-1 px-3 py-2 border rounded-md text-sm dark:bg-slate-800 dark:border-slate-700"
              placeholder={`${label} ${i + 1}`}
            />
            <button
              type="button"
              onClick={() => setItems(items.filter((_, idx) => idx !== i))}
              className="px-2 text-rose-600 hover:bg-rose-50 dark:hover:bg-rose-950 rounded-md"
              aria-label="Delete"
            >
              <Trash2 className="w-4 h-4" />
            </button>
          </div>
        ))}
        <button
          type="button"
          onClick={() => setItems([...items, ""])}
          className="flex items-center gap-1 text-xs text-indigo-600 hover:text-indigo-700"
        >
          <Plus className="w-3.5 h-3.5" /> Add item
        </button>
      </div>
    </div>
  );

  return (
    <FormSection title="🎯 Goals & Targets" description="উদ্দেশ্য ও লক্ষ্য (যত খুশি আইটেম যোগ করুন)">
      <div className="space-y-5">
        {renderList(goals, setGoals, "উদ্দেশ্য", "text-emerald-600 dark:text-emerald-400")}
        {renderList(targets, setTargets, "লক্ষ্য", "text-amber-600 dark:text-amber-400")}
        <button onClick={save} disabled={isPending}
          className="flex items-center gap-2 px-4 py-2 bg-emerald-600 hover:bg-emerald-700 disabled:opacity-50 text-white text-sm rounded-md">
          {isPending ? <Loader2 className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />}
          {isPending ? "Saving..." : "Save"}
        </button>
      </div>
    </FormSection>
  );
}