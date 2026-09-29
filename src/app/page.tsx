import Link from "next/link";
import { redirect } from "next/navigation";
import {
  Home,
  BookOpen,
  Download,
  Users,
  GraduationCap,
  Image as ImageIcon,
  Bell,
  Phone,
  UserCheck,
  Monitor,
  Shield,
  Heart,
  Trophy,
  MapPin,
  Mail,
  ChevronRight,
  Target,
  FileText,
  LogIn,
  Megaphone,
  User,
  Pin,
  CheckCircle2,
  Award,
  Calendar,
  Star,
  School,
  Library,
  Palette,
  Music,
  Calculator,
  Globe,
  Sparkles,
} from "lucide-react";
import { createClient } from "@/lib/supabase/server";

type Row = Record<string, any>;

const first = (row: Row | null | undefined, keys: string[], fallback = "") => {
  if (!row) return fallback;
  for (const key of keys) {
    const value = row[key];
    if (value !== null && value !== undefined && String(value).trim() !== "") {
      return String(value);
    }
  }
  return fallback;
};

export default async function HomePage() {
  const supabase = await createClient();

  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (user) redirect("/dashboard");

  // Fetch dynamic data from Supabase
  const [
    { data: school },
    { data: notices },
    { data: classes },
    { data: staff },
    { data: feeCategories },
  ] = await Promise.all([
    supabase
      .from("school_settings")
      .select("school_name, school_address, school_phone, school_email, school_logo")
      .limit(1)
      .maybeSingle(),

    supabase
      .from("notices")
      .select("id, title, content, created_at, type")
      .order("created_at", { ascending: false })
      .limit(5),

    supabase
      .from("classes")
      .select("*")
      .order("numeric_order", { ascending: true }),

    supabase
      .from("staff")
      .select("*")
      .neq("status", "resigned")
      .limit(20),

    supabase
      .from("fee_categories")
      .select("*")
      .eq("is_active", true)
      .limit(10),
  ]);

  const schoolName = first(school, ["school_name"], "শাপলা কিন্ডারগার্টেন এন্ড প্রি-ক্যাডেট");
  const schoolAddress = first(school, ["school_address"], "নাওতলা, মাধাইয়া বাজার, চান্দিনা, কুমিল্লা");
  const schoolPhone = first(school, ["school_phone"], "01923253454");
  const schoolEmail = first(school, ["school_email"], "shapla.kindergarten@gmail.com");
  const schoolLogo = first(school, ["school_logo"], "");

  const defaultClasses = [
    { name: "Play Group", age: "৩+ বছর", bg: "bg-sky-100 dark:bg-sky-900/40 text-sky-800 dark:text-sky-200 border-sky-300" },
    { name: "Nursery", age: "৪+ বছর", bg: "bg-emerald-100 dark:bg-emerald-900/40 text-emerald-800 dark:text-emerald-200 border-emerald-300" },
    { name: "KG-1", age: "৫+ বছর", bg: "bg-amber-100 dark:bg-amber-900/40 text-amber-800 dark:text-amber-200 border-amber-300" },
    { name: "KG-2", age: "৬+ বছর", bg: "bg-rose-100 dark:bg-rose-900/40 text-rose-800 dark:text-rose-200 border-rose-300" },
    { name: "১ম শ্রেণি", age: "৬+ বছর", bg: "bg-purple-100 dark:bg-purple-900/40 text-purple-800 dark:text-purple-200 border-purple-300" },
    { name: "২য় শ্রেণি", age: "৭+ বছর", bg: "bg-cyan-100 dark:bg-cyan-900/40 text-cyan-800 dark:text-cyan-200 border-cyan-300" },
    { name: "৩য় শ্রেণি", age: "৮+ বছর", bg: "bg-blue-100 dark:bg-blue-900/40 text-blue-800 dark:text-blue-200 border-blue-300" },
    { name: "৪র্থ শ্রেণি", age: "৯+ বছর", bg: "bg-red-100 dark:bg-red-900/40 text-red-800 dark:text-red-200 border-red-300" },
    { name: "৫ম শ্রেণি", age: "১০+ বছর", bg: "bg-teal-100 dark:bg-teal-900/40 text-teal-800 dark:text-teal-200 border-teal-300" },
  ];

  const classList = classes && classes.length > 0
    ? classes.map((c: Row, idx: number) => ({
        name: first(c, ["name", "class_name"], `শ্রেণি ${idx + 1}`),
        age: first(c, ["age_group", "section"], ""),
        bg: defaultClasses[idx % defaultClasses.length].bg,
      }))
    : defaultClasses;

  const staffList = staff && staff.length > 0
    ? staff.map((s: Row, idx: number) => ({
        sl: idx + 1,
        name: first(s, ["name", "full_name"], "শিক্ষক"),
        role: first(s, ["designation", "role"], "শিক্ষক"),
        phone: first(s, ["phone", "mobile", "contact"], "01700000000"),
        photo: first(s, ["photo_url", "photo", "avatar_url"], ""),
      }))
    : [
        { sl: 1, name: "মোঃ তাজুল ইসলাম", role: "পরিচালক ও সভাপতি", phone: "০১৭৭৭৫৮৪৩৫২", photo: "" },
        { sl: 2, name: "মোঃ মনসুর আলী খাঁ", role: "সহসভাপতি", phone: "01812345678", photo: "" },
        { sl: 3, name: "সামসুন নাহার", role: "প্রধান শিক্ষক ও সদস্য সচিব", phone: "01987654321", photo: "" },
        { sl: 4, name: "ফেরদৌসি আক্তার", role: "শিক্ষক প্রতিনিধি", phone: "01755667788", photo: "" },
        { sl: 5, name: "ফারজানা আক্তার", role: "অভিভাবক প্রতিনিধি", phone: "01899887766", photo: "" },
        { sl: 6, name: "কামরুল ইসলাম সাজ্জাদ", role: "অভিভাবক প্রতিনিধি", phone: "01911223344", photo: "" },
      ];

  const director = staffList.find((s) => /পরিচালক|director/i.test(s.role)) || {
    name: "মোঃ আব্দুল হালিম",
    role: "পরিচালক",
    photo: "",
  };

  const headTeacher = staffList.find((s) => /প্রধান শিক্ষক|headmaster|principal/i.test(s.role)) || {
    name: "মোছাঃ নাসরিন আক্তার",
    role: "প্রধান শিক্ষক",
    photo: "",
  };

  const downloadItems = [
    { name: "সিলেবাস", tag: "PDF | Class Wise", iconColor: "text-rose-500", cardBg: "bg-rose-50 dark:bg-rose-950/30 border-rose-200", btnBg: "bg-rose-500" },
    { name: "ওয়ার্কশীট", tag: "PDF | Class Wise", iconColor: "text-blue-500", cardBg: "bg-blue-50 dark:bg-blue-950/30 border-blue-200", btnBg: "bg-blue-500" },
    { name: "সাজেশন", tag: "PDF | Class Wise", iconColor: "text-emerald-500", cardBg: "bg-emerald-50 dark:bg-emerald-950/30 border-emerald-200", btnBg: "bg-emerald-500" },
    { name: "অন্যান্য", tag: "নোটিশ, নির্দেশিকা ইত্যাদি", iconColor: "text-purple-500", cardBg: "bg-purple-50 dark:bg-purple-950/30 border-purple-200", btnBg: "bg-purple-500" },
  ];

  const galleryImages = [
    "/school-images/gallery/gallery-1.jpg",
    "/school-images/gallery/gallery-2.jpg",
    "/school-images/gallery/gallery-3.jpg",
    "/school-images/gallery/gallery-4.jpg",
    "/school-images/gallery/gallery-5.jpg",
    "/school-images/gallery/gallery-6.jpg",
  ];

  return (
    <div className="min-h-screen bg-slate-50 dark:bg-slate-900 text-slate-800 dark:text-slate-100 font-sans transition-colors duration-200">
      
      {/* ══════════════════════════════════════════════════════════════
          HEADER BAR (Top Blue Bar) - PDF অনুযায়ী
      ══════════════════════════════════════════════════════════════ */}
      <header className="bg-gradient-to-r from-[#0a4d8c] via-[#0d5ca8] to-[#0a4d8c] text-white">
        <div className="max-w-7xl mx-auto px-4 py-2.5">
          <div className="flex flex-wrap items-center justify-between gap-3">
            {/* Left: Logo + School Name */}
            <div className="flex items-center gap-3">
              <div className="w-12 h-12 rounded-full border-2 border-white/40 bg-white flex items-center justify-center overflow-hidden shrink-0 shadow-lg">
                {schoolLogo ? (
                  <img src={schoolLogo} alt="School Logo" className="w-full h-full object-cover" />
                ) : (
                  <GraduationCap className="w-7 h-7 text-[#0a4d8c]" />
                )}
              </div>
              <div>
                <h1 className="text-base md:text-lg font-bold text-white tracking-tight leading-tight">
                  {schoolName}
                </h1>
                <p className="text-[10px] md:text-xs font-medium text-blue-100 flex items-center gap-2">
                  <span>শিক্ষা</span>
                  <span className="w-1 h-1 rounded-full bg-blue-300"></span>
                  <span>শৃঙ্খলা</span>
                  <span className="w-1 h-1 rounded-full bg-blue-300"></span>
                  <span>সুন্দর ভবিষ্যৎ</span>
                </p>
              </div>
            </div>

            {/* Middle: Contact Info */}
            <div className="hidden lg:flex items-center gap-5 text-xs text-blue-50">
              <div className="flex items-center gap-1.5">
                <MapPin className="w-4 h-4 text-emerald-300" />
                <span>{schoolAddress}</span>
              </div>
              <div className="flex items-center gap-1.5">
                <Phone className="w-4 h-4 text-emerald-300" />
                <span>{schoolPhone}</span>
              </div>
              <div className="flex items-center gap-1.5">
                <Mail className="w-4 h-4 text-emerald-300" />
                <span>{schoolEmail}</span>
              </div>
            </div>

            {/* Right: Auth Buttons */}
            <div className="flex items-center gap-2">
              <Link
                href="/admission"
                className="flex items-center gap-1.5 bg-emerald-500 hover:bg-emerald-600 text-white font-bold px-3.5 py-1.5 rounded-md text-xs transition shadow-md"
              >
                <UserCheck className="w-3.5 h-3.5" /> অনলাইন ভর্তি
              </Link>
              <Link
                href="/login"
                className="flex items-center gap-1.5 bg-amber-500 hover:bg-amber-600 text-slate-900 font-bold px-3.5 py-1.5 rounded-md text-xs transition shadow-md"
              >
                <LogIn className="w-3.5 h-3.5" /> লগইন করুন
              </Link>
            </div>
          </div>
        </div>
      </header>

      {/* ══════════════════════════════════════════════════════════════
          NAVIGATION BAR - PDF অনুযায়ী
      ══════════════════════════════════════════════════════════════ */}
      <nav className="bg-[#0a4d8c] text-white sticky top-0 z-50 shadow-lg border-t border-blue-700/50">
        <div className="max-w-7xl mx-auto px-4">
          <div className="flex items-center gap-1 overflow-x-auto whitespace-nowrap scrollbar-none text-xs md:text-[13px] font-medium">
            <Link href="#" className="flex items-center gap-1.5 px-3.5 py-2.5 bg-[#083b6b] text-white hover:bg-[#062f56] transition rounded-sm">
              <Home className="w-3.5 h-3.5" /> হোম
            </Link>
            <a href="#about" className="flex items-center gap-1.5 px-3.5 py-2.5 hover:bg-[#083b6b] transition">
              <Users className="w-3.5 h-3.5" /> আমাদের সম্পর্কে
            </a>
            <a href="#academic" className="flex items-center gap-1.5 px-3.5 py-2.5 hover:bg-[#083b6b] transition">
              <BookOpen className="w-3.5 h-3.5" /> একাডেমিক
            </a>
            <a href="#downloads" className="flex items-center gap-1.5 px-3.5 py-2.5 hover:bg-[#083b6b] transition">
              <Download className="w-3.5 h-3.5" /> ডাউনলোড
            </a>
            <a href="#gallery" className="flex items-center gap-1.5 px-3.5 py-2.5 hover:bg-[#083b6b] transition">
              <ImageIcon className="w-3.5 h-3.5" /> গ্যালারি
            </a>
            <a href="#notices" className="flex items-center gap-1.5 px-3.5 py-2.5 hover:bg-[#083b6b] transition">
              <Megaphone className="w-3.5 h-3.5" /> নোটিশ
            </a>
            <a href="#teachers" className="flex items-center gap-1.5 px-3.5 py-2.5 hover:bg-[#083b6b] transition">
              <User className="w-3.5 h-3.5" /> শিক্ষকবৃন্দ
            </a>
            <a href="#classes" className="flex items-center gap-1.5 px-3.5 py-2.5 hover:bg-[#083b6b] transition">
              <GraduationCap className="w-3.5 h-3.5" /> ছাত্র-ছাত্রী
            </a>
            <a href="#contact" className="flex items-center gap-1.5 px-3.5 py-2.5 hover:bg-[#083b6b] transition">
              <Phone className="w-3.5 h-3.5" /> যোগাযোগ
            </a>
          </div>
        </div>
      </nav>

      {/* ══════════════════════════════════════════════════════════════
          MAIN HERO SECTION - PDF Page 1 (3 Column Layout)
      ══════════════════════════════════════════════════════════════ */}
      <section className="py-8 bg-white dark:bg-slate-900">
        <div className="max-w-7xl mx-auto px-4">
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-5">
            
            {/* ── LEFT: আমাদের উদ্দেশ্য ও লক্ষ্য ── */}
            <div className="lg:col-span-3 bg-white dark:bg-slate-800/50 rounded-xl p-5 border border-slate-200 dark:border-slate-700 shadow-sm">
              <h2 className="flex items-center gap-2 text-base font-bold text-[#0a4d8c] dark:text-blue-400 mb-4 pb-2 border-b border-slate-200 dark:border-slate-700">
                <Target className="w-5 h-5 text-[#0a4d8c] dark:text-blue-400" />
                আমাদের উদ্দেশ্য ও লক্ষ্য
              </h2>

              <div className="space-y-4">
                {/* উদ্দেশ্য */}
                <div>
                  <h3 className="flex items-center gap-1.5 text-sm font-bold text-emerald-600 dark:text-emerald-400 mb-2">
                    <span className="w-2 h-2 rounded-full bg-emerald-500"></span>
                    উদ্দেশ্য
                  </h3>
                  <ul className="space-y-1.5 text-xs text-slate-600 dark:text-slate-300">
                    <li className="flex items-start gap-1.5">
                      <CheckCircle2 className="w-3.5 h-3.5 text-emerald-500 shrink-0 mt-0.5" />
                      <span>শিক্ষার্থীদের সর্বাঙ্গীণ বিকাশ নিশ্চিত করা।</span>
                    </li>
                    <li className="flex items-start gap-1.5">
                      <CheckCircle2 className="w-3.5 h-3.5 text-emerald-500 shrink-0 mt-0.5" />
                      <span>নৈতিক ও মানবিক মূল্যবোধ গঠন।</span>
                    </li>
                    <li className="flex items-start gap-1.5">
                      <CheckCircle2 className="w-3.5 h-3.5 text-emerald-500 shrink-0 mt-0.5" />
                      <span>আধুনিক ও প্রযুক্তিনির্ভর শিক্ষা প্রদান।</span>
                    </li>
                  </ul>
                </div>

                {/* লক্ষ্য */}
                <div>
                  <h3 className="flex items-center gap-1.5 text-sm font-bold text-amber-600 dark:text-amber-400 mb-2">
                    <span className="w-2 h-2 rounded-full bg-amber-500"></span>
                    লক্ষ্য
                  </h3>
                  <ul className="space-y-1.5 text-xs text-slate-600 dark:text-slate-300">
                    <li className="flex items-start gap-1.5">
                      <CheckCircle2 className="w-3.5 h-3.5 text-amber-500 shrink-0 mt-0.5" />
                      <span>গুণগত মানসম্পন্ন শিক্ষায় অগ্রণী ভূমিকা রাখা।</span>
                    </li>
                    <li className="flex items-start gap-1.5">
                      <CheckCircle2 className="w-3.5 h-3.5 text-amber-500 shrink-0 mt-0.5" />
                      <span>সৃজনশীল, দক্ষ ও দেশপ্রেমিক নাগরিক তৈরি করা।</span>
                    </li>
                    <li className="flex items-start gap-1.5">
                      <CheckCircle2 className="w-3.5 h-3.5 text-amber-500 shrink-0 mt-0.5" />
                      <span>একটি মডেল শিক্ষা প্রতিষ্ঠান হিসেবে প্রতিষ্ঠিত হওয়া।</span>
                    </li>
                  </ul>
                </div>
              </div>
            </div>

            {/* ── CENTER: School Building Image ── */}
            <div className="lg:col-span-6 relative">
              <div className="relative w-full h-64 md:h-80 lg:h-[340px] rounded-xl overflow-hidden shadow-xl border-2 border-slate-200 dark:border-slate-700">
                <img
                  src="/school-images/hero/school-building.jpg"
                  alt="School Building"
                  className="w-full h-full object-cover"
                />
                {/* Overlay text on image */}
                <div className="absolute bottom-0 right-0 bg-gradient-to-t from-black/70 to-transparent p-4 w-full">
                  <p className="text-white text-right text-lg font-bold italic">
                    শিক্ষাই সর্বোত্তম সম্পদ
                  </p>
                </div>
              </div>
            </div>

            {/* ── RIGHT: Director & Head Teacher ── */}
            <div className="lg:col-span-3 space-y-4">
              
              {/* Director Card */}
              <div className="bg-white dark:bg-slate-800/50 rounded-xl p-4 border border-slate-200 dark:border-slate-700 shadow-sm text-center">
                <div className="w-20 h-20 rounded-full overflow-hidden border-3 border-blue-100 dark:border-slate-700 shadow-md mx-auto mb-2 bg-slate-200 dark:bg-slate-800">
                  <img
                    src={director.photo || "/school-images/leadership/director.jpg"}
                    alt="Director"
                    className="w-full h-full object-cover"
                  />
                </div>
                <div className="text-[10px] font-bold text-blue-600 dark:text-blue-400 mb-0.5">
                  পরিচালকের পরিচিতি
                </div>
                <h4 className="text-sm font-bold text-slate-800 dark:text-slate-100">
                  {director.name}
                </h4>
                <span className="text-[11px] font-medium text-emerald-600 dark:text-emerald-400">
                  {director.role}
                </span>
                <p className="text-[10px] text-slate-500 dark:text-slate-400 mt-2 leading-relaxed italic">
                  "শিক্ষা বিস্তারের মাধ্যমে সমাজে সুন্দর জাতি গঠনে আমার প্রতিশ্রুতি অব্যাহত থাকবে।"
                </p>
              </div>

              {/* Head Teacher Card */}
              <div className="bg-white dark:bg-slate-800/50 rounded-xl p-4 border border-slate-200 dark:border-slate-700 shadow-sm text-center">
                <div className="w-20 h-20 rounded-full overflow-hidden border-3 border-emerald-100 dark:border-slate-700 shadow-md mx-auto mb-2 bg-slate-200 dark:bg-slate-800">
                  <img
                    src={headTeacher.photo || "/school-images/leadership/head-teacher.jpg"}
                    alt="Head Teacher"
                    className="w-full h-full object-cover"
                  />
                </div>
                <div className="text-[10px] font-bold text-emerald-600 dark:text-emerald-400 mb-0.5">
                  প্রধান শিক্ষকের পরিচিতি
                </div>
                <h4 className="text-sm font-bold text-slate-800 dark:text-slate-100">
                  {headTeacher.name}
                </h4>
                <span className="text-[11px] font-medium text-blue-600 dark:text-blue-400">
                  {headTeacher.role}
                </span>
                <p className="text-[10px] text-slate-500 dark:text-slate-400 mt-2 leading-relaxed italic">
                  "গুণগত মানসম্পন্ন শিক্ষা প্রদান করাই আমাদের প্রধান লক্ষ্য।"
                </p>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* ══════════════════════════════════════════════════════════════
          FEATURES SECTION - PDF অনুযায়ী 6 Icons
      ══════════════════════════════════════════════════════════════ */}
      <section className="py-8 bg-slate-50 dark:bg-slate-950 border-t border-slate-200 dark:border-slate-800">
        <div className="max-w-7xl mx-auto px-4">
          <h2 className="text-lg md:text-xl font-bold text-center text-[#0a4d8c] dark:text-blue-400 mb-6 relative">
            আমাদের বৈশিষ্ট্য
            <span className="block w-16 h-1 bg-[#0a4d8c] dark:bg-blue-400 mx-auto mt-2 rounded-full"></span>
          </h2>

          <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-4 text-center">
            {[
              { icon: Monitor, title: "ডিজিটাল স্কুল ম্যানেজমেন্ট", desc: "সব কাজ এখন অনলাইনে, সহজ ও দ্রুত।", color: "bg-[#0a4d8c]" },
              { icon: Shield, title: "নিরাপদ ও নির্ভরযোগ্য", desc: "ডেটা সুরক্ষা ও নিয়মিত ব্যাকআপ।", color: "bg-emerald-500" },
              { icon: BookOpen, title: "অভিজ্ঞ ও দক্ষ শিক্ষক", desc: "দক্ষ, অভিজ্ঞ ও স্নেহশীল শিক্ষক মণ্ডলী।", color: "bg-amber-500" },
              { icon: Users, title: "স্মার্ট ক্লাসরুম", desc: "আধুনিক প্রযুক্তি ও সৃজনশীল শিক্ষা।", color: "bg-purple-500" },
              { icon: Heart, title: "শিশুর সার্বিক বিকাশ", desc: "শিক্ষা, নৈতিকতা, সংস্কৃতি ও মূল্যবোধের চর্চা।", color: "bg-rose-500" },
              { icon: Trophy, title: "উজ্জ্বল ভবিষ্যৎ", desc: "ভবিষ্যৎ নেতৃত্বের জন্য সঠিক প্রস্তুতি।", color: "bg-teal-500" },
            ].map((item, idx) => (
              <div key={idx} className="flex flex-col items-center group bg-white dark:bg-slate-900 rounded-xl p-4 border border-slate-200 dark:border-slate-800 shadow-sm hover:shadow-md transition">
                <div className={`w-12 h-12 rounded-full ${item.color} text-white flex items-center justify-center shadow-md mb-3 transition transform group-hover:scale-110`}>
                  <item.icon className="w-6 h-6" />
                </div>
                <h3 className="font-bold text-[11px] md:text-xs text-slate-800 dark:text-slate-100 mb-1 leading-snug">
                  {item.title}
                </h3>
                <p className="text-[10px] text-slate-500 dark:text-slate-400 leading-snug">
                  {item.desc}
                </p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ══════════════════════════════════════════════════════════════
          CLASSES + MEDIUM + DOWNLOADS - PDF Page 2
      ══════════════════════════════════════════════════════════════ */}
      <section id="academic" className="py-8 bg-white dark:bg-slate-900">
        <div className="max-w-7xl mx-auto px-4">
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-5">
            
            {/* ── LEFT: শ্রেণি সমূহ ── */}
            <div id="classes" className="lg:col-span-5 bg-slate-50 dark:bg-slate-950 rounded-xl p-5 border border-slate-200 dark:border-slate-800">
              <h3 className="text-base font-bold text-[#0a4d8c] dark:text-blue-400 mb-4 flex items-center gap-2">
                <School className="w-5 h-5" /> শ্রেণি সমূহ
              </h3>
              <div className="grid grid-cols-3 sm:grid-cols-4 gap-2.5">
                {classList.map((cls, idx) => (
                  <div
                    key={idx}
                    className={`${cls.bg} rounded-lg p-2.5 text-center font-bold shadow-sm border hover:scale-105 transition cursor-pointer`}
                  >
                    <div className="text-[11px] font-bold leading-tight">{cls.name}</div>
                    {cls.age && <div className="text-[9px] opacity-80 mt-0.5">({cls.age})</div>}
                  </div>
                ))}
              </div>
            </div>

            {/* ── CENTER: শিক্ষার মাধ্যম ── */}
            <div className="lg:col-span-3 bg-slate-50 dark:bg-slate-950 rounded-xl p-5 border border-slate-200 dark:border-slate-800 text-center flex flex-col items-center justify-between">
              <div className="w-full">
                <h3 className="text-base font-bold text-[#0a4d8c] dark:text-blue-400 mb-4 flex items-center justify-center gap-1.5">
                  <Library className="w-5 h-5" /> শিক্ষার মাধ্যম
                </h3>
                <div className="w-16 h-16 rounded-2xl bg-emerald-500 text-white flex items-center justify-center mx-auto mb-3 shadow-lg">
                  <BookOpen className="w-8 h-8" />
                </div>
                <h4 className="text-sm font-bold text-slate-800 dark:text-slate-100">বাংলা ও ইংরেজি</h4>
                <p className="text-[11px] text-slate-500 dark:text-slate-400 mt-0.5">(প্রাথমিক মাধ্যম)</p>
              </div>
              <p className="text-[11px] text-slate-600 dark:text-slate-300 italic bg-white dark:bg-slate-900 p-3 rounded-xl border border-slate-200 dark:border-slate-800 mt-4 w-full">
                "মাতৃভাষার ভিত্তিতে ইংরেজিতে দক্ষতা, এটাই আমাদের লক্ষ্য।"
              </p>
            </div>

            {/* ── RIGHT: ফলাফল দেখুন (Table) ── */}
            <div className="lg:col-span-4 bg-slate-50 dark:bg-slate-950 rounded-xl p-5 border border-slate-200 dark:border-slate-800">
              <h3 className="text-base font-bold text-[#0a4d8c] dark:text-blue-400 mb-4 flex items-center gap-2">
                <Award className="w-5 h-5" /> ফলাফল দেখুন
              </h3>
              <div className="grid grid-cols-2 gap-2 text-center">
                {["প্লে-গ্রুপ", "নাসারি", "কেজি", "প্রথম", "দ্বিতীয়", "তৃতীয়", "চতুর্থ", "পঞ্চম"].map((item, idx) => (
                  <div
                    key={idx}
                    className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-lg py-2 px-3 text-[11px] font-bold text-slate-700 dark:text-slate-300 hover:bg-blue-50 dark:hover:bg-blue-950/30 hover:text-[#0a4d8c] dark:hover:text-blue-400 transition cursor-pointer"
                  >
                    {item}
                  </div>
                ))}
              </div>
              <p className="text-[10px] text-slate-400 dark:text-slate-500 mt-3 text-center">
                শ্রেণি অনুযায়ী ফলাফল দেখুন
              </p>
            </div>
          </div>
        </div>
      </section>

      {/* ══════════════════════════════════════════════════════════════
          DOWNLOADS SECTION - PDF Page 2
      ══════════════════════════════════════════════════════════════ */}
      <section id="downloads" className="py-8 bg-slate-50 dark:bg-slate-950 border-t border-slate-200 dark:border-slate-800">
        <div className="max-w-7xl mx-auto px-4">
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-5">
            
            {/* ── Downloads ── */}
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
                  <div
                    key={idx}
                    className={`${dl.cardBg} p-3 rounded-xl border text-center flex flex-col justify-between hover:shadow-md transition`}
                  >
                    <div>
                      <FileText className={`w-6 h-6 mx-auto mb-1.5 ${dl.iconColor}`} />
                      <div className="text-xs font-bold text-slate-800 dark:text-slate-200">{dl.name}</div>
                      <div className="text-[9px] text-slate-500 dark:text-slate-400 mb-3">{dl.tag}</div>
                    </div>
                    <button className={`${dl.btnBg} text-white text-[10px] font-bold py-1.5 px-3 rounded-md shadow hover:opacity-90 transition`}>
                      ডাউনলোড
                    </button>
                  </div>
                ))}
              </div>
            </div>

            {/* ── Notices ── */}
            <div id="notices" className="lg:col-span-3 bg-white dark:bg-slate-900 rounded-xl p-5 border border-slate-200 dark:border-slate-800 shadow-sm">
              <div className="flex items-center justify-between mb-3 pb-2 border-b border-slate-200 dark:border-slate-700">
                <h3 className="text-sm font-bold text-[#0a4d8c] dark:text-blue-400 flex items-center gap-1.5">
                  <Megaphone className="w-4 h-4 text-rose-600" /> সাম্প্রতিক নোটিশ
                </h3>
                <a href="#notices" className="text-[10px] text-blue-600 dark:text-blue-400 font-bold hover:underline">
                  সকল নোটিশ →
                </a>
              </div>

              <div className="space-y-2.5">
                {notices && notices.length > 0 ? (
                  notices.slice(0, 4).map((n: Row) => (
                    <div key={n.id} className="flex items-start gap-2 bg-slate-50 dark:bg-slate-950 p-2.5 rounded-lg border border-slate-200 dark:border-slate-800">
                      <Pin className="w-3.5 h-3.5 text-rose-500 shrink-0 mt-0.5" />
                      <div className="flex-1 min-w-0">
                        <div className="font-bold text-[11px] text-slate-800 dark:text-slate-200 leading-snug line-clamp-2">
                          {n.title}
                        </div>
                        <div className="text-[9px] text-slate-400 dark:text-slate-500 mt-1">
                          {n.created_at ? new Date(n.created_at).toLocaleDateString("bn-BD") : ""}
                        </div>
                      </div>
                    </div>
                  ))
                ) : (
                  <>
                    <div className="flex items-start gap-2 bg-slate-50 dark:bg-slate-950 p-2.5 rounded-lg border border-slate-200 dark:border-slate-800">
                      <Pin className="w-3.5 h-3.5 text-rose-500 shrink-0 mt-0.5" />
                      <div>
                        <div className="font-bold text-[11px] text-slate-800 dark:text-slate-200">নতুন শিক্ষাবর্ষে ভর্তি কার্যক্রম শুরু</div>
                        <div className="text-[9px] text-slate-400 dark:text-slate-500 mt-0.5">20 Sep 2025</div>
                      </div>
                    </div>
                    <div className="flex items-start gap-2 bg-slate-50 dark:bg-slate-950 p-2.5 rounded-lg border border-slate-200 dark:border-slate-800">
                      <Pin className="w-3.5 h-3.5 text-rose-500 shrink-0 mt-0.5" />
                      <div>
                        <div className="font-bold text-[11px] text-slate-800 dark:text-slate-200">শিক্ষক-অভিভাবক সভা আগামী ২৫ সেপ্টেম্বর</div>
                        <div className="text-[9px] text-slate-400 dark:text-slate-500 mt-0.5">18 Sep 2025</div>
                      </div>
                    </div>
                    <div className="flex items-start gap-2 bg-slate-50 dark:bg-slate-950 p-2.5 rounded-lg border border-slate-200 dark:border-slate-800">
                      <Pin className="w-3.5 h-3.5 text-rose-500 shrink-0 mt-0.5" />
                      <div>
                        <div className="font-bold text-[11px] text-slate-800 dark:text-slate-200">বার্ষিক পুনর্মিলনী সময়সূচি প্রকাশ</div>
                        <div className="text-[9px] text-slate-400 dark:text-slate-500 mt-0.5">15 Sep 2025</div>
                      </div>
                    </div>
                  </>
                )}
              </div>
            </div>

            {/* ── Gallery ── */}
            <div id="gallery" className="lg:col-span-3 bg-white dark:bg-slate-900 rounded-xl p-5 border border-slate-200 dark:border-slate-800 shadow-sm">
              <div className="flex items-center justify-between mb-3 pb-2 border-b border-slate-200 dark:border-slate-700">
                <h3 className="text-sm font-bold text-[#0a4d8c] dark:text-blue-400 flex items-center gap-1.5">
                  <ImageIcon className="w-4 h-4 text-emerald-600" /> গ্যালারি
                </h3>
                <a href="#gallery" className="text-[10px] text-blue-600 dark:text-blue-400 font-bold hover:underline">
                  সকল ছবি →
                </a>
              </div>

              <div className="grid grid-cols-2 gap-2">
                {galleryImages.map((img, idx) => (
                  <div key={idx} className="h-20 rounded-lg overflow-hidden border border-slate-200 dark:border-slate-800">
                    <img
                      src={img}
                      alt="Gallery"
                      className="w-full h-full object-cover hover:scale-110 transition duration-300"
                    />
                  </div>
                ))}
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* ══════════════════════════════════════════════════════════════
          TEACHERS TABLE SECTION
      ══════════════════════════════════════════════════════════════ */}
      <section id="teachers" className="py-8 bg-white dark:bg-slate-900 border-t border-slate-200 dark:border-slate-800">
        <div className="max-w-7xl mx-auto px-4">
          <div className="bg-slate-50 dark:bg-slate-950 rounded-xl p-5 border border-slate-200 dark:border-slate-800 shadow-sm">
            <div className="flex items-center justify-between mb-4 pb-3 border-b border-slate-200 dark:border-slate-700">
              <div className="flex items-center gap-2">
                <Users className="w-5 h-5 text-blue-700 dark:text-blue-400" />
                <h3 className="text-base font-bold text-slate-800 dark:text-slate-100">পরিচালকবৃন্দ ও শিক্ষকমণ্ডলী</h3>
              </div>
              <a href="#teachers" className="text-xs font-bold text-blue-600 dark:text-blue-400 hover:underline">
                সকল দেখুন →
              </a>
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
                  {staffList.map((stf) => (
                    <tr key={stf.sl} className="hover:bg-blue-50/50 dark:hover:bg-slate-800/50 transition">
                      <td className="p-2.5 text-center font-bold text-slate-500 dark:text-slate-400">{stf.sl}</td>
                      <td className="p-2.5">
                        <div className="w-8 h-8 rounded-full overflow-hidden bg-slate-200 dark:bg-slate-700 border border-slate-300 dark:border-slate-600">
                          {stf.photo ? (
                            <img src={stf.photo} alt={stf.name} className="w-full h-full object-cover" />
                          ) : (
                            <div className="w-full h-full flex items-center justify-center text-[11px] font-bold text-slate-500 bg-gradient-to-br from-slate-200 to-slate-300">
                              {stf.name.charAt(0)}
                            </div>
                          )}
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
      </section>

      {/* ══════════════════════════════════════════════════════════════
          CONTACT SECTION
      ══════════════════════════════════════════════════════════════ */}
      <section id="contact" className="py-8 bg-slate-50 dark:bg-slate-950 border-t border-slate-200 dark:border-slate-800">
        <div className="max-w-7xl mx-auto px-4">
          <div className="bg-gradient-to-r from-[#0a4d8c] to-[#0d5ca8] rounded-xl p-6 md:p-8 text-white shadow-xl">
            <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
              <div className="md:col-span-2">
                <h3 className="text-xl font-bold mb-3">যোগাযোগ করুন</h3>
                <p className="text-sm text-blue-100 mb-4">
                  ভর্তি, ফি বা যেকোনো তথ্যের জন্য আমাদের সাথে যোগাযোগ করুন
                </p>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-sm">
                  <div className="flex items-center gap-2 bg-white/10 rounded-lg px-3 py-2">
                    <MapPin className="w-4 h-4 text-emerald-300 shrink-0" />
                    <span>{schoolAddress}</span>
                  </div>
                  <div className="flex items-center gap-2 bg-white/10 rounded-lg px-3 py-2">
                    <Phone className="w-4 h-4 text-emerald-300 shrink-0" />
                    <span>{schoolPhone}</span>
                  </div>
                  <div className="flex items-center gap-2 bg-white/10 rounded-lg px-3 py-2">
                    <Mail className="w-4 h-4 text-emerald-300 shrink-0" />
                    <span>{schoolEmail}</span>
                  </div>
                </div>
              </div>
              <div className="flex flex-col gap-3 justify-center">
                <Link
                  href="/admission"
                  className="bg-emerald-500 hover:bg-emerald-600 text-white font-bold py-3 px-5 rounded-xl text-center transition shadow-lg flex items-center justify-center gap-2"
                >
                  <UserCheck className="w-4 h-4" /> অনলাইন ভর্তি
                </Link>
                <Link
                  href="/login"
                  className="bg-amber-500 hover:bg-amber-600 text-slate-900 font-bold py-3 px-5 rounded-xl text-center transition shadow-lg flex items-center justify-center gap-2"
                >
                  <LogIn className="w-4 h-4" /> লগইন করুন
                </Link>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* ══════════════════════════════════════════════════════════════
          FOOTER - PDF অনুযায়ী
      ══════════════════════════════════════════════════════════════ */}
      <footer className="bg-[#083b6b] dark:bg-slate-950 text-white py-6 border-t border-blue-900 dark:border-slate-800">
        <div className="max-w-7xl mx-auto px-4">
          <div className="flex flex-col md:flex-row items-center justify-between gap-4">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-full border-2 border-white/30 flex items-center justify-center bg-white/10 overflow-hidden">
                {schoolLogo ? (
                  <img src={schoolLogo} alt="Logo" className="w-full h-full object-cover" />
                ) : (
                  <GraduationCap className="w-5 h-5 text-white" />
                )}
              </div>
              <div>
                <div className="font-bold text-sm">{schoolName}</div>
                <div className="text-[10px] text-blue-200 flex items-center gap-1.5">
                  <span>শিক্ষা</span>
                  <span className="w-1 h-1 rounded-full bg-blue-300"></span>
                  <span>শৃঙ্খলা</span>
                  <span className="w-1 h-1 rounded-full bg-blue-300"></span>
                  <span>সুন্দর ভবিষ্যৎ</span>
                </div>
              </div>
            </div>

            <div className="text-center md:text-right text-blue-200 text-[11px]">
              © 2025 {schoolName}। সর্বস্বত্ব সংরক্ষিত।
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