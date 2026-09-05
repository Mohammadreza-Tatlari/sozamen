import Image from "next/image";

export function RouteLoadingScreen() {
  return (
    <div className="route-loading" role="status" aria-live="polite" aria-label="در حال بارگذاری">
      <div className="route-loading-card">
        <div className="route-loading-illustration" aria-hidden="true">
          <Image
            src="/icons/cat-splashing-water-loading.webp"
            alt=""
            width={260}
            height={260}
            priority
            unoptimized
          />
        </div>
        <p>کمی صبر کنید، در حال آماده‌سازی...</p>
        <span className="route-loading-dots" aria-hidden="true">
          <i />
          <i />
          <i />
        </span>
      </div>
    </div>
  );
}
