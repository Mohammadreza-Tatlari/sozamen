"use client";
import { useEffect, useState } from "react";
export function CartBadge() {
  const [n, setN] = useState(0);
  useEffect(() => {
    const u = () => {
      try {
        setN(
          JSON.parse(localStorage.getItem("sozamen-cart") || "[]").reduce(
            (a: number, x: { quantity: number }) => a + x.quantity,
            0,
          ),
        );
      } catch {}
    };
    u();
    addEventListener("cart-change", u);
    return () => removeEventListener("cart-change", u);
  }, []);
  return n ? <span className="badge">{n}</span> : null;
}
