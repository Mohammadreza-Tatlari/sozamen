import { NextResponse } from "next/server";
import { requireAdmin } from "@/lib/auth/session";
import { saveProductImage } from "@/lib/uploads";
import { db } from "@/lib/db";
export async function PUT(req: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    await requireAdmin();
    const id = Number((await params).id),
      f = await req.formData(),
      image = f.get("image");
    const imageUrl =
      image instanceof File && image.size ? await saveProductImage(image) : undefined;
    const p = await db.product.update({
      where: { id },
      data: {
        name: String(f.get("name")),
        description: String(f.get("description")),
        price: Math.max(0, Number(f.get("price"))),
        stock: Math.max(0, Number(f.get("stock"))),
        ...(imageUrl && { imageUrl }),
      },
    });
    return NextResponse.json(p);
  } catch (e) {
    return NextResponse.json({ error: e instanceof Error ? e.message : "خطا" }, { status: 403 });
  }
}
export async function DELETE(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    await requireAdmin();
    await db.product.delete({ where: { id: Number((await params).id) } });
    return NextResponse.json({ ok: true });
  } catch {
    return NextResponse.json({ error: "حذف انجام نشد" }, { status: 403 });
  }
}
