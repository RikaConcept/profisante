import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import { viteSingleFile } from "vite-plugin-singlefile";

// Le build produit un seul fichier HTML autonome (dist/index.html) :
// c'est ce fichier qui est publié comme artefact partagé et qui se
// republie lui-même à chaque enregistrement (voir src/storage).
export default defineConfig({
  plugins: [react(), viteSingleFile()],
  build: {
    target: "es2020",
    cssCodeSplit: false,
    assetsInlineLimit: 100_000_000,
    reportCompressedSize: false,
  },
});
