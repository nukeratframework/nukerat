export class KeyError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "KeyError";
  }
}

export interface ParsedKey {
  name: string;
  user: string;
  pass: string;
  secret: string;
}

export function parseKey(raw: string): ParsedKey {
  const line = raw.trim();
  if (!line) throw new KeyError("Key is empty");

  const parts = line.split(":");
  if (parts.length !== 3) throw new KeyError("Bad authentication key");

  const [name, pass, secret] = parts;
  if (!name || !pass || !secret) {
    throw new KeyError(`${name || "Key"}: Bad authentication key`);
  }
  if (secret.length !== 256) {
    throw new KeyError(`${name}: Bad authentication key`);
  }

  return { name, user: name, pass, secret };
}

export function encodeKey(parsed: ParsedKey): string {
  return `${parsed.name}:${parsed.pass}:${parsed.secret}`;
}
