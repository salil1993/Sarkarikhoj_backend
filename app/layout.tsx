import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Sarkari Scheme Eligibility Checker API",
  description: "Backend API for scheme eligibility and listings.",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body style={{ fontFamily: "system-ui, sans-serif", margin: 24 }}>{children}</body>
    </html>
  );
}
