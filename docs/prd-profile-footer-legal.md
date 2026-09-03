# PRD: Customer Profile, Footer, and Legal Page

## Status

Implemented for the local MVP. Contact and social destinations are templates and legal copy is pending review.

## Objective

Make account access predictable after login, give customers control over their identity details, expose their checkout history, and add the minimum global contact and legal navigation expected from a shop.

## User stories

- As a guest, selecting the account icon takes me to login.
- As a logged-in customer, selecting the account icon takes me directly to my profile.
- As a customer, I can update my profile picture, name, mobile number, and delivery address.
- As a customer, I can review past checkouts with status, date, purchased products, quantities, and total.
- As a customer, I can log out from my profile.
- As a visitor, I can find the shop phone number, Telegram, Instagram, and legal page from every screen.

## Functional requirements

### Profile

- Route: `/dashboard/profile`.
- Authentication is required and enforced on the server.
- Accepted profile image types: PNG, JPEG, and WebP.
- Maximum profile image size: 3 MB.
- Mobile numbers must follow the Iranian `09xxxxxxxxx` format and remain unique.
- Profile updates persist in SQLite through Prisma.
- Order history is loaded only for the signed-in user.
- Logout clears the HTTP-only session cookie.

### Header

- The account icon resolves the current server session.
- Guests link to `/login`; authenticated users link to `/dashboard/profile`.
- When available, the profile image replaces the generic account icon.

### Footer

- Displayed globally.
- Example phone: `021-12345678`.
- Template social destinations: `https://t.me/sozamen` and `https://instagram.com/sozamen`.
- External social links open in a new tab with safe relationship attributes.

### Legal page

- Route: `/legal`.
- Clearly states that approved terms and privacy text will be added later.
- Final legal content must cover store usage, purchases, delivery, returns, and privacy.

## Acceptance criteria

- Logged-in users no longer return to login when selecting the account icon.
- A user can update all requested profile fields and see the new avatar in the header.
- Duplicate or malformed phone numbers show an error without changing the profile.
- Checkout records appear in the same user's profile.
- Logout returns to the home page and the account icon returns to guest behavior.
- Footer links and the legal placeholder are reachable on desktop and mobile layouts.

## Future work

- Replace example phone and social URLs with official details.
- Review and publish approved legal copy.
- Move profile image storage to cloud object storage before multi-server production deployment.
