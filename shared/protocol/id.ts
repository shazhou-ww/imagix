/**
 * Prefixed ULID ID system.
 *
 * Format: `pfx_crockford_base32(128bit_ulid)` — always 30 characters.
 *   - pfx: 3-char entity type prefix
 *   - _:   separator
 *   - 26 chars Crockford Base32 encoded ULID (10 timestamp + 16 random)
 */

// Crockford Base32 alphabet (lowercase)
const ENCODING = "0123456789abcdefghjkmnpqrstvwxyz";
const DECODING: Record<string, number> = {};
for (let i = 0; i < ENCODING.length; i++) {
  DECODING[ENCODING[i]] = i;
}

const ID_LENGTH = 30;
const ULID_LENGTH = 26;
const PREFIX_LENGTH = 3;

export const EntityPrefix = {
  World: "wld",
  TaxonomyNode: "txn",
  Character: "chr",
  Thing: "thg",
  Relationship: "rel",
  Event: "evt",
  EventLink: "elk",
  Story: "sty",
  Chapter: "chp",
  Plot: "plt",
} as const;

export type EntityPrefix = (typeof EntityPrefix)[keyof typeof EntityPrefix];

const VALID_PREFIXES = new Set<string>(Object.values(EntityPrefix));

// ---------------------------------------------------------------------------
// Crockford Base32 ULID encoding
// ---------------------------------------------------------------------------

function encodeTime(timestamp: number): string {
  let t = timestamp;
  const chars: string[] = new Array(10);
  for (let i = 9; i >= 0; i--) {
    chars[i] = ENCODING[t & 0x1f];
    t = Math.floor(t / 32);
  }
  return chars.join("");
}

function encodeRandom(): string {
  const bytes = new Uint8Array(10); // 80 bits
  crypto.getRandomValues(bytes);

  const chars: string[] = new Array(16);
  // Encode 80 bits (10 bytes) into 16 base32 chars
  // Process 5 bits at a time from an 80-bit buffer
  let buffer = 0;
  let bitsInBuffer = 0;
  let charIdx = 15;

  for (let i = 9; i >= 0; i--) {
    buffer = (buffer << 8) | bytes[i];
    bitsInBuffer += 8;
    while (bitsInBuffer >= 5) {
      chars[charIdx--] = ENCODING[buffer & 0x1f];
      buffer >>>= 5;
      bitsInBuffer -= 5;
    }
  }
  if (bitsInBuffer > 0) {
    chars[charIdx--] = ENCODING[buffer & 0x1f];
  }
  // Fill any remaining positions (shouldn't happen for 80 bits → 16 chars)
  while (charIdx >= 0) {
    chars[charIdx--] = "0";
  }

  return chars.join("");
}

function generateUlid(timestamp?: number): string {
  const ts = timestamp ?? Date.now();
  return encodeTime(ts) + encodeRandom();
}

// ---------------------------------------------------------------------------
// Public API
// ---------------------------------------------------------------------------

export function createId(prefix: EntityPrefix, timestamp?: number): string {
  return `${prefix}_${generateUlid(timestamp)}`;
}

const ID_REGEX = /^[a-z]{3}_[0-9a-hjkmnp-tv-z]{26}$/;

export function isValidId(id: string): boolean {
  return id.length === ID_LENGTH && ID_REGEX.test(id);
}

export function isValidIdWithPrefix(id: string, prefix: EntityPrefix): boolean {
  return isValidId(id) && id.startsWith(`${prefix}_`);
}

export function getPrefix(id: string): string {
  return id.slice(0, PREFIX_LENGTH);
}

export function extractTimestamp(id: string): number {
  const ulidPart = id.slice(PREFIX_LENGTH + 1, PREFIX_LENGTH + 1 + 10);
  let timestamp = 0;
  for (const char of ulidPart) {
    timestamp = timestamp * 32 + (DECODING[char] ?? 0);
  }
  return timestamp;
}
