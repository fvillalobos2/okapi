import { type ButtonHTMLAttributes, forwardRef } from 'react'

type Variant = 'primary' | 'secondary' | 'ghost' | 'danger' | 'outline'
type Size = 'sm' | 'md' | 'lg'

const VARIANTS: Record<Variant, string> = {
  primary:   'bg-emerald-500 text-white hover:bg-emerald-600 disabled:bg-emerald-300',
  secondary: 'bg-gray-100 text-gray-800 hover:bg-gray-200 disabled:opacity-50',
  ghost:     'text-gray-600 hover:bg-gray-100 disabled:opacity-50',
  danger:    'bg-red-500 text-white hover:bg-red-600 disabled:opacity-50',
  outline:   'border border-gray-300 text-gray-700 hover:bg-gray-50 disabled:opacity-50',
}

const SIZES: Record<Size, string> = {
  sm: 'text-xs px-3 py-1.5 min-h-[32px]',
  md: 'text-sm px-4 py-2 min-h-[40px]',
  lg: 'text-base px-5 py-3 min-h-[48px]',
}

interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: Variant
  size?: Size
}

export const Button = forwardRef<HTMLButtonElement, ButtonProps>(function Button(
  { variant = 'primary', size = 'md', className = '', children, ...props },
  ref
) {
  return (
    <button
      ref={ref}
      className={`
        inline-flex items-center justify-center gap-2 rounded-lg font-medium
        transition-colors duration-150 cursor-pointer disabled:cursor-not-allowed
        ${VARIANTS[variant]} ${SIZES[size]} ${className}
      `}
      {...props}
    >
      {children}
    </button>
  )
})
