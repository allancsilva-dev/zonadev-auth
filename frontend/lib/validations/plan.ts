import { z } from 'zod';

export const planSchema = z.object({
  name: z.string().min(2, 'Nome deve ter pelo menos 2 caracteres').max(100),
  price: z.number().min(0, 'Preço não pode ser negativo'),
  maxUsers: z.number().int().min(1, 'Mínimo 1 utilizador'),
  features: z.record(z.string(), z.unknown()).default({}),
});

export type PlanFormData = z.infer<typeof planSchema>;
