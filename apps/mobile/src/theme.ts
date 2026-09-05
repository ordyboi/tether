export const colors = {
  text: {
    primary: "#16171A",
    secondary: "#43464F",
    tertiary: "#8A8A8E",
  },
  accent: "#0A84FF",
  accentTint: "rgba(10,132,255,0.12)",
  bg: {
    app: "#F2F1F6",
    surface: "#FFFFFF",
    fill: "rgba(120,120,128,0.12)",
    fillSubtle: "rgba(120,120,128,0.08)",
  },
  separator: "rgba(60,60,67,0.13)",
  warningBg: "rgba(255,204,0,0.14)",
  success: "#2E7D4F",
  avatar: ["#2E6FE8", "#B85A32", "#4A6B45", "#1F5FD0", "#2FA98C"],
  avatarStale: "#9AA0A6",
} as const;

export type TypeRole =
  "largeTitle" | "title" | "headline" | "body" | "subhead" | "footnote" | "caption";

export const type: Record<
  TypeRole,
  {
    fontSize: number;
    fontWeight: "400" | "600" | "700";
    letterSpacing: number;
    textTransform?: "uppercase";
  }
> = {
  largeTitle: { fontSize: 34, fontWeight: "700", letterSpacing: -0.03 * 34 },
  title: { fontSize: 28, fontWeight: "700", letterSpacing: -0.03 * 28 },
  headline: { fontSize: 17, fontWeight: "600", letterSpacing: -0.01 * 17 },
  body: { fontSize: 16, fontWeight: "400", letterSpacing: 0 },
  subhead: { fontSize: 15, fontWeight: "400", letterSpacing: 0 },
  footnote: { fontSize: 13, fontWeight: "400", letterSpacing: 0 },
  caption: {
    fontSize: 11,
    fontWeight: "600",
    letterSpacing: 0.08 * 11,
    textTransform: "uppercase",
  },
};

export function avatarFont(size: number) {
  return Math.round(size * 0.42);
}

export const spacing = {
  xs: 4,
  sm: 8,
  md: 12,
  lg: 16,
  xl: 20,
  xxl: 24,
  xxxl: 32,
  gutter: 16,
} as const;

export const radii = {
  sm: 8,
  md: 12,
  lg: 14,
  xl: 20,
  pill: 999,
  full: 9999,
} as const;

export const borders = {
  hairline: "hairline",
  width: 1,
} as const;

export const touchTarget = 44;

// Hashes a member alias deterministically into one of the fixed avatar colours.
export function avatarColorFor(memberAlias: string) {
  let hash = 0;
  for (let index = 0; index < memberAlias.length; index += 1) {
    hash = (hash * 31 + memberAlias.charCodeAt(index)) >>> 0;
  }
  const palette = colors.avatar;
  return palette[hash % palette.length]!;
}
