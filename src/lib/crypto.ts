import crypto from "node:crypto";

// AES-256-GCM helpers to encrypt OAuth tokens before they touch the JSON store.
// The key is derived from NETFLIXME_SECRET. If no secret is set we fall back to a
// machine-local constant — fine for a personal local-first app, but the README
// recommends setting a real secret.

function key(): Buffer {
  const secret =
    process.env.NETFLIXME_SECRET && process.env.NETFLIXME_SECRET.length > 0
      ? process.env.NETFLIXME_SECRET
      : "netflixme-local-default-secret-change-me";
  return crypto.createHash("sha256").update(secret).digest();
}

export function encrypt(plain: string): string {
  const iv = crypto.randomBytes(12);
  const cipher = crypto.createCipheriv("aes-256-gcm", key(), iv);
  const enc = Buffer.concat([cipher.update(plain, "utf8"), cipher.final()]);
  const tag = cipher.getAuthTag();
  return `${iv.toString("base64")}.${tag.toString("base64")}.${enc.toString("base64")}`;
}

export function decrypt(payload: string): string {
  const [ivB64, tagB64, dataB64] = payload.split(".");
  if (!ivB64 || !tagB64 || !dataB64) throw new Error("bad ciphertext");
  const decipher = crypto.createDecipheriv(
    "aes-256-gcm",
    key(),
    Buffer.from(ivB64, "base64")
  );
  decipher.setAuthTag(Buffer.from(tagB64, "base64"));
  const dec = Buffer.concat([
    decipher.update(Buffer.from(dataB64, "base64")),
    decipher.final(),
  ]);
  return dec.toString("utf8");
}

export function randomState(): string {
  return crypto.randomBytes(16).toString("hex");
}
