import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Moshe Hayat — CEO, KLOMIT LTD",
  description:
    "Digital business card for Moshe Hayat, CEO of KLOMIT LTD.",
  openGraph: {
    title: "Moshe Hayat — CEO, KLOMIT LTD",
    description: "Connect with Moshe Hayat, CEO of KLOMIT LTD",
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
