"use client";
import { ShoppingBag } from "lucide-react";
import { useRouter } from "next/navigation";
import { useState } from "react";
export type CartProduct = {
  id: number;
  name: string;
  price: number;
  imageUrl: string;
  stock: number;
  quantity: number;
};
export function AddToCart({
  product,
  isAuthenticated,
}: {
  product: Omit<CartProduct, "quantity">;
  isAuthenticated: boolean;
}) {
  const router = useRouter();
  const [done, setDone] = useState(false),
    [quantity, setQuantity] = useState(1);

  function add() {
    let cart: CartProduct[] = [];
    try {
      cart = JSON.parse(localStorage.getItem("sozamen-cart") || "[]");
    } catch {
      localStorage.removeItem("sozamen-cart");
    }

    const old = cart.find((x) => x.id === product.id);
    if (old) {
      old.stock = product.stock;
      old.quantity = Math.min(product.stock, old.quantity + quantity);
    } else cart.push({ ...product, quantity: Math.min(quantity, product.stock) });
    localStorage.setItem("sozamen-cart", JSON.stringify(cart));
    dispatchEvent(new Event("cart-change"));

    if (!isAuthenticated) {
      router.push("/login?next=/cart");
      return;
    }

    setDone(true);
    setTimeout(() => setDone(false), 1500);
  }
  if (product.stock < 1)
    return (
      <button className="button secondary" disabled>
        ناموجود
      </button>
    );
  return (
    <div className="add-cart-row">
      <div className="product-quantity" aria-label="تعداد محصول">
        <button type="button" onClick={() => setQuantity(Math.max(1, quantity - 1))}>
          −
        </button>
        <input
          aria-label="تعداد"
          type="number"
          min={1}
          max={product.stock}
          value={quantity}
          onChange={(e) =>
            setQuantity(Math.max(1, Math.min(product.stock, Number(e.target.value) || 1)))
          }
        />
        <button type="button" onClick={() => setQuantity(Math.min(product.stock, quantity + 1))}>
          +
        </button>
      </div>
      <button className="button" onClick={add}>
        <ShoppingBag size={18} />
        {done
          ? `${quantity} عدد اضافه شد`
          : isAuthenticated
            ? "افزودن به سبد"
            : "ورود و افزودن به سبد"}
      </button>
    </div>
  );
}
