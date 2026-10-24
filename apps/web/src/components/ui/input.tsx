import * as React from 'react';
import { cn } from '@/lib/utils';

export type InputProps = React.InputHTMLAttributes<HTMLInputElement>;

/**
 * Konteks penghubung Field → kontrol. Dipakai supaya `id`, `aria-describedby`
 * dan `aria-invalid` tidak perlu dijahit manual oleh setiap layar; prop eksplisit
 * selalu menang atas nilai konteks.
 */
const FieldContext = React.createContext<{
  inputId?: string;
  describedBy?: string;
  invalid?: boolean;
} | null>(null);

type AriaInvalid = React.AriaAttributes['aria-invalid'];

function useFieldProps(own: { id?: string; 'aria-describedby'?: string; 'aria-invalid'?: AriaInvalid }) {
  const field = React.useContext(FieldContext);
  const describedBy = own['aria-describedby'] ?? field?.describedBy;
  const invalid = own['aria-invalid'] ?? (field?.invalid ? true : undefined);
  return { id: own.id ?? field?.inputId, describedBy, invalid };
}

/**
 * Input dengan ikon kiri/kanan. Kontras ikon dijaga (slate-400, bukan abu kusam).
 * Kelas bentuk datang dari `.velzon-input` di `app/globals.css` supaya tema gelap
 * ikut tanpa varian `dark:`.
 */
const Input = React.forwardRef<
  HTMLInputElement,
  InputProps & { startIcon?: React.ReactNode; endIcon?: React.ReactNode }
>(({ className, type, startIcon, endIcon, id, 'aria-describedby': ariaDescribedBy, 'aria-invalid': ariaInvalid, ...props }, ref) => {
  const a11y = useFieldProps({ id, 'aria-describedby': ariaDescribedBy, 'aria-invalid': ariaInvalid });

  if (!startIcon && !endIcon) {
    return (
      <input
        ref={ref}
        type={type}
        id={a11y.id}
        aria-describedby={a11y.describedBy}
        aria-invalid={a11y.invalid}
        className={cn('velzon-input', className)}
        {...props}
      />
    );
  }

  // Ikon hiasan boleh disembunyikan dari pembaca layar; kontrol (mis. tombol
  // buka/sembunyikan sandi) tidak boleh, karena elemen yang bisa difokus di
  // dalam subtree aria-hidden menjadi temuan "aria-hidden-focus".
  const endIsControl = React.isValidElement(endIcon) && typeof endIcon.type === 'string';

  return (
    <span className={cn('relative flex items-center', className)}>
      {startIcon ? (
        <span className="pointer-events-none absolute left-3.5 flex items-center text-slate-400" aria-hidden>
          {startIcon}
        </span>
      ) : null}
      <input
        ref={ref}
        type={type}
        id={a11y.id}
        aria-describedby={a11y.describedBy}
        aria-invalid={a11y.invalid}
        className={cn('velzon-input', startIcon && 'pl-10', endIcon && 'pr-10')}
        {...props}
      />
      {endIcon ? (
        <span
          className={cn(
            'absolute right-3.5 flex items-center text-slate-400',
            !endIsControl && 'pointer-events-none',
          )}
          aria-hidden={endIsControl ? undefined : true}
        >
          {endIcon}
        </span>
      ) : null}
    </span>
  );
});
Input.displayName = 'Input';

const Textarea = React.forwardRef<HTMLTextAreaElement, React.TextareaHTMLAttributes<HTMLTextAreaElement>>(
  ({ className, id, 'aria-describedby': ariaDescribedBy, 'aria-invalid': ariaInvalid, ...props }, ref) => {
    const a11y = useFieldProps({ id, 'aria-describedby': ariaDescribedBy, 'aria-invalid': ariaInvalid });
    return (
      <textarea
        ref={ref}
        id={a11y.id}
        aria-describedby={a11y.describedBy}
        aria-invalid={a11y.invalid}
        className={cn('velzon-input min-h-24 resize-y leading-relaxed', className)}
        {...props}
      />
    );
  },
);
Textarea.displayName = 'Textarea';

const Select = React.forwardRef<HTMLSelectElement, React.SelectHTMLAttributes<HTMLSelectElement>>(
  ({ className, children, id, 'aria-describedby': ariaDescribedBy, 'aria-invalid': ariaInvalid, ...props }, ref) => {
    const a11y = useFieldProps({ id, 'aria-describedby': ariaDescribedBy, 'aria-invalid': ariaInvalid });
    return (
      <select
        ref={ref}
        id={a11y.id}
        aria-describedby={a11y.describedBy}
        aria-invalid={a11y.invalid}
        className={cn('velzon-input appearance-none pr-9', className)}
        {...props}
      >
        {children}
      </select>
    );
  },
);
Select.displayName = 'Select';

/** Label + kontrol + hint/error dalam satu bungkus yang menautkan id otomatis. */
const Field = ({
  label,
  htmlFor,
  hint,
  error,
  required,
  className,
  children,
}: {
  readonly label?: string;
  readonly htmlFor?: string;
  readonly hint?: string;
  readonly error?: string;
  readonly required?: boolean;
  readonly className?: string;
  readonly children: React.ReactNode;
}) => {
  const autoId = React.useId();
  const inputId = htmlFor ?? autoId;
  const errorId = error ? `${inputId}-error` : undefined;
  const hintId = hint && !error ? `${inputId}-hint` : undefined;
  const describedBy = [errorId, hintId].filter(Boolean).join(' ') || undefined;
  const ctx = React.useMemo(
    () => ({ inputId, describedBy, invalid: Boolean(error) }),
    [inputId, describedBy, error],
  );

  return (
    <div className={cn('flex flex-col gap-1.5', className)}>
      {label ? (
        <label htmlFor={inputId} className="field-label">
          {label}
          {required ? <span className="ml-0.5 text-danger">*</span> : null}
        </label>
      ) : null}
      <FieldContext.Provider value={ctx}>{children}</FieldContext.Provider>
      {error ? (
        <p id={errorId} className="field-error" role="alert">
          {error}
        </p>
      ) : hint ? (
        <p id={hintId} className="field-hint">
          {hint}
        </p>
      ) : null}
    </div>
  );
};

export { Input, Textarea, Select, Field };
