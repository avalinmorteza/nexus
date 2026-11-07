// Optional field-level encryption (AES-GCM 256, key derived with PBKDF2-SHA256, 310k iterations).
// The derived key lives only in memory of the open dashboard/popup; it is never stored.
import type { EncryptedValue, SecretValue } from './types';

const enc = new TextEncoder();
const dec = new TextDecoder();
const VERIFIER_PLAINTEXT = 'nexus-verifier-v1';

const b64 = (buf: ArrayBuffer | Uint8Array) => btoa(String.fromCharCode(...new Uint8Array(buf as ArrayBuffer)));
const unb64 = (s: string) => Uint8Array.from(atob(s), (c) => c.charCodeAt(0));

let sessionKey: CryptoKey | null = null;
const listeners = new Set<() => void>();

export function isUnlocked() {
  return !!sessionKey;
}
export function onLockChange(fn: () => void) {
  listeners.add(fn);
  return () => listeners.delete(fn);
}
function emit() {
  listeners.forEach((f) => f());
}
export function lock() {
  sessionKey = null;
  emit();
}

export function isEncrypted(v: unknown): v is EncryptedValue {
  return !!v && typeof v === 'object' && (v as any).__enc === 1;
}

export function newSalt(): string {
  return b64(crypto.getRandomValues(new Uint8Array(16)));
}

export async function deriveKey(passphrase: string, salt: string): Promise<CryptoKey> {
  const base = await crypto.subtle.importKey('raw', enc.encode(passphrase), 'PBKDF2', false, ['deriveKey']);
  return crypto.subtle.deriveKey(
    { name: 'PBKDF2', salt: unb64(salt), iterations: 310000, hash: 'SHA-256' },
    base,
    { name: 'AES-GCM', length: 256 },
    false,
    ['encrypt', 'decrypt'],
  );
}

export async function encryptWith(key: CryptoKey, plain: string): Promise<EncryptedValue> {
  const iv = crypto.getRandomValues(new Uint8Array(12));
  const ct = await crypto.subtle.encrypt({ name: 'AES-GCM', iv }, key, enc.encode(plain));
  return { __enc: 1, iv: b64(iv), ct: b64(ct) };
}

export async function decryptWith(key: CryptoKey, v: EncryptedValue): Promise<string> {
  const pt = await crypto.subtle.decrypt({ name: 'AES-GCM', iv: unb64(v.iv) }, key, unb64(v.ct));
  return dec.decode(pt);
}

export async function makeVerifier(key: CryptoKey) {
  return encryptWith(key, VERIFIER_PLAINTEXT);
}

/** Try to unlock with a passphrase; returns false if it is wrong. */
export async function unlock(passphrase: string, salt: string, verifier: EncryptedValue): Promise<boolean> {
  try {
    const key = await deriveKey(passphrase, salt);
    const v = await decryptWith(key, verifier);
    if (v !== VERIFIER_PLAINTEXT) return false;
    sessionKey = key;
    emit();
    return true;
  } catch {
    return false;
  }
}

export function setSessionKey(k: CryptoKey | null) {
  sessionKey = k;
  emit();
}
export function getSessionKey() {
  return sessionKey;
}

/** Encrypt a value for storage if encryption is on (requires unlocked session). */
export async function sealSecret(plain: string | undefined, encryptionOn: boolean): Promise<SecretValue | undefined> {
  if (!plain) return undefined;
  if (!encryptionOn) return plain;
  if (!sessionKey) throw new Error('Vault is locked');
  return encryptWith(sessionKey, plain);
}

/** Reveal a stored secret. Returns null if it is encrypted and the vault is locked. */
export async function revealSecret(v: SecretValue | undefined): Promise<string | null> {
  if (!v) return '';
  if (typeof v === 'string') return v;
  if (!sessionKey) return null;
  try {
    return await decryptWith(sessionKey, v);
  } catch {
    return null;
  }
}
