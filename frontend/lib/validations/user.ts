import { z } from 'zod';

export const userSchema = z.object({
  email: z.string().email('E-mail inválido'),
  password: z.string().min(8, 'Senha deve ter pelo menos 8 caracteres'),
  tenantId: z.string().uuid('UUID inválido').optional().or(z.literal('')).transform(v => v || undefined),
  role: z.enum(['USER', 'ADMIN', 'SUPERADMIN']).default('USER'),
  active: z.boolean().default(false),
});

export type UserFormData = z.infer<typeof userSchema>;
