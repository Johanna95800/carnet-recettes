import { lookup } from "node:dns/promises";
import net from "node:net";

const MAX_TEXT = 60_000;

function isPrivateIp(ip: string) {
  if (net.isIPv6(ip)) {
    const l = ip.toLowerCase();
    if (l.startsWith("::ffff:")) return isPrivateIp(l.slice(7));
    return l === "::1" || l === "::" || l.startsWith("fc") || l.startsWith("fd") || l.startsWith("fe80");
  }
  const [a, b] = ip.split(".").map(Number);
  return (
    a === 10 || a === 127 || a === 0 || (a === 169 && b === 254) ||
    (a === 172 && b >= 16 && b <= 31) || (a === 192 && b === 168) || (a === 100 && b >= 64 && b <= 127)
  );
}

/** Refuse les URL non http(s) ou pointant vers le réseau interne. */
export async function assertPublicUrl(raw: string): Promise<URL> {
  let url: URL;
  try {
    url = new URL(raw.trim());
  } catch {
    throw new Error("Adresse invalide.");
  }
  if (!["http:", "https:"].includes(url.protocol)) throw new Error("Seules les adresses http(s) sont acceptées.");
  const { address } = await lookup(url.hostname).catch(() => {
    throw new Error("Site introuvable.");
  });
  if (isPrivateIp(address)) throw new Error("Adresse non autorisée.");
  return url;
}

export async function fetchPublic(raw: string, accept: string, maxBytes: number) {
  let url = await assertPublicUrl(raw);
  for (let hop = 0; hop < 5; hop++) {
    const res = await fetch(url, {
      redirect: "manual",
      signal: AbortSignal.timeout(15_000),
      headers: {
        accept,
        "accept-language": "fr-FR,fr;q=0.9,en;q=0.8",
        "user-agent": "Mozilla/5.0 (compatible; CarnetRecettes/1.0)",
      },
    });
    if (res.status >= 300 && res.status < 400 && res.headers.get("location")) {
      url = await assertPublicUrl(new URL(res.headers.get("location")!, url).toString());
      continue;
    }
    if (!res.ok) throw new Error(`Le site a répondu ${res.status}.`);
    const buf = Buffer.from(await res.arrayBuffer());
    if (buf.length > maxBytes) throw new Error("Contenu trop volumineux.");
    return { buf, url, contentType: res.headers.get("content-type") ?? "" };
  }
  throw new Error("Trop de redirections.");
}

function decodeEntities(s: string) {
  return s
    .replace(/&nbsp;/g, " ")
    .replace(/&amp;/g, "&")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&quot;/g, '"')
    .replace(/&#0?39;|&apos;/g, "'")
    .replace(/&#(\d+);/g, (_, n) => String.fromCodePoint(Number(n)))
    .replace(/&#x([0-9a-f]+);/gi, (_, n) => String.fromCodePoint(parseInt(n, 16)));
}

type Json = Record<string, unknown>;

function findRecipeNode(node: unknown): Json | null {
  if (!node || typeof node !== "object") return null;
  if (Array.isArray(node)) {
    for (const n of node) {
      const f = findRecipeNode(n);
      if (f) return f;
    }
    return null;
  }
  const obj = node as Json;
  const t = obj["@type"];
  if (t === "Recipe" || (Array.isArray(t) && t.includes("Recipe"))) return obj;
  if (obj["@graph"]) return findRecipeNode(obj["@graph"]);
  return null;
}

function imageUrlsFrom(value: unknown): string[] {
  if (!value) return [];
  if (typeof value === "string") return [value];
  if (Array.isArray(value)) return value.flatMap(imageUrlsFrom);
  if (typeof value === "object") {
    const o = value as Json;
    return imageUrlsFrom(o.url ?? o.contentUrl);
  }
  return [];
}

/** Extrait les données schema.org/Recipe, le texte lisible et les images d'une page. */
export function parseRecipePage(html: string, base: URL) {
  let recipe: Json | null = null;
  for (const m of html.matchAll(/<script[^>]*type=["']application\/ld\+json["'][^>]*>([\s\S]*?)<\/script>/gi)) {
    try {
      recipe = findRecipeNode(JSON.parse(m[1].trim()));
      if (recipe) break;
    } catch {
      /* JSON-LD invalide : on ignore */
    }
  }

  const images: string[] = [];
  if (recipe) images.push(...imageUrlsFrom(recipe.image));
  const og = html.match(/<meta[^>]+property=["']og:image["'][^>]+content=["']([^"']+)["']/i)
    ?? html.match(/<meta[^>]+content=["']([^"']+)["'][^>]+property=["']og:image["']/i);
  if (og) images.push(decodeEntities(og[1]));

  const absolute = [...new Set(images.map((i) => {
    try { return new URL(i, base).toString(); } catch { return null; }
  }).filter((x): x is string => !!x))];

  let structured: string | null = null;
  if (recipe) {
    const { image: _img, review: _r, aggregateRating: _a, video: _v, ...rest } = recipe;
    structured = JSON.stringify(rest).slice(0, 30_000);
  }

  const body = html.match(/<body[\s\S]*<\/body>/i)?.[0] ?? html;
  const text = decodeEntities(
    body
      .replace(/<(script|style|noscript|svg|nav|footer|header|form|iframe)[\s\S]*?<\/\1>/gi, " ")
      .replace(/<(br|\/p|\/li|\/h\d|\/div|\/tr)[^>]*>/gi, "\n")
      .replace(/<[^>]+>/g, " "),
  )
    .replace(/[ \t]+/g, " ")
    .replace(/\n\s*\n+/g, "\n")
    .trim()
    .slice(0, MAX_TEXT);

  return { structured, text, images: absolute.slice(0, 3) };
}
