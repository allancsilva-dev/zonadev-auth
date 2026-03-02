import { z } from 'zod';

export const tenantSchema = z.object({
  name: z.string().min(2, 'Nome deve ter pelo menos 2 caracteres').max(255),
  subdomain: z
    .string()
    .min(2, 'Subdomínio deve ter pelo menos 2 caracteres')
    .max(100)
    .regex(/^[a-z0-9-]+$/, 'Apenas letras minúsculas, números e hífens'),
  plan: z.enum(['FREE', 'STARTER', 'PRO', 'ENTERPRISE']),
  active: z.boolean().default(true),
});

export type TenantFormData = z.infer<typeof tenantSchema>;

export const tenantUpdateSchema = tenantSchema.partial().omit({ subdomain: true });
export type TenantUpdateFormData = z.infer<typeof tenantUpdateSchema>;
