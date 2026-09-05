import type { Metadata } from "next";
import "./globals.css";
import { Header } from "@/components/Header";
import { Footer } from "@/components/Footer";
import { TemporaryLoadingGate } from "@/components/TemporaryLoadingGate";
export const metadata: Metadata = {
  title: "سوزامن | مراقبت از پوست",
  description: "فروشگاه مینیمال محصولات مراقبت از پوست و زیبایی",
};
export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="fa" dir="rtl">
      <body>
        <TemporaryLoadingGate />
        <Header />
        <main>{children}</main>
        <Footer />
      </body>
    </html>
  );
}
