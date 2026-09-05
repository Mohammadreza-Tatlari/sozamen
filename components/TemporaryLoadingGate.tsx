"use client";

import { useEffect, useRef, useState } from "react";
import { RouteLoadingScreen } from "@/components/RouteLoadingScreen";

const TEMPORARY_MINIMUM_LOADING_MS = 400;

export function TemporaryLoadingGate() {
  const [visible, setVisible] = useState(true);
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    const showBriefly = () => {
      setVisible(true);
      if (timer.current) clearTimeout(timer.current);
      timer.current = setTimeout(() => setVisible(false), TEMPORARY_MINIMUM_LOADING_MS);
    };

    const handleNavigation = (event: MouseEvent) => {
      if (event.defaultPrevented || event.button !== 0 || event.metaKey || event.ctrlKey) return;

      const link = (event.target as Element | null)?.closest("a[href]") as HTMLAnchorElement | null;
      if (!link || link.target === "_blank" || link.hasAttribute("download")) return;

      const destination = new URL(link.href, window.location.href);
      const current = new URL(window.location.href);
      const changesPage =
        destination.origin === current.origin &&
        `${destination.pathname}${destination.search}` !== `${current.pathname}${current.search}`;

      if (changesPage) showBriefly();
    };

    showBriefly();
    document.addEventListener("click", handleNavigation, true);

    return () => {
      document.removeEventListener("click", handleNavigation, true);
      if (timer.current) clearTimeout(timer.current);
    };
  }, []);

  return visible ? <RouteLoadingScreen /> : null;
}
