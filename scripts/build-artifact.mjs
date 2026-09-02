// Post-traitement du build Vite.
//
// Le document est découpé par POSITION de balises réelles (première <style>,
// premier <script type="module">, premier </script> qui le suit…), jamais
// par recherche large : le bundle contient du code qui manipule des
// balises HTML sous forme de chaînes et une expression régulière trop
// large s'y perdrait (c'est arrivé : page publiée tronquée).
//
// Produit :
//   dist/index.html    document complet, hébergeable partout
//   dist/artifact.html contenu seul (title/link/style + body), pour l'outil Artifact
import { readFileSync, writeFileSync } from "node:fs";
import { resolve } from "node:path";

const dist = resolve("dist");
const src = readFileSync(resolve(dist, "index.html"), "utf8");
const seed = JSON.parse(readFileSync(resolve("src/data/seed.json"), "utf8"));
const json = JSON.stringify(seed).replace(/</g, "\\u003c");

function between(texte, debut, fin, depuis = 0) {
  const a = texte.indexOf(debut, depuis);
  if (a < 0) throw new Error(`Balise introuvable : ${debut}`);
  const b = texte.indexOf(fin, a + debut.length);
  if (b < 0) throw new Error(`Fin introuvable : ${fin}`);
  return { contenu: texte.slice(a + debut.length, b), debut: a, fin: b + fin.length };
}

// 1. Titre (première balise du document).
const titre = between(src, "<title>", "</title>").contenu;

// 2. Liens externes marqués data-app (polices).
const liens = [...src.matchAll(/<link\b[^>]*\bdata-app\b[^>]*>/g)].map((m) => m[0].replace(/\s+/g, " "));

// 3. Feuille de style inlinée par vite-plugin-singlefile (première <style> du document).
const styleTag = src.match(/<style\b[^>]*>/);
if (!styleTag) throw new Error("Feuille de style inlinée introuvable dans dist/index.html");
const style = between(src, styleTag[0], "</style>", styleTag.index).contenu;

// 4. Bundle : première balise <script type="module"…> ; le bundle lui-même ne
//    contient jamais "</script>" (esbuild l'échappe en "<\/script>").
const ouvrant = src.match(/<script type="module"[^>]*>/);
if (!ouvrant) throw new Error("Bundle inline introuvable dans dist/index.html");
const bundle = between(src, ouvrant[0], "</script>", ouvrant.index).contenu;
if (/<\/script/i.test(bundle)) throw new Error("Le bundle contient une balise </script> : document corrompu");
for (const interdit of ["</body>", "</head>", "<body>", "</style>", "<title>"]) {
  if (bundle.includes(interdit)) {
    throw new Error(`Le bundle contient la chaîne ${interdit} : le découpage HTML ne serait plus fiable`);
  }
}

// 5. Assemblage — même disposition que construireDocument() côté navigateur.
const tete = [
  `<title>${titre}</title>`,
  ...liens,
  `<style data-app>${style}</style>`,
].join("\n");
const corps = [
  `<script id="app-state" type="application/json" data-app>${json}</script>`,
  '<div id="root"></div>',
  `<script type="module" data-app>${bundle}</script>`,
].join("\n");

const complet = [
  "<!doctype html>",
  '<html lang="fr">',
  "<head>",
  '<meta charset="utf-8" />',
  '<meta name="viewport" content="width=device-width, initial-scale=1" />',
  tete,
  "</head>",
  "<body>",
  corps,
  "</body>",
  "</html>",
  "",
].join("\n");

writeFileSync(resolve(dist, "index.html"), complet);
writeFileSync(resolve(dist, "artifact.html"), `${tete}\n${corps}\n`);

// Vérification : les deux fichiers doivent contenir le point d'entrée React et l'état.
for (const f of ["index.html", "artifact.html"]) {
  const t = readFileSync(resolve(dist, f), "utf8");
  if (!t.includes('getElementById("root")') || !t.includes('"membres":')) {
    throw new Error(`${f} est incomplet`);
  }
  console.log(`${f} : ${(Buffer.byteLength(t) / 1024).toFixed(0)} Ko`);
}
