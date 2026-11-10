import { existsSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { expect, test } from "@playwright/test";
import { createRsbuild } from "@rsbuild/core";
import { getRandomPort } from "../../helper";
import { pluginWasmPack } from "../../src/index";

const __dirname = dirname(fileURLToPath(import.meta.url));

test.setTimeout(120000);

test("builds a Rust crate and runs its Wasm exports in the browser", async ({
	page,
}) => {
	const rsbuild = await createRsbuild({
		cwd: __dirname,
		rsbuildConfig: {
			plugins: [
				pluginWasmPack({
					crates: [
						{
							path: "rust",
							target: "web",
						},
					],
					autoInstallWasmPack: true,
				}),
			],
			server: {
				port: getRandomPort(),
			},
		},
	});

	await rsbuild.build();
	const wasmPath = join(__dirname, "pkgs", "wasm-crate", "wasm_crate_bg.wasm");
	expect(existsSync(wasmPath)).toBe(true);

	const { server, urls } = await rsbuild.startDevServer();
	const pageErrors: Error[] = [];
	page.on("pageerror", (error) => pageErrors.push(error));

	try {
		const response = await page.goto(urls[0]);

		expect(response?.ok()).toBe(true);
		await expect(page.locator("#wasm-result")).toHaveText("Hello, wasm-crate!");
		expect(pageErrors).toEqual([]);
	} finally {
		await server.close();
	}
});
