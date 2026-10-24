"use client";

import Image from "next/image";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { type FormEvent, useEffect, useState } from "react";
import {
  ACADEMIC_PROGRAMS,
  ACADEMIC_LEVELS,
  ACADEMIC_SUBJECTS,
  EMPTY_SITE_CONTENT,
  LOCAL_GALLERY_IMAGES,
  SCHOOL_CONTACT,
  SCHOOL_NAME,
  SCHOOL_NAME_BN,
  SOCIAL_LINKS,
  type SiteContent,
  type TeacherProfile,
} from "@/lib/school-data";

type UploadedImage = {
  name: string;
  url: string;
};

type AdmissionResponse = {
  message?: string;
};

const APP_DOWNLOAD_URL = "https://github.com/ismailmuhammad15g-code/samdania-madrasah-app/releases/download/app/app-debug.apk";
const APP_LOGO_URL = "https://i.ibb.co.com/gb5b5CYR/logo2.png";

const APP_FEATURES_EN = [
  ["🎓", "Smart Student Dashboard", "See your academic profile, student ID information, and class details in one place."],
  ["🕒", "Real-time Attendance", "Check daily attendance records with cloud synchronization."],
  ["🪪", "Digital ID Card", "Access your official student identity card from your phone."],
  ["📊", "Results & Academic Tracking", "View examination results, progress reports, and academic syllabus."],
  ["📚", "Routine & Homework", "Keep up with class schedules and daily homework."],
  ["👩‍🏫", "Teacher Portal", "A dedicated portal for teachers to manage academic information."],
  ["💳", "Fees & Payment History", "Review payment records and pending fees transparently."],
  ["🏆", "Islamic Quiz Contest", "Take part in daily Islamic and general knowledge quizzes."],
  ["🔔", "Instant Notifications", "Receive official notices and updates through push alerts."],
  ["📶", "Professional Experience", "Modern interface, skeleton loading, and network-status alerts."],
];

const APP_FEATURES_BN = [
  ["🎓", "স্মার্ট স্টুডেন্ট ড্যাশবোর্ড", "এক জায়গায় একাডেমিক প্রোফাইল, শিক্ষার্থী আইডি ও শ্রেণির তথ্য দেখুন।"],
  ["🕒", "রিয়েল-টাইম উপস্থিতি", "ক্লাউড সিঙ্ক্রোনাইজেশনের মাধ্যমে প্রতিদিনের হাজিরার রেকর্ড দেখুন।"],
  ["🪪", "ডিজিটাল আইডি কার্ড", "মোবাইল থেকেই আপনার অফিসিয়াল শিক্ষার্থী পরিচয়পত্র ব্যবহার করুন।"],
  ["📊", "রেজাল্ট ও একাডেমিক অগ্রগতি", "পরীক্ষার ফলাফল, প্রগতি প্রতিবেদন ও একাডেমিক সিলেবাস দেখুন।"],
  ["📚", "রুটিন ও বাড়ির কাজ", "ক্লাসের সময়সূচী ও প্রতিদিনের বাড়ির কাজ সম্পর্কে আপডেট থাকুন।"],
  ["👩‍🏫", "শিক্ষক পোর্টাল", "শিক্ষকদের জন্য একাডেমিক তথ্য পরিচালনার বিশেষ পোর্টাল।"],
  ["💳", "ফি ও পেমেন্টের ইতিহাস", "পেমেন্ট রেকর্ড ও বকেয়া ফি স্বচ্ছভাবে যাচাই করুন।"],
  ["🏆", "ইসলামিক কুইজ প্রতিযোগিতা", "দৈনিক ইসলামিক ও সাধারণ জ্ঞানভিত্তিক কুইজে অংশ নিন।"],
  ["🔔", "তাৎক্ষণিক বিজ্ঞপ্তি", "পুশ অ্যালার্টের মাধ্যমে অফিসিয়াল নোটিশ ও আপডেট পান।"],
  ["📶", "আধুনিক ব্যবহার অভিজ্ঞতা", "আধুনিক ইন্টারফেস, স্কেলেটন লোডিং ও ইন্টারনেট সংযোগের সতর্কতা।"],
];

