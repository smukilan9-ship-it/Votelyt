import { InputHTMLAttributes, forwardRef } from "react";

interface InputProps extends InputHTMLAttributes<HTMLInputElement> {
  label?: string;
  error?: string;
  helper?: string;
}

/** Underline input: 1px bottom hairline, accent on focus, mono value text. */
export const Input = forwardRef<HTMLInputElement, InputProps>(
  ({ label, error, helper, className = "", ...props }, ref) => (
    <div className="flex flex-col gap-1.5">
      {label && (
        <label className="mono-label">
          {label}
          {props.required && <span className="ml-1 text-accent">*</span>}
        </label>
      )}
      <input
        ref={ref}
        className={`field-underline text-sm placeholder:font-mono placeholder:text-[0.8rem] ${
          error ? "!border-b-[var(--destructive)]" : ""
        } ${className}`}
        {...props}
      />
      {error && <p className="font-mono text-[0.65rem] text-destructive">{error}</p>}
      {helper && !error && <p className="font-mono text-[0.65rem] tracking-wide text-muted">{helper}</p>}
    </div>
  )
);

Input.displayName = "Input";

interface TextareaProps extends React.TextareaHTMLAttributes<HTMLTextAreaElement> {
  label?: string;
  error?: string;
}

export const Textarea = forwardRef<HTMLTextAreaElement, TextareaProps>(
  ({ label, error, className = "", ...props }, ref) => (
    <div className="flex flex-col gap-1.5">
      {label && (
        <label className="mono-label">
          {label}
          {props.required && <span className="ml-1 text-accent">*</span>}
        </label>
      )}
      <textarea
        ref={ref}
        className={`resize-none rounded-[2px] border bg-transparent px-3 py-2.5 text-sm text-bone placeholder:text-muted transition-colors focus:outline-none focus:border-accent ${
          error ? "border-[var(--destructive)]" : "border-[var(--hairline-strong)]"
        } ${className}`}
        {...props}
      />
      {error && <p className="font-mono text-[0.65rem] text-destructive">{error}</p>}
    </div>
  )
);

Textarea.displayName = "Textarea";
