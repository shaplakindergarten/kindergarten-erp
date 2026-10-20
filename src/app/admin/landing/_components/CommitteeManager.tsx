// src/app/admin/landing/_components/CommitteeManager.tsx
"use client";

import { useState, useTransition } from "react";
import { Plus, Pencil, Trash2 } from "lucide-react";
import { toast } from "sonner";
import { ImageUploader } from "./ImageUploader";
import { FormSection } from "./FormSection";
import { upsertCommittee, deleteCommittee } from "../actions";

export function CommitteeManager({ initial }: { initial: Record<string, unknown>[] }) {
  const [items, setItems] = useState(initial);
  const [editing, setEditing] = useState<Record<string, unknown> | null>(null);
  const [isPending, startTransition] = useTransition();

  const startNew = () => setEditing({ name: "", role: "", phone: "", photo_url: "", display_order: items.length + 1 });

  const save = () => {
    if (!editing) return;
    startTransition(async () => {
      const res = await upsertCommittee({
        id: editing.id as string | undefined,
        name: String(editing.name),
        role: String(editing.role),
        phone: String(editing.phone ?? ""),
        photo_url: String(editing.photo_url ?? ""),
        display_order: Number(editing.display_order),
      });
      if (res.ok) { toast.success("Saved!"); setEditing(null); window.location.reload(); } else toast.error(res.error);
    });
  };

  const remove = (id: string) => {
    if (!confirm("Delete?")) return;
    startTransition(async () => {
      const res = await deleteCommittee(id);
      if (res.ok) { toast.success("Deleted"); setItems(items.filter(i => i.id !== id)); } else toast.error(res.error);
    });
  };

  return (
    <FormSection title="👔 পরিচালকবৃন্দ (Committee)" description="পরিচালকদের তালিকা">
      <div className="space-y-3">
        {items.map((it) => (
          <div key={String(it.id)} className="flex items-center justify-between p-3 bg-slate-50 dark:bg-slate-800 rounded-md">
            <div className="font-semibold text-sm">{String(it.name)} ({String(it.role)})</div>
            <div className="flex gap-1">
              <button onClick={() => setEditing(it)} className="p-1.5 text-blue-600"><Pencil className="w-4 h-4" /></button>
              <button onClick={() => remove(String(it.id))} className="p-1.5 text-rose-600"><Trash2 className="w-4 h-4" /></button>
            </div>
          </div>
        ))}
        <button onClick={startNew} className="text-sm text-indigo-600 flex items-center gap-1"><Plus className="w-4 h-4" /> Add Member</button>
        {editing && (
          <div className="border p-4 rounded-lg space-y-3 bg-slate-50 dark:bg-slate-900">
            <input value={String(editing.name ?? "")} onChange={(e) => setEditing({ ...editing, name: e.target.value })} placeholder="Name" className="w-full px-3 py-2 border rounded-md text-sm" />
            <input value={String(editing.role ?? "")} onChange={(e) => setEditing({ ...editing, role: e.target.value })} placeholder="Role" className="w-full px-3 py-2 border rounded-md text-sm" />
            <input value={String(editing.phone ?? "")} onChange={(e) => setEditing({ ...editing, phone: e.target.value })} placeholder="Phone" className="w-full px-3 py-2 border rounded-md text-sm" />
            <ImageUploader bucket="landing-assets" folder="committee" currentUrl={String(editing.photo_url ?? "")} onUploaded={(url) => setEditing({ ...editing, photo_url: url })} label="Photo" previewClassName="w-16 h-16 rounded-full" />
            <div className="flex gap-2">
              <button onClick={save} disabled={isPending} className="px-4 py-2 bg-emerald-600 text-white rounded-md">Save</button>
              <button onClick={() => setEditing(null)} className="px-4 py-2 bg-slate-300 rounded-md">Cancel</button>
            </div>
          </div>
        )}
      </div>
    </FormSection>
  );
}