import { forwardRef, type ButtonHTMLAttributes, type ReactNode } from "react";
import { Link, type LinkProps } from "react-router-dom";

/**
 * Shared button primitive. Built because the outline-button className
 * string — `"font-mono text-xs font-semibold uppercase border-2
 * border-billboard-ink rounded..."` — was copy-pasted across 61 separate
 * call sites (confirmed directly, `grep -rn` against this exact string in
 * `src`), and had already drifted: some had `hover:bg-billboard-paperDim`,
 * some `hover:-translate-y-0.5`, some neither, all for the same visual
 * role. That's also why there was no single place to add a focus ring —
 * baked in here (`focus-visible:ring-2`) so every call site that adopts
 * this component gets it for free, closing the focus-visible gap named
 * elsewhere in this same audit at the same time as the duplication.
 *
 * Three variants, matching the real button families this codebase
 * actually uses (confirmed by sampling, not guessed): `outline` (the
 * 61-occurrence one above), `primary` (the bold yellow CTA style —
 * `bg-billboard-yellow border-[3px] font-bold`), and `dark` (solid
 * black-filled, mostly admin submit actions — `bg-billboard-ink
 * text-white`, found separately while migrating real call sites, not
 * part of the original 61-occurrence count).
 *
 * Renders a `<Link>` when given `to`, a `<button>` otherwise — one
 * component either way, not two, since every call site needs the exact
 * same visual variants regardless of which it navigates with.
 */

type ButtonVariant = "outline" | "primary" | "dark";
type ButtonSize = "sm" | "md";

const BASE = "inline-flex items-center justify-center gap-2 rounded transition hover:-translate-y-0.5 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-billboard-ink focus-visible:ring-offset-2 disabled:opacity-60 disabled:hover:translate-y-0 disabled:cursor-not-allowed";

const VARIANT_CLASS: Record<ButtonVariant, string> = {
  outline: "font-mono font-semibold uppercase border-2 border-billboard-ink bg-white hover:bg-billboard-paperDim",
  primary: "font-bold border-[3px] border-billboard-ink bg-billboard-yellow hover:bg-billboard-yellowDeep",
  dark: "font-mono font-semibold uppercase bg-billboard-ink text-white hover:bg-black",
};

const SIZE_CLASS: Record<ButtonVariant, Record<ButtonSize, string>> = {
  outline: { sm: "text-xs px-3 py-1.5", md: "text-xs px-4 py-2" },
  primary: { sm: "text-sm px-4 py-2", md: "text-sm px-5 py-2.5" },
  dark: { sm: "text-xs px-3 py-1.5", md: "text-xs px-4 py-2" },
};

interface CommonProps {
  variant?: ButtonVariant;
  size?: ButtonSize;
  children: ReactNode;
  className?: string;
}

type ButtonAsButton = CommonProps & ButtonHTMLAttributes<HTMLButtonElement> & { to?: undefined };
type ButtonAsLink = CommonProps & Omit<LinkProps, "className"> & { to: LinkProps["to"] };

export type ButtonProps = ButtonAsButton | ButtonAsLink;

const Button = forwardRef<HTMLButtonElement | HTMLAnchorElement, ButtonProps>(function Button(
  { variant = "outline", size = "md", children, className = "", ...rest },
  ref,
) {
  const classes = `${BASE} ${VARIANT_CLASS[variant]} ${SIZE_CLASS[variant][size]} ${className}`.trim();

  if ("to" in rest && rest.to !== undefined) {
    const { to, ...linkRest } = rest as ButtonAsLink;
    return (
      <Link ref={ref as React.Ref<HTMLAnchorElement>} to={to} className={classes} {...linkRest}>
        {children}
      </Link>
    );
  }

  const buttonRest = rest as ButtonHTMLAttributes<HTMLButtonElement>;
  return (
    <button ref={ref as React.Ref<HTMLButtonElement>} type={buttonRest.type ?? "button"} className={classes} {...buttonRest}>
      {children}
    </button>
  );
});

export default Button;
