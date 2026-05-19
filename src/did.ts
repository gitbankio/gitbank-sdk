import fs from "node:fs";
import path from "node:path";
import os from "node:os";
import crypto from "node:crypto";

export interface DIDDocument {
  did: string;
  type: "ed25519";
  publicKeyHex: string;
  createdAt: string;
}

const DID_DIR = path.join(os.homedir(), ".gitbank", "did");
const DID_FILE = path.join(DID_DIR, "identity.json");

function ensureDir(): void {
  if (!fs.existsSync(DID_DIR)) {
    fs.mkdirSync(DID_DIR, { recursive: true, mode: 0o700 });
  }
}

function encodeBase58(buf: Buffer): string {
  const ALPHABET = "123456789ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnopqrstuvwxyz";
  let carry: number;
  const digits: number[] = [0];
  for (const byte of buf) {
    carry = byte;
    for (let i = 0; i < digits.length; i++) {
      carry += digits[i] * 256;
      digits[i] = carry % 58;
      carry = Math.floor(carry / 58);
    }
    while (carry > 0) {
      digits.push(carry % 58);
      carry = Math.floor(carry / 58);
    }
  }
  let result = "";
  for (let i = 0; i < buf.length - 1 && buf[i] === 0; i++) result += "1";
  for (let i = digits.length - 1; i >= 0; i--) result += ALPHABET[digits[i]];
  return result;
}

export function generateDID(): DIDDocument {
  const { privateKey, publicKey } = crypto.generateKeyPairSync("ed25519");
  const pubKeyDer = publicKey.export({ type: "spki", format: "der" }) as Buffer;
  const pubKeyRaw = pubKeyDer.slice(pubKeyDer.length - 32);
  const multicodecPrefix = Buffer.from([0xed, 0x01]);
  const multibase = encodeBase58(Buffer.concat([multicodecPrefix, pubKeyRaw]));
  const did = `did:key:z${multibase}`;
  const privKeyDer = privateKey.export({ type: "pkcs8", format: "pem" }) as string;

  const doc: DIDDocument = {
    did,
    type: "ed25519",
    publicKeyHex: pubKeyRaw.toString("hex"),
    createdAt: new Date().toISOString(),
  };

  ensureDir();
  fs.writeFileSync(DID_FILE, JSON.stringify({ ...doc, privateKeyPem: privKeyDer }, null, 2), { mode: 0o600 });
  return doc;
}

export function loadDID(): DIDDocument | null {
  try {
    if (!fs.existsSync(DID_FILE)) return null;
    const raw = JSON.parse(fs.readFileSync(DID_FILE, "utf-8")) as DIDDocument;
    return raw;
  } catch {
    return null;
  }
}

export function clearDID(): void {
  try {
    if (fs.existsSync(DID_FILE)) fs.unlinkSync(DID_FILE);
  } catch {
    // ignore
  }
}
