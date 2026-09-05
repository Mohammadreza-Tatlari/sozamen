import Link from "next/link";
import { ShoppingBag, UserRound } from "lucide-react";
import { CartBadge } from "./cart/CartBadge";
import { MobileNav } from "./MobileNav";
import { getUser } from "@/lib/auth/session";
export async function Header() {
  const user = await getUser();
  return (
    <header className="nav">
      <div className="container nav-inner">
        <Link className="logo" href="/">
          SOZAMEN
        </Link>
        <nav className="nav-links">
          <Link href="/">خانه</Link>
          <Link href="/shop">فروشگاه</Link>
          <Link href="/about">درباره ما</Link>
          <Link href="/about#contact">تماس</Link>
        </nav>
        <div className="nav-actions">
          <MobileNav />
          <Link
            className="icon-btn account-avatar"
            href={user ? "/dashboard/profile" : "/login"}
            aria-label={user ? "پروفایل من" : "ورود به حساب"}
          >
            {user?.profileImageUrl ? (
              <img src={user.profileImageUrl} alt="" />
            ) : (
              <UserRound size={19} />
            )}
          </Link>
          <Link
            className="icon-btn"
            href={user ? "/cart" : "/login?next=/cart"}
            aria-label={user ? "سبد خرید" : "ورود برای مشاهده سبد خرید"}
          >
            <ShoppingBag size={19} />
            {user && <CartBadge />}
          </Link>
        </div>
      </div>
    </header>
  );
}
