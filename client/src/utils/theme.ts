export const colors = {
  background: "#F4F6FF",
  surface: "#FFFFFF",
  text: "#26272A",
  primary: "#3D4A71",
  onPrimary: "#FBFBFA",
  border: "#E2E2DE",
  progressTrack: "#D5D9E8",
  progressActive: "#3D4A71",
  errorText: "#B4402A",
  errorBorder: "#D9A99C",
} as const;

export const spacing = {
  screenHorizontal: 36,
  screenBottom: 36,
  bookendTop: 72,
  stepTop: 24,
  headerToHeading: 40,
  headingGap: 24,
} as const;

export const typography = {
  heading: {
    fontSize: 40,
    fontWeight: "400",
    letterSpacing: -1.6,
    lineHeight: 46,
    color: colors.text,
  },
  subtext: {
    fontSize: 16,
    lineHeight: 25.6,
    color: colors.text,
  },
  label: {
    fontSize: 16,
    fontWeight: "600",
    color: colors.text,
  },
  button: {
    fontSize: 16,
  },
} as const;
