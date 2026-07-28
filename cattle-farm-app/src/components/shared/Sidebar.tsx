'use client'

import Link from 'next/link'
import { usePathname } from 'next/navigation'
import {
  Home, Beef, Heart, Scale, MapPin, Dna, Landmark,
  Upload, CheckSquare, TrendingUp, MessageCircle, Settings, Menu, X, Target,
} from 'lucide-react'
import { useState } from 'react'

const NAV_GROUPS = [
  {
    label: null,
    items: [
      { href: '/inicio',          label: 'Inicio',             icon: Home },
      { href: '/establecimiento', label: 'Mi Establecimiento', icon: Landmark },
    ],
  },
  {
    label: 'GESTIÓN',
    items: [
      { href: '/animales',     label: 'Animales',            icon: Beef },
      { href: '/reproduccion', label: 'Reproducción',        icon: Heart },
      { href: '/pesos',        label: 'Pesos',               icon: Scale },
      { href: '/lotes',        label: 'Lotes y potreros',    icon: MapPin },
      { href: '/genetica',     label: 'Genética',            icon: Dna },
    ],
  },
  {
    label: 'OPERACIONES',
    items: [
      { href: '/forecast',     label: 'Forecast',      icon: Target },
      { href: '/importar',    label: 'Importar',     icon: Upload },
      { href: '/tareas',      label: 'Tareas',        icon: CheckSquare },
      { href: '/rentabilidad',label: 'Rentabilidad',  icon: TrendingUp },
    ],
  },
  {
    label: null,
    items: [
      { href: '/asistente',    label: 'Asistente IA',  icon: MessageCircle },
      { href: '/configuracion',label: 'Configuración', icon: Settings },
    ],
  },
]

function NavLink({ href, label, icon: Icon, onClick }: {
  href: string; label: string; icon: React.ElementType; onClick?: () => void
}) {
  const pathname = usePathname()
  const isActive = pathname === href || (href !== '/inicio' && pathname.startsWith(href + '/'))

  return (
    <Link
      href={href}
      onClick={onClick}
      className={`
        flex items-center gap-2.5 px-3 py-1.5 rounded text-[13px] transition-colors
        ${isActive
          ? 'bg-[#292524] text-white font-medium border-l-2 border-[#16A34A] pl-[10px]'
          : 'text-[#A8A29E] hover:text-[#D6D3D1] hover:bg-[#292524] border-l-2 border-transparent pl-[10px]'
        }
      `}
    >
      <Icon size={15} strokeWidth={isActive ? 2 : 1.5} />
      <span>{label}</span>
    </Link>
  )
}

function NavGroup({ group, onNavigate }: { group: typeof NAV_GROUPS[0]; onNavigate?: () => void }) {
  return (
    <div className="space-y-0.5">
      {group.label && (
        <p className="px-3 pt-4 pb-1 text-[10px] font-semibold tracking-widest text-[#57534E]">
          {group.label}
        </p>
      )}
      {group.items.map(item => (
        <NavLink key={item.href} {...item} onClick={onNavigate} />
      ))}
    </div>
  )
}

export function Sidebar({ farmName }: { farmName?: string }) {
  return (
    <aside className="hidden md:flex flex-col w-52 bg-[#1C1917] min-h-screen py-5 shrink-0">
      {/* Logo */}
      <div className="px-4 mb-6">
        <div className="flex items-center gap-2">
          <div className="w-6 h-6 bg-[#16A34A] rounded flex items-center justify-center shrink-0">
            <span className="text-white font-bold text-xs">G</span>
          </div>
          <span className="text-white font-semibold text-sm tracking-tight">GanApp</span>
        </div>
      </div>

      {/* Nav */}
      <nav className="flex-1 px-1 space-y-1">
        {NAV_GROUPS.map((group, i) => (
          <NavGroup key={i} group={group} />
        ))}
      </nav>

      {/* Farm label */}
      <div className="px-4 pt-3 mt-4 border-t border-[#292524]">
        <p className="text-[11px] text-[#D6D3D1] font-medium truncate">{farmName ?? 'Establecimiento'}</p>
        <p className="text-[10px] text-[#78716C] mt-0.5">Establecimiento activo</p>
      </div>
    </aside>
  )
}

export function MobileNav() {
  const [open, setOpen] = useState(false)

  return (
    <>
      <header className="md:hidden flex items-center justify-between bg-[#1C1917] px-4 py-3 sticky top-0 z-40 border-b border-[#292524]">
        <div className="flex items-center gap-2">
          <div className="w-5 h-5 bg-[#16A34A] rounded flex items-center justify-center">
            <span className="text-white font-bold text-[10px]">G</span>
          </div>
          <span className="text-white font-semibold text-sm">GanApp</span>
        </div>
        <button
          onClick={() => setOpen(true)}
          className="text-[#A8A29E] p-1.5 rounded hover:bg-[#292524]"
        >
          <Menu size={20} />
        </button>
      </header>

      {open && (
        <div className="fixed inset-0 z-50 md:hidden">
          <div className="absolute inset-0 bg-black/60" onClick={() => setOpen(false)} />
          <aside className="absolute left-0 top-0 bottom-0 w-64 bg-[#1C1917] py-5 flex flex-col">
            <div className="flex items-center justify-between px-4 mb-6">
              <div className="flex items-center gap-2">
                <div className="w-6 h-6 bg-[#16A34A] rounded flex items-center justify-center">
                  <span className="text-white font-bold text-xs">G</span>
                </div>
                <span className="text-white font-semibold text-sm">GanApp</span>
              </div>
              <button onClick={() => setOpen(false)} className="text-[#A8A29E] p-1 rounded hover:bg-[#292524]">
                <X size={18} />
              </button>
            </div>
            <nav className="flex-1 px-1 space-y-1">
              {NAV_GROUPS.map((group, i) => (
                <NavGroup key={i} group={group} onNavigate={() => setOpen(false)} />
              ))}
            </nav>
          </aside>
        </div>
      )}
    </>
  )
}
