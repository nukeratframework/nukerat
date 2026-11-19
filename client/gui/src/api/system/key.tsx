import { translate } from "@/i18n";

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
  if (!line) throw new KeyError(translate("api.keyEmpty"));

  const badKey = translate("api.badKey");
  const parts = line.split(":");
  if (parts.length !== 3) throw new KeyError(badKey);

  const [name, pass, secret] = parts;
  if (!name || !pass || !secret) {
    throw new KeyError(`${name || "Key"}: ${badKey}`);
  }
  if (secret.length !== 256) {
    throw new KeyError(`${name}: ${badKey}`);
  }

  return { name, user: name, pass, secret };
}

export function encodeKey(parsed: ParsedKey): string {
  return `${parsed.name}:${parsed.pass}:${parsed.secret}`;
}
