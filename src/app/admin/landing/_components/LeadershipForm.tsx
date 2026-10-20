"use client";

import { useState, useTransition } from "react";
import { Loader2, Save } from "lucide-react";
import { toast } from "sonner";
import { ImageUploader } from "./ImageUploader";
import { FormSection } from "./FormSection";
import { saveLandingSettings } from "../actions";

type Row = Record<string, unknown> | null;

export function LeadershipForm({ initial }: { initial: Row }) {
  const [isPending, startTransition] = useTransition();
  const [dName, setDName] = useState((initial?.director_name as string) ?? "");
  const [dTitle, setDTitle] = useState((initial?.director_title as string) ?? "Director");
  const [dQuote, setDQuote] = useState((initial?.director_quote as string) ?? "");
  const [dPhoto, setDPhoto] = useState((initial?.director_photo_url as string) ?? "");

  const [hName, setHName] = useState((initial?.head_teacher_name as string) ?? "");
  const [hTitle, setHTitle] = useState((initial?.head_teacher_title as string) ?? "Head Teacher");
  const [hQuote, setHQuote] = useState((initial?.head_teacher_quote as string) ?? "");
  const [hPhoto, setHPhoto] = useState((initial?.head_teacher_photo_url as string) ?? "");

  const save = () => {
    startTransition(async () => {
      const res = await saveLandingSettings({
        director_name: dName,
        director_title: dTitle,
        director_quote: dQuote,
        director_photo_url: dPhoto,
        head_teacher_name: hName,
        head_teacher_title: hTitle,
        head_teacher_quote: hQuote,
        head_teacher_photo_url: hPhoto,
      });
      if (res.ok) toast.success("Leadership saved!");
      else toast.error(res.error || "Save failed");
    });
  };

  return (
    <FormSection title="👔 Leadership" description="পরিচালক ও প্রধান শিক্ষকের তথ্য">
      <div className="space-y-6">
        {/* Director */}
        <div className="space-y-3">
          <h3 className="text-sm font-semibold text-slate-700 dark:text-slate-300">Director</h3>
          <ImageUploader
            bucket="landing-assets"
            folder="leadership"
            currentUrl={dPhoto}
            onUploaded={setDPhoto}
            label="Director photo"
            previewClassName="w-24 h-24 rounded-full"
          />
          <input value={dName} onChange={(e) => setDName(e.target.value)}
            placeholder="Director name" className="w-full px-3 py-2 border rounded-md text-sm dark:bg-slate-800 dark:border-slate-700" />
          <input value={dTitle} onChange={(e) => setDTitle(e.target.value)}
            placeholder="Designation" className="w-full px-3 py-2 border rounded-md text-sm dark:bg-slate-800 dark:border-slate-700" />
          <textarea value={dQuote} onChange={(e) => setDQuote(e.target.value)}
            placeholder="Quote (optional)" rows={2}
            className="w-full px-3 py-2 border rounded-md text-sm dark:bg-slate-800 dark:border-slate-700" />
        </div>

        {/* Head Teacher */}
        <div className="space-y-3 pt-4 border-t border-slate-200 dark:border-slate-800">
          <h3 className="text-sm font-semibold text-slate-700 dark:text-slate-300">Head Teacher</h3>
          <ImageUploader
            bucket="landing-assets"
            folder="leadership"
            currentUrl={hPhoto}
            onUploaded={setHPhoto}
            label="Head teacher photo"
            previewClassName="w-24 h-24 rounded-full"
          />
          <input value={hName} onChange={(e) => setHName(e.target.value)}
            placeholder="Head teacher name" className="w-full px-3 py-2 border rounded-md text-sm dark:bg-slate-800 dark:border-slate-700" />
          <input value={hTitle} onChange={(e) => setHTitle(e.target.value)}
            placeholder="Designation" className="w-full px-3 py-2 border rounded-md text-sm dark:bg-slate-800 dark:border-slate-700" />
          <textarea value={hQuote} onChange={(e) => setHQuote(e.target.value)}
            placeholder="Quote (optional)" rows={2}
            className="w-full px-3 py-2 border rounded-md text-sm dark:bg-slate-800 dark:border-slate-700" />
        </div>

        <button onClick={save} disabled={isPending}
          className="flex items-center gap-2 px-4 py-2 bg-emerald-600 hover:bg-emerald-700 disabled:opacity-50 text-white text-sm rounded-md">
          {isPending ? <Loader2 className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />}
          {isPending ? "Saving..." : "Save"}
        </button>
      </div>
    </FormSection>
  );
}