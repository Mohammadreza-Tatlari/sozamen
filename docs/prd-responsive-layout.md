# PRD: Responsive Layout

## Objective

Make all customer and administrator workflows usable on phones, tablets, and desktop screens without clipped content or horizontal scrolling.

## Requirements

- Support a minimum viewport width of 320px.
- Use RTL direction and right-aligned content throughout customer and administrator pages, including responsive layouts.
- Keep tracking codes and numeric entry fields isolated where LTR character ordering improves readability.
- Show the full desktop navigation above 850px.
- Show a keyboard-accessible mobile menu at 850px and below while keeping account and cart actions visible.
- The menu exposes its expanded state to assistive technology and closes with Escape, backdrop selection, or navigation.
- Collapse the hero, product details, profile, admin orders, and order details to one column where needed.
- Reduce cards, imagery, headings, and panel spacing on narrow screens.
- Stack checkout and cart summary actions when horizontal space is insufficient.
- Prevent admin product rows and order line items from overflowing.
- Use a single-column product grid on screens narrower than 380px.

## Verification

- Verify the home page at 390px and 320px widths.
- Verify the mobile menu opens within the viewport and all links are reachable.
- Verify the shop, product detail, cart, footer, profile, and admin CSS layouts have mobile breakpoints.
- Verify no horizontal page overflow at the tested phone widths.
- Verify the desktop navigation returns above the mobile breakpoint.

## Source readability

- TypeScript, TSX, CSS, JSON, and Markdown files use a shared Prettier configuration.
- Prisma schema files use Prisma's official formatter.
- Indentation uses two spaces without tabs and source lines target a maximum width of 100 characters.
- Developers can run `npm run format` to format the project or `npm run format:check` to verify formatting without changing files.
