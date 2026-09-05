import { redirect } from "next/navigation";
import { CartView } from "@/components/cart/CartView";
import { getUser } from "@/lib/auth/session";

export default async function Cart() {
  const user = await getUser();
  if (!user) redirect("/login?next=/cart");

  return (
    <div className="container">
      <div className="page-hero">
        <span className="section-kicker">انتخاب‌های شما</span>
        <h1 className="page-title">سبد خرید</h1>
      </div>
      <CartView />
    </div>
  );
}
