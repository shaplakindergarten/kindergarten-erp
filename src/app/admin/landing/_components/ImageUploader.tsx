"use client";

import { useState, useTransition, useRef } from "react";
import Image from "next/image";
import { Upload, Loader2, X, ImageIcon } from "lucide-react";
import { createClient } from "@/lib/supabase/client";
import { toast } from "sonner";

interface Props {
  bucket: "landing-assets" | "gallery" | "downloads" | "school-assets";
  currentUrl?: string | null;
  onUploaded: (url: string) => void;
  folder?: string;
  label?: string;
  accept?: string;
  previewClassName?: string;
  maxSizeMB?: number;
}

export function ImageUploader({
  bucket,
  currentUrl,
  onUploaded,
  folder = "",
  label = "Upload image",
  accept = "image/*",
  previewClassName = "w-32 h-32 rounded-lg",
  maxSizeMB = 5,
}: Props) {
  const supabase = createClient();
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [preview, setPreview] = useState<string | null>(currentUrl ?? null);
  const [isPending, startTransition] = useTransition();

  const handleUpload = (file: File) => {
    if (file.size > maxSizeMB * 1024 * 1024) {
      toast.error(`File too large. Max ${maxSizeMB}MB.`);
      return;
    }

    startTransition(async () => {
      try {
        const ext = file.name.split(".").pop() || "bin";
        const fileName = `${Date.now()}-${Math.random().toString(36).slice(2, 8)}.${ext}`;
        const path = folder ? `${folder}/${fileName}` : fileName;

        const { error: uploadErr } = await supabase.storage
          .from(bucket)
          .upload(path, file, { cacheControl: "3600", upsert: false });

        if (uploadErr) throw uploadErr;

        const { data } = supabase.storage.from(bucket).getPublicUrl(path);
        setPreview(data.publicUrl);
        onUploaded(data.publicUrl);
        toast.success("Image uploaded!");
      } catch (err) {
        console.error(err);
        toast.error(err instanceof Error ? err.message : "Upload failed");
      }
    });
  };

  return (
    <div className="space-y-2">
      <label className="block text-sm font-medium text-slate-700 dark:text-slate-300">
        {label}
      </label>
      <div className="flex items-start gap-3">
        <div className={`relative ${previewClassName} overflow-hidden border-2 border-dashed border-slate-300 dark:border-slate-600 bg-slate-50 dark:bg-slate-800 flex items-center justify-center shrink-0`}>
          {preview ? (
            <>
              <Image src={preview} alt="Preview" fill className="object-cover" sizes="128px" />
              <button
                type="button"
                onClick={() => { setPreview(null); onUploaded(""); }}
                className="absolute top-1 right-1 bg-rose-500 text-white rounded-full p-0.5 hover:bg-rose-600"
                aria-label="Remove image"
              >
                <X className="w-3 h-3" />
              </button>
            </>
          ) : (
            <ImageIcon className="w-8 h-8 text-slate-400" />
          )}
        </div>
        <div className="flex-1">
          <input
            ref={fileInputRef}
            type="file"
            accept={accept}
            className="hidden"
            onChange={(e) => {
              const f = e.target.files?.[0];
              if (f) handleUpload(f);
            }}
          />
          <button
            type="button"
            disabled={isPending}
            onClick={() => fileInputRef.current?.click()}
            className="flex items-center gap-2 px-3 py-2 bg-indigo-600 hover:bg-indigo-700 disabled:opacity-50 text-white text-sm rounded-md transition"
          >
            {isPending ? <Loader2 className="w-4 h-4 animate-spin" /> : <Upload className="w-4 h-4" />}
            {isPending ? "Uploading..." : "Choose file"}
          </button>
          <p className="text-[11px] text-slate-500 dark:text-slate-400 mt-1">
            Max {maxSizeMB}MB • {accept.includes("pdf") ? "PDF/Image" : "JPG, PNG, WebP"}
          </p>
        </div>
      </div>
    </div>
  );
}