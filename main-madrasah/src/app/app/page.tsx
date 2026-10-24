import type { Metadata } from "next";
import SchoolSite from "@/components/school-site";

export const metadata: Metadata = {
  title: "Download the official app | Samdania Talimul Islam Madrasah",
  description: "Download the official Samdania Talimul Islam Madrasah Android app for students, parents, and teachers.",
};

export default function AppDownloadPage() {
  return <SchoolSite />;
}
