// src/app/admission/success/page.tsx
"use client";

import { useSearchParams } from "next/navigation";
import Link from "next/link";
import { CheckCircle, Copy, Home, Printer, Clock } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { useState, Suspense } from "react";

function SuccessContent() {
  const searchParams = useSearchParams();
  const referenceNo = searchParams.get("ref") || "N/A";
  const [copied, setCopied] = useState(false);

  const handleCopy = async () => {
    try {
      await navigator.clipboard.writeText(referenceNo);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch (err) {
      console.error("Copy failed:", err);
    }
  };

  const handlePrint = () => {
    window.print();
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-emerald-50 via-slate-50 to-blue-50 dark:from-slate-950 dark:via-slate-900 dark:to-slate-950 flex items-center justify-center p-4">
      <Card className="max-w-2xl w-full shadow-2xl border-0">
        <CardContent className="p-8 md:p-12">
          {/* Success Icon */}
          <div className="flex justify-center mb-6">
            <div className="relative">
              <div className="w-24 h-24 rounded-full bg-emerald-100 dark:bg-emerald-950/50 flex items-center justify-center animate-pulse">
                <CheckCircle className="w-14 h-14 text-emerald-600 dark:text-emerald-400" />
              </div>
              <div className="absolute -top-1 -right-1 w-8 h-8 rounded-full bg-emerald-500 text-white flex items-center justify-center shadow-lg">
                <span className="text-lg">✓</span>
              </div>
            </div>
          </div>

          {/* Header */}
          <div className="text-center mb-8">
            <h1 className="text-3xl md:text-4xl font-bold text-emerald-700 dark:text-emerald-400 mb-3">
              🎉 আবেদন সফলভাবে জমা হয়েছে!
            </h1>
            <p className="text-slate-600 dark:text-slate-400 text-sm md:text-base">
              আপনার ভর্তি আবেদনটি আমাদের কাছে পৌঁছেছে
            </p>
          </div>

          {/* Reference Box */}
          <div className="bg-gradient-to-r from-blue-50 to-indigo-50 dark:from-blue-950/30 dark:to-indigo-950/30 border-2 border-blue-200 dark:border-blue-800 rounded-2xl p-6 mb-6">
            <p className="text-center text-xs font-semibold text-blue-700 dark:text-blue-400 uppercase tracking-wider mb-2">
              আপনার রেফারেন্স নম্বর
            </p>
            <div className="flex items-center justify-center gap-3">
              <p className="text-2xl md:text-3xl font-mono font-bold text-blue-900 dark:text-blue-300 tracking-wider">
                {referenceNo}
              </p>
              <button
                onClick={handleCopy}
                className="p-2 rounded-lg bg-white dark:bg-slate-800 border border-blue-300 dark:border-blue-700 hover:bg-blue-50 dark:hover:bg-blue-950/50 transition"
                title="কপি করুন"
              >
                {copied ? (
                  <CheckCircle className="w-4 h-4 text-emerald-600" />
                ) : (
                  <Copy className="w-4 h-4 text-blue-600" />
                )}
              </button>
            </div>
            {copied && (
              <p className="text-center text-xs text-emerald-600 mt-2 font-medium">
                ✓ কপি হয়েছে!
              </p>
            )}
            <p className="text-center text-xs text-blue-600 dark:text-blue-400 mt-3">
              ⚠️ এই নম্বরটি সংরক্ষণ করুন — ভবিষ্যতে প্রয়োজন হবে
            </p>
          </div>

          {/* What's Next */}
          <div className="bg-amber-50 dark:bg-amber-950/20 border-l-4 border-amber-500 rounded-lg p-4 mb-6">
            <div className="flex items-start gap-3">
              <Clock className="w-5 h-5 text-amber-600 shrink-0 mt-0.5" />
              <div>
                <p className="font-bold text-amber-900 dark:text-amber-200 text-sm">
                  পরবর্তী পদক্ষেপ
                </p>
                <ul className="mt-2 space-y-1 text-xs text-amber-800 dark:text-amber-300">
                  <li>• আমাদের টিম ২৪-৪৮ ঘণ্টার মধ্যে আপনার আবেদন পর্যালোচনা করবে</li>
                  <li>• অনুমোদিত হলে SMS বা ফোনে জানানো হবে</li>
                  <li>• অনুমোদনের পর শ্রেণি ও ফি সম্পর্কে বিস্তারিত জানতে পারবেন</li>
                  <li>• যেকোনো তথ্যের জন্য যোগাযোগ: <strong>01923253454</strong></li>
                </ul>
              </div>
            </div>
          </div>

          {/* Actions */}
          <div className="flex flex-wrap gap-3 justify-center">
            <Button
              onClick={handlePrint}
              variant="outline"
              className="min-w-[140px]"
            >
              <Printer className="w-4 h-4 mr-2" />
              প্রিন্ট করুন
            </Button>
            <Link href="/">
              <Button className="bg-emerald-600 hover:bg-emerald-700 min-w-[140px]">
                <Home className="w-4 h-4 mr-2" />
                হোমে ফিরে যান
              </Button>
            </Link>
          </div>

          {/* Footer */}
          <div className="mt-8 pt-6 border-t border-slate-200 dark:border-slate-800 text-center">
            <p className="text-xs text-slate-500 dark:text-slate-400">
              শাপলা কিন্ডারগার্টেন এন্ড প্রি-ক্যাডেট
            </p>
            <p className="text-xs text-slate-400 dark:text-slate-500 mt-1">
              শিক্ষা • শৃঙ্খলা • সুন্দর ভবিষ্যৎ
            </p>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}

export default function AdmissionSuccessPage() {
  return (
    <Suspense fallback={
      <div className="min-h-screen flex items-center justify-center">
        <div className="text-center">
          <div className="w-12 h-12 border-4 border-emerald-500 border-t-transparent rounded-full animate-spin mx-auto" />
          <p className="text-sm text-slate-500 mt-3">লোড হচ্ছে...</p>
        </div>
      </div>
    }>
      <SuccessContent />
    </Suspense>
  );
}