import { createHash, randomBytes } from 'crypto';

/**
 * Gera um token criptograficamente aleatório como hex string.
 * @param bytes Número de bytes aleatórios (padrão: 64 → 128 chars hex)
 */
export function generateToken(bytes = 64): string {
  return randomBytes(bytes).toString('hex');
}

/**
 * Calcula SHA-256 de uma string.
 * Usado para armazenar refresh tokens e reset tokens com segurança:
 * token puro → e-mail/cookie | hash → banco de dados
 */
export function sha256(input: string): string {
  return createHash('sha256').update(input).digest('hex');
}
