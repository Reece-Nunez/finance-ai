interface FormErrorProps {
  id: string
  message: string | null | undefined
  className?: string
}

/**
 * Accessible form error message component.
 * Use with aria-describedby on the associated input.
 *
 * @example
 * <Input
 *   id="email"
 *   aria-describedby={error ? 'email-error' : undefined}
 *   aria-invalid={error ? 'true' : undefined}
 * />
 * <FormError id="email-error" message={error} />
 */
export function FormError({ id, message, className }: FormErrorProps) {
  if (!message) return null

  return (
    <p
      id={id}
      role="alert"
      className={className ?? 'text-sm text-destructive mt-1'}
    >
      {message}
    </p>
  )
}
