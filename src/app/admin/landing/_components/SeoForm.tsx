"use client";

import { useState, useTransition } from "react";
import { Loader2, Save } from "lucide-react";
import { toast } from "sonner";
import { ImageUploader } from "./ImageUploader";
import { FormSection } from "./FormSection";
import { saveLandingSettings } from "../actions";

type Row = Record<string, unknown> | null;

export function SeoForm({ initial }: { initial: Row }) {
  const [isPending, startTransition] = useTransition();
  const [metaTitle, setMetaTitle] = useState((initial?.meta_title as string) ?? "");
  const [metaDesc, setMetaDesc] = useState((initial?.meta_description as string) ?? "");
  const [metaKeywords, setMetaKeywords] = useState((initial?.meta_keywords as string) ?? "");
  const [favicon, setFavicon] = useState((initial?.favicon_url as string) ?? "");
  const [footerText, setFooterText] = useState((initial?.footer_text as string) ?? "");

  const save = () => {
    startTransition(async () => {
      const res = await saveLandingSettings({
        meta_title: metaTitle,
        meta_description: metaDesc,
        meta_keywords: metaKeywords,
        favicon_url: favicon,
        footer_text: footerText,
      });
      if (res.ok) toast.success("SEO saved!");
      else toast.error(res.error || "Save failed");
    });
  };

  return (
    <FormSection title="🔍 SEO & Metadata" description="ব্রাউজার ট্যাব, সার্চ ইঞ্জিন ও ফুটার">
      <div className="space-y-4">
        <div>
          <label className="block text-sm font-medium mb-1">Browser tab title</label>
          <input value={metaTitle} onChange={(e) => setMetaTitle(e.target.value)}
            className="w-full px-3 py-2 border rounded-md text-sm dark:bg-slate-800 dark:border-slate-700" />
        </div>
        <div>
          <label className="block text-sm font-medium mb-1">Meta description (search engines)</label>
          <textarea value={metaDesc} onChange={(e) => setMetaDesc(e.target.value)} rows={2}
            className="w-full px-3 py-2 border rounded-md text-sm dark:bg-slate-800 dark:border-slate-700" />
        </div>
        <div>
          <label className="block text-sm font-medium mb-1">Meta keywords (comma-separated)</label>
          <input value={metaKeywords} onChange={(e) => setMetaKeywords(e.target.value)}
            className="w-full px-3 py-2 border rounded-md text-sm dark:bg-slate-800 dark:border-slate-700" />
        </div>
        <ImageUploader
          bucket="landing-assets"
          folder="favicon"
          currentUrl={favicon}
          onUploaded={setFavicon}
          label="Favicon (.ico / .png)"
          accept="image/*,.ico"
          previewClassName="w-12 h-12 rounded"
        />
        <div>
          <label className="block text-sm font-medium mb-1">Footer copyright text</label>
          <input value={footerText} onChange={(e) => setFooterText(e.target.value)}
            className="w-full px-3 py-2 border rounded-md text-sm dark:bg-slate-800 dark:border-slate-700"
            placeholder="All rights reserved." />
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