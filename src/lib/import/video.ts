import { fetchPublic } from "./web";

export type VideoInfo = { platform: string; title: string; text: string; thumbnails: string[] };

function decodeJsonString(s: string) {
  try { return JSON.parse(`"${s}"`) as string; } catch { return s; }
}
function meta(html: string, prop: string) {
  const re1 = new RegExp(`<meta[^>]+(?:property|name)=["']${prop}["'][^>]+content=["']([^"']*)["']`, "i");
  const re2 = new RegExp(`<meta[^>]+content=["']([^"']*)["'][^>]+(?:property|name)=["']${prop}["']`, "i");
  const v = html.match(re1)?.[1] ?? html.match(re2)?.[1] ?? "";
  return v.replace(/&amp;/g, "&").replace(/&quot;/g, '"').replace(/&#0?39;/g, "'").replace(/&#x27;/g, "'");
}

export function videoPlatform(url: URL): "youtube" | "tiktok" | "instagram" | null {
  const h = url.hostname.replace(/^(www|m)\./, "");
  if (h === "youtube.com" || h === "youtu.be" || h === "music.youtube.com") return "youtube";
  if (h.endsWith("tiktok.com")) return "tiktok";
  if (h === "instagram.com") return "instagram";
  return null;
}

function youtubeId(url: URL) {
  if (url.hostname.endsWith("youtu.be")) return url.pathname.slice(1).split("/")[0];
  return url.searchParams.get("v") ?? url.pathname.match(/\/(?:shorts|embed|live)\/([\w-]{6,})/)?.[1] ?? null;
}

/** Récupère le titre, la description (où se trouve souvent la recette) et la miniature d'une vidéo. */
export async function fetchVideo(url: URL): Promise<VideoInfo | null> {
  const platform = videoPlatform(url);
  if (platform === "youtube") {
    const id = youtubeId(url);
    if (!id) return null;
    const { buf } = await fetchPublic(`https://www.youtube.com/watch?v=${id}&hl=fr`, "text/html", 8_000_000);
    const html = buf.toString("utf8");
    const desc = html.match(/"shortDescription":"((?:[^"\\]|\\.)*)"/)?.[1];
    return {
      platform: "YouTube",
      title: meta(html, "og:title"),
      text: desc ? decodeJsonString(desc) : meta(html, "og:description"),
      thumbnails: [`https://i.ytimg.com/vi/${id}/maxresdefault.jpg`, `https://i.ytimg.com/vi/${id}/hqdefault.jpg`],
    };
  }
  if (platform === "tiktok") {
    // liens courts (vm.tiktok.com / vt.tiktok.com) : on suit la redirection vers l'adresse complète
    if (/^(vm|vt)\./.test(url.hostname)) {
      url = (await fetchPublic(url.toString(), "text/html", 8_000_000).catch(() => ({ url }))).url;
    }
    const { buf } = await fetchPublic(`https://www.tiktok.com/oembed?url=${encodeURIComponent(url.toString())}`, "application/json", 2_000_000);
    const j = JSON.parse(buf.toString("utf8")) as { title?: string; thumbnail_url?: string; author_name?: string };
    return { platform: "TikTok", title: j.author_name ? `Vidéo de ${j.author_name}` : "", text: j.title ?? "", thumbnails: j.thumbnail_url ? [j.thumbnail_url] : [] };
  }
  if (platform === "instagram") {
    const code = url.pathname.match(/\/(?:p|reel|reels|tv)\/([\w-]+)/)?.[1];
    if (!code) return null;
    // la page « embed » contient la légende complète sans connexion
    const { buf } = await fetchPublic(`https://www.instagram.com/p/${code}/embed/captioned/`, "text/html", 5_000_000);
    const html = buf.toString("utf8");
    const caption = html.match(/<div class="Caption"[^>]*>([\s\S]*?)<div class="CaptionComments"/)?.[1] ?? "";
    const text = caption.replace(/<br\s*\/?>/gi, "\n").replace(/<[^>]+>/g, " ").replace(/&amp;/g, "&").replace(/&#39;|&#x27;/g, "'")
      .replace(/&quot;/g, '"').replace(/[ \t]+/g, " ").trim();
    const img = html.match(/<img[^>]+class="EmbeddedMediaImage"[^>]+src="([^"]+)"/)?.[1]?.replace(/&amp;/g, "&");
    return { platform: "Instagram", title: "", text, thumbnails: img ? [img] : [] };
  }
  return null;
}
