/**
 * Centraliza o redirect pós-login por role.
 * SUPERADMIN → /admin (dashboard completo)
 * ADMIN       → /admin/users (apenas gestão de utilizadores do seu tenant)
 */
export function getRedirectByRole(role: string): string {
  if (role === 'SUPERADMIN') return '/admin';
  if (role === 'ADMIN') return '/admin/users';
  return '/';
}
