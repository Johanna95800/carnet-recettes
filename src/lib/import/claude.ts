import Anthropic from "@anthropic-ai/sdk";
import { zodOutputFormat } from "@anthropic-ai/sdk/helpers/zod";
import { z } from "zod";
import { ExtractedRecipeSchema, type ExtractedRecipe } from "@/lib/types";

const client = new Anthropic(); // lit ANTHROPIC_API_KEY

const SYSTEM = `Tu es l'assistant d'un carnet de recettes familial français. On te donne une recette (photo d'une fiche manuscrite, photo d'une page de livre/magazine, ou contenu d'une page web) et tu la retranscris fidèlement dans le format demandé.

Règles :
- Écris en français. Si la source est dans une autre langue, traduis-la.
- Recopie les étapes fidèlement, sans en inventer ; découpe-les en étapes courtes et claires, une action principale par étape. Ne numérote pas les étapes dans le texte.
- Ingrédients : sépare quantité numérique, unité et nom (« 200 g de farine » → quantity 200, unit "g", name "farine"). Convertis les fractions (½ → 0.5). Pour « 3 œufs », unit est null.
- Ustensiles : liste ceux cités ; si la source n'en cite pas, déduis le matériel indispensable des étapes (moule, saladier, fouet, four…).
- Durées en minutes, bien séparées : prep_minutes = travail actif seulement ; cook_minutes = cuisson ; rest_minutes = attente sans intervention (refroidissement, réfrigération, levée, marinade…) avec sa nature dans rest_label. Ne mets JAMAIS un temps de refroidissement ou de repos dans la préparation. Si la source donne un « temps total », redécompose-le. Si les durées ne sont pas indiquées, estime-les à partir des étapes.
- Difficulté : reprends celle de la source, sinon estime-la.
- Catégorie : choisis la plus adaptée (apéritif, entrée, plat, accompagnement, dessert, boisson, sauce, petit-déjeuner, autre).
- Écriture manuscrite difficile à lire : fais au mieux en t'aidant du contexte culinaire ; si un mot reste illisible, mets [?] à sa place.
- Si plusieurs images sont fournies, elles forment une seule recette (pages successives).
- Photos : pour chaque image, indique la rotation qui remet le texte à l'endroit (une photo prise téléphone à plat est souvent couchée ou à l'envers).
- Si aucune recette n'est présente, renvoie found=false avec des champs vides.`;

export type ImageInput = { base64: string; mediaType: "image/jpeg" | "image/png" | "image/webp" };

export class ExtractionError extends Error {}

async function run(content: Anthropic.Beta.BetaContentBlockParam[]): Promise<ExtractedRecipe> {
  let response;
  try {
    response = await client.beta.messages.parse({
      model: "claude-opus-5-5",
      max_tokens: 16000,
      // Si la requête est refusée par un filtre de sécurité, l'API la rejoue sur un modèle de repli.
      betas: ["server-side-fallback-2026-07-01"],
      fallbacks: "default",
      output_config: { effort: "medium", format: zodOutputFormat(ExtractedRecipeSchema) },
      system: SYSTEM,
      messages: [{ role: "user", content }],
    });
  } catch (err) {
    if (err instanceof Anthropic.AuthenticationError) {
      throw new ExtractionError("Clé API Anthropic invalide ou absente (ANTHROPIC_API_KEY).");
    }
    if (err instanceof Anthropic.RateLimitError) {
      throw new ExtractionError("Trop de demandes en ce moment, réessayez dans une minute.");
    }
    if (err instanceof Anthropic.APIError) {
      throw new ExtractionError(`Erreur du service d'IA (${err.status ?? "réseau"}). Réessayez.`);
    }
    throw err;
  }
  if (response.stop_reason === "refusal") {
    throw new ExtractionError("L'IA n'a pas pu traiter ce contenu.");
  }
  if (response.stop_reason === "max_tokens" || !response.parsed_output) {
    throw new ExtractionError("La recette n'a pas pu être lue entièrement. Réessayez ou saisissez-la à la main.");
  }
  const out = response.parsed_output;
  if (!out.found) throw new ExtractionError("Aucune recette n'a été trouvée.");
  return out;
}

