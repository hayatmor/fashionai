import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Mor Hayat — CEO, Fashion AI",
  description:
    "Digital business card for Mor Hayat, CEO of Fashion AI. AI-powered creative studio for fashion brands.",
  openGraph: {
    title: "Mor Hayat — CEO, Fashion AI",
    description: "Connect with Mor Hayat, CEO of Fashion AI",
    type: "profile",
  },
};

export default function CardLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return children;
}
