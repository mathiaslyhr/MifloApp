// Symmetric encryption for the device-transfer payload.
//
// The payload the old phone hands over ({ session tokens + local snapshot })
// briefly rests in the device_transfers.payload column. Rows are service-role
// only, short-lived and single-use, but the tokens are sensitive enough that we
// also encrypt them at rest so a stray DB dump is inert. AES-256-GCM with a
// per-payload random IV; the 256-bit key is SHA-256 of the TRANSFER_ENC_KEY
// secret so any sufficiently long secret works.
//
// Wire format: base64( iv(12 bytes) || ciphertext+tag ).

const SECRET = Deno.env.get('TRANSFER_ENC_KEY') ?? '';

export function transferCryptoConfigured(): boolean {
  return SECRET.length >= 16;
}

async function keyFromSecret(): Promise<CryptoKey> {
  const digest = await crypto.subtle.digest(
    'SHA-256',
    new TextEncoder().encode(SECRET),
  );
  return crypto.subtle.importKey('raw', digest, {name: 'AES-GCM'}, false, [
    'encrypt',
    'decrypt',
  ]);
}

function toBase64(bytes: Uint8Array): string {
  let binary = '';
  for (const b of bytes) {
    binary += String.fromCharCode(b);
  }
  return btoa(binary);
}

function fromBase64(text: string): Uint8Array {
  const binary = atob(text);
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i++) {
    bytes[i] = binary.charCodeAt(i);
  }
  return bytes;
}

export async function encryptPayload(plaintext: string): Promise<string> {
  const key = await keyFromSecret();
  const iv = crypto.getRandomValues(new Uint8Array(12));
  const cipher = new Uint8Array(
    await crypto.subtle.encrypt(
      {name: 'AES-GCM', iv},
      key,
      new TextEncoder().encode(plaintext),
    ),
  );
  const out = new Uint8Array(iv.length + cipher.length);
  out.set(iv, 0);
  out.set(cipher, iv.length);
  return toBase64(out);
}

export async function decryptPayload(encoded: string): Promise<string> {
  const key = await keyFromSecret();
  const raw = fromBase64(encoded);
  const iv = raw.slice(0, 12);
  const cipher = raw.slice(12);
  const plain = await crypto.subtle.decrypt({name: 'AES-GCM', iv}, key, cipher);
  return new TextDecoder().decode(plain);
}
