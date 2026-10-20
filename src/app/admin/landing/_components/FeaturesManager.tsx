"use client";

import { useState, useTransition } from "react";
import { Loader2, Plus, Pencil, Trash2, Save, X } from "lucide-react";
import { toast } from "sonner";
import { FormSection } from "./FormSection";
import { upsertFeature, deleteFeature } from "../actions";

type Row = Record<string, unknown>;
interface Props { initial: Row[] }

const ICON_OPTIONS = [
  "Monitor","Shield","BookOpen","Users","Heart","Trophy","Sparkles","Star",
  "Music","Palette","Calculator","Globe","GraduationCap","Award","School",
];
const COLOR_OPTIONS = [
  "bg-[#0a4d8c]","bg-emerald-500","bg-amber-500","bg-purple-500",
  "bg-rose-500","bg-teal-500","bg-blue-500","bg-indigo-500",
];

export function FeaturesManager({ initial }: Props) {
  const [items, setItems] = useState(initial);
  const [editing, setEditing] = useState<Row | null>(null);
  const [isPending, startTransition] = useTransition();

  const startNew = () => setEditing({
    title: "", description: "", icon_name: "Sparkles",
    color_class: "bg-[#0a4d8c]", display_order: items.length + 1, is_active: true,
  });

  const save = () => {
    if (!editing) return;
    startTransition(async () => {
      const res = await upsertFeature({
        id: editing.id as string | undefined,
        title: String(editing.title),
        description: String(editing.description ?? ""),
        icon_name: String(editing.icon_name),
        color_class: String(editing.color_class),
        display_order: Number(editing.display_order),
        is_active: Boolean(editing.is_active),
      });
      if (res.ok) {
        toast.success("Feature saved!");
        setEditing(null);
      } else toast.error(res.error || "Save failed");
    });
  };

  const remove = (id: string) => {
    if (!confirm("Delete this feature?")) return;
    startTransition(async () => {
      const res = await deleteFeature(id);
      if (res.ok) {
        toast.success("Deleted");
        setItems(items.filter(i => i.id !== id));
      } else toast.error(res.error || "Delete failed");
    });
  };

  return (
    <FormSection title="✨ Features" description="ল্যান্ডিং পেজের ৬টি ফিচার কার্ড">
      <div className="space-y-3">
        {items.map((it) => (
          <div key={String(it.id)} className="flex items-center justify-between gap-3 p-3 bg-slate-50 dark:bg-slate-800 rounded-md">
            <div className="flex-1">
              <div className="font-semibold text-sm">{String(it.title)}</div>
              <div className="text-xs text-slate-500">{String(it.description ?? "")}</div>
            </div>
            <div className="flex gap-1">
              <button onClick={() => setEditing(it)} className="p-1.5 text-blue-600 hover:bg-blue-50 dark:hover:bg-blue-950 rounded">
                <Pencil className="w-4 h-4" />
              </button>
              <button onClick={() => remove(String(it.id))} className="p-1.5 text-rose-600 hover:bg-rose-50 dark:hover:bg-rose-950 rounded">
                <Trash2 className="w-4 h-4" />
              </button>
            </div>
          </div>
        ))}

        <button onClick={startNew} className="flex items-center gap-1 text-sm text-indigo-600 hover:text-indigo-700">
          <Plus className="w-4 h-4" /> Add feature
        </button>

        {editing && (
          <div className="border-2 border-indigo-300 dark:border-indigo-700 rounded-lg p-4 space-y-3 bg-indigo-50/30 dark:bg-indigo-950/20">
            <div className="flex justify-between items-center">
              <h4 className="font-semibold text-sm">{editing.id ? "Edit feature" : "New feature"}</h4>
              <button onClick={() => setEditing(null)} className="p-1 text-slate-500">
                <X className="w-4 h-4" />
              </button>
            </div>
            <input
              value={String(editing.title ?? "")}
              onChange={(e) => setEditing({ ...editing, title: e.target.value })}
              placeholder="Title" className="w-full px-3 py-2 border rounded-md text-sm dark:bg-slate-800 dark:border-slate-700"
            />
            <input
              value={String(editing.description ?? "")}
              onChange={(e) => setEditing({ ...editing, description: e.target.value })}
              placeholder="Description" className="w-full px-3 py-2 border rounded-md text-sm dark:bg-slate-800 dark:border-slate-700"
            />
            <select
              value={String(editing.icon_name ?? "Sparkles")}
              onChange={(e) => setEditing({ ...editing, icon_name: e.target.value })}
              className="w-full px-3 py-2 border rounded-md text-sm dark:bg-slate-800 dark:border-slate-700"
            >
              {ICON_OPTIONS.map(n => <option key={n} value={n}>{n}</option>)}
            </select>
            <select
              value={String(editing.color_class ?? "bg-[#0a4d8c]")}
              onChange={(e) => setEditing({ ...editing, color_class: e.target.value })}
              className="w-full px-3 py-2 border rounded-md text-sm dark:bg-slate-800 dark:border-slate-700"
            >
              {COLOR_OPTIONS.map(c => <option key={c} value={c}>{c}</option>)}
            </select>
            <button onClick={save} disabled={isPending}
              className="flex items-center gap-2 px-4 py-2 bg-emerald-600 text-white text-sm rounded-md disabled:opacity-50">
              {isPending ? <Loader2 className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />}
              Save
            </button>
          </div>
        )}
      </div>
    </FormSection>
  );
}