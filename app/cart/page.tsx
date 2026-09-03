import { CartView } from "@/components/cart/CartView";
export default function Cart() {
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
