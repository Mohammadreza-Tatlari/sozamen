import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import {
  createPreviewAccessToken,
  hasValidPreviewAccess,
  isPreviewAccessEnabled,
  PREVIEW_ACCESS_COOKIE,
} from "@/lib/preview-access";

function safeDestination(value: FormDataEntryValue | string | undefined) {
  const destination = String(value || "/");
  return destination.startsWith("/") && !destination.startsWith("//") ? destination : "/";
}

async function unlockPreview(formData: FormData) {
  "use server";

  const configuredPassword = process.env.PREVIEW_PASSWORD?.trim();
  const enteredPassword = String(formData.get("password") || "");
  const destination = safeDestination(formData.get("next") || undefined);

  if (!configuredPassword || enteredPassword !== configuredPassword) {
    redirect(`/preview-access?error=1&next=${encodeURIComponent(destination)}`);
  }

  (await cookies()).set(PREVIEW_ACCESS_COOKIE, await createPreviewAccessToken(configuredPassword), {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production" && process.env.PREVIEW_COOKIE_SECURE !== "false",
    sameSite: "lax",
    path: "/",
    maxAge: 60 * 60 * 24,
  });

  redirect(destination);
}

export default async function PreviewAccessPage({
  searchParams,
}: {
  searchParams: Promise<{ error?: string; next?: string }>;
}) {
  const query = await searchParams;
  const cookieValue = (await cookies()).get(PREVIEW_ACCESS_COOKIE)?.value;

  if (!isPreviewAccessEnabled() || (await hasValidPreviewAccess(cookieValue))) {
    redirect(safeDestination(query.next));
  }

  return (
    <section className="preview-gate" aria-labelledby="preview-access-title">
      <form className="preview-gate-card" action={unlockPreview}>
        <div className="preview-gate-mark" aria-hidden="true">
          س
        </div>
        <span className="section-kicker">نمایش خصوصی سوزامن</span>
        <h1 id="preview-access-title">ورود به نسخه آزمایشی</h1>
        <p>برای مشاهده فروشگاه، رمز موقت را وارد کنید.</p>

        {query.error && (
          <div className="notice preview-gate-error" role="alert">
            رمز واردشده صحیح نیست. دوباره تلاش کنید.
          </div>
        )}

        <input type="hidden" name="next" value={safeDestination(query.next)} />
        <div className="field">
          <label htmlFor="preview-password">رمز ورود</label>
          <input
            id="preview-password"
            name="password"
            type="password"
            autoComplete="current-password"
            required
            autoFocus
            dir="ltr"
          />
        </div>
        <button className="button preview-gate-submit" type="submit">
          مشاهده فروشگاه
        </button>
        <small>دسترسی پس از ۲۴ ساعت منقضی می‌شود.</small>
      </form>
    </section>
  );
}
