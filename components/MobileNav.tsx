"use client";
import Link from "next/link";
import { Menu, X } from "lucide-react";
import { useEffect, useState } from "react";

const links = [
  { href: "/", label: "خانه" },
  { href: "/shop", label: "فروشگاه" },
  { href: "/about", label: "درباره ما" },
  { href: "/about#contact", label: "تماس با ما" },
  { href: "/legal", label: "قوانین و حریم خصوصی" },
];

export function MobileNav() {
  const [open, setOpen] = useState(false);
  useEffect(() => {
    const close = (event: KeyboardEvent) => event.key === "Escape" && setOpen(false);
    document.addEventListener("keydown", close);
    return () => document.removeEventListener("keydown", close);
  }, []);
  return (
    <div className="mobile-nav">
      <button
        className="icon-btn mobile-menu-button"
        type="button"
        aria-label={open ? "بستن منو" : "باز کردن منو"}
        aria-expanded={open}
        aria-controls="mobile-menu"
        onClick={() => setOpen(!open)}
      >
        {open ? <X size={20} /> : <Menu size={20} />}
      </button>
      {open && (
        <>
          <button
            className="mobile-menu-backdrop"
            aria-label="بستن منو"
            onClick={() => setOpen(false)}
          />
          <nav className="mobile-menu" id="mobile-menu" aria-label="منوی موبایل" dir="rtl">
            {links.map((link) => (
              <Link key={link.href} href={link.href} onClick={() => setOpen(false)}>
                {link.label}
              </Link>
            ))}
          </nav>
        </>
      )}
    </div>
  );
}
