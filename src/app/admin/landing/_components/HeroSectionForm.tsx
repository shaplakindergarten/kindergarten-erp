"use client";

import { useState, useTransition } from "react";
import { Loader2, Save } from "lucide-react";
import { toast } from "sonner";
import { ImageUploader } from "./ImageUploader";
import { FormSection } from "./FormSection";
import { saveLandingSettings } from "../actions";

type Row = Record<string, unknown> | null;

export function HeroSectionForm({ initial }: { initial: Row }) {
  const [isPending, startTransition] = useTransition();
  const [heroImageUrl, setHeroImageUrl] = useState<string>(
    (initial?.hero_image_url as string) ?? ""
  );
  const [heroCaption, setHeroCaption] = useState<string>(
    (initial?.hero_caption as string) ?? ""
  );
  const [tagline, setTagline] = useState<string>(
    (initial?.tagline as string) ?? ""
  );

  const save = () => {
    startTransition(async () => {
      const res = await saveLandingSettings({
        hero_image_url: heroImageUrl,
        hero_caption: heroCaption,
        tagline,
      });
      if (res.ok) toast.success("Hero section saved!");
      else toast.error(res.error || "Save failed");
    });
  };

  return (
    <FormSection title="📸 Hero Section" description="মূল ছবি, ক্যাপশন ও ট্যাগলাইন">
      <div className="space-y-4">
        <ImageUploader
          bucket="landing-assets"
          folder="hero"
          currentUrl={heroImageUrl}
          onUploaded={setHeroImageUrl}
          label="Hero image (main school photo)"
          previewClassName="w-40 h-28 rounded-lg"
        />
        <div>
          <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1">
            Hero caption (overlay text)
          </label>
          <input
            type="text"
            value={heroCaption}
            onChange={(e) => setHeroCaption(e.target.value)}
            className="w-full px-3 py-2 border border-slate-300 dark:border-slate-700 dark:bg-slate-800 rounded-md text-sm"
            placeholder="e.g. শিক্ষাই সর্বোত্তম সম্পদ"
          />
        </div>
        <div>
          <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1">
            Tagline (shown next to logo)
          </label>
          <input
            type="text"
            value={tagline}
            onChange={(e) => setTagline(e.target.value)}
            className="w-full px-3 py-2 border border-slate-300 dark:border-slate-700 dark:bg-slate-800 rounded-md text-sm"
            placeholder="e.g. শিক্ষা • শৃঙ্খলা • সুন্দর ভবিষ্যৎ"
          />
        </div>
        <button
          onClick={save}
          disabled={isPending}
          className="flex items-center gap-2 px-4 py-2 bg-emerald-600 hover:bg-emerald-700 disabled:opacity-50 text-white text-sm rounded-md"
        >
          {isPending ? <Loader2 className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />}
          {isPending ? "Saving..." : "Save"}
        </button>
      </div>
    </FormSection>
  );
}