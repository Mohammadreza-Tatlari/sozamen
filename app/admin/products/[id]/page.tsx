import { notFound, redirect } from "next/navigation";
import { getUser } from "@/lib/auth/session";
import { db } from "@/lib/db";
import { ProductForm } from "@/components/admin/ProductForm";
export default async function EditProduct({ params }: { params: Promise<{ id: string }> }) {
  const u = await getUser();
  if (u?.role !== "admin") redirect("/");
  const p = await db.product.findUnique({ where: { id: Number((await params).id) } });
  if (!p) notFound();
  return <ProductForm product={p} />;
}
