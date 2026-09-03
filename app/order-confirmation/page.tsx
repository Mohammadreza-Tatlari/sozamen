import Link from "next/link";
import { CircleCheck } from "lucide-react";
export default async function Confirmation({
  searchParams,
}: {
  searchParams: Promise<{ id?: string; ref?: string }>;
}) {
  const q = await searchParams;
  return (
    <section className="form-card" style={{ textAlign: "center" }}>
      <CircleCheck size={60} color="#8f4e58" />
      <h1>سفارش شما ثبت شد</h1>
      <p>از خرید شما ممنونیم. سفارش شماره {q.id} با موفقیت پرداخت شد.</p>
      <div className="notice">کد پیگیری: {q.ref}</div>
      <Link className="button" href="/dashboard">
        مشاهده سفارش‌ها
      </Link>
    </section>
  );
}
