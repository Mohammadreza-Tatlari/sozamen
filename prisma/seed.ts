import { PrismaClient } from "@prisma/client";
const db = new PrismaClient();
const products = [
  [
    "سرم آبرسان رز",
    "سرمی سبک با هیالورونیک اسید برای رطوبت‌رسانی عمیق و درخشندگی طبیعی پوست.",
    890000,
    "/uploads/products/serum.png",
  ],
  [
    "کرم ابریشمی صورت",
    "کرم روزانه مغذی با بافت ابریشمی، مناسب پوست نرمال تا خشک.",
    760000,
    "/uploads/products/cream.png",
  ],
  [
    "شوینده ملایم ابری",
    "پاک‌کننده کرمی بدون صابون که تعادل طبیعی پوست را حفظ می‌کند.",
    540000,
    "/uploads/products/cleanser.png",
  ],
  [
    "روغن صورت گل محمدی",
    "ترکیبی لطیف از روغن‌های گیاهی برای نرمی و شادابی شبانه.",
    980000,
    "/uploads/products/serum.png",
  ],
  [
    "کرم دور چشم پرسلن",
    "آبرسان سبک برای کاهش ظاهر خستگی و خطوط ظریف اطراف چشم.",
    820000,
    "/uploads/products/cream.png",
  ],
  [
    "لوسیون بدن ساتن",
    "لوسیون زودجذب با رایحه ظریف و حس لطافت ماندگار.",
    620000,
    "/uploads/products/cleanser.png",
  ],
] as const;
async function main() {
  await db.user.upsert({
    where: { phone: "09120000000" },
    update: { role: "admin" },
    create: { phone: "09120000000", name: "مدیر سوزامن", address: "تهران", role: "admin" },
  });
  await db.user.upsert({
    where: { phone: "09121111111" },
    update: {},
    create: {
      phone: "09121111111",
      name: "مشتری نمونه",
      address: "تهران، خیابان ولیعصر",
      role: "customer",
    },
  });
  await db.user.upsert({
    where: { phone: "09123456789" },
    update: {},
    create: {
      phone: "09123456789",
      name: "نگار احمدی",
      address: "تهران، میدان هفت تیر",
      role: "customer",
    },
  });
  await db.user.upsert({
    where: { phone: "09351234567" },
    update: {},
    create: {
      phone: "09351234567",
      name: "سارا محمدی",
      address: "شیراز، بلوار چمران",
      role: "customer",
    },
  });
  await db.user.upsert({
    where: { phone: "09901239876" },
    update: {},
    create: {
      phone: "09901239876",
      name: "الهام رضایی",
      address: "اصفهان، خیابان چهارباغ",
      role: "customer",
    },
  });
  if ((await db.product.count()) === 0)
    for (const [name, description, price, imageUrl] of products)
      await db.product.create({ data: { name, description, price, imageUrl, stock: 20 } });
}
main().finally(() => db.$disconnect());
