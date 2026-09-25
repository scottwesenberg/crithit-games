export function formatCents(cents: number) {
  return (cents / 100).toLocaleString("en-US", {
    style: "currency",
    currency: "USD",
  });
}

export function slugify(input: string) {
  return input
    .toString()
    .toLowerCase()
    .trim()
    .replace(/['"]/g, "")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/(^-|-$)+/g, "");
}

export function generateOrderNumber() {
  const stamp = Date.now().toString(36).toUpperCase();
  const rand = Math.random().toString(36).slice(2, 6).toUpperCase();
  return `CHG-${stamp}-${rand}`;
}

export function generateSku(gameSlug: string, setSlug: string, cardSlug: string, finish: string, condition: string) {
  const bits = [gameSlug, setSlug, cardSlug, finish, condition]
    .join("-")
    .toUpperCase()
    .replace(/[^A-Z0-9-]/g, "");
  return bits.slice(0, 120);
}

export function classNames(...values: Array<string | false | null | undefined>) {
  return values.filter(Boolean).join(" ");
}
