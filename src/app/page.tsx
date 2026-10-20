import Link from "next/link";
import { redirect } from "next/navigation";
import Image from "next/image";
import {
  Home,
  BookOpen,
  Download,
  Users,
  GraduationCap,
  Image as ImageIcon,
  Phone,
  UserCheck,
  Monitor,
  Shield,
  Heart,
  Trophy,
  MapPin,
  Mail,
  Target,
  FileText,
  LogIn,
  Megaphone,
  User,
  Pin,
  CheckCircle2,
  Award,
  School,
  Library,
  Sparkles,
  Star,
  Music,
  Palette,
  Calculator,
  Globe,
  type LucideIcon
} from "lucide-react";
import { createClient } from "@/lib/supabase/server";

// ─── Lucide icon whitelist (safe dynamic mapping) ─────────────
const ICON_MAP: Record<string, LucideIcon> = {
  Monitor,
  Shield,
  BookOpen,
  Users,
  Heart,
  Trophy,
  Sparkles,
  Star,
  Music,
  Palette,
  Calculator,
  Globe,
  GraduationCap,
  Award,
  School,
  FileText,
  Download,
  ImageIcon,
  Target,
  CheckCircle2,
};

const getIcon = (name: string | null | undefined): LucideIcon =>
  (name && ICON_MAP[name]) || Sparkles;

// ─── Tiny helpers ─────────────────────────────────────────────
type Row = Record<string, unknown>;
const first = (row: Row | null | undefined, keys: string[], fallback = ""): string => {
  if (!row) return fallback;
  for (const key of keys) {
    const v = row[key];
    if (v !== null && v !== undefined && String(v).trim() !== "") return String(v);
  }
  return fallback;
};
const arr = (v: unknown): string[] =>
  Array.isArray(v) ? v.map(String).filter(Boolean) : [];

// ─── Safe Image Component ─────────────────────────────────────
function SafeImage({
  src,
  alt,
  fill,
  className,
  sizes,
  priority,
}: {
  src?: string | null;
  alt: string;
  fill?: boolean;
  className?: string;
  sizes?: string;
  priority?: boolean;
}) {
  if (!src) {
    return (
      <div className={`${className ?? ""} flex items-center justify-center bg-slate-200 dark:bg-slate-800 text-slate-400`}>
        <ImageIcon className="w-1/3 h-1/3 opacity-40" />
      </div>
    );
  }
  return (
    <Image
      src={src}
      alt={alt}
      fill={fill}
      width={fill ? undefined : 100}
      height={fill ? undefined : 100}
      sizes={sizes}
      priority={priority}
      className={className}
    />
  );
}

