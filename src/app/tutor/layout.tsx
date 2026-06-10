import type { Metadata } from "next"

export const metadata: Metadata = {
  title: "AI Tutor",
  description: "Get instant doubt resolution and step-by-step explanations from your personal AI JEE tutor. Ask questions, upload problems, and master concepts.",
}

export default function TutorLayout({ children }: { children: React.ReactNode }) {
  return <>{children}</>
}
