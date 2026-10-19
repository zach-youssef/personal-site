/// <reference types="vitest/config" />
import { resolve } from "node:path";
import { readFileSync, existsSync } from "node:fs";
import { defineConfig, loadEnv, Plugin } from "vite";
import react from "@vitejs/plugin-react";
import tsconfigPaths from "vite-tsconfig-paths";


// https://vitejs.dev/config/
export default defineConfig(({ mode }) => {
  setEnv(mode);
  return {
    plugins: [
      react(),
      tsconfigPaths(),
      envPlugin(),
      devServerPlugin(),
      sourcemapPlugin(),
      buildPathPlugin(),
      basePlugin(),
      backendProxyPlugin(),
      importPrefixPlugin(),
      htmlPlugin(mode),
      
      
      
    ],
    css: {
      preprocessorOptions: {
        scss: {
          // Bootstrap 4 predates the Sass module system, so its sources raise deprecation
          // warnings and the theme has to @import it. Our own code otherwise warns as usual.
          quietDeps: true,
          silenceDeprecations: ["import"],
        },
      },
    },
    test: {
      environment: "jsdom",
      // Testing Library registers its automatic cleanup through the global afterEach
      globals: true,
      setupFiles: ["src/setupTests.ts"],
      include: ["src/**/*.test.{ts,tsx}"],
    },
  };
});

function setEnv(mode: string) {
	Object.assign(
		process.env,
		loadEnv(mode, ".", ["REACT_APP_", "NODE_ENV", "PUBLIC_URL"]),
	);
	process.env.NODE_ENV ||= mode;
	const { homepage } = JSON.parse(readFileSync("package.json", "utf-8"));
	process.env.PUBLIC_URL ||= homepage
		? `${
				homepage.startsWith("http") || homepage.startsWith("/")
					? homepage
					: `/${homepage}`
			}`.replace(/\/$/, "")
		: "";
}

// Expose `process.env` environment variables to your client code
// Migration guide: Follow the guide below to replace process.env with import.meta.env in your app, you may also need to rename your environment variable to a name that begins with VITE_ instead of REACT_APP_
// https://vitejs.dev/guide/env-and-mode.html#env-variables
function envPlugin(): Plugin {
  return {
    name: "env-plugin",
    config(_, { mode }) {
      const env = loadEnv(mode, ".", ["REACT_APP_", "NODE_ENV", "PUBLIC_URL"]);
      return {
        define: Object.fromEntries(
          Object.entries(env).map(([key, value]) => [
            `process.env.${key}`,
            JSON.stringify(value),
          ]),
        ),
      };
    },
  };
}

// Setup HOST, SSL, PORT
// Migration guide: Follow the guides below
// https://vitejs.dev/config/server-options.html#server-host
// https://vitejs.dev/config/server-options.html#server-https
// https://vitejs.dev/config/server-options.html#server-port
function devServerPlugin(): Plugin {
	return {
		name: "dev-server-plugin",
		config(_, { mode }) {
			const { HOST, PORT, HTTPS, SSL_CRT_FILE, SSL_KEY_FILE } = loadEnv(
				mode,
				".",
				["HOST", "PORT", "HTTPS", "SSL_CRT_FILE", "SSL_KEY_FILE"],
			);
			const https = HTTPS === "true";
			return {
				server: {
					host: HOST || "0.0.0.0",
					port: parseInt(PORT || "3000", 10),
					open: true,
					...(https &&
						SSL_CRT_FILE &&
						SSL_KEY_FILE && {
							https: {
								cert: readFileSync(resolve(SSL_CRT_FILE)),
								key: readFileSync(resolve(SSL_KEY_FILE)),
							},
						}),
				},
			};
		},
	};
}

// Migration guide: Follow the guide below
// https://vitejs.dev/config/build-options.html#build-sourcemap
function sourcemapPlugin(): Plugin {
	return {
		name: "sourcemap-plugin",
		config(_, { mode }) {
			const { GENERATE_SOURCEMAP } = loadEnv(mode, ".", [
				"GENERATE_SOURCEMAP",
			]);
			return {
				build: {
					sourcemap: GENERATE_SOURCEMAP === "true",
				},
			};
		},
	};
}

// Migration guide: Follow the guide below
// https://vitejs.dev/config/build-options.html#build-outdir
function buildPathPlugin(): Plugin {
	return {
		name: "build-path-plugin",
		config(_, { mode }) {
			const { BUILD_PATH } = loadEnv(mode, ".", [
				"BUILD_PATH",
			]);
			return {
				build: {
					outDir: BUILD_PATH || "build",
				},
			};
		},
	};
}

// Migration guide: Follow the guide below and remove homepage field in package.json
// https://vitejs.dev/config/shared-options.html#base
function basePlugin(): Plugin {
	return {
		name: "base-plugin",
		config(_, { mode }) {
			const { PUBLIC_URL } = loadEnv(mode, ".", ["PUBLIC_URL"]);
			return {
				// Absolute asset paths, so pages on nested routes like /projects/sokoban can load them
				base: PUBLIC_URL || "/",
			};
		},
	};
}

// Paths the Ktor backend serves. In production it serves the site too, so the frontend requests
// these relative to the page; the dev and preview servers forward them to a backend instead.
// Frontend build output also lives under /assets, so only the backend's asset folders are listed.
const BACKEND_PATHS = [
	"/graphql",
	"/seamCarver",
	"/assets/projectThumbnail",
	"/assets/raytracer",
	"/assets/ppu",
	"/assets/zgal",
];

// BACKEND_URL picks the backend, e.g. a local one on another port or the live site;
// it defaults to the port the backend listens on when run locally
function backendProxyPlugin(): Plugin {
	return {
		name: "backend-proxy-plugin",
		config(_, { mode }) {
			const { BACKEND_URL } = loadEnv(mode, ".", ["BACKEND_URL"]);
			const target = BACKEND_URL || "http://localhost:8080";
			const proxy = Object.fromEntries(
				BACKEND_PATHS.map((path) => [path, { target, changeOrigin: true }]),
			);
			return { server: { proxy }, preview: { proxy } };
		},
	};
}

// To resolve modules from node_modules, you can prefix paths with ~
// https://create-react-app.dev/docs/adding-a-sass-stylesheet
// Migration guide: Follow the guide below
// https://vitejs.dev/config/shared-options.html#resolve-alias
function importPrefixPlugin(): Plugin {
	return {
		name: "import-prefix-plugin",
		config() {
			return {
				resolve: {
					alias: [{ find: /^~([^/])/, replacement: "$1" }],
				},
			};
		},
	};
}




// Replace %ENV_VARIABLES% in index.html
// https://vitejs.dev/guide/api-plugin.html#transformindexhtml
// Migration guide: Follow the guide below, you may need to rename your environment variable to a name that begins with VITE_ instead of REACT_APP_
// https://vitejs.dev/guide/env-and-mode.html#html-env-replacement
function htmlPlugin(mode: string): Plugin {
	const env = loadEnv(mode, ".", ["REACT_APP_", "NODE_ENV", "PUBLIC_URL"]);
	return {
		name: "html-plugin",
		transformIndexHtml: {
			order: "pre",
			handler(html) {
				return html.replace(/%(.*?)%/g, (match, p1) => env[p1] ?? match);
			},
		},
	};
}
