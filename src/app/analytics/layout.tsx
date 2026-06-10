import type { Metadata } from "next"

export const metadata: Metadata = {
  title: "Analytics",
  description: "Visualize your JEE preparation progress. Track subject-wise performance, identify weak areas, and monitor your study time.",
}

export default function AnalyticsLayout({ children }: { children: React.ReactNode }) {
  return <>{children}</>
}
