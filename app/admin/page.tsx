import {redirect} from "next/navigation";
import Link from "next/link";
import {db} from "@/lib/db";
import {getUser} from "@/lib/auth/session";
import {money} from "@/lib/format";
import {orderStatusLabel} from "@/lib/orders";
import {Eye,Pencil,Plus} from "lucide-react";

export default async function Admin(){
  const user=await getUser();if(!user||user.role!=="admin")redirect("/");
  const [customers,products,orders]=await Promise.all([
    db.user.findMany({where:{role:"customer"},include:{_count:{select:{orders:true}}}}),
    db.product.findMany({orderBy:{updatedAt:"desc"}}),
    db.order.findMany({include:{user:true,items:true},orderBy:{createdAt:"desc"}})
  ]);
  return <div className="container">
<div className="page-hero">
<span className="section-kicker">مدیریت فروشگاه</span>
<h1 className="page-title">پنل مدیر</h1>
</div>
<div className="stat-grid">
<div className="stat">مشتریان<b>{customers.length}</b>
</div>
<div className="stat">محصولات<b>{products.length}</b>
</div>
<div className="stat">سفارش‌ها<b>{orders.length}</b>
</div>
</div>
    <section className="panel admin-section">
<div className="section-head">
<h2>سفارش‌های مشتریان</h2>
</div>{orders.length?orders.map(o=>
<div className="admin-order-row" key={o.id}>
<div>
<b>سفارش {o.id}</b>
<span className="tracking-code">کد پیگیری: <b>{o.trackingCode}</b></span>
<span>{o.user.name} - {o.user.phone}</span>
</div>
<div>
<span className={`status status-${o.status}`}>{orderStatusLabel(o.status)}</span>
<small>{o.items.reduce((s,i)=>s+i.quantity,0)} کالا - {money(o.items.reduce((s,i)=>s+i.priceAtPurchase*i.quantity,0))}</small>
</div>
<Link className="button secondary" href={`/admin/orders/${o.id}`}>
<Eye size={17}/>جزئیات و مدیریت</Link>
</div>):<p className="empty">هنوز سفارشی ثبت نشده است.</p>}</section>
    <section className="panel admin-section">
<div className="section-head">
<h2>مدیریت محصولات</h2>
<Link className="button" href="/admin/products/new">
<Plus size={17}/>افزودن محصول</Link>
</div>{products.map(p=>
<div className="admin-row" key={p.id}>
<img src={p.imageUrl} alt=""/>
<div>
<b>{p.name}</b>
<div className="price">{money(p.price)}</div>
<small>{p.stock} عدد موجود</small>
</div>
<span>
</span>
<Link className="icon-btn" href={`/admin/products/${p.id}`}>
<Pencil size={17}/>
</Link>
</div>)}</section>
    <section className="panel admin-section admin-last">
<h2>مشتریان</h2>{customers.map(c=>
<div className="order" key={c.id}>
<b>{c.name}</b>
<p>{c.phone} - {c.address||"نشانی ثبت نشده"} - {c._count.orders} سفارش</p>
</div>)}</section>
  </div>
}
