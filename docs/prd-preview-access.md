# PRD: Temporary preview access gate

## Purpose

Keep the publicly reachable MVP private while it is being shown to a small
group of invited reviewers. This gate is separate from customer and
administrator authentication and is intended to be removed when the storefront
is ready for general access.

## User flow

1. A visitor opens any storefront, dashboard, admin, API, or uploaded-media URL.
2. If temporary preview protection is enabled and the visitor has no valid
   preview cookie, the application redirects to `/preview-access`.
3. The visitor enters the shared temporary password.
4. A correct password creates a signed, HttpOnly, SameSite cookie lasting 24
   hours and returns the visitor to the originally requested internal URL.
5. Existing customer/admin authentication continues normally after the preview
   gate is passed.

## Configuration

- `PREVIEW_PASSWORD`: enables the gate when set to a nonempty value.
- `SESSION_SECRET`: contributes to the preview token signature and must be a
  strong production secret.
- `PREVIEW_COOKIE_SECURE`: defaults to secure cookies in production. Set it to
  `false` only during a short direct-HTTP test; keep it `true` or omit it when
  HTTPS is enabled.
- Removing `PREVIEW_PASSWORD` disables the gate.
- Changing either value invalidates previously issued preview cookies.

The preview password must exist only in the VPS `.env` file and must never be
committed to Git.

## Security boundaries

- The password is verified on the server and is not included in browser source.
- The access cookie is HttpOnly, Secure by default in production, SameSite=Lax,
  and scoped to the entire site.
- The gate protects application routes, APIs, and public uploaded-media paths.
- Next.js internal static/image assets and the favicon remain accessible so the
  password screen can render.
- Redirect destinations accept only same-site absolute paths.

This is a temporary shared-password barrier, not a replacement for individual
accounts, authorization, rate limiting, HTTPS, or production identity controls.

## Acceptance criteria

- Without a valid cookie, `/`, `/shop`, `/admin`, `/api/orders`, and uploaded
  media redirect to `/preview-access` when protection is enabled.
- An incorrect password shows a Persian error without granting access.
- A correct password returns the visitor to the originally requested route.
- Customer login and admin authorization still work behind the gate.
- The page is RTL, keyboard accessible, and usable on mobile screens.
- The application behaves exactly as before when `PREVIEW_PASSWORD` is absent.
