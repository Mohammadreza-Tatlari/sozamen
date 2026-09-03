import { notFound, redirect } from "next/navigation";
import Link from "next/link";
import { ArrowRight, Trash2 } from "lucide-react";
import { db } from "@/lib/db";
import { requireAdmin } from "@/lib/auth/session";
import { money } from "@/lib/format";
import { orderStatusLabel, orderStatuses } from "@/lib/orders";

async function updateStatus(fd: FormData) {
  "use server";
  await requireAdmin();
  const id = Number(fd.get("id")),
    status = String(fd.get("status"));
  if (!Object.keys(orderStatuses).includes(status)) throw new Error("وضعیت نامعتبر است");
  await db.order.update({ where: { id }, data: { status } });
  redirect(`/admin/orders/${id}?saved=1`);
}
async function deleteOrder(fd: FormData) {
  "use server";
  await requireAdmin();
  await db.order.delete({ where: { id: Number(fd.get("id")) } });
  redirect("/admin");
}

export default async function AdminOrder({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ saved?: string }>;
}) {
  await requireAdmin();
  const id = Number((await params).id),
    q = await searchParams;
  const order = await db.order.findUnique({
    where: { id },
    include: { user: true, items: { include: { product: true } } },
  });
  if (!order) notFound();
  const total = order.items.reduce((s, i) => s + i.priceAtPurchase * i.quantity, 0);
  return (
    <div className="container order-detail-page">
      <Link className="text-link" href="/admin">
        <ArrowRight size={17} />
        بازگشت به پنل
      </Link>
      <div className="page-hero">
        <span className="section-kicker">مدیریت سفارش</span>
        <h1 className="page-title">سفارش شماره {order.id}</h1>
        <div className="tracking-code prominent">
          کد پیگیری: <b>{order.trackingCode}</b>
        </div>
        <p>
          <span className={`status status-${order.status}`}>{orderStatusLabel(order.status)}</span>
        </p>
      </div>
      {q.saved && <div className="success-notice">وضعیت سفارش به‌روزرسانی شد.</div>}
      <div className="order-detail-grid">
        <section className="panel">
          <h2>اقلام سفارش</h2>
          {order.items.map((i) => (
            <div className="order-item-detail" key={i.id}>
              <img src={i.product.imageUrl} alt={i.product.name} />
              <div>
                <b>{i.product.name}</b>
                <span>
                  {i.quantity} عدد × {money(i.priceAtPurchase)}
                </span>
              </div>
              <strong>{money(i.quantity * i.priceAtPurchase)}</strong>
            </div>
          ))}
          <div className="order-total">
            <span>مجموع سفارش</span>
            <strong>{money(total)}</strong>
          </div>
        </section>
        <aside>
          <section className="panel">
            <h2>مشتری و ارسال</h2>
            <p>
              <b>{order.user.name}</b>
            </p>
            <p>{order.user.phone}</p>
            <p>{order.user.address || "نشانی ثبت نشده"}</p>
            <small>
              {new Intl.DateTimeFormat("fa-IR", { dateStyle: "long", timeStyle: "short" }).format(
                order.createdAt,
              )}
            </small>
          </section>
          <section className="panel order-actions">
            <h2>وضعیت سفارش</h2>
            <form action={updateStatus}>
              <input type="hidden" name="id" value={order.id} />
              <div className="field">
                <select name="status" defaultValue={order.status}>
                  {Object.entries(orderStatuses).map(([value, label]) => (
                    <option key={value} value={value}>
                      {label}
                    </option>
                  ))}
                </select>
              </div>
              <button className="button">ثبت وضعیت</button>
            </form>
            <form action={deleteOrder}>
              <input type="hidden" name="id" value={order.id} />
              <button className="button danger">
                <Trash2 size={17} />
                حذف سفارش
              </button>
            </form>
          </section>
        </aside>
      </div>
    </div>
  );
}
