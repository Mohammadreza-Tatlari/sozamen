"use client";
import { useState } from "react";
import { useRouter } from "next/navigation";
export function ProductForm({
  product,
}: {
  product?: {
    id: number;
    name: string;
    description: string;
    price: number;
    stock: number;
    imageUrl: string;
  };
}) {
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  async function submit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setBusy(true);
    const r = await fetch(product ? `/api/products/${product.id}` : "/api/products", {
      method: product ? "PUT" : "POST",
      body: new FormData(e.currentTarget),
    });
    if (r.ok) router.push("/admin");
    else {
      setError((await r.json()).error || "خطا در ذخیره محصول");
      setBusy(false);
    }
  }
  async function remove() {
    if (!product || !confirm("این محصول حذف شود؟")) return;
    const r = await fetch(`/api/products/${product.id}`, { method: "DELETE" });
    if (r.ok) router.push("/admin");
  }
  return (
    <form className="form-card" onSubmit={submit}>
      <span className="section-kicker">محصول</span>
      <h1>{product ? "ویرایش محصول" : "افزودن محصول"}</h1>
      {error && <div className="notice">{error}</div>}
      <div className="field">
        <label>نام محصول</label>
        <input name="name" defaultValue={product?.name} required />
      </div>
      <div className="field">
        <label>قیمت به تومان</label>
        <input name="price" type="number" min="0" defaultValue={product?.price} required />
      </div>
      <div className="field">
        <label>موجودی انبار</label>
        <input name="stock" type="number" min="0" defaultValue={product?.stock ?? 0} required />
      </div>
      <div className="field">
        <label>توضیحات</label>
        <textarea name="description" defaultValue={product?.description} required />
      </div>
      <div className="field">
        <label>تصویر محصول</label>
        <input
          name="image"
          type="file"
          accept="image/png,image/jpeg,image/webp"
          required={!product}
        />
      </div>
      <button className="button" disabled={busy}>
        {busy ? "در حال ذخیره..." : "ذخیره محصول"}
      </button>
      {product && (
        <button type="button" className="button danger" style={{ marginLeft: 10 }} onClick={remove}>
          حذف محصول
        </button>
      )}
    </form>
  );
}
