"use client";

import { useState, useTransition } from "react";
import Image from "next/image";
import { Trash2 } from "lucide-react";
import { toast } from "sonner";
import { ImageUploader } from "./ImageUploader";
import { FormSection } from "./FormSection";
import { addGalleryImage, deleteGalleryImage } from "../actions";

export function GalleryManager({ initial }: { initial: Record<string, unknown>[] }) {
  const [items, setItems] = useState(initial);
  const [newCaption, setNewCaption] = useState("");
  const [isPending, startTransition] = useTransition();

  const handleUpload = (url: string) => {
    if (!url) return;
    startTransition(async () => {
      const res = await addGalleryImage({ 
        image_url: url, 
        alt_text: newCaption || "Gallery", 
        caption: newCaption, 
        display_order: items.length + 1 
      });
      if (res.ok) { 
        toast.success("Added!"); 
        setNewCaption(""); 
        window.location.reload(); 
      } else {
        toast.error(res.error);
      }
    });
  };

  const remove = (id: string) => {
    if (!confirm("Delete this image?")) return;
    startTransition(async () => {
      const res = await deleteGalleryImage(id);
      if (res.ok) { 
        toast.success("Deleted"); 
        setItems(items.filter(i => i.id !== id)); 
      } else {
        toast.error(res.error);
      }
    });
  };

  return (
    <FormSection title="🖼️ Gallery" description="স্কুলের ছবি">
      <div className="grid grid-cols-3 sm:grid-cols-4 gap-3 mb-6">
        {items.map((it) => (
          <div key={String(it.id)} className="relative group aspect-square rounded-lg overflow-hidden border border-slate-200">
            <Image src={String(it.image_url)} alt={String(it.alt_text ?? "")} fill className="object-cover" sizes="150px" />
            <button
              onClick={() => remove(String(it.id))}
              className="absolute top-1 right-1 bg-rose-600 text-white rounded-full p-1 opacity-0 group-hover:opacity-100 transition"
            >
              <Trash2 className="w-3.5 h-3.5" />
            </button>
          </div>
        ))}
      </div>

      <div className="border-2 border-dashed border-slate-300 dark:border-slate-700 rounded-lg p-4 space-y-3">
        <h4 className="text-sm font-semibold">Add new image</h4>
        <input 
          value={newCaption} 
          onChange={(e) => setNewCaption(e.target.value)}
          placeholder="Caption (optional)" 
          className="w-full px-3 py-2 border rounded-md text-sm dark:bg-slate-800 dark:border-slate-700" 
        />
        <ImageUploader
          bucket="gallery"
          folder=""
          currentUrl=""
          onUploaded={handleUpload}
          label="Choose image to upload"
          previewClassName="w-24 h-24 rounded"
        />
        {isPending && <p className="text-xs text-indigo-600 mt-2">Uploading...</p>}
      </div>
    </FormSection>
  );
}