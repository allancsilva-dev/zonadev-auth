export const OidcError = {
  invalidRequest: (description: string) => ({
    error: 'invalid_request' as const,
    error_description: description,
  }),
  invalidClient: (description: string) => ({
    error: 'invalid_client' as const,
    error_description: description,
  }),
  unauthorizedClient: (description: string) => ({
    error: 'unauthorized_client' as const,
    error_description: description,
  }),
  accessDenied: (description: string) => ({
    error: 'access_denied' as const,
    error_description: description,
  }),
  invalidGrant: (description: string) => ({
    error: 'invalid_grant' as const,
    error_description: description,
  }),
  invalidScope: (description: string) => ({
    error: 'invalid_scope' as const,
    error_description: description,
  }),
} as const;