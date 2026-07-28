'use client'

import { Info } from 'lucide-react'

interface TooltipProps {
  text: string
  children: React.ReactNode
  position?: 'top' | 'bottom' | 'right'
  width?: string
}

export function Tooltip({ text, children, position = 'top', width = 'w-56' }: TooltipProps) {
  const posClass = {
    top:    'bottom-full left-1/2 -translate-x-1/2 mb-2',
    bottom: 'top-full left-1/2 -translate-x-1/2 mt-2',
    right:  'left-full top-1/2 -translate-y-1/2 ml-2',
  }[position]

  const arrowClass = {
    top:    'top-full left-1/2 -translate-x-1/2 border-t-[#1C1917] border-l-transparent border-r-transparent border-b-transparent',
    bottom: 'bottom-full left-1/2 -translate-x-1/2 border-b-[#1C1917] border-l-transparent border-r-transparent border-t-transparent',
    right:  'right-full top-1/2 -translate-y-1/2 border-r-[#1C1917] border-t-transparent border-b-transparent border-l-transparent',
  }[position]

  return (
    <span className="group/tip relative inline-flex items-center">
      {children}
      <span
        className={`
          pointer-events-none invisible group-hover/tip:visible
          absolute ${posClass} ${width}
          bg-[#1C1917] text-white text-xs leading-relaxed
          px-3 py-2 rounded z-50 shadow-lg
          transition-opacity opacity-0 group-hover/tip:opacity-100
        `}
      >
        {text}
        <span className={`absolute border-4 ${arrowClass}`} />
      </span>
    </span>
  )
}

/* Convenience: label + info icon + tooltip */
export function MetricLabel({ label, tooltip }: { label: string; tooltip: string }) {
  return (
    <Tooltip text={tooltip} position="top">
      <span className="flex items-center gap-1 cursor-default">
        <span>{label}</span>
        <Info size={11} className="text-stone-400 shrink-0" />
      </span>
    </Tooltip>
  )
}