export default async function HomePage() {
  const supabase = await createClient();

  const { data: { user } } = await supabase.auth.getUser();
  if (user) redirect("/dashboard");

  // ── Fetch all dynamic data ────────────────────────────
  const [
    landingRes,
    schoolRes,
    noticesRes,
    classesRes,
    staffRes,
    featuresRes,
    downloadsRes,
    galleryRes,
    committeeRes
  ] = await Promise.all([
    supabase.from("landing_settings").select("*").eq("id", 1).maybeSingle(),
    supabase.from("school_settings").select("school_name, school_address, school_phone, school_email, school_logo").limit(1).maybeSingle(),
    supabase.from("notices").select("id, title, content, created_at, type").order("created_at", { ascending: false }).limit(5),
    supabase.from("classes").select("*").order("numeric_order", { ascending: true }),
    supabase.from("staff").select("*").neq("status", "resigned").limit(20),
    supabase.from("school_features").select("*").eq("is_active", true).order("display_order", { ascending: true }),
    supabase.from("download_items").select("*").eq("is_active", true).order("display_order", { ascending: true }),
    supabase.from("gallery_images").select("*").eq("is_active", true).order("display_order", { ascending: true }).limit(6),
    supabase.from("landing_committee").select("*").eq("is_active", true).order("display_order", { ascending: true }),
  ]);

  // ── Data Mapping (No Fallbacks) ────────────────────────────
  const landing = landingRes.data;
  const school = schoolRes.data;

  const schoolName = first(school, ["school_name"], "KinderERP School");
  const schoolAddress = first(school, ["school_address"], "");
  const schoolPhone = first(school, ["school_phone"], "");
  const schoolEmail = first(school, ["school_email"], "");
  const schoolLogo = first(school, ["school_logo"], "");
  
  const heroImage = first(landing, ["hero_image_url"], "");
  const heroCaption = first(landing, ["hero_caption"], "");
  const footerText = first(landing, ["footer_text"], "All rights reserved.");
  
  const goals = arr(landing?.goals);
  const targets = arr(landing?.targets);

  const director = {
    name: first(landing, ["director_name"], ""),
    title: first(landing, ["director_title"], ""),
    quote: first(landing, ["director_quote"], ""),
    photo: first(landing, ["director_photo_url"], ""),
  };
  const headTeacher = {
    name: first(landing, ["head_teacher_name"], ""),
    title: first(landing, ["head_teacher_title"], ""),
    quote: first(landing, ["head_teacher_quote"], ""),
    photo: first(landing, ["head_teacher_photo_url"], ""),
  };

  const mediumTitle = first(landing, ["medium_title"], "");
  const mediumSubtitle = first(landing, ["medium_subtitle"], "");
  const mediumQuote = first(landing, ["medium_quote"], "");

  // Classes
  const classList = (classesRes.data || []).map((c: any, idx: number) => {
    const palette = [
      "bg-sky-100 dark:bg-sky-900/40 text-sky-800 dark:text-sky-200 border-sky-300",
      "bg-emerald-100 dark:bg-emerald-900/40 text-emerald-800 dark:text-emerald-200 border-emerald-300",
      "bg-amber-100 dark:bg-amber-900/40 text-amber-800 dark:text-amber-200 border-amber-300",
      "bg-rose-100 dark:bg-rose-900/40 text-rose-800 dark:text-rose-200 border-rose-300",
      "bg-purple-100 dark:bg-purple-900/40 text-purple-800 dark:text-purple-200 border-purple-300",
      "bg-cyan-100 dark:bg-cyan-900/40 text-cyan-800 dark:text-cyan-200 border-cyan-300",
    ];
    return {
      name: first(c, ["name", "class_name"], ""),
      age: first(c, ["age_group", "section"], ""),
      bg: palette[idx % palette.length],
    };
  });

  // Staff
  const staffList = (staffRes.data || []).map((s: any, idx: number) => ({
    sl: idx + 1,
    name: first(s, ["name", "full_name"], ""),
    role: first(s, ["designation", "role"], ""),
    phone: first(s, ["phone", "mobile", "contact"], ""),
    photo: first(s, ["photo_url", "photo", "avatar_url"], ""),
  }));

  // Committee
  const committeeList = (committeeRes.data || []).map((c: any, idx: number) => ({
    sl: idx + 1,
    name: c.name,
    role: c.role,
    phone: c.phone || "",
    photo: c.photo_url || "",
  }));

  // Features
  const features = (featuresRes.data || []).map((f: any) => ({
    icon: getIcon(f.icon_name),
    title: f.title,
    desc: f.description,
    color: f.color_class || "bg-[#0a4d8c]",
  }));

  // Downloads
  const downloadItems = (downloadsRes.data || []).map((d: any) => ({
    name: d.title, 
    tag: d.subtitle, 
    iconColor: d.icon_color, 
    cardBg: d.card_bg, 
    cardBorder: d.card_border,
    btnBg: d.button_bg, 
    url: d.file_url
  }));

  // Gallery
  const galleryImages = (galleryRes.data || []).map((g: any) => g.image_url);

  return (
    <div className="min-h-screen bg-slate-50 dark:bg-slate-900 text-slate-800 dark:text-slate-100 font-sans transition-colors duration-200">
      
      {/* ═══════════ HEADER BAR ═══════════ */}
      <header className="bg-gradient-to-r from-[#0a4d8c] via-[#0d5ca8] to-[#0a4d8c] text-white">
        <div className="max-w-7xl mx-auto px-4 py-2.5">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div className="flex items-center gap-3">
              <div className="relative w-12 h-12 rounded-full border-2 border-white/40 bg-white flex items-center justify-center overflow-hidden shrink-0 shadow-lg">
                {schoolLogo ? (
                  <Image src={schoolLogo} alt="Logo" fill className="object-cover" sizes="48px" />
                ) : (
                  <GraduationCap className="w-7 h-7 text-[#0a4d8c]" />
                )}
              </div>
              <div>
                <h1 className="text-base md:text-lg font-bold text-white tracking-tight leading-tight">{schoolName}</h1>
                <p className="text-[10px] md:text-xs font-medium text-blue-100 flex items-center gap-2">
                  <span>শিক্ষা</span>
                  <span className="w-1 h-1 rounded-full bg-blue-300"></span>
                  <span>শৃঙ্খলা</span>
                  <span className="w-1 h-1 rounded-full bg-blue-300"></span>
                  <span>সুন্দর ভবিষ্যৎ</span>
                </p>
              </div>
            </div>
            <div className="hidden lg:flex items-center gap-5 text-xs text-blue-50">
              <div className="flex items-center gap-1.5"><MapPin className="w-4 h-4 text-emerald-300" /><span>{schoolAddress}</span></div>
              <div className="flex items-center gap-1.5"><Phone className="w-4 h-4 text-emerald-300" /><span>{schoolPhone}</span></div>
              <div className="flex items-center gap-1.5"><Mail className="w-4 h-4 text-emerald-300" /><span>{schoolEmail}</span></div>
            </div>
            <div className="flex items-center gap-2">
              <Link href="/admission" className="flex items-center gap-1.5 bg-emerald-500 hover:bg-emerald-600 text-white font-bold px-3.5 py-1.5 rounded-md text-xs transition shadow-md">
                <UserCheck className="w-3.5 h-3.5" /> অনলাইন ভর্তি
              </Link>
              <Link href="/login" className="flex items-center gap-1.5 bg-amber-500 hover:bg-amber-600 text-slate-900 font-bold px-3.5 py-1.5 rounded-md text-xs transition shadow-md">
                <LogIn className="w-3.5 h-3.5" /> লগইন করুন
              </Link>
            </div>
          </div>
        </div>
      </header>

      {/* ═══════════ NAVIGATION BAR ═══════════ */}
      <nav className="bg-[#0a4d8c] text-white sticky top-0 z-50 shadow-lg border-t border-blue-700/50">
        <div className="max-w-7xl mx-auto px-4">
          <div className="flex items-center gap-1 overflow-x-auto whitespace-nowrap scrollbar-none text-xs md:text-[13px] font-medium">
            <Link href="#" className="flex items-center gap-1.5 px-3.5 py-2.5 bg-[#083b6b] text-white hover:bg-[#062f56] transition rounded-sm"><Home className="w-3.5 h-3.5" /> হোম</Link>
            <a href="#about" className="flex items-center gap-1.5 px-3.5 py-2.5 hover:bg-[#083b6b] transition"><Users className="w-3.5 h-3.5" /> আমাদের সম্পর্কে</a>
            <a href="#academic" className="flex items-center gap-1.5 px-3.5 py-2.5 hover:bg-[#083b6b] transition"><BookOpen className="w-3.5 h-3.5" /> একাডেমিক</a>
            <a href="#downloads" className="flex items-center gap-1.5 px-3.5 py-2.5 hover:bg-[#083b6b] transition"><Download className="w-3.5 h-3.5" /> ডাউনলোড</a>
            <a href="#gallery" className="flex items-center gap-1.5 px-3.5 py-2.5 hover:bg-[#083b6b] transition"><ImageIcon className="w-3.5 h-3.5" /> গ্যালারি</a>
            <a href="#notices" className="flex items-center gap-1.5 px-3.5 py-2.5 hover:bg-[#083b6b] transition"><Megaphone className="w-3.5 h-3.5" /> নোটিশ</a>
            <a href="#teachers" className="flex items-center gap-1.5 px-3.5 py-2.5 hover:bg-[#083b6b] transition"><User className="w-3.5 h-3.5" /> শিক্ষকবৃন্দ</a>
            <a href="#classes" className="flex items-center gap-1.5 px-3.5 py-2.5 hover:bg-[#083b6b] transition"><GraduationCap className="w-3.5 h-3.5" /> ছাত্র-ছাত্রী</a>
            <a href="#contact" className="flex items-center gap-1.5 px-3.5 py-2.5 hover:bg-[#083b6b] transition"><Phone className="w-3.5 h-3.5" /> যোগাযোগ</a>
          </div>
        </div>
      </nav>

      {/* ═══════════ MAIN HERO SECTION ═══════════ */}
      <section className="py-8 bg-white dark:bg-slate-900">
        <div className="max-w-7xl mx-auto px-4">
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-5">
            
            <div className="lg:col-span-3 bg-white dark:bg-slate-800/50 rounded-xl p-5 border border-slate-200 dark:border-slate-700 shadow-sm">
              <h2 className="flex items-center gap-2 text-base font-bold text-[#0a4d8c] dark:text-blue-400 mb-4 pb-2 border-b border-slate-200 dark:border-slate-700">
                <Target className="w-5 h-5 text-[#0a4d8c] dark:text-blue-400" /> আমাদের উদ্দেশ্য ও লক্ষ্য
              </h2>
              <div className="space-y-4">
                {goals.length > 0 && (
                  <div>
                    <h3 className="flex items-center gap-1.5 text-sm font-bold text-emerald-600 dark:text-emerald-400 mb-2"><span className="w-2 h-2 rounded-full bg-emerald-500"></span> উদ্দেশ্য</h3>
                    <ul className="space-y-1.5 text-xs text-slate-600 dark:text-slate-300">
                      {goals.map((g, i) => (
                        <li key={i} className="flex items-start gap-1.5"><CheckCircle2 className="w-3.5 h-3.5 text-emerald-500 shrink-0 mt-0.5" /><span>{g}</span></li>
                      ))}
                    </ul>
                  </div>
                )}
                {targets.length > 0 && (
                  <div>
                    <h3 className="flex items-center gap-1.5 text-sm font-bold text-amber-600 dark:text-amber-400 mb-2"><span className="w-2 h-2 rounded-full bg-amber-500"></span> লক্ষ্য</h3>
                    <ul className="space-y-1.5 text-xs text-slate-600 dark:text-slate-300">
                      {targets.map((t, i) => (
                        <li key={i} className="flex items-start gap-1.5"><CheckCircle2 className="w-3.5 h-3.5 text-amber-500 shrink-0 mt-0.5" /><span>{t}</span></li>
                      ))}
                    </ul>
                  </div>
                )}
              </div>
            </div>

            <div className="lg:col-span-6 relative">
              <div className="relative w-full h-64 md:h-80 lg:h-[340px] rounded-xl overflow-hidden shadow-xl border-2 border-slate-200 dark:border-slate-700">
                <SafeImage src={heroImage} alt="School Building" fill sizes="(max-width: 1024px) 100vw, 50vw" priority className="object-cover" />
                {heroCaption && (
                  <div className="absolute bottom-0 right-0 bg-gradient-to-t from-black/70 to-transparent p-4 w-full">
                    <p className="text-white text-right text-lg font-bold italic">{heroCaption}</p>
                  </div>
                )}
              </div>
            </div>

            <div className="lg:col-span-3 space-y-4">
              {director.name && (
                <div className="bg-white dark:bg-slate-800/50 rounded-xl p-4 border border-slate-200 dark:border-slate-700 shadow-sm text-center">
                  <div className="relative w-20 h-20 rounded-full overflow-hidden border-[3px] border-blue-100 dark:border-slate-700 shadow-md mx-auto mb-2 bg-slate-200 dark:bg-slate-800">
                    <SafeImage src={director.photo} alt="Director" fill sizes="80px" className="object-cover" />
                  </div>
                  <div className="text-[10px] font-bold text-blue-600 dark:text-blue-400 mb-0.5">পরিচালকের পরিচিতি</div>
                  <h4 className="text-sm font-bold text-slate-800 dark:text-slate-100">{director.name}</h4>
                  <span className="text-[11px] font-medium text-emerald-600 dark:text-emerald-400">{director.title}</span>
                  {director.quote && <p className="text-[10px] text-slate-500 dark:text-slate-400 mt-2 leading-relaxed italic">"{director.quote}"</p>}
                </div>
              )}
              {headTeacher.name && (
                <div className="bg-white dark:bg-slate-800/50 rounded-xl p-4 border border-slate-200 dark:border-slate-700 shadow-sm text-center">
                  <div className="relative w-20 h-20 rounded-full overflow-hidden border-[3px] border-emerald-100 dark:border-slate-700 shadow-md mx-auto mb-2 bg-slate-200 dark:bg-slate-800">
                    <SafeImage src={headTeacher.photo} alt="Head Teacher" fill sizes="80px" className="object-cover" />
                  </div>
                  <div className="text-[10px] font-bold text-emerald-600 dark:text-emerald-400 mb-0.5">প্রধান শিক্ষকের পরিচিতি</div>
                  <h4 className="text-sm font-bold text-slate-800 dark:text-slate-100">{headTeacher.name}</h4>
                  <span className="text-[11px] font-medium text-blue-600 dark:text-blue-400">{headTeacher.title}</span>
                  {headTeacher.quote && <p className="text-[10px] text-slate-500 dark:text-slate-400 mt-2 leading-relaxed italic">"{headTeacher.quote}"</p>}
                </div>
              )}
            </div>
          </div>
        </div>
      </section>

      {/* ═══════════ FEATURES SECTION ═══════════ */}
      <section className="py-8 bg-slate-50 dark:bg-slate-950 border-t border-slate-200 dark:border-slate-800">
        <div className="max-w-7xl mx-auto px-4">
          <h2 className="text-lg md:text-xl font-bold text-center text-[#0a4d8c] dark:text-blue-400 mb-6 relative">
            আমাদের বৈশিষ্ট্য
            <span className="block w-16 h-1 bg-[#0a4d8c] dark:bg-blue-400 mx-auto mt-2 rounded-full"></span>
          </h2>
          <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-4 text-center">
            {features.map((item, idx) => {
              const Icon = item.icon;
              return (
                <div key={idx} className="flex flex-col items-center group bg-white dark:bg-slate-900 rounded-xl p-4 border border-slate-200 dark:border-slate-800 shadow-sm hover:shadow-md transition">
                  <div className={`w-12 h-12 rounded-full ${item.color} text-white flex items-center justify-center shadow-md mb-3 transition transform group-hover:scale-110`}>
                    <Icon className="w-6 h-6" />
                  </div>
                  <h3 className="font-bold text-[11px] md:text-xs text-slate-800 dark:text-slate-100 mb-1 leading-snug">{item.title}</h3>
                  <p className="text-[10px] text-slate-500 dark:text-slate-400 leading-snug">{item.desc}</p>
                </div>
              );
            })}
          </div>
        </div>
      </section>

      {/* ═══════════ CLASSES + MEDIUM + RESULTS ═══════════ */}
      <section id="academic" className="py-8 bg-white dark:bg-slate-900">
        <div className="max-w-7xl mx-auto px-4">
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-5">
            
            <div id="classes" className="lg:col-span-5 bg-slate-50 dark:bg-slate-950 rounded-xl p-5 border border-slate-200 dark:border-slate-800">
              <h3 className="text-base font-bold text-[#0a4d8c] dark:text-blue-400 mb-4 flex items-center gap-2"><School className="w-5 h-5" /> শ্রেণি সমূহ</h3>
              <div className="grid grid-cols-3 sm:grid-cols-4 gap-2.5">
                {classList.map((cls, idx) => (
                  <div key={idx} className={`${cls.bg} rounded-lg p-2.5 text-center font-bold shadow-sm border hover:scale-105 transition cursor-pointer`}>
                    <div className="text-[11px] font-bold leading-tight">{cls.name}</div>
                    {cls.age && <div className="text-[9px] opacity-80 mt-0.5">({cls.age})</div>}
                  </div>
                ))}
              </div>
            </div>

            <div className="lg:col-span-3 bg-slate-50 dark:bg-slate-950 rounded-xl p-5 border border-slate-200 dark:border-slate-800 text-center flex flex-col items-center justify-between">
              <div className="w-full">
                <h3 className="text-base font-bold text-[#0a4d8c] dark:text-blue-400 mb-4 flex items-center justify-center gap-1.5"><Library className="w-5 h-5" /> শিক্ষার মাধ্যম</h3>
                <div className="w-16 h-16 rounded-2xl bg-emerald-500 text-white flex items-center justify-center mx-auto mb-3 shadow-lg"><BookOpen className="w-8 h-8" /></div>
                <h4 className="text-sm font-bold text-slate-800 dark:text-slate-100">{mediumTitle}</h4>
                <p className="text-[11px] text-slate-500 dark:text-slate-400 mt-0.5">{mediumSubtitle}</p>
              </div>
              {mediumQuote && (
                <p className="text-[11px] text-slate-600 dark:text-slate-300 italic bg-white dark:bg-slate-900 p-3 rounded-xl border border-slate-200 dark:border-slate-800 mt-4 w-full">
                  "{mediumQuote}"
                </p>
              )}
            </div>

            <div className="lg:col-span-4 bg-slate-50 dark:bg-slate-950 rounded-xl p-5 border border-slate-200 dark:border-slate-800">
              <h3 className="text-base font-bold text-[#0a4d8c] dark:text-blue-400 mb-4 flex items-center gap-2"><Award className="w-5 h-5" /> ফলাফল দেখুন</h3>
              <div className="grid grid-cols-2 gap-2 text-center">
                {classList.slice(0, 8).map((cls, idx) => (
                  <Link 
                    key={idx} 
                    href="/login"
                    className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-lg py-2 px-3 text-[11px] font-bold text-slate-700 dark:text-slate-300 hover:bg-blue-50 dark:hover:bg-blue-950/30 hover:text-[#0a4d8c] dark:hover:text-blue-400 transition cursor-pointer"
                  >
                    {cls.name}
                  </Link>
                ))}
              </div>
              <p className="text-[10px] text-slate-400 dark:text-slate-500 mt-3 text-center">ফলাফল দেখতে লগইন করুন</p>
            </div>
          </div>
        </div>
      </section>

      {/* ═══════════ DOWNLOADS + NOTICES + GALLERY ═══════════ */}
      <section id="downloads" className="py-8 bg-slate-50 dark:bg-slate-950 border-t border-slate-200 dark:border-slate-800">
        <div className="max-w-7xl mx-auto px-4">
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-5">
            
            <div className="lg:col-span-6 bg-white dark:bg-slate-900 rounded-xl p-5 border border-slate-200 dark:border-slate-800 shadow-sm">
              <div className="flex items-center gap-2 mb-4 pb-3 border-b border-slate-200 dark:border-slate-700">
                <Download className="w-5 h-5 text-emerald-600 dark:text-emerald-400" />
                <div>
                  <h3 className="text-base font-bold text-slate-800 dark:text-slate-100">ডাউনলোড সেকশন</h3>
                  <p className="text-[10px] text-slate-500 dark:text-slate-400">প্রয়োজনীয় সকল শিক্ষাসামগ্রী এক জায়গায়</p>
                </div>
              </div>
              <div className="grid grid-cols-2 gap-3">
                {downloadItems.map((dl, idx) => (
                  <div key={idx} className={`${dl.cardBg} ${dl.cardBorder || 'border'} p-3 rounded-xl border text-center flex flex-col justify-between hover:shadow-md transition`}>
                    <div>
                      <FileText className={`w-6 h-6 mx-auto mb-1.5 ${dl.iconColor}`} />
                      <div className="text-xs font-bold text-slate-800 dark:text-slate-200">{dl.name}</div>
                      <div className="text-[9px] text-slate-500 dark:text-slate-400 mb-3">{dl.tag}</div>
                    </div>
                    <a href={dl.url || "#"} target="_blank" rel="noopener noreferrer" className={`${dl.btnBg} text-white text-[10px] font-bold py-1.5 px-3 rounded-md shadow hover:opacity-90 transition inline-block`}>ডাউনলোড</a>
                  </div>
                ))}
              </div>
            </div>

            <div id="notices" className="lg:col-span-3 bg-white dark:bg-slate-900 rounded-xl p-5 border border-slate-200 dark:border-slate-800 shadow-sm">
              <div className="flex items-center justify-between mb-3 pb-2 border-b border-slate-200 dark:border-slate-700">
                <h3 className="text-sm font-bold text-[#0a4d8c] dark:text-blue-400 flex items-center gap-1.5"><Megaphone className="w-4 h-4 text-rose-600" /> সাম্প্রতিক নোটিশ</h3>
                <a href="#notices" className="text-[10px] text-blue-600 dark:text-blue-400 font-bold hover:underline">সকল নোটিশ →</a>
              </div>
              <div className="space-y-2.5">
                {noticesRes.data && noticesRes.data.length > 0 ? (
                  noticesRes.data.slice(0, 4).map((n: any) => (
                    <div key={n.id} className="flex items-start gap-2 bg-slate-50 dark:bg-slate-950 p-2.5 rounded-lg border border-slate-200 dark:border-slate-800">
                      <Pin className="w-3.5 h-3.5 text-rose-500 shrink-0 mt-0.5" />
                      <div className="flex-1 min-w-0">
                        <div className="font-bold text-[11px] text-slate-800 dark:text-slate-200 leading-snug line-clamp-2">{n.title}</div>
                        <div className="text-[9px] text-slate-400 dark:text-slate-500 mt-1">{n.created_at ? new Date(n.created_at).toLocaleDateString("bn-BD") : ""}</div>
                      </div>
                    </div>
                  ))
                ) : (
                  <p className="text-xs text-slate-400 text-center py-4">কোনো নোটিশ নেই</p>
                )}
              </div>
            </div>

            <div id="gallery" className="lg:col-span-3 bg-white dark:bg-slate-900 rounded-xl p-5 border border-slate-200 dark:border-slate-800 shadow-sm">
              <div className="flex items-center justify-between mb-3 pb-2 border-b border-slate-200 dark:border-slate-700">
                <h3 className="text-sm font-bold text-[#0a4d8c] dark:text-blue-400 flex items-center gap-1.5"><ImageIcon className="w-4 h-4 text-emerald-600" /> গ্যালারি</h3>
                <a href="#gallery" className="text-[10px] text-blue-600 dark:text-blue-400 font-bold hover:underline">সকল ছবি →</a>
              </div>
              <div className="grid grid-cols-2 gap-2">
                {galleryImages.length > 0 ? galleryImages.map((img, idx) => (
                  <div key={idx} className="relative h-20 rounded-lg overflow-hidden border border-slate-200 dark:border-slate-800">
                    <SafeImage src={img} alt="Gallery" fill sizes="150px" className="object-cover hover:scale-110 transition duration-300" />
                  </div>
                )) : <p className="text-xs text-slate-400 text-center col-span-2 py-4">কোনো ছবি নেই</p>}
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* ═══════════ TEACHERS & COMMITTEE SECTION ═══════════ */}
      <section id="teachers" className="py-8 bg-white dark:bg-slate-900 border-t border-slate-200 dark:border-slate-800">
        <div className="max-w-7xl mx-auto px-4">
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            
            <div className="bg-white dark:bg-slate-950 rounded-xl p-5 border border-slate-200 dark:border-slate-800 shadow-sm">
              <div className="bg-emerald-600 text-white text-center py-2.5 rounded-lg mb-4 shadow-sm">
                <h3 className="text-lg font-bold">পরিচালকবৃন্দ</h3>
              </div>
              <div className="overflow-x-auto">
                <table className="w-full text-left text-xs border-collapse">
                  <thead>
                    <tr className="bg-[#0a4d8c] text-white">
                      <th className="p-2.5 font-bold text-center w-12 rounded-tl-lg">ক্রম</th>
                      <th className="p-2.5 font-bold w-16">ছবি</th>
                      <th className="p-2.5 font-bold">নাম</th>
                      <th className="p-2.5 font-bold">পদবী</th>
                      <th className="p-2.5 font-bold text-right rounded-tr-lg">মোবাইল নম্বর</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
                    {committeeList.map((c: any, idx: number) => (
                      <tr key={idx} className="hover:bg-blue-50/50 dark:hover:bg-slate-800/50 transition">
                        <td className="p-2.5 text-center font-bold text-slate-500 dark:text-slate-400">{c.sl}</td>
                        <td className="p-2.5">
                          <div className="relative w-8 h-8 rounded-full overflow-hidden bg-slate-200 dark:bg-slate-700 border border-slate-300 dark:border-slate-600">
                            {c.photo ? <SafeImage src={c.photo} alt={c.name} fill sizes="32px" className="object-cover" /> : <div className="w-full h-full flex items-center justify-center text-[11px] font-bold text-slate-500 bg-gradient-to-br from-slate-200 to-slate-300">{c.name.charAt(0)}</div>}
                          </div>
                        </td>
                        <td className="p-2.5 font-bold text-slate-800 dark:text-slate-200">{c.name}</td>
                        <td className="p-2.5 text-slate-600 dark:text-slate-400">{c.role}</td>
                        <td className="p-2.5 text-right font-mono font-semibold text-slate-700 dark:text-slate-300">{c.phone}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>

            <div className="bg-white dark:bg-slate-950 rounded-xl p-5 border border-slate-200 dark:border-slate-800 shadow-sm">
              <div className="bg-[#b45309] text-white text-center py-2.5 rounded-lg mb-4 shadow-sm">
                <h3 className="text-lg font-bold">শিক্ষকমণ্ডলী</h3>
              </div>
              <div className="overflow-x-auto">
                <table className="w-full text-left text-xs border-collapse">
                  <thead>
                    <tr className="bg-[#a21caf] text-white">
                      <th className="p-2.5 font-bold text-center w-12 rounded-tl-lg">ক্রম</th>
                      <th className="p-2.5 font-bold w-16">ছবি</th>
                      <th className="p-2.5 font-bold">নাম</th>
                      <th className="p-2.5 font-bold">পদবী</th>
                      <th className="p-2.5 font-bold text-right rounded-tr-lg">মোবাইল নম্বর</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
                    {staffList.map((stf: any, idx: number) => (
                      <tr key={idx} className="hover:bg-blue-50/50 dark:hover:bg-slate-800/50 transition">
                        <td className="p-2.5 text-center font-bold text-slate-500 dark:text-slate-400">{stf.sl}</td>
                        <td className="p-2.5">
                          <div className="relative w-8 h-8 rounded-full overflow-hidden bg-slate-200 dark:bg-slate-700 border border-slate-300 dark:border-slate-600">
                            {stf.photo ? <SafeImage src={stf.photo} alt={stf.name} fill sizes="32px" className="object-cover" /> : <div className="w-full h-full flex items-center justify-center text-[11px] font-bold text-slate-500 bg-gradient-to-br from-slate-200 to-slate-300">{stf.name.charAt(0)}</div>}
                          </div>
                        </td>
                        <td className="p-2.5 font-bold text-slate-800 dark:text-slate-200">{stf.name}</td>
                        <td className="p-2.5 text-slate-600 dark:text-slate-400">{stf.role}</td>
                        <td className="p-2.5 text-right font-mono font-semibold text-slate-700 dark:text-slate-300">{stf.phone}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* ═══════════ CONTACT ═══════════ */}
      <section id="contact" className="py-8 bg-slate-50 dark:bg-slate-950 border-t border-slate-200 dark:border-slate-800">
        <div className="max-w-7xl mx-auto px-4">
          <div className="bg-gradient-to-r from-[#0a4d8c] to-[#0d5ca8] rounded-xl p-6 md:p-8 text-white shadow-xl">
            <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
              <div className="md:col-span-2">
                <h3 className="text-xl font-bold mb-3">যোগাযোগ করুন</h3>
                <p className="text-sm text-blue-100 mb-4">ভর্তি, ফি বা যেকোনো তথ্যের জন্য আমাদের সাথে যোগাযোগ করুন</p>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-sm">
                  <div className="flex items-center gap-2 bg-white/10 rounded-lg px-3 py-2"><MapPin className="w-4 h-4 text-emerald-300 shrink-0" /><span>{schoolAddress}</span></div>
                  <div className="flex items-center gap-2 bg-white/10 rounded-lg px-3 py-2"><Phone className="w-4 h-4 text-emerald-300 shrink-0" /><span>{schoolPhone}</span></div>
                  <div className="flex items-center gap-2 bg-white/10 rounded-lg px-3 py-2"><Mail className="w-4 h-4 text-emerald-300 shrink-0" /><span>{schoolEmail}</span></div>
                </div>
              </div>
              <div className="flex flex-col gap-3 justify-center">
                <Link href="/admission" className="bg-emerald-500 hover:bg-emerald-600 text-white font-bold py-3 px-5 rounded-xl text-center transition shadow-lg flex items-center justify-center gap-2"><UserCheck className="w-4 h-4" /> অনলাইন ভর্তি</Link>
                <Link href="/login" className="bg-amber-500 hover:bg-amber-600 text-slate-900 font-bold py-3 px-5 rounded-xl text-center transition shadow-lg flex items-center justify-center gap-2"><LogIn className="w-4 h-4" /> লগইন করুন</Link>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* ═══════════ FOOTER ═══════════ */}
      <footer className="bg-[#083b6b] dark:bg-slate-950 text-white py-6 border-t border-blue-900 dark:border-slate-800">
        <div className="max-w-7xl mx-auto px-4">
          <div className="flex flex-col md:flex-row items-center justify-between gap-4">
            <div className="flex items-center gap-3">
              <div className="relative w-10 h-10 rounded-full border-2 border-white/30 bg-white/10 overflow-hidden">
                {schoolLogo ? <Image src={schoolLogo} alt="Logo" fill sizes="40px" className="object-cover" /> : <div className="w-full h-full flex items-center justify-center"><GraduationCap className="w-5 h-5 text-white" /></div>}
              </div>
              <div>
                <div className="font-bold text-sm">{schoolName}</div>
                <div className="text-[10px] text-blue-200 flex items-center gap-1.5">
                  <span>শিক্ষা</span><span className="w-1 h-1 rounded-full bg-blue-300"></span><span>শৃঙ্খলা</span><span className="w-1 h-1 rounded-full bg-blue-300"></span><span>সুন্দর ভবিষ্যৎ</span>
                </div>
              </div>
            </div>
            <div className="text-center md:text-right text-blue-200 text-[11px]">
              © {new Date().getFullYear()} {schoolName}। {footerText}
            </div>
            <div className="text-blue-300 text-[10px]">
              Powered by <span className="font-bold text-white">KinderERP</span> | School Management System
            </div>
          </div>
        </div>
      </footer>
    </div>
  );
}