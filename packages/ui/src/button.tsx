import type { ButtonHTMLAttributes, ReactNode } from "react";

type ButtonTone = "primary" | "ghost";

export interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  children: ReactNode;
  className?: string;
  tone?: ButtonTone;
}

const toneClasses: Record<ButtonTone, string> = {
  primary:
    "border border-amber-300/80 bg-amber-200 px-4 py-3 text-stone-950 shadow-[0_10px_30px_rgba(238,187,102,0.28)] hover:-translate-y-0.5 hover:bg-amber-100",
  ghost:
    "border border-amber-50/15 bg-white/5 px-4 py-3 text-amber-50 hover:-translate-y-0.5 hover:border-amber-200/30 hover:bg-white/10",
};

export function Button({
  children,
  className,
  tone = "primary",
  type = "button",
  ...props
}: ButtonProps) {
  const classes = [
    "inline-flex items-center justify-center gap-2 rounded-full font-mono text-[11px] font-semibold uppercase tracking-[0.32em] transition duration-200 ease-out focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-amber-200/80 focus-visible:ring-offset-2 focus-visible:ring-offset-stone-950 disabled:cursor-not-allowed disabled:opacity-50",
    toneClasses[tone],
    className,
  ]
    .filter(Boolean)
    .join(" ");

  return (
    <button className={classes} type={type} {...props}>
      {children}
    </button>
  );
}
