import { z } from 'zod'

export const AnimalFormSchema = z.object({
  display_id: z.string().min(1, 'El número de animal es requerido'),
  ear_tag: z.string().optional(),
  name: z.string().optional(),
  category: z.enum([
    'vaca_reproductora', 'toro', 'vaquillona', 'novillo',
    'ternero', 'ternera', 'macho_joven', 'hembra_joven',
  ]),
  sex: z.enum(['M', 'H']),
  birth_date: z.string().optional(),
  breed_raw: z.string().optional(),
  mother_display_id: z.string().optional(),
  father_name: z.string().optional(),
  current_lot_id: z.string().optional(),
  notes: z.string().optional(),
})

export type AnimalFormValues = z.infer<typeof AnimalFormSchema>

export const WeightFormSchema = z.object({
  weight_date: z.string().min(1, 'La fecha es requerida'),
  weight_kg: z.coerce.number().positive('El peso debe ser mayor a 0').max(2000, 'Peso inválido'),
  measurement_method: z.enum(['balanza', 'cinta', 'estimado', 'otro']).optional(),
  notes: z.string().optional(),
})

export type WeightFormValues = z.infer<typeof WeightFormSchema>
