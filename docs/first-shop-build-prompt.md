# Build Prompt: Sozamen — Persian Skincare/Cosmetics Shop (MVP)

Build a minimal, modular e-commerce web app called **Sozamen** using **Next.js (App Router)** for a skincare and cosmetics brand. All UI text and page layouts use **Persian/Farsi RTL** direction. Use TypeScript.

## Visual Direction

- Palette: warm neutrals — ivory, rose beige, porcelain, skin-tone/nude accents. Soft, minimal, boutique-cosmetics feel. No harsh contrast; use warm off-whites for backgrounds, muted rose/terracotta for accents and CTAs.
- Typography: clean, elegant, good Farsi font support (e.g. Vazirmatn or similar variable font).
- Top navigation bar (not sidebar) on all pages: Logo | Home | Shop | About Us | Login/Account icon.
- Keep it minimal — generous whitespace, soft rounded corners, subtle shadows.

## Responsive Behavior

- Support desktop, tablet, and mobile layouts down to 320px wide without horizontal overflow.
- At 850px and below, replace the centered desktop navigation links with an accessible menu button and dropdown navigation.
- The mobile menu closes from its close button, backdrop, selected link, or Escape key.
- Product grids, hero content, product details, cart rows, checkout summaries, profile panels, admin rows, order details, forms, and footer columns adapt to narrow screens.
- Keep account and cart actions visible in the mobile header.
- During real route loading, show the supplied cat-washing illustration in a
  centered, responsive loading card over a blurred page backdrop. Motion must
  respect the user's reduced-motion preference and must not add an artificial
  delay. Serve a small dedicated WebP directly from `/icons` so the loading
  artwork does not depend on the Next.js image optimizer or the preview-access
  middleware.
- Temporary MVP review setting: keep the loading screen visible for at least
  400 ms on initial render and internal link navigation. Remove
  `TemporaryLoadingGate` when reviewers no longer need the animation slowed
  down for inspection.

## Tech Stack

- Next.js App Router + TypeScript
- SQLite as the database (use Prisma as ORM for easy future migration to Postgres)
- Local file storage for product images (e.g. `/public/uploads`) for now, structured so it can be swapped for cloud storage later
- Fake/mock OTP auth and fake/mock payment gateway — both built as swappable modules (interface + mock implementation) so real SMS OTP and real payment providers can be plugged in later without rearchitecting
- Modular folder structure: separate `lib/auth`, `lib/payments`, `lib/db`, `components/`, `app/(routes)` so each concern can be upgraded independently
- Reserve a top-level `/docs` directory in the project (can be empty or have a placeholder README for now) — this is where design style guides and Product Requirement Documents (PRDs) will be added later as markdown files for reference during future development. No functionality needed here, just make sure the project structure doesn't conflict with adding it.

## Data Models (Prisma schema)

- **User**: id, phone, name, address, role (`customer` | `admin`), createdAt
- **Product**: id, name, description, price, imageUrl, createdAt, updatedAt
- **Comment**: id, productId, userId, text, createdAt
- **Order**: id, userId, trackingCode, status (mock statuses: pending/paid/fake-failed), createdAt
- **OrderItem**: id, orderId, productId, quantity, priceAtPurchase

## Pages & Features

### 1. Home (Landing)

Layout reference (trimmed to MVP essentials — no ratings, wishlist, or discount pricing):

- **Top nav**: Logo left, center links (Home, Shop, About Us, Contact — no Blog/Categories for MVP), right icons (Search optional, Account, Cart with item-count badge)
- **Hero section**: two-column layout (text left, model/product image right) on a soft pink gradient background
  - Small eyebrow label above the headline (e.g. "New Collection")
  - Large two-line headline, second line in the rose/brand accent color
  - Short supporting sentence (1–2 lines)
  - Primary CTA button, pill-shaped, dark, "Shop Now" with arrow icon
  - Small row of 2–3 trust badges below CTA (e.g. "Natural Ingredients", "Dermatologist Tested", "Cruelty Free") with simple icons
  - Optional floating circular badge over hero image (e.g. promo callout)
- **Bestsellers / Featured Products section**: section title + simple product grid (4 across on desktop), each card = image, name, price only (no star ratings, no wishlist heart, no struck-through discount price for MVP)
- Skip: Shop by Categories row, Promo banner with stats, Blog — these are good v2 additions but out of scope for MVP

### 2. Shop

Same simple product card style as the Home bestsellers section, in a full grid layout.

- Grid of products (image, name, price)
- Click a product → **Product Detail Page**: large image, description, price, available stock, quantity selector, "Add to Cart" button, and comments section below.
- Product comments and their input inherit the global RTL direction and right alignment.
- A comment can be deleted by its author or by an administrator. The server must verify ownership or the admin role before deletion.
- **Admin-only**: a small pencil/edit icon appears on each product card (only visible when logged in as admin) → opens edit form (name, price, description, image upload). Also an "Add Product" button visible only to admin.

### 3. About Us

- Simple static content page, brand story.

### 4. Login

- Phone number input → "send code" → OTP input (mock: accept any 4-6 digit code and log the user in)
- Build the auth flow (session/cookie-based) as if it were real, so swapping in a real SMS provider later is a drop-in change to one module.

