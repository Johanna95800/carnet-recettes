# 🍲 Carnet de recettes

Application web (installable sur téléphone) pour rassembler et partager les recettes de la famille.

## Fonctionnalités

- **Import depuis un site** : collez l'adresse, la recette est lue automatiquement (avec la photo).
- **Import d'une recette manuscrite** : prenez la fiche en photo, l'IA la retranscrit (la photo d'origine est gardée en souvenir).
- **Import depuis un livre / magazine** : photographiez la page ; la photo du plat est découpée automatiquement.
- **Saisie libre** et modification de toute recette après import.
- Chaque recette contient : étapes, ingrédients et quantités, nombre de personnes, ustensiles, temps de préparation / cuisson / repos, difficulté, photos, catégorie (apéritif, entrée, plat, dessert…), astuces, mots-clés, source.
- **Partage familial** : chaque membre crée un compte et rejoint le carnet avec un code d'invitation. Tout le monde peut ajouter et modifier.
- Recherche par nom ou ingrédient, filtre par catégorie.
- Ajustement automatique des quantités selon le nombre de personnes.
- **Mode cuisine** : l'écran du téléphone reste allumé, les étapes et ingrédients se cochent.

## Technique

- [Next.js](https://nextjs.org) 15 + Tailwind CSS
- [Supabase](https://supabase.com) : comptes, base de données, stockage des photos (bucket privé, accès limité à la famille)
- [Claude](https://www.anthropic.com) (API Anthropic) pour lire les photos et pages web
- Hébergement : [Vercel](https://vercel.com)

## Mise en route

### 1. Supabase (gratuit)

1. Créez un projet sur [supabase.com](https://supabase.com).
2. Dans **SQL Editor**, collez et exécutez le contenu de [`supabase/schema.sql`](supabase/schema.sql).
3. Dans **Project Settings → API**, notez l'URL du projet et la clé `anon` publique.
4. Dans **Authentication → URL Configuration**, mettez l'adresse du site (ex. `https://carnet-recettes.vercel.app`) dans *Site URL*, et ajoutez `https://carnet-recettes.vercel.app/auth/callback` dans *Redirect URLs*.

### 2. Clé Anthropic

Créez une clé sur [console.anthropic.com](https://console.anthropic.com) → *API Keys*. Comptez quelques centimes par recette importée.

### 3. Vercel (gratuit)

1. Sur [vercel.com](https://vercel.com), **Add New → Project** et importez ce dépôt GitHub.
2. Ajoutez les variables d'environnement :
   - `NEXT_PUBLIC_SUPABASE_URL`
   - `NEXT_PUBLIC_SUPABASE_ANON_KEY`
   - `ANTHROPIC_API_KEY`
3. Déployez.

### 4. Utilisation

1. Ouvrez le site, créez votre compte, puis **créez le carnet** (ex. « Famille Martin »).
2. Dans l'onglet **Famille**, partagez le code d'invitation.
3. Sur téléphone : *Partager → Sur l'écran d'accueil* (iPhone) ou *⋮ → Installer l'application* (Android).

## Développement local

```bash
cp .env.example .env.local   # puis remplissez les valeurs
npm install
npm run dev
```
