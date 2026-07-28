// 共用 Neobrutalism 基礎元件（抄 tpass-vote/src/components/ui/primitives.tsx 的寫法）。
// 嚴格照 tpass-portal/docs/design.md：互動元素一律 border-2 border-foreground + hard offset
// shadow，hover 上移、shadow 變大。禁 soft shadow / dark mode / hex；圓角 ≤ rounded-2xl。
import * as React from "react";
import Link from "next/link";

export function cn(...parts: Array<string | false | null | undefined>): string {
  return parts.filter(Boolean).join(" ");
}

// ── Button ────────────────────────────────────────────────────────────
type ButtonVariant = "primary" | "default" | "accent" | "destructive" | "ghost";
type ButtonSize = "sm" | "md";

const BTN_BASE =
  "inline-flex items-center justify-center gap-2 rounded-xl border-2 border-foreground font-bold transition-all duration-200 disabled:opacity-50 disabled:pointer-events-none";
const BTN_SHADOW =
  "shadow-[3px_3px_0_0_var(--color-foreground)] hover:-translate-y-0.5 hover:shadow-[5px_5px_0_0_var(--color-foreground)] active:translate-y-0 active:shadow-[2px_2px_0_0_var(--color-foreground)]";

const BTN_VARIANT: Record<ButtonVariant, string> = {
  primary: `bg-primary text-primary-foreground ${BTN_SHADOW}`,
  accent: `bg-accent text-primary-foreground ${BTN_SHADOW}`,
  default: `bg-card text-foreground ${BTN_SHADOW}`,
  destructive: `bg-destructive text-primary-foreground ${BTN_SHADOW}`,
  ghost: "border-transparent text-muted-foreground hover:text-foreground hover:bg-muted",
};
const BTN_SIZE: Record<ButtonSize, string> = {
  sm: "px-3 py-1.5 text-sm",
  md: "px-4 py-2",
};

export interface ButtonProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: ButtonVariant;
  size?: ButtonSize;
}

function buttonClass(variant: ButtonVariant, size: ButtonSize, className?: string): string {
  return cn(BTN_BASE, BTN_VARIANT[variant], BTN_SIZE[size], className);
}

export function Button({ variant = "default", size = "md", className, ...props }: ButtonProps) {
  return <button className={buttonClass(variant, size, className)} {...props} />;
}

// 「長得像按鈕的連結」。存在的理由：<Link><Button/></Link> 會產出 <a><button></button></a>，
// 巢狀互動元素是無效 HTML，鍵盤與螢幕閱讀器的行為沒有定義。導覽用連結、動作用按鈕，
// 兩者共用同一組 class 就好。
export function LinkButton({
  href,
  variant = "default",
  size = "md",
  className,
  children,
}: {
  href: string;
  variant?: ButtonVariant;
  size?: ButtonSize;
  className?: string;
  children: React.ReactNode;
}) {
  return (
    <Link href={href} className={buttonClass(variant, size, className)}>
      {children}
    </Link>
  );
}

// ── Input / Select ───────────────────────────────────────────────────
const FIELD_BASE =
  "w-full rounded-xl border-2 border-foreground bg-card px-3 py-2 font-medium text-foreground placeholder:text-muted-foreground/70 outline-none transition-shadow focus:shadow-[3px_3px_0_0_var(--color-ring)] disabled:opacity-50";

export const Input = React.forwardRef<HTMLInputElement, React.InputHTMLAttributes<HTMLInputElement>>(
  function Input({ className, ...props }, ref) {
    return <input ref={ref} className={cn(FIELD_BASE, className)} {...props} />;
  },
);

export const Textarea = React.forwardRef<
  HTMLTextAreaElement,
  React.TextareaHTMLAttributes<HTMLTextAreaElement>
>(function Textarea({ className, ...props }, ref) {
  // 貼 email 清單用，所以固定 mono——一眼看得出哪一行少了 @ 或多了空格。
  return <textarea ref={ref} className={cn(FIELD_BASE, "font-mono text-sm", className)} {...props} />;
});

export const Select = React.forwardRef<HTMLSelectElement, React.SelectHTMLAttributes<HTMLSelectElement>>(
  function Select({ className, children, ...props }, ref) {
    return (
      <select ref={ref} className={cn(FIELD_BASE, "appearance-none pr-8", className)} {...props}>
        {children}
      </select>
    );
  },
);

// ── Card ──────────────────────────────────────────────────────────────
export function Card({ className, ...props }: React.HTMLAttributes<HTMLDivElement>) {
  return (
    <div
      className={cn(
        "rounded-2xl border-2 border-foreground bg-card p-5 shadow-[4px_4px_0_0_var(--color-foreground)]",
        className,
      )}
      {...props}
    />
  );
}

// ── Badge ─────────────────────────────────────────────────────────────
export function Badge({ className, ...props }: React.HTMLAttributes<HTMLSpanElement>) {
  return (
    <span
      className={cn(
        "inline-block rounded-md border-2 border-foreground bg-card px-2 py-0.5 font-mono text-[11px] font-bold text-foreground",
        className,
      )}
      {...props}
    />
  );
}

// ── Label ─────────────────────────────────────────────────────────────
export function Label({ className, ...props }: React.LabelHTMLAttributes<HTMLLabelElement>) {
  return <label className={cn("block font-bold text-sm text-foreground", className)} {...props} />;
}
