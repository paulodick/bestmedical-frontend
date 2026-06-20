import type {
  InputHTMLAttributes,
  SelectHTMLAttributes,
  TextareaHTMLAttributes,
  ReactNode,
  ButtonHTMLAttributes,
} from "react";

// ===== Rótulo de campo =====
export function Label({
  children,
  htmlFor,
  required,
}: {
  children: ReactNode;
  htmlFor?: string;
  required?: boolean;
}) {
  return (
    <label
      htmlFor={htmlFor}
      className="mb-1.5 block text-[13px] font-medium text-text-muted"
    >
      {children}
      {required && <span className="ml-0.5 text-danger">*</span>}
    </label>
  );
}

const baseField =
  "w-full rounded-md border border-border bg-surface px-3 py-2 text-[14px] text-text placeholder:text-text-faint transition focus:border-primary focus:outline-none focus:ring-2 focus:ring-primary/20 disabled:cursor-not-allowed disabled:bg-surface-offset disabled:text-text-faint";

export function Input(props: InputHTMLAttributes<HTMLInputElement>) {
  return <input {...props} className={`${baseField} ${props.className ?? ""}`} />;
}

export function Textarea(props: TextareaHTMLAttributes<HTMLTextAreaElement>) {
  return (
    <textarea
      {...props}
      className={`${baseField} resize-y leading-relaxed ${props.className ?? ""}`}
    />
  );
}

export function Select(props: SelectHTMLAttributes<HTMLSelectElement>) {
  return (
    <select
      {...props}
      className={`${baseField} cursor-pointer appearance-none bg-[length:18px] bg-[right_0.6rem_center] bg-no-repeat pr-9 ${props.className ?? ""}`}
      style={{
        backgroundImage:
          "url(\"data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='18' height='18' viewBox='0 0 24 24' fill='none' stroke='%2364748b' stroke-width='2' stroke-linecap='round' stroke-linejoin='round'%3E%3Cpolyline points='6 9 12 15 18 9'/%3E%3C/svg%3E\")",
      }}
    />
  );
}

// ===== Campo completo (label + controle) =====
export function Field({
  label,
  required,
  children,
  className = "",
  hint,
}: {
  label: string;
  required?: boolean;
  children: ReactNode;
  className?: string;
  hint?: string;
}) {
  return (
    <div className={className}>
      <Label required={required}>{label}</Label>
      {children}
      {hint && <p className="mt-1 text-[12px] text-text-faint">{hint}</p>}
    </div>
  );
}

// ===== Botão =====
type Variant = "primary" | "secondary" | "ghost" | "outline";
const variants: Record<Variant, string> = {
  primary:
    "bg-primary text-text-inverse hover:bg-primary-hover active:bg-primary-active shadow-sm",
  secondary:
    "bg-surface-offset text-text hover:bg-border",
  outline:
    "border border-border bg-surface text-text hover:border-primary hover:text-primary",
  ghost: "text-text-muted hover:bg-surface-offset hover:text-text",
};

export function Button({
  variant = "primary",
  icon,
  children,
  ...props
}: ButtonHTMLAttributes<HTMLButtonElement> & {
  variant?: Variant;
  icon?: ReactNode;
}) {
  return (
    <button
      {...props}
      className={`inline-flex items-center justify-center gap-2 rounded-md px-4 py-2 text-[14px] font-medium transition disabled:cursor-not-allowed disabled:opacity-50 ${variants[variant]} ${props.className ?? ""}`}
    >
      {icon}
      {children}
    </button>
  );
}

// ===== Cartão / bloco de seção =====
export function Block({
  title,
  step,
  description,
  accent,
  children,
  right,
}: {
  title: string;
  step?: number;
  description?: string;
  accent?: boolean;
  children: ReactNode;
  right?: ReactNode;
}) {
  return (
    <section
      className={`rounded-lg border bg-surface shadow-sm ${
        accent ? "border-primary/30 ring-1 ring-primary/10" : "border-border"
      }`}
    >
      <header className="flex items-start justify-between gap-3 border-b border-divider px-5 py-3.5">
        <div className="flex items-center gap-3">
          {step != null && (
            <span
              className={`flex h-6 w-6 shrink-0 items-center justify-center rounded-md text-[12px] font-semibold ${
                accent
                  ? "bg-primary text-text-inverse"
                  : "bg-surface-offset text-text-muted"
              }`}
            >
              {step}
            </span>
          )}
          <div>
            <h2 className="text-[15px] font-semibold text-text">{title}</h2>
            {description && (
              <p className="mt-0.5 text-[12px] text-text-faint">{description}</p>
            )}
          </div>
        </div>
        {right}
      </header>
      <div className="p-5">{children}</div>
    </section>
  );
}

// ===== Badge de status (sim/não) =====
export function StatusPill({ on, label }: { on: boolean; label: string }) {
  return (
    <span
      className={`inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[11px] font-medium ${
        on
          ? "bg-success-soft text-success"
          : "bg-surface-offset text-text-faint"
      }`}
    >
      <span
        className={`h-1.5 w-1.5 rounded-full ${
          on ? "bg-success" : "bg-text-faint"
        }`}
      />
      {label}
    </span>
  );
}