function LoadingImage({
  src,
  alt,
  className,
  priority = false,
  draggable,
}: {
  src: string;
  alt: string;
  className?: string;
  priority?: boolean;
  draggable?: boolean;
}) {
  const [loaded, setLoaded] = useState(false);
  const [failed, setFailed] = useState(false);

  return (
    <>
      <span className={`image-skeleton${loaded || failed ? " is-hidden" : ""}`} aria-hidden="true" />
      {failed ? (
        <span className="image-error" role="img" aria-label={alt}>
          {alt}
        </span>
      ) : (
        <Image
          src={src}
          alt={alt}
          fill
          priority={priority}
          unoptimized={src.startsWith("http") || src.startsWith("data:image/")}
          sizes="(max-width: 680px) 92vw, (max-width: 1100px) 48vw, 42vw"
          className={className}
          draggable={draggable}
          onLoad={() => setLoaded(true)}
          onError={() => setFailed(true)}
        />
      )}
    </>
  );
}

export default function SchoolSite() {
  const pathname = usePathname();
  const isAdmissionPage = pathname === "/admission";
  const isAboutPage = pathname === "/about";
  const isAppPage = pathname === "/app";
  const isHomePage = !isAdmissionPage && !isAboutPage && !isAppPage;
  const [isBengali, setIsBengali] = useState(false);
  const [mobileOpen, setMobileOpen] = useState(false);
  const [gallery, setGallery] = useState<UploadedImage[]>([]);
  const [content, setContent] = useState<SiteContent>(EMPTY_SITE_CONTENT);
  const [galleryError, setGalleryError] = useState(false);
  const [contentError, setContentError] = useState(false);
  const [formStatus, setFormStatus] = useState("");
  const [formError, setFormError] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [teachers, setTeachers] = useState<TeacherProfile[]>([]);
  const [teachersError, setTeachersError] = useState(false);

  useEffect(() => {
    document.documentElement.lang = isBengali ? "bn" : "en";
  }, [isBengali]);

  useEffect(() => {
    let active = true;

    if (isHomePage) void fetch("/api/gallery", { cache: "no-store" })
      .then(async (response) => {
        if (!response.ok) throw new Error("Gallery request failed");
        return (await response.json()) as { images: UploadedImage[] };
      })
      .then((result) => {
        if (active) setGallery(result.images);
      })
      .catch(() => {
        if (active) setGalleryError(true);
      });

    if (isHomePage || isAdmissionPage) void fetch("/api/content", { cache: "no-store" })
      .then(async (response) => {
        if (!response.ok) throw new Error("Content request failed");
        return (await response.json()) as { content: SiteContent };
      })
      .then((result) => {
        if (active) setContent({ ...EMPTY_SITE_CONTENT, ...result.content });
      })
      .catch(() => {
        if (active) setContentError(true);
      });

    if (isAboutPage) void fetch("/api/teachers", { cache: "no-store" })
      .then(async (response) => {
        if (!response.ok) throw new Error("Teacher profiles could not be loaded.");
        return (await response.json()) as { teachers: TeacherProfile[] };
      })
      .then((result) => {
        if (active) setTeachers(result.teachers);
      })
      .catch(() => {
        if (active) setTeachersError(true);
      });

    return () => {
      active = false;
    };
  }, [isAboutPage, isAdmissionPage, isHomePage]);

  const t = isBengali
    ? {
        official: "অফিশিয়াল ওয়েবসাইট",
        home: "হোম",
        academics: "একাডেমিক",
        gallery: "গ্যালারি",
        admission: "ভর্তির আবেদন",
        about: "আমাদের সম্পর্কে",
        appDownload: "অ্যাপ ডাউনলোড",
        teachers: "শিক্ষকবৃন্দ",
        teachersIntro: "আমাদের শিক্ষকমণ্ডলীর পরিচিতি",
        noTeachers: "শিক্ষক পরিচিতি শিগগিরই প্রকাশ করা হবে।",
        teachersUnavailable: "শিক্ষক পরিচিতি এখন লোড করা যায়নি। পরে আবার চেষ্টা করুন।",
        name: "নাম",
        role: "পদবি",
        qualifications: "শিক্ষাগত যোগ্যতা",
        subjectsTaught: "পঠিত বিষয়",
        biography: "পরিচিতি",
        backHome: "মূল পাতায় ফিরুন",
        levels: "একাডেমিক বিভাগ",
        photos: "মাদ্রাসার গ্যালারি",
        galleryUnavailable: "নতুন গ্যালারি ছবি এখন লোড করা যায়নি।",
        contentUnavailable: "ঐচ্ছিক সংরক্ষিত ওয়েবসাইটের লেখা এখন লোড করা যায়নি; নিশ্চিত তথ্য এখানে দেখা যাচ্ছে।",
        board: "শিক্ষাক্রম / বোর্ড",
        schedule: "সময়সূচি",
        classTime: "সকাল ৯:০০টা – দুপুর ১:২০টা",
        breakTime: "মাঝখানে ১৫ মিনিটের বিরতি",
        subjects: "পঠিত বিষয়",
        primaryCurriculum: "বাংলা, ইংরেজি ও গণিত সরকারি প্রাথমিক শিক্ষাক্রম অনুযায়ী।",
        eligibility: "যোগ্যতা",
        age: "৫ থেকে ১০ বছর",
        admissionTiming: "আবেদনের সময়",
        admissionDates: "শিশু জামাতের ভর্তিচ্ছুকদের জন্য প্রতি বছর নভেম্বর ও ডিসেম্বরে বিনামূল্যে প্রস্তুতিমূলক ক্লাসের ব্যবস্থা থাকে। সাধারণ ভর্তি জানুয়ারি থেকে মার্চ পর্যন্ত চলে। যোগ্য শিক্ষার্থী বছরের যেকোনো সময় ভর্তি হতে পারে।",
        documents: "প্রয়োজনীয় কাগজপত্র",
        documentList: "অভিভাবকের জাতীয় পরিচয়পত্রের ফটোকপি, শিক্ষার্থীর পাসপোর্ট সাইজের ছবি এবং জন্ম নিবন্ধনের ফটোকপি।",
        fees: "ভর্তি ফি",
        feesCopy: "ভর্তি ফির তথ্য প্রকাশিত হয়নি।",
        finalAdmission: "চূড়ান্ত ভর্তি",
        physicalForm: "অনলাইনে আবেদন করলেও মাদ্রাসা অফিসে সরাসরি ভর্তি ফরমে স্বাক্ষর করার পর ভর্তি প্রক্রিয়া সম্পন্ন হবে।",
        privacy: "গোপনীয়তা",
        privacyCopy: "আবেদনকারীর তথ্য গোপন রাখা হবে এবং শুধুমাত্র ভর্তি ও প্রশাসনিক কাজে ব্যবহার করা হবে।",
        contactDetails: "যোগাযোগ",
        address: "ঠিকানা",
        phone: "ফোন",
        email: "ইমেইল",
        galleryProtection: "ছবিতে রাইট-ক্লিক ও ড্র্যাগ বন্ধ রাখা হয়েছে। তবে স্ক্রিনশট বা ব্রাউজারের অন্যান্য উপায়ে ছবি সংরক্ষণ পুরোপুরি আটকানো যায় না।",
        student: "শিক্ষার্থীর নাম",
        studentAge: "শিক্ষার্থীর বয়স (৫–১০ বছর)",
        guardian: "অভিভাবকের নাম",
        contact: "যোগাযোগ নম্বর",
        level: "ভর্তির শ্রেণি/স্তর",
        choose: "একটি স্তর বেছে নিন",
        note: "অতিরিক্ত তথ্য (ঐচ্ছিক)",
        consent: "আমি সম্মতি দিচ্ছি যে আমার তথ্য গোপন রাখা হবে এবং শুধুমাত্র ভর্তি ও প্রশাসনিক কাজে ব্যবহার করা হবে।",
        submit: "আবেদন পাঠান",
        sending: "পাঠানো হচ্ছে",
        success: "আপনার ভর্তির আবেদন গ্রহণ করা হয়েছে।",
        failed: "আবেদন পাঠানো যায়নি। কিছুক্ষণ পর আবার চেষ্টা করুন।",
        serverUnavailable: "আবেদন ব্যবস্থা এখনো সংযুক্ত নয়। মাদ্রাসা ওয়েবসাইটের সার্ভারে Supabase সেটআপ করতে হবে।",
        required: "অনুগ্রহ করে সব আবশ্যিক তথ্য পূরণ করুন এবং সম্মতি দিন।",
        language: "English",
        footer: "অফিশিয়াল ওয়েবসাইট",
        appTagline: "ডিজিটাল উৎকর্ষতার মাধ্যমে শিক্ষার অগ্রযাত্রা",
        appWelcome: "সামদানিয়া তা'লীমুল ইসলাম মাদ্রাসা, গলাচিপার অফিসিয়াল ডিজিটাল গেটওয়েতে আপনাকে স্বাগতম।",
        appIntro: "শিক্ষার্থী, অভিভাবক ও শিক্ষকদের জন্য সহজ একাডেমিক অভিজ্ঞতা—হাজিরা থেকে ফলাফল, প্রয়োজনীয় সবকিছু এখন হাতের মুঠোয়।",
        appFeatures: "অ্যাপের মূল সুবিধাসমূহ",
        downloadNow: "এখনই অ্যাপ ডাউনলোড করুন",
        appClosing: "মাদ্রাসা ব্যবস্থাপনার ডিজিটাল ভবিষ্যতের সঙ্গে যুক্ত থাকুন। সামদানিয়া মাদ্রাসার ডিজিটাল যাত্রায় আমাদের সঙ্গী হোন।",
        androidApk: "অ্যান্ড্রয়েড অ্যাপ (APK)",
        appCopyright: "অ্যাপ ও ওয়েবসাইটের সর্বস্বত্ব সংরক্ষিত।",
      }
    : {
        official: "Official website",
        home: "Home",
        academics: "Academics",
        gallery: "Gallery",
        admission: "Admission request",
        about: "About us",
        appDownload: "Download app",
        teachers: "Our teachers",
        teachersIntro: "Meet our teaching team",
        noTeachers: "Teacher profiles will be published here soon.",
        teachersUnavailable: "Teacher profiles could not be loaded right now. Please try again later.",
        name: "Name",
        role: "Position",
        qualifications: "Education & qualifications",
        subjectsTaught: "Subjects",
        biography: "Biography",
        backHome: "Back to home",
        levels: "Academic programs",
        photos: "Madrasah gallery",
        galleryUnavailable: "New gallery photos could not be loaded right now.",
        contentUnavailable: "Optional saved website copy could not be loaded; confirmed information is still shown here.",
        board: "Curriculum / Board",
        schedule: "Class schedule",
        classTime: "9:00 AM – 1:20 PM",
        breakTime: "A 15-minute break",
        subjects: "Subjects",
        primaryCurriculum: "Bengali, English, and Mathematics follow the Government Primary Curriculum.",
        eligibility: "Eligibility",
        age: "5 to 10 years",
        admissionTiming: "Application period",
        admissionDates: "Free preparatory classes for Shishu Jamat applicants are arranged every November and December. General admissions run from January through March. Eligible students may be admitted at any time during the year.",
        documents: "Required documents",
        documentList: "Photocopy of the guardian’s NID card, a passport-size student photograph, and photocopy of the student’s birth registration certificate.",
        fees: "Admission fee",
        feesCopy: "Admission fees have not been published.",
        finalAdmission: "Finalizing admission",
        physicalForm: "An online request does not complete admission. The physical admission form must be signed at the madrasah office.",
        privacy: "Privacy",
        privacyCopy: "Applicant information will be kept confidential and used only for admission and administrative purposes.",
        contactDetails: "Contact",
        address: "Address",
        phone: "Phone",
        email: "Email",
        galleryProtection: "Right-clicking and dragging are disabled on gallery images. Screenshots or other browser tools can still save publicly displayed images.",
        student: "Student name",
        studentAge: "Student age (5–10 years)",
        guardian: "Parent or guardian name",
        contact: "Contact number",
        level: "Requested class / level",
        choose: "Choose a level",
        note: "Additional information (optional)",
        consent: "I agree that my information will be kept confidential and used only for admission and administrative purposes.",
        submit: "Send request",
        sending: "Sending",
        success: "Your admission request was received.",
        failed: "The request could not be sent. Please try again.",
        serverUnavailable: "Admissions are not connected yet. The website administrator must configure Supabase on the website server.",
        required: "Complete the required fields and consent before sending.",
        language: "বাংলা",
        footer: "Official website",
        appTagline: "Empowering Education through Digital Excellence",
        appWelcome: "Welcome to the official digital gateway of Samdania Talimul Islam Madrasah, Galachipa.",
        appIntro: "Designed for students, parents, and teachers, the app brings attendance, results, and essential academic services together in one convenient place.",
        appFeatures: "Explore the app features",
        downloadNow: "Download the app now",
        appClosing: "Experience the future of Madrasah management. Stay connected and stay updated with Samdania Madrasah.",
        androidApk: "Android app (APK)",
        appCopyright: "App and website. All rights reserved.",
      };

  const name = isBengali ? SCHOOL_NAME_BN : SCHOOL_NAME;

  async function submitAdmission(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setFormStatus("");
    setFormError(false);

    const form = event.currentTarget;
    if (!form.reportValidity()) {
      setFormError(true);
      setFormStatus(t.required);
      return;
    }

    const formData = new FormData(form);
    const request = {
      studentName: String(formData.get("studentName") ?? "").trim(),
      studentAge: Number(formData.get("studentAge")),
      guardianName: String(formData.get("guardianName") ?? "").trim(),
      contact: String(formData.get("contact") ?? "").trim(),
      className: String(formData.get("className") ?? ""),
      message: String(formData.get("message") ?? "").trim(),
      website: String(formData.get("website") ?? ""),
      consent: formData.get("consent") === "on",
    };

    setIsSubmitting(true);
    try {
      const response = await fetch("/api/admissions", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(request),
      });
      const result = (await response.json()) as AdmissionResponse;

      if (!response.ok) {
        if (response.status === 503) throw new Error(t.serverUnavailable);
        throw new Error(result.message || t.failed);
      }

      form.reset();
      setFormStatus(t.success);
    } catch (error) {
      setFormError(true);
      setFormStatus(error instanceof Error ? error.message : t.failed);
    } finally {
      setIsSubmitting(false);
    }
  }

  const allGalleryImages = [
    ...LOCAL_GALLERY_IMAGES.map((url) => ({ url, key: url })),
    ...gallery.map((image) => ({ url: image.url, key: image.name })),
  ];

  function closeMobileMenu() {
    setMobileOpen(false);
  }

  return (
    <div className="site-shell">
      <header className="site-header">
        <div className="header-inner">
          <Link className="brand" href="/" aria-label={name}>
            <span className="brand-mark">
              <LoadingImage
                src="/school-logo.webp"
                alt=""
                className="brand-logo"
                priority
              />
            </span>
            <span>
              <span className="brand-name">{name}</span>
              <span className="brand-caption">{t.official}</span>
            </span>
          </Link>

          <nav className="desktop-nav" aria-label={isBengali ? "প্রধান নেভিগেশন" : "Main navigation"}>
            <Link href="/">{t.home}</Link>
            {isHomePage && <Link href="/#academics">{t.academics}</Link>}
            {isHomePage && <Link href="/#gallery">{t.gallery}</Link>}
            <Link href="/about">{t.about}</Link>
            <Link href="/admission">{t.admission}</Link>
            <Link href="/app">{t.appDownload}</Link>
          </nav>

          <div className="mobile-nav">
            <button
              className="language-button"
              type="button"
              onClick={() => setIsBengali((value) => !value)}
              aria-label={isBengali ? "Switch to English" : "বাংলায় দেখুন"}
            >
              {t.language}
            </button>
            <button
              className="language-button menu-button"
              type="button"
              onClick={() => setMobileOpen((value) => !value)}
              aria-expanded={mobileOpen}
              aria-controls="mobile-menu"
            >
              {mobileOpen ? "×" : "☰"}
            </button>
          </div>

          <button
            className="language-button desktop-language"
            type="button"
            onClick={() => setIsBengali((value) => !value)}
            aria-label={isBengali ? "Switch to English" : "বাংলায় দেখুন"}
          >
            {t.language}
          </button>
        </div>
        {mobileOpen && (
          <nav id="mobile-menu" className="mobile-menu" aria-label={isBengali ? "প্রধান নেভিগেশন" : "Main navigation"}>
            <Link href="/" onClick={closeMobileMenu}>{t.home}</Link>
            {isHomePage && <Link href="/#academics" onClick={closeMobileMenu}>{t.academics}</Link>}
            {isHomePage && <Link href="/#gallery" onClick={closeMobileMenu}>{t.gallery}</Link>}
            <Link href="/about" onClick={closeMobileMenu}>{t.about}</Link>
            <Link href="/admission" onClick={closeMobileMenu}>{t.admission}</Link>
            <Link href="/app" onClick={closeMobileMenu}>{t.appDownload}</Link>
          </nav>
        )}
      </header>

      <main>
        {isAppPage && <section className="app-download-section">
          <div className="section-inner">
            <div className="app-download-hero">
              <div className="app-download-copy">
                <span className="eyebrow">{isBengali ? "অফিশিয়াল মাদ্রাসা অ্যাপ" : "Official Madrasah App"}</span>
                <h1>{isBengali ? "সামদানিয়া তালিমুল ইসলাম মাদ্রাসা অ্যাপ" : "Samdania Talimul Islam Madrasah Official App"}</h1>
                <p className="app-tagline">{t.appTagline}</p>
                <p className="app-welcome">{t.appWelcome}</p>
                <p className="app-intro">{t.appIntro}</p>
                <a className="button-primary app-download-button" href={APP_DOWNLOAD_URL} download>
                  <span aria-hidden="true">⬇</span>
                  {t.downloadNow}
                </a>
                <p className="app-platform">{t.androidApk}</p>
              </div>
              <div className="app-logo-wrap">
                <LoadingImage
                  src={APP_LOGO_URL}
                  alt={isBengali ? "সামদানিয়া মাদ্রাসা অ্যাপের লোগো" : "Samdania Madrasah app logo"}
                  className="app-logo"
                  priority
                />
              </div>
            </div>

            <div className="app-features">
              <div className="section-heading">
                <div>
                  <span className="eyebrow">{isBengali ? "এক অ্যাপে প্রয়োজনীয় সেবা" : "Everything you need in one app"}</span>
                  <h2>{t.appFeatures}</h2>
                </div>
              </div>
              <div className="app-feature-grid">
                {(isBengali ? APP_FEATURES_BN : APP_FEATURES_EN).map(([icon, title, description]) => (
                  <article className="app-feature-card" key={title}>
                    <span className="app-feature-icon" aria-hidden="true">{icon}</span>
                    <div>
                      <h3>{title}</h3>
                      <p>{description}</p>
                    </div>
                  </article>
                ))}
              </div>
            </div>

            <div className="app-download-cta">
              <h2>{t.downloadNow}</h2>
              <p>{t.appClosing}</p>
              <a className="button-primary app-download-button" href={APP_DOWNLOAD_URL} download>
                <span aria-hidden="true">⬇</span>
                {t.downloadNow}
              </a>
            </div>
          </div>
        </section>}

        {isHomePage && <section className="hero" id="home">
          <div className="section-inner hero-grid">
            <div className="hero-copy">
              <span className="eyebrow">{t.official}</span>
              <h1>{name}</h1>
              <p className="hero-subtitle">{isBengali ? SCHOOL_NAME : SCHOOL_NAME_BN}</p>
              <p className="hero-motto" lang="bn">
                অভিভাবকের ইচ্ছা, শিক্ষার্থীর প্রচেষ্টা, প্রতিষ্ঠানের জবাবদিহিতা এবং আল্লাহর কবুলের উপর আস্থার আশায়....
              </p>
              <div className="hero-actions">
                <Link className="button-primary" href="/admission">{t.admission}</Link>
                <Link className="button-secondary" href="/#gallery">{t.photos}</Link>
              </div>
            </div>
            <div className="hero-image-wrap" aria-label={name}>
              <div className="hero-image">
                <LoadingImage
                  src="/school-logo.webp"
                  alt={name}
                  className="hero-logo"
                  priority
                />
              </div>
            </div>
          </div>
        </section>}

        {isHomePage && <section className="section academics-section" id="academics">
          <div className="section-inner">
            <div className="section-heading">
              <div>
                <span className="eyebrow">{t.academics}</span>
                <h2>{t.levels}</h2>
              </div>
            </div>
            <div className="program-grid">
              {ACADEMIC_PROGRAMS.map((program, index) => (
                <div className="program-card" key={program.name_en}>
                  <span className="program-index">{String(index + 1).padStart(2, "0")}</span>
                  <div>
                    <strong>{isBengali ? program.name_bn : program.name_en}</strong>
                    <p>{isBengali ? program.description_bn : program.description_en}</p>
                  </div>
                </div>
              ))}
            </div>
            <div className="academic-facts">
              <article className="fact-card">
                <h3>{t.board}</h3>
                <p>{isBengali ? "সামদানিয়া মাদ্রাসা শিক্ষা বোর্ড" : "Samdania Madrasa Education Board"}</p>
              </article>
              <article className="fact-card">
                <h3>{t.schedule}</h3>
                <p>{t.classTime}</p>
                <p>{t.breakTime}</p>
              </article>
              <article className="fact-card subjects-card">
                <h3>{t.subjects}</h3>
                <p>{t.primaryCurriculum}</p>
                <ul className="subject-list">
                  {ACADEMIC_SUBJECTS.map((subject) => (
                    <li key={subject.en}>{isBengali ? subject.bn : subject.en}</li>
                  ))}
                </ul>
              </article>
            </div>
            {(isBengali ? content.academic_bn : content.academic_en).trim() && (
              <p className="verified-copy">
                {(isBengali ? content.academic_bn : content.academic_en).trim()}
              </p>
            )}
            {contentError && <p className="load-note" role="status">{t.contentUnavailable}</p>}
          </div>
        </section>}

        {isHomePage && <section className="section gallery-section" id="gallery">
          <div className="section-inner">
            <div className="section-heading">
              <div>
                <span className="eyebrow">{t.gallery}</span>
                <h2>{t.photos}</h2>
              </div>
            </div>
            <div className="gallery-grid">
              {allGalleryImages.map((image, index) => (
                <div
                  className="gallery-card"
                  key={image.key}
                  onContextMenu={(event) => event.preventDefault()}
                  onDragStart={(event) => event.preventDefault()}
                >
                  <LoadingImage
                    src={image.url}
                    alt={`${t.photos} ${index + 1}`}
                    draggable={false}
                  />
                </div>
              ))}
            </div>
            <p className="gallery-protection">{t.galleryProtection}</p>
            {galleryError && <p className="load-note" role="status">{t.galleryUnavailable}</p>}
          </div>
        </section>}

        {isAdmissionPage && <section className="section admission-section" id="admission">
          <div className="section-inner">
            <div className="section-heading">
              <div>
                <span className="eyebrow">{t.admission}</span>
                <h2>{t.admission}</h2>
              </div>
            </div>
            <div className="admission-grid">
              <div>
                <div className="admission-facts">
                  <article className="admission-fact">
                    <h3>{t.eligibility}</h3>
                    <p>{t.age}</p>
                  </article>
                  <article className="admission-fact">
                    <h3>{t.admissionTiming}</h3>
                    <p>{t.admissionDates}</p>
                  </article>
                  <article className="admission-fact">
                    <h3>{t.documents}</h3>
                    <p>{t.documentList}</p>
                  </article>
                  <article className="admission-fact">
                    <h3>{t.fees}</h3>
                    <p>{t.feesCopy}</p>
                  </article>
                  <article className="admission-fact">
                    <h3>{t.finalAdmission}</h3>
                    <p>{t.physicalForm}</p>
                  </article>
                  <article className="admission-fact">
                    <h3>{t.privacy}</h3>
                    <p>{t.privacyCopy}</p>
                  </article>
                </div>
                {(isBengali ? content.admission_bn : content.admission_en).trim() && (
                  <p className="admission-copy">
                    {(isBengali ? content.admission_bn : content.admission_en).trim()}
                  </p>
                )}
                <div className="contact-card">
                  <h3>{t.contactDetails}</h3>
                  <p><strong>{t.address}:</strong> {isBengali ? SCHOOL_CONTACT.address_bn : SCHOOL_CONTACT.address_en}</p>
                  <p>
                    <strong>{t.phone}:</strong>{" "}
                    <a href={`tel:${SCHOOL_CONTACT.phone}`}>{SCHOOL_CONTACT.phone}</a>
                  </p>
                  <p>
                    <strong>{t.email}:</strong>{" "}
                    <a href={`mailto:${SCHOOL_CONTACT.email}`}>{SCHOOL_CONTACT.email}</a>
                  </p>
                </div>
                <div className="social-links">
                  {SOCIAL_LINKS.map((social) => (
                    <a
                      className="social-link"
                      href={social.href}
                      key={social.label}
                      target="_blank"
                      rel="noreferrer"
                    >
                      {social.label}
                    </a>
                  ))}
                </div>
              </div>

              <form className="admission-form" onSubmit={submitAdmission}>
                <div className="honeypot" aria-hidden="true">
                  <label htmlFor="website">Website</label>
                  <input id="website" name="website" tabIndex={-1} autoComplete="off" />
                </div>
                <div className="form-field">
                  <label htmlFor="studentName">{t.student}</label>
                  <input id="studentName" name="studentName" required maxLength={120} />
                </div>
                <div className="form-field">
                  <label htmlFor="studentAge">{t.studentAge}</label>
                  <input id="studentAge" name="studentAge" type="number" required min={5} max={10} step={1} />
                </div>
                <div className="form-field">
                  <label htmlFor="guardianName">{t.guardian}</label>
                  <input id="guardianName" name="guardianName" required maxLength={120} />
                </div>
                <div className="form-field">
                  <label htmlFor="contact">{t.contact}</label>
                  <input id="contact" name="contact" type="tel" required maxLength={40} autoComplete="tel" />
                </div>
                <div className="form-field">
                  <label htmlFor="className">{t.level}</label>
                  <select id="className" name="className" required defaultValue="">
                    <option value="" disabled>{t.choose}</option>
                    {ACADEMIC_LEVELS.map((level) => <option value={level} key={level}>{level}</option>)}
                  </select>
                </div>
                <div className="form-field full">
                  <label htmlFor="message">{t.note}</label>
                  <textarea id="message" name="message" maxLength={1000} />
                </div>
                <label className="consent-label form-field full">
                  <input name="consent" type="checkbox" required />
                  <span>{t.consent}</span>
                </label>
                <button className="submit-button" type="submit" disabled={isSubmitting}>
                  {isSubmitting && <span className="spinner" aria-hidden="true" />}
                  {isSubmitting ? t.sending : t.submit}
                </button>
                {formStatus && (
                  <p className={`form-status${formError ? " error" : ""}`} role="status">
                    {formStatus}
                  </p>
                )}
              </form>
            </div>
          </div>
        </section>}

        {isAboutPage && <section className="section about-section">
          <div className="section-inner">
            <div className="section-heading">
              <div>
                <span className="eyebrow">{t.about}</span>
                <h2>{t.teachersIntro}</h2>
              </div>
            </div>
            {teachersError ? (
              <p className="load-note" role="status">{t.teachersUnavailable}</p>
            ) : teachers.length === 0 ? (
              <p className="empty-teachers">{t.noTeachers}</p>
            ) : (
              <div className="teacher-grid">
                {teachers.map((teacher) => (
                  <article className="teacher-card" key={teacher.id}>
                    <div className="teacher-photo">
                      <LoadingImage
                        src={teacher.photo_url}
                        alt={isBengali ? teacher.name_bn : teacher.name_en}
                        draggable={false}
                      />
                    </div>
                    <div className="teacher-details">
                      <h3>{isBengali ? teacher.name_bn : teacher.name_en}</h3>
                      <p className="teacher-role">{isBengali ? teacher.role_bn : teacher.role_en}</p>
                      {(isBengali ? teacher.qualification_bn : teacher.qualification_en) && (
                        <p><strong>{t.qualifications}:</strong> {isBengali ? teacher.qualification_bn : teacher.qualification_en}</p>
                      )}
                      {(isBengali ? teacher.subjects_bn : teacher.subjects_en) && (
                        <p><strong>{t.subjectsTaught}:</strong> {isBengali ? teacher.subjects_bn : teacher.subjects_en}</p>
                      )}
                      {(isBengali ? teacher.bio_bn : teacher.bio_en) && (
                        <p className="teacher-bio">{isBengali ? teacher.bio_bn : teacher.bio_en}</p>
                      )}
                    </div>
                  </article>
                ))}
              </div>
            )}
            <Link className="button-secondary about-back-link" href="/">{t.backHome}</Link>
          </div>
        </section>}
      </main>

      <footer className="site-footer">
        <div className="footer-inner">
          <div className="footer-school">
            <strong>{SCHOOL_NAME}</strong>
            <span lang="bn">{SCHOOL_NAME_BN}</span>
            <small>© 2026 {SCHOOL_NAME}. {t.appCopyright}</small>
          </div>
          <div className="footer-socials">
            {SOCIAL_LINKS.map((social) => (
              <a href={social.href} key={social.label} target="_blank" rel="noreferrer">
                {social.label}
              </a>
            ))}
          </div>
        </div>
      </footer>
    </div>
  );
}
