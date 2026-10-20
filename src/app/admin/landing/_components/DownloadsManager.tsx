"use client";

import { useState, useTransition } from "react";
import { Plus, Pencil, Trash2 } from "lucide-react";
import { toast } from "sonner";
import { ImageUploader } from "./ImageUploader";
import { FormSection } from "./FormSection";
import { upsertDownload, deleteDownload } from "../actions";

export function DownloadsManager({ initial }: { initial: Record<string, unknown>[] }) {
  const [items, setItems] = useState(initial);
  const [editing, setEditing] = useState<Record<string, unknown> | null>(null);
  const [isPending, startTransition] = useTransition();

  const startNew = () => setEditing({ 
    title: "", 
    subtitle: "", 
    icon_color: "text-rose-500", 
    card_bg: "bg-rose-50", 
    card_border: "border-rose-200", 
    button_bg: "bg-rose-500", 
    file_url: "", 
    display_order: items.length + 1, 
    is_active: true 
  });

  const save = () => {
    if (!editing) return;
    startTransition(async () => {
      const res = await upsertDownload({
        id: editing.id as string | undefined, 
        title: String(editing.title), 
        subtitle: String(editing.subtitle ?? ""), 
        icon_color: String(editing.icon_color), 
        card_bg: String(editing.card_bg), 
        card_border: String(editing.card_border), 
        button_bg: String(editing.button_bg), 
        file_url: String(editing.file_url ?? ""), 
        display_order: Number(editing.display_order), 
        is_active: true,
      });
      if (res.ok) { 
        toast.success("Saved!"); 
        setEditing(null); 
        window.location.reload(); 
      } else {
        toast.error(res.error);
      }
    });
  };

  const remove = (id: string) => {
    if (!confirm("Are you sure you want to delete this?")) return;
    startTransition(async () => {
      const res = await deleteDownload(id);
      if (res.ok) { 
        toast.success("Deleted"); 
        setItems(items.filter(i => i.id !== id)); 
      } else {
        toast.error(res.error);
      }
    });
  };

  return (
    <FormSection title="📥 Downloads" description="পিডিএফ ফাইল আপলোড ও ম্যানেজ করুন">
      <div className="space-y-3">
        {items.map((it) => (
          <div key={String(it.id)} className="flex items-center justify-between p-3 bg-slate-50 dark:bg-slate-800 rounded-md">
            <div className="font-semibold text-sm">{String(it.title)}</div>
            <div className="flex gap-1">
              <button onClick={() => setEditing(it)} className="p-1.5 text-blue-600 hover:bg-blue-50 rounded"><Pencil className="w-4 h-4" /></button>
              <button onClick={() => remove(String(it.id))} className="p-1.5 text-rose-600 hover:bg-rose-50 rounded"><Trash2 className="w-4 h-4" /></button>
            </div>
          </div>
        ))}
        
        <button onClick={startNew} className="text-sm text-indigo-600 flex items-center gap-1 hover:underline">
          <Plus className="w-4 h-4" /> Add PDF
        </button>

        {editing && (
          <div className="border p-4 rounded-lg space-y-3 bg-slate-50 dark:bg-slate-900 mt-4">
            <input 
              value={String(editing.title ?? "")} 
              onChange={(e) => setEditing({ ...editing, title: e.target.value })} 
              placeholder="Title (e.g. Syllabus)" 
              className="w-full px-3 py-2 border rounded-md text-sm dark:bg-slate-800" 
            />
            <input 
              value={String(editing.subtitle ?? "")} 
              onChange={(e) => setEditing({ ...editing, subtitle: e.target.value })} 
              placeholder="Subtitle (e.g. PDF | Class Wise)" 
              className="w-full px-3 py-2 border rounded-md text-sm dark:bg-slate-800" 
            />
            <ImageUploader 
              bucket="downloads" 
              folder="pdfs" 
              currentUrl={String(editing.file_url ?? "")} 
              onUploaded={(url) => setEditing({ ...editing, file_url: url })} 
              label="PDF File" 
              accept="application/pdf" 
              previewClassName="w-16 h-16 rounded" 
            />
            <div className="flex gap-2 pt-2">
              <button onClick={save} disabled={isPending} className="px-4 py-2 bg-emerald-600 text-white rounded-md text-sm disabled:opacity-50">
                {isPending ? "Saving..." : "Save"}
              </button>
              <button onClick={() => setEditing(null)} className="px-4 py-2 bg-slate-300 text-slate-800 rounded-md text-sm">
                Cancel
              </button>
            </div>
          </div>
        )}
      </div>
    </FormSection>
  );
}