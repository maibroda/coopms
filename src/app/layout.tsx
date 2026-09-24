import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "Cooperative Management System",
  description: "Member contributions, loans, sales and payroll deductions.",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  );
}