export function extractFromImages(images: ImageInput[], kind: "manuscrite" | "livre") {
  const hint =
    kind === "manuscrite"
      ? "Voici la photo d'une recette écrite à la main. Retranscris-la, et remplis images (une entrée par photo)."
      : "Voici la photo d'une recette tirée d'un livre ou d'un magazine. Retranscris-la, et remplis images (une entrée par photo).";
  return run([
    ...images.map(
      (img): Anthropic.Beta.BetaContentBlockParam => ({
        type: "image",
        source: { type: "base64", media_type: img.mediaType, data: img.base64 },
      }),
    ),
    { type: "text", text: hint },
  ]);
}

export function extractFromWebPage(url: string, structured: string | null, pageText: string) {
  const parts = [
    `Voici le contenu d'une page web de recette (${url}). Retranscris la recette. images doit être vide.`,
  ];
  if (structured) parts.push(`<donnees_structurees>\n${structured}\n</donnees_structurees>`);
  parts.push(`<texte_de_la_page>\n${pageText}\n</texte_de_la_page>`);
  return run([{ type: "text", text: parts.join("\n\n") }]);
}

const PixelBox = z.object({
  left: z.number(),
  top: z.number(),
  right: z.number(),
  bottom: z.number(),
});

const LocateSchema = z.object({
  images: z.array(
    z.object({
      image_index: z.number(),
      page_box: PixelBox.describe("Bords de la feuille / de la page (ou des deux pages ouvertes), en pixels"),
      dish_photo_box: PixelBox.nullable().describe(
        "Bords de la photo du plat imprimée sur cette page, en pixels. null s'il n'y en a pas sur cette image.",
      ),
    }),
  ),
});
export type Located = z.infer<typeof LocateSchema>["images"][number];

/**
 * Localise, sur des images déjà remises à l'endroit, la page et la photo du plat.
 * Appel séparé et dédié : bien plus précis que de demander les cadres pendant la retranscription.
 */
export async function locateOnPages(
  images: (ImageInput & { width: number; height: number })[],
  withDish: boolean,
): Promise<Located[]> {
  const content: Anthropic.Beta.BetaContentBlockParam[] = [];
  images.forEach((img, i) => {
    content.push({ type: "text", text: `Image ${i} — ${img.width} × ${img.height} pixels :` });
    content.push({ type: "image", source: { type: "base64", media_type: img.mediaType, data: img.base64 } });
  });
  content.push({
    type: "text",
    text: `Pour chaque image, donne en pixels (origine en haut à gauche, x vers la droite, y vers le bas) :
- page_box : les bords exacts de la feuille ou de la page photographiée (des deux pages si le livre est ouvert), en excluant la table, la main, le fond. Si la page remplit toute l'image, donne toute l'image.
${withDish
  ? "- dish_photo_box : les bords exacts de la photo du plat imprimée sur la page — au ras de l'image imprimée, sans le texte, le titre ni la marge blanche autour. Si plusieurs photos, prends la plus grande montrant le plat terminé. null si cette image n'en contient pas."
  : "- dish_photo_box : toujours null."}
Sois précis au pixel près : regarde où se trouvent réellement les bords.`,
  });

  const response = await client.beta.messages.parse({
    model: "claude-opus-5-5",
    max_tokens: 16000,
    betas: ["server-side-fallback-2026-07-01"],
    fallbacks: "default",
    output_config: { effort: "medium", format: zodOutputFormat(LocateSchema) },
    messages: [{ role: "user", content }],
  });
  if (response.stop_reason !== "end_turn" || !response.parsed_output) return [];
  return response.parsed_output.images;
}
