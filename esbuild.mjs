import esbuild from "esbuild";
import { sassPlugin } from "esbuild-sass-plugin";

// Generate CSS/JS Builds
esbuild
    .build({
        bundle: true,
        entryPoints: ["src/favicon.ico", "src/life.html", "src/life.scss", "src/life.ts"],
        loader: {
            ".html": "copy",
            ".ico": "copy",
        },
        format: "esm",
        metafile: true,
        minify: true,
        outdir: "dist",
        plugins: [sassPlugin()],
        sourcemap: false,
    })
    .then(() => console.log("⚡ Build complete! ⚡"))
    .catch(() => process.exit(1));