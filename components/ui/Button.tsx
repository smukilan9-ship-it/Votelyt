"use client";
import { ButtonHTMLAttributes, forwardRef } from "react";

interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: "primary" | "secondary" | "danger" | "ghost" | "success";
  size?: "sm" | "md" | "lg";
  loading?: boolean;
}

/**
 * Premium button. Blue gradient primary with glow + lift, glass secondary,
 * clear destructive. Strong focus-visible ring and 44px touch targets come
 * from the .btn* primitives in globals.css. No weak text-only primaries.
 */
const variantClass: Record<NonNullable<ButtonProps["variant"]>, string> = {
  primary: "btn-primary",
  success: "btn-primary",
  secondary: "btn-glass",
  ghost: "btn-ghost",
  danger: "btn-danger",
};

const sizeClass: Record<NonNullable<ButtonProps["size"]>, string> = {
  sm: "text-[0.82rem] px-4 py-2",
  md: "text-[0.9rem] px-5 py-2.5",
  lg: "text-[0.98rem] px-7 py-3.5",
};

export const Button = forwardRef<HTMLButtonElement, ButtonProps>(
  ({ variant = "primary", size = "md", loading, children, className = "", disabled, ...props }, ref) => {
    return (
      <button
        ref={ref}
        className={`btn ${variantClass[variant]} ${sizeClass[size]} ${className}`}
        disabled={disabled || loading}
        aria-busy={loading || undefined}
        {...props}
      >
        {loading && (
          <svg className="h-4 w-4 animate-spin" fill="none" viewBox="0 0 24 24" aria-hidden="true">
            <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="3" />
            <path className="opacity-90" fill="currentColor" d="M4 12a8 8 0 018-8v3a5 5 0 00-5 5H4z" />
          </svg>
        )}
        {children}
      </button>
    );
  }
);

Button.displayName = "Button";
