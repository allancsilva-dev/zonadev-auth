-- Seed initial post_logout_redirect_uris for ERP app
UPDATE apps
SET post_logout_redirect_uris = ARRAY[
  'https://erp.zonadev.tech/login',
  'https://erp.zonadev.tech'
]
WHERE slug = 'erp';
