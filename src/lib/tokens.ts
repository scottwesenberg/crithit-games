import crypto from "crypto";

export function createToken() {
  return crypto.randomBytes(32).toString("hex");
}

export function tokenExpiry(hours: number) {
  return new Date(Date.now() + hours * 60 * 60 * 1000);
}
