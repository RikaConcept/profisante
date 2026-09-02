// Post-traitement du build Vite :
//  1. marque les balises statiques (`data-app`) pour que la page puisse se
//     republier elle-même (voir src/storage/index.ts) ;
//  2. injecte l'état initial dans <script id="app-state"> ;
//  3. écrit dist/index.html (document complet, hébergeable partout) et
//     dist/artifact.html (contenu seul, pour l'outil Artifact de Claude).
import { readFileSync, writeFileSync } from "node:fs";
import { resolve } from "node:path";

const dist = resolve("dist");
const src = readFileSync(resolve(dist, "index.html"), "utf8");
const seed = JSON.parse(readFileSync(resolve("src/data/seed.json"), "utf8"));
const json = JSON.stringify(seed).replace(/</g, "\\u003c");

let html = src
  .replace(/<style>/g, '<style data-app>')
  .replace(/<script type="module" crossorigin>/g, '<script type="module" data-app>')
  .replace(/<script type="module">/g, '<script type="module" data-app>')
  .replace(
    /<script id="app-state" type="application\/json" data-app><\/script>/,
    `<script id="app-state" type="application/json" data-app>${json}</script>`,
  );

if (!html.includes('<script type="module" data-app>')) {
  throw new Error("Bundle inline introuvable dans dist/index.html");
}
if (/<\/script>/i.test(html.split('<script type="module" data-app>')[1].split("</script>\n")[0])) {
  throw new Error("Le bundle contient une balise </script> : le document serait corrompu");
}

writeFileSync(resolve(dist, "index.html"), html);

// Version « contenu seul » pour l'outil Artifact (qui ajoute lui-même le squelette du document).
const head = html.match(/<head>([\s\S]*?)<\/head>/)?.[1] ?? "";
const body = html.match(/<body>([\s\S]*?)<\/body>/)?.[1] ?? "";
const headSansMeta = head.replace(/<meta[^>]*>\s*/g, "");
writeFileSync(resolve(dist, "artifact.html"), `${headSansMeta.trim()}\n${body.trim()}\n`);

console.log(`artifact.html : ${(Buffer.byteLength(html) / 1024).toFixed(0)} Ko`);
