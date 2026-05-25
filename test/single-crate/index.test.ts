import { dirname } from "node:path";
import { fileURLToPath } from "node:url";
import { test } from "@playwright/test";
import { createRsbuild } from "@rsbuild/core";
import { getRandomPort } from "../../helper";
import { pluginWasmPack } from "../../src/index";

const __dirname = dirname(fileURLToPath(import.meta.url));

test.setTimeout(120000);

test("should build wasm", async ({ page }) => {
	const rsbuild = await createRsbuild({
		cwd: __dirname,
		rsbuildConfig: {
			plugins: [
				pluginWasmPack({
					crates: [
						{
							path: "rust",
							target: "nodejs",
						},
					],
					aliasPkgDir: false,
				}),
			],
			server: {
				port: getRandomPort(),
			},
		},
	});

	await rsbuild.build();
	const { server, urls } = await rsbuild.startDevServer();

	await page.goto(urls[0]);

	await server.close();
});
