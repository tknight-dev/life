import esbuild from 'esbuild';
import open from 'open';
import { sassPlugin } from 'esbuild-sass-plugin';
import { typecheckPlugin } from '@jgoz/esbuild-plugin-typecheck';

/**
 * @author tknight-dev
 */

/**
 * ARGs
 */
var production = true;
for (const param of process.argv) {
	if (param === 'dev') {
		production = false;
	}
}

/**
 * Config
 */
var config = {
	bundle: true,
	entryPoints: {
		favicon: 'src/favicon.ico',
		index: 'src/index.html',
		style: 'src/style.scss',
		script: 'src/script.ts',
		'video.engine': 'src/workers/video/video.engine.ts', // Worker entry point
	},
	loader: {
		'.html': 'copy',
		'.ico': 'copy',
	},
	format: 'esm',
	metafile: true,
	minify: true,
	outdir: 'dist',
	outExtension: {
		'.js': '.mjs',
	},
	platform: 'node',
	plugins: [sassPlugin()],
	sourcemap: false,
};

/**
 * Build
 */
if (production) {
	await esbuild.build(config);
} else {
	var host = 'localhost',
		port = 8080;

	// Config: dev
	config.minify = false;
	config.plugins.push(
		typecheckPlugin({
			watch: true,
		}),
	);
	config.sourcemap = true;

	// Serve and Watch
	var ctx = await esbuild.context(config);
	await ctx.watch();
	await ctx.serve({
		host: host,
		port: port,
	});

	// Report and open Browser instance
	console.log(`Watching and Serving on http://${host}:${port}`);
	open(`http://${host}:${port}`);
}
