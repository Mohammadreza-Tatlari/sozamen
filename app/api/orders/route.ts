import { NextResponse } from "next/server";
import { getUser } from "@/lib/auth/session";
import { db } from "@/lib/db";
import { paymentProvider } from "@/lib/payments/provider";

type RequestedItem = { productId: number; quantity: number };

export async function POST(req: Request) {
  const user = await getUser();
  if (!user) return NextResponse.json({ error: "ابتدا وارد حساب شوید" }, { status: 401 });
  const body = await req.json();
  if (!Array.isArray(body.items) || !body.items.length)
    return NextResponse.json({ error: "سبد خرید خالی است" }, { status: 400 });
  const items: RequestedItem[] = body.items.map((x: RequestedItem) => ({
    productId: Number(x.productId),
    quantity: Math.max(1, Math.floor(Number(x.quantity))),
  }));
  const products = await db.product.findMany({
    where: { id: { in: items.map((x) => x.productId) } },
  });
  if (products.length !== new Set(items.map((x) => x.productId)).size)
    return NextResponse.json({ error: "یک یا چند محصول دیگر موجود نیست" }, { status: 400 });
  const unavailable = items.find(
    (x) => (products.find((p) => p.id === x.productId)?.stock ?? 0) < x.quantity,
  );
  if (unavailable) {
    const product = products.find((p) => p.id === unavailable.productId);
    return NextResponse.json(
      { error: `موجودی ${product?.name || "محصول"} کافی نیست` },
      { status: 409 },
    );
  }
  const total = items.reduce(
    (sum, x) => sum + (products.find((p) => p.id === x.productId)?.price || 0) * x.quantity,
    0,
  );
  const pay = await paymentProvider.pay(total);
  try {
    const order = await db.$transaction(async (tx) => {
      await tx.user.update({
        where: { id: user.id },
        data: { name: String(body.name), phone: String(body.phone), address: String(body.address) },
      });
      for (const item of items) {
        const changed = await tx.product.updateMany({
          where: { id: item.productId, stock: { gte: item.quantity } },
          data: { stock: { decrement: item.quantity } },
        });
        if (changed.count !== 1) throw new Error("OUT_OF_STOCK");
      }
      return tx.order.create({
        data: {
          userId: user.id,
          trackingCode: pay.reference,
          status: pay.success ? "paid" : "fake-failed",
          items: {
            create: items.map((x) => ({
              productId: x.productId,
              quantity: x.quantity,
              priceAtPurchase: products.find((p) => p.id === x.productId)?.price || 0,
            })),
          },
        },
      });
    });
    return NextResponse.json({ id: order.id, reference: pay.reference });
  } catch (e) {
    if (e instanceof Error && e.message === "OUT_OF_STOCK")
      return NextResponse.json(
        { error: "موجودی یکی از محصولات تغییر کرده است. سبد را بررسی کنید." },
        { status: 409 },
      );
    throw e;
  }
}
