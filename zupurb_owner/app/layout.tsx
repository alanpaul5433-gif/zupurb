import type { Metadata } from "next";
import { Inter } from "next/font/google";
import "./globals.css";
import { OwnerAuthProvider } from "@/lib/owner-auth-context";

const inter = Inter({ subsets: ["latin"] });

export const metadata: Metadata = {
  title: "Zupurb Owner Portal",
  description: "Manage your restaurant on Zupurb",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" className="h-full">
      <body className={`${inter.className} h-full bg-gray-50`}>
        <OwnerAuthProvider>{children}</OwnerAuthProvider>
      </body>
    </html>
  );
}
