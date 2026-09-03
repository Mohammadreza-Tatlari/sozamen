import { notFound, redirect } from "next/navigation";
import Link from "next/link";
import { Trash2 } from "lucide-react";
import { db } from "@/lib/db";
import { getUser } from "@/lib/auth/session";
import { money } from "@/lib/format";
import { AddToCart } from "@/components/cart/AddToCart";
async function addComment(formData: FormData) {
  "use server";
  const user = await getUser();
  const productId = Number(formData.get("productId"));
  if (!user) redirect(`/login?next=/shop/${productId}`);
  const text = String(formData.get("text") || "").trim();
  if (text) await db.comment.create({ data: { text, productId, userId: user.id } });
  redirect(`/shop/${productId}`);
}
async function deleteComment(formData: FormData) {
  "use server";
  const user = await getUser();
  if (!user) redirect("/login");
  const id = Number(formData.get("commentId")),
    comment = await db.comment.findUnique({ where: { id } });
  if (!comment) redirect("/");
  if (user.role !== "admin" && comment.userId !== user.id) throw new Error("دسترسی غیرمجاز");
  await db.comment.delete({ where: { id } });
  redirect(`/shop/${comment.productId}`);
}
export default async function ProductPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const [product, user] = await Promise.all([
    db.product.findUnique({
      where: { id: Number(id) },
      include: { comments: { include: { user: true }, orderBy: { createdAt: "desc" } } },
    }),
    getUser(),
  ]);
  if (!product) notFound();
  return (
    <div className="container">
      <section className="product-detail">
        <img
          className="detail-image"
          src={product.imageUrl || "/uploads/products/placeholder.svg"}
          alt={product.name}
        />
        <div className="detail-copy">
          <span className="section-kicker">مراقبت روزانه</span>
          <h1>{product.name}</h1>
          <p>{product.description}</p>
          <div className="detail-price">{money(product.price)}</div>
          <div className={product.stock > 0 ? "stock available" : "stock unavailable"}>
            {product.stock > 0
              ? `${new Intl.NumberFormat("fa-IR").format(product.stock)} عدد موجود در انبار`
              : "ناموجود"}
          </div>
          <AddToCart
            product={{
              id: product.id,
              name: product.name,
              price: product.price,
              imageUrl: product.imageUrl,
              stock: product.stock,
            }}
          />
        </div>
      </section>
      <section className="comments" dir="rtl">
        <h2>نظرهای شما</h2>
        {user ? (
          <form action={addComment}>
            <input type="hidden" name="productId" value={product.id} />
            <div className="field">
              <textarea name="text" required placeholder="تجربه خود را درباره این محصول بنویسید" />
            </div>
            <button className="button">ثبت نظر</button>
          </form>
        ) : (
          <div className="notice">
            برای ثبت نظر، ابتدا{" "}
            <Link href={`/login?next=/shop/${product.id}`}>
              <u>وارد حساب شوید</u>
            </Link>
            .
          </div>
        )}
        {product.comments.length ? (
          product.comments.map((c) => (
            <div className="comment" key={c.id}>
              <div className="comment-head">
                <strong>{c.user.name}</strong>
                {user && (user.role === "admin" || user.id === c.userId) && (
                  <form action={deleteComment}>
                    <input type="hidden" name="commentId" value={c.id} />
                    <button className="comment-delete" aria-label="حذف نظر" title="حذف نظر">
                      <Trash2 size={16} />
                    </button>
                  </form>
                )}
              </div>
              <p>{c.text}</p>
            </div>
          ))
        ) : (
          <p className="empty">هنوز نظری ثبت نشده است.</p>
        )}
      </section>
    </div>
  );
}
