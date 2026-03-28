export interface AdminApp {
  id: string;
  name: string;
  slug: string;
  domain: string;
  baseUrl?: string;
  postLogoutRedirectUris?: string[];
  active: boolean;
  updatedAt?: string | null;
}

export interface CreateAdminAppPayload {
  name: string;
  slug: string;
  domain: string;
  baseUrl: string;
  active?: boolean;
  postLogoutRedirectUris?: string[];
}
