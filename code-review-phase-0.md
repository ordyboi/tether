# Code Review — `phase-0-design-updates`

Branch is a shadcn/base-ui design migration (mostly cosmetic class swaps). Two real issues, three cleanup items.

## Worth fixing

### 1. Drawer renders behind the Leaflet map
`apps/web/components/ui/drawer.tsx:1779`

The new shadcn Drawer overlay/popup are hardcoded to `z-50`, but Leaflet map controls (zoom buttons, attribution) sit at `z-index: 1000`. The old modals used `z-[1000]` specifically to cover the map. On `/room`, opening **GhostControls** ("Your visibility") or a **MemberSheet** leaves the map's controls painting on top of the dimmed backdrop — partially obscured, and controls stay clickable through it. Functional regression.

### 2. `clsx` removed from deps but still imported
`apps/web/package.json:13`

The diff drops `clsx` from dependencies, but `create/page.tsx`, `MemberAvatar.tsx`, and `GhostControls.tsx` still `import clsx from "clsx"`. It only resolves today because `class-variance-authority` hoists it into the root `node_modules`. A strict/isolated install (pnpm, npm without hoisting) would fail with "Cannot find module clsx".

## Cleanup / migration half-done

### 3. Geist font loaded but never rendered
`apps/web/app/layout.tsx:30`

`Geist({variable:'--font-sans'})` is wired to `<html>`, but `<body>` still has an inline `style={{ fontFamily: '"Trebuchet MS"...' }}` that wins over `font-sans`. The font is fetched every page load and displayed never.

### 4. Body still hardcodes old colors
`apps/web/app/layout.tsx:25`

`globals.css` now defines `bg-background`/`text-foreground` tokens, but `<body>` keeps literal `bg-[#1b140c] text-amber-50`, overriding the layer. Future token changes won't reach the app shell.

### 5. Stacked active-translate utilities
`apps/web/components/ui/button.tsx:22`

Base has `active:...translate-y-px` while `tether*` variants add `active:translate-y-1`. Different prefixes mean tailwind-merge won't dedupe them, muddying the intended press-down. Purely cosmetic.
