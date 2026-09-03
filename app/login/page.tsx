import { redirect } from "next/navigation";
import { cookies } from "next/headers";
import { db } from "@/lib/db";
import { makeSession } from "@/lib/auth/session";
import { otpProvider } from "@/lib/auth/provider";
async function login(formData: FormData) {
  "use server";
  const phone = String(formData.get("phone") || "").trim();
  const code = String(formData.get("code") || "").trim();
  const next = String(formData.get("next") || "/dashboard");
  if (!/^09\d{9}$/.test(phone) || !(await otpProvider.verify(phone, code)))
    redirect(`/login?error=1&next=${encodeURIComponent(next)}`);
  const user = await db.user.upsert({
    where: { phone },
    update: {},
    create: { phone, name: "کاربر سوزامن", role: "customer" },
  });
  (await cookies()).set("sozamen_session", makeSession({ id: user.id, role: user.role }), {
    httpOnly: true,
    sameSite: "lax",
    path: "/",
    maxAge: 60 * 60 * 24 * 14,
  });
  redirect(next.startsWith("/") ? next : "/dashboard");
}
export default async function Login({
  searchParams,
}: {
  searchParams: Promise<{ error?: string; next?: string }>;
}) {
  const q = await searchParams;
  return (
    <form className="form-card" action={login}>
      <span className="section-kicker">خوش آمدید</span>
      <h1>ورود به حساب</h1>
      <p>شماره موبایل و یک کد ۴ تا ۶ رقمی دلخواه وارد کنید.</p>
      {q.error && <div className="notice">شماره موبایل یا کد وارد شده معتبر نیست.</div>}
      <input type="hidden" name="next" value={q.next || "/dashboard"} />
      <div className="field">
        <label>شماره موبایل</label>
        <input name="phone" inputMode="tel" placeholder="09120000000" required />
      </div>
      <div className="field">
        <label>کد یک‌بار مصرف</label>
        <input
          name="code"
          inputMode="numeric"
          placeholder="مثلا 1234"
          required
          minLength={4}
          maxLength={6}
        />
      </div>
      <button className="button" type="submit">
        ورود
      </button>
      <div className="notice demo-accounts">
        <b>حساب‌های آزمایشی</b>
        <span>مدیر سوزامن: 09120000000</span>
        <span>مشتری نمونه: 09121111111</span>
        <span>نگار احمدی: 09123456789</span>
        <span>سارا محمدی: 09351234567</span>
        <span>الهام رضایی: 09901239876</span>
      </div>
    </form>
  );
}
