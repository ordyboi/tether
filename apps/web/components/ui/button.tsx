import { Button as ButtonPrimitive } from "@base-ui/react/button"
import { cva, type VariantProps } from "class-variance-authority"

import { cn } from "@/lib/utils"

const buttonVariants = cva(
  "group/button inline-flex shrink-0 items-center justify-center rounded-lg border border-transparent bg-clip-padding text-sm font-medium whitespace-nowrap transition-all outline-none select-none focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50 active:not-aria-[haspopup]:translate-y-px disabled:pointer-events-none disabled:opacity-50 aria-invalid:border-destructive aria-invalid:ring-3 aria-invalid:ring-destructive/20 dark:aria-invalid:border-destructive/50 dark:aria-invalid:ring-destructive/40 [&_svg]:pointer-events-none [&_svg]:shrink-0 [&_svg:not([class*='size-'])]:size-4",
  {
    variants: {
      variant: {
        default: "bg-primary text-primary-foreground hover:bg-primary/80",
        outline:
          "border-border bg-background hover:bg-muted hover:text-foreground aria-expanded:bg-muted aria-expanded:text-foreground dark:border-input dark:bg-input/30 dark:hover:bg-input/50",
        secondary:
          "bg-secondary text-secondary-foreground hover:bg-[color-mix(in_oklch,var(--secondary),var(--foreground)_5%)] aria-expanded:bg-secondary aria-expanded:text-secondary-foreground",
        ghost:
          "hover:bg-muted hover:text-foreground aria-expanded:bg-muted aria-expanded:text-foreground dark:hover:bg-muted/50",
        destructive:
          "bg-destructive/10 text-destructive hover:bg-destructive/20 focus-visible:border-destructive/40 focus-visible:ring-destructive/20 dark:bg-destructive/20 dark:hover:bg-destructive/30 dark:focus-visible:ring-destructive/40",
        link: "text-primary underline-offset-4 hover:underline",
        // Chunky "campfire" CTAs: thick border, hard drop shadow, press-down on active.
        tether:
          "border-[3px] border-orange-600 bg-orange-500 text-white shadow-[0_4px_0_0_var(--shadow-hard-color)] hover:bg-orange-500 active:translate-y-1 active:shadow-none disabled:border-stone-600 disabled:bg-stone-700 disabled:text-stone-400 disabled:shadow-none",
        "tether-success":
          "border-[3px] border-green-600 bg-green-500 text-white shadow-[0_4px_0_0_var(--shadow-hard-color)] hover:bg-green-500 active:translate-y-1 active:shadow-none disabled:border-stone-600 disabled:bg-stone-700 disabled:text-stone-400 disabled:shadow-none",
        "tether-info":
          "border-[3px] border-blue-700 bg-blue-500 text-white shadow-[0_4px_0_0_var(--shadow-hard-color)] hover:bg-blue-500 active:translate-y-1 active:shadow-none disabled:border-stone-600 disabled:bg-stone-700 disabled:text-stone-400 disabled:shadow-none",
        "tether-danger":
          "border-[3px] border-red-600 bg-red-600/20 text-red-300 active:translate-y-0.5 disabled:border-stone-600 disabled:bg-transparent disabled:text-stone-500",
        "tether-outline":
          "border-[3px] border-border bg-card text-muted-foreground hover:border-[#5c4326] hover:text-foreground",
        "tether-ghost":
          "border-2 border-border bg-card/95 text-muted-foreground backdrop-blur hover:text-foreground",
      },
      size: {
        default:
          "h-8 gap-1.5 px-2.5 has-data-[icon=inline-end]:pr-2 has-data-[icon=inline-start]:pl-2",
        xs: "h-6 gap-1 rounded-[min(var(--radius-md),10px)] px-2 text-xs in-data-[slot=button-group]:rounded-lg has-data-[icon=inline-end]:pr-1.5 has-data-[icon=inline-start]:pl-1.5 [&_svg:not([class*='size-'])]:size-3",
        sm: "h-7 gap-1 rounded-[min(var(--radius-md),12px)] px-2.5 text-[0.8rem] in-data-[slot=button-group]:rounded-lg has-data-[icon=inline-end]:pr-1.5 has-data-[icon=inline-start]:pl-1.5 [&_svg:not([class*='size-'])]:size-3.5",
        lg: "h-9 gap-1.5 px-2.5 has-data-[icon=inline-end]:pr-2 has-data-[icon=inline-start]:pl-2",
        icon: "size-8",
        "icon-xs":
          "size-6 rounded-[min(var(--radius-md),10px)] in-data-[slot=button-group]:rounded-lg [&_svg:not([class*='size-'])]:size-3",
        "icon-sm":
          "size-7 rounded-[min(var(--radius-md),12px)] in-data-[slot=button-group]:rounded-lg",
        "icon-lg": "size-9",
        // Chunky sizes used by the campfire CTAs.
        "tether-block":
          "h-auto w-full gap-2 rounded-full px-4 py-3.5 text-base font-extrabold",
        "tether-pill":
          "h-auto gap-1.5 rounded-full px-3 py-2 text-xs font-extrabold",
        "tether-icon": "size-11 rounded-full [&_svg:not([class*='size-'])]:size-[18px]",
        "tether-icon-sm": "size-8 rounded-full [&_svg:not([class*='size-'])]:size-4",
      },
    },
    defaultVariants: {
      variant: "default",
      size: "default",
    },
  }
)

function Button({
  className,
  variant = "default",
  size = "default",
  ...props
}: ButtonPrimitive.Props & VariantProps<typeof buttonVariants>) {
  return (
    <ButtonPrimitive
      data-slot="button"
      className={cn(buttonVariants({ variant, size, className }))}
      {...props}
    />
  )
}

export { Button, buttonVariants }
