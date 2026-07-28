import Link from 'next/link'
import { PlusCircle } from 'lucide-react'
import { AnimalsList } from '@/components/animals/AnimalsList'
import { getAnimals } from '@/lib/data/supabase'

export default async function AnimalesPage() {
  const animals = await getAnimals()

  return (
    <div className="max-w-5xl mx-auto space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Animales</h1>
          <p className="text-gray-500 text-sm mt-0.5">Registro completo del establecimiento</p>
        </div>
        <Link
          href="/animales/nuevo"
          className="flex items-center gap-2 bg-emerald-500 text-white px-4 py-2.5 rounded-lg text-sm font-medium hover:bg-emerald-600 transition-colors min-h-[44px]"
        >
          <PlusCircle size={16} />
          Agregar
        </Link>
      </div>

      <AnimalsList animals={animals} />
    </div>
  )
}
