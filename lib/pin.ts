/**
 * Helpers PIN — utilisés par les routes /api/pin*.
 *
 * Le PIN est hashé avec scrypt (algorithme intégré à Node, déjà très lent
 * volontairement pour résister au brute-force) + un sel aléatoire par user.
 * Format stocké en DB : `salt_hex:hash_hex`.
 */

import { scrypt, randomBytes, timingSafeEqual } from 'crypto';
import { promisify } from 'util';

const scryptAsync = promisify(scrypt) as (
  pwd: string | Buffer,
  salt: string | Buffer,
  keylen: number,
) => Promise<Buffer>;

const PIN_REGEX = /^\d{4,6}$/;

export function isValidPinFormat(pin: string): boolean {
  return PIN_REGEX.test(pin);
}

export async function hashPin(pin: string): Promise<string> {
  if (!isValidPinFormat(pin)) {
    throw new Error('PIN must be 4 to 6 digits.');
  }
  const salt = randomBytes(16);
  const derived = await scryptAsync(pin, salt, 64);
  return `${salt.toString('hex')}:${derived.toString('hex')}`;
}

export async function verifyPin(pin: string, stored: string | null): Promise<boolean> {
  if (!stored || !isValidPinFormat(pin)) return false;
  const [saltHex, hashHex] = stored.split(':');
  if (!saltHex || !hashHex) return false;
  const salt = Buffer.from(saltHex, 'hex');
  const expected = Buffer.from(hashHex, 'hex');
  const derived = await scryptAsync(pin, salt, 64);
  if (derived.length !== expected.length) return false;
  return timingSafeEqual(derived, expected);
}
