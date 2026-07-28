import { type HTMLAttributes } from 'react'

type Variant = 'default' | 'success' | 'warning' | 'danger' | 'info' | 'outline'

const VARIANTS: Record<Variant, string> = {
  default: 'bg-gray-100 text-gray-700',
  success: 'bg-emerald-100 text-emerald-700',
  warning: 'bg-yellow-100 text-yellow-700',
  danger:  'bg-red-100 text-red-700',
  info:    'bg-blue-100 text-blue-700',
  outline: 'border border-gray-300 text-gray-600',
}

interface BadgeProps extends HTMLAttributes<HTMLSpanElement> {
  variant?: Variant
}

export function Badge({ variant = 'default', className = '', children, ...props }: BadgeProps) {
  return (
    <span
      className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium ${VARIANTS[variant]} ${className}`}
      {...props}
    >
      {children}
    </span>
  )
}
