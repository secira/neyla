import { describe, expect, it } from 'vitest';
import { decryptCredential, encryptCredential, isEncryptedCredential } from './credentialVault.js';

describe('credential vault', () => {
  it('encrypts credentials without storing plaintext', () => {
    const secret = 'provider-token-that-must-not-be-exposed';
    const ciphertext = encryptCredential(secret);

    expect(ciphertext).toBeTruthy();
    expect(ciphertext).not.toContain(secret);
    expect(isEncryptedCredential(ciphertext)).toBe(true);
    expect(decryptCredential(ciphertext)).toBe(secret);
  });

  it('uses a fresh initialization vector for every write', () => {
    const first = encryptCredential('same-value');
    const second = encryptCredential('same-value');

    expect(first).not.toBe(second);
    expect(decryptCredential(first)).toBe('same-value');
    expect(decryptCredential(second)).toBe('same-value');
  });

  it('keeps legacy plaintext readable only for the startup migration', () => {
    expect(decryptCredential('legacy-token')).toBe('legacy-token');
  });
});