### 5. Cart & Checkout

- Add to cart, view cart, adjust quantities, checkout form (confirm address/name/phone), place order.
- Cart and checkout require login. If a guest chooses a product, preserve the
  chosen product and quantity, redirect to login, then return them to the cart
  with that selection available.
- Customers can select multiple units before adding a product, and cart quantities cannot exceed current stock.
- Checkout validates stock server-side and reduces inventory atomically when the order is placed.
- Payment step: mock payment screen ("Pay" button that always succeeds, or simulate success/fail) — implemented behind a `PaymentProvider` interface so a real gateway can be swapped in later.
- Order confirmation page.

### 6. User Dashboard

- Account icon links authenticated users directly to `/dashboard/profile`; guests are sent to login.
- View/edit profile: profile picture, name, phone, and address.
- Profile pictures accept PNG, JPEG, or WebP files up to 3 MB and are stored locally under `/public/uploads/profiles/`.
- View checkout and payment history with purchased items, quantities, totals, status, and order date.
- Display every customer-facing order status with a Persian label.
- Show the unique tracking code directly below each order number in customer history.
- Provide a clear logout action that removes the session cookie and returns the user home.

### 7. Admin Dashboard

- Do not show the customer-only "خریدهای من" section on an administrator profile.
- Customer list with their info (name, phone, address, order count)
- Product management (list/add/edit/delete) — can live here and/or via the inline pencil icon on the shop page (build both entry points using the same shared component)
- Product add/edit forms include a non-negative inventory count.
- Show a list of orders with customer, item count, total, and current status.
- Show the tracking code in the admin list and order detail page so staff can match customer enquiries to the correct order.
- Each order has a detail page with purchased items, quantities, prices, delivery information, and order date.
- Admin can set an order to paid, in progress, done, cancelled, pending, or payment failed, and can permanently delete an order.

## Auth & Roles — Admin vs Customer Separation

- Single `User` table, distinguished by a `role` field (`customer` | `admin`) — no separate admin table, to keep it simple for MVP.
- Every phone number that logs in via the (mock) OTP flow is created as `role: customer` by default. There is no self-serve way to become admin — admin accounts are only created by seeding the database directly (e.g. via a Prisma seed script), never through the public login/signup flow.
- Seed script creates exactly one demo admin (fixed phone number) so it can be tested via the same login screen — logging in with that phone number logs you in as admin, any other phone number logs in as a customer.
- During MVP testing, seed one named demo customer and three additional named test customers, and list their phone numbers on the login page.
- Session/cookie stores the user's `role` alongside their id, and this is checked server-side (not just hidden in the UI) before rendering admin-only data or actions.
- Route protection via middleware or server-side checks:
  - `/dashboard/*` → requires any logged-in user
  - `/admin/*` → requires `role === 'admin'`, redirect to home otherwise
  - The pencil/edit icon and "Add Product" button on the Shop page are conditionally rendered only when the logged-in user's role is `admin`, and the underlying add/edit/delete API routes also re-check the role server-side (never trust the client-side check alone)
- This structure keeps room to grow later (e.g. multiple admins, permission levels) without changing the schema — just add more users with `role: admin`.

## Product Images — MVP Strategy

- Use real-looking skincare/cosmetics product photos for the seed data (not generic gray boxes) so the MVP actually feels usable and gives a true sense of the final look — e.g. free stock photos (Unsplash/Pexels-style skincare bottle/jar photography) saved locally into `/public/uploads/products/`.
- Every product's image is just a field (`imageUrl`) pointing at a file path — nothing is hardcoded into components — so swapping in real product photography later is just replacing files and/or re-uploading through the admin's product form, no code changes needed.
- The admin "Add/Edit Product" form includes a real image upload field (not just a URL field) from day one, storing to `/public/uploads/products/`, so admin can already replace placeholder photos with real ones through the UI even in MVP.
- Fall back to a clean branded placeholder image (soft ivory/rose square with a simple icon) only if a product somehow has no image, so the UI never breaks.

## Project Docs Directory

- Create a `/docs` folder at the project root (even if mostly empty for now) reserved for future markdown documentation — e.g. design style guides, Product Requirement Documents (PRDs), and other planning docs.
- Keep this folder out of the app's build/runtime logic (it's just reference material, not consumed by the app), so it can grow freely without affecting the codebase.

## Global Footer and Legal Page

- Show the footer on every page with an example shop phone number and icon.
- Include template links for Telegram and Instagram with their respective icons. Replace the example destinations when official accounts are available.
- Include a link to `/legal`.
- The legal page is a styled placeholder for future terms, purchase conditions, delivery and returns policy, and privacy policy content.

## Non-goals for this MVP (explicitly skip)

- Real SMS OTP integration
- Real payment gateway integration
- Comment moderation/approval workflow
- Cloud image storage
- Don't use emdash and instead of it use hythen

## Deliverable

A working Next.js app with seed data (a handful of demo products, one admin user, one demo customer) so the flows can be clicked through end-to-end: browse → product detail → comment (if logged in) → add to cart → checkout → fake payment → order appears in user dashboard and admin dashboard.
