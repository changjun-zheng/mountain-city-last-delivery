const UUID_V4_PATTERN =
  /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

export interface CryptoLike {
  readonly randomUUID?: () => string;
  readonly getRandomValues?: <T extends Uint8Array>(array: T) => T;
}

export function createRuntimeUuid(cryptoSource: CryptoLike | undefined): string {
  if (!cryptoSource) {
    throw new Error('Secure UUID generation is unavailable in this browser.');
  }
  if (typeof cryptoSource.randomUUID === 'function') {
    const value = cryptoSource.randomUUID();
    if (!UUID_V4_PATTERN.test(value)) {
      throw new Error('crypto.randomUUID() returned an invalid UUID v4.');
    }
    return value.toLowerCase();
  }
  if (typeof cryptoSource.getRandomValues === 'function') {
    const bytes = cryptoSource.getRandomValues(new Uint8Array(16));
    bytes[6] = (bytes[6] & 0x0f) | 0x40;
    bytes[8] = (bytes[8] & 0x3f) | 0x80;
    const hex = [...bytes].map(byte => byte.toString(16).padStart(2, '0')).join('');
    return `${hex.slice(0, 8)}-${hex.slice(8, 12)}-${hex.slice(12, 16)}-${hex.slice(16, 20)}-${hex.slice(20)}`;
  }
  throw new Error('crypto.randomUUID and crypto.getRandomValues are unavailable.');
}

export function runtimeUuidProvider(
  cryptoSource: CryptoLike | undefined = globalThis.crypto,
): Readonly<{ generate: () => string }> {
  return Object.freeze({ generate: () => createRuntimeUuid(cryptoSource) });
}
