import type { Metadata } from "next"

export const metadata: Metadata = {
  title: "Tests & Practice",
  description: "Take adaptive JEE mock tests, chapter-wise practice sets, and previous year papers. Analyze your performance and improve your score.",
}

export default function TestsLayout({ children }: { children: React.ReactNode }) {
  return <>{children}</>
}
