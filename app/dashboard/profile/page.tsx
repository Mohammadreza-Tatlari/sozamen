import {redirect} from "next/navigation";import {cookies} from "next/headers";import Link from "next/link";import {Camera,LogOut,PackageCheck,UserRound} from "lucide-react";import {db} from "@/lib/db";import {getUser} from "@/lib/auth/session";import {money} from "@/lib/format";import {saveProfileImage} from "@/lib/uploads";
async function updateProfile(fd:FormData){"use server";const user=await getUser();if(!user)redirect("/login");const name=String(fd.get("name")||"").trim(),phone=String(fd.get("phone")||"").trim(),address=String(fd.get("address")||"").trim(),image=fd.get("image");if(!name||!/^09\d{9}$/.test(phone))redirect("/dashboard/profile?error=invalid");try{const profileImageUrl=image instanceof File&&image.size?await saveProfileImage(image):undefined;await db.user.update({where:{id:user.id},data:{name,phone,address,...(profileImageUrl&&{profileImageUrl})}})}catch{redirect("/dashboard/profile?error=duplicate")}redirect("/dashboard/profile?saved=1")}
async function logout(){"use server";(await cookies()).delete("sozamen_session");redirect("/")}
export default async function Profile({searchParams}:{searchParams:Promise<{saved?:string,error?:string}>}){const user=await getUser();if(!user)redirect("/login?next=/dashboard/profile");const q=await searchParams;const orders=await db.order.findMany({where:{userId:user.id},include:{items:{include:{product:true}}},orderBy:{createdAt:"desc"}});return <div className="container profile-layout">
<aside className="panel profile-summary">
<div className="profile-photo">{user.profileImageUrl?<img src={user.profileImageUrl} alt={`تصویر پروفایل ${user.name}`}/>:<UserRound size={44}/>}</div>
<h2>{user.name}</h2>
<p>{user.phone}</p>{user.role==="admin"&&<Link className="button secondary" href="/admin">پنل مدیریت</Link>}<form action={logout}>
<button className="button secondary logout">
<LogOut size={17}/>خروج از حساب</button>
</form>
</aside>
<div>
<section className="panel">
<div className="profile-section-title">
<div>
<span className="section-kicker">حساب کاربری</span>
<h1>پروفایل من</h1>
</div>
</div>{q.saved&&<div className="success-notice">تغییرات پروفایل ذخیره شد.</div>}{q.error&&<div className="notice">{q.error==="duplicate"?"این شماره موبایل قبلا استفاده شده است.":"نام و شماره موبایل معتبر وارد کنید."}</div>}<form action={updateProfile}>
<div className="field">
<label>
<Camera size={16}/> تصویر پروفایل</label>
<input name="image" type="file" accept="image/png,image/jpeg,image/webp"/>
</div>
<div className="field">
<label>نام و نام خانوادگی</label>
<input name="name" defaultValue={user.name} required/>
</div>
<div className="field">
<label>شماره موبایل</label>
<input name="phone" inputMode="tel" defaultValue={user.phone} required/>
</div>
<div className="field">
<label>نشانی ارسال</label>
<textarea name="address" defaultValue={user.address}/>
</div>
<button className="button">ذخیره تغییرات</button>
</form>
</section>
<section className="panel orders-panel">
<div className="profile-section-title">
<div>
<span className="section-kicker">خریدهای من</span>
<h2>سفارش‌ها و پرداخت‌ها</h2>
</div>
<PackageCheck size={27}/>
</div>{orders.length?orders.map(o=>
<article className="profile-order" key={o.id}>
<div className="order-heading">
<div>
<b>سفارش شماره {o.id}</b>
<span className="tracking-code">کد پیگیری: <b>{o.trackingCode}</b></span>
<small>{new Intl.DateTimeFormat("fa-IR",{dateStyle:"medium"}).format(o.createdAt)}</small>
</div>
<span className="status">{o.status==="paid"?"پرداخت شده":o.status}</span>
</div>
<div className="order-products">{o.items.map(i=>
<div key={i.id}>
<img src={i.product.imageUrl} alt=""/>
<span>{i.product.name} × {i.quantity}</span>
</div>)}</div>
<strong>{money(o.items.reduce((s,i)=>s+i.priceAtPurchase*i.quantity,0))}</strong>
</article>):<div className="empty">هنوز خریدی ثبت نکرده‌اید.<br/>
<br/>
<Link className="button" href="/shop">مشاهده محصولات</Link>
</div>}</section>
</div>
</div>}
