import type { RsbuildPlugin } from "@rsbuild/core";
import { sync as runSync } from "cross-spawn";
import path from "node:path";
import fs from "node:fs";
/**
 * Configuration options for the `pluginWasmPack`.
 */
export type PluginWasmPackOptions = {
	/**
	 * A list of Rust crates to be built using `wasm-pack`.
	 */
	crates: CrateTarget[];
};

export type CrateTarget = {
	/**
	 * The file path to the Rust crate directory, which must contain the `Cargo.toml` file.
	 */
	path: string;

	/**
	 * The directory where the compiled WebAssembly package will be output
	 * after running `wasm-pack`.
	 */
	output: string;

	/**
	 * Specifies the target environment for the generated WebAssembly package.
	 *
	 * - `"nodejs"`: For use with the Node.js runtime.
	 * - `"web"`: For use in web browsers.
	 * - `"no-modules"`: Outputs a package without ES6 module support.
	 * - `"deno"`: Outputs a package compatible with the Deno runtime.
	 * - `"bundler"`: Outputs a package suitable for module bundlers like Webpack or Rollup.
	 */
	target: "nodejs" | "web" | "no-modules" | "deno" | "bundler";
};

let watchers = new Map<string, fs.FSWatcher>();

/**
 * Creates an `RsbuildPlugin` that uses `wasm-pack` to build a Rust crate
 * into a WebAssembly package.
 *
 * @param options - Configuration options for the plugin.
 * @returns An `RsbuildPlugin` instance that can be used in the build process.
 */
export const pluginWasmPack = (
	options: PluginWasmPackOptions,
): RsbuildPlugin => ({
	name: "rsbuild:wasmpack",
	setup: (api) => {
		const wasmPackPath = path.resolve(
			process.env.HOME || "",
			".cargo/bin/wasm-pack",
		);

		if (!fs.existsSync(wasmPackPath)) {
			throw new Error("wasm-pack not found please install it");
		}

		if (!(options?.crates?.length > 0)) {
			throw new Error("Crates are missing");
		}

		const crates = new Array<CrateTarget>();
		const paths = new Set<string>();

		for (const crate of options.crates) {
			if (!(crate?.path?.length > 0)) {
				throw new Error("Crate path is missing");
			}

			if (!(crate?.target?.length > 0)) {
				throw new Error(`No target directory for ${path.basename(crate.path)}`);
			}

			if (!(crate?.output?.length > 0)) {
				throw new Error(`No output directory for ${path.basename(crate.path)}`);
			}

			if (fs.existsSync(path.resolve(crate.path, "Cargo.toml"))) {
				throw new Error(`${path.basename(crate.path)} does not exists`);
			}

			const fullPath = path.resolve(crate.path);

			crates.push({
				path: fullPath,
				output: path.resolve(crate.path),
				target: crate.target,
			});

			paths.add(fullPath);
		}

		function initialBuild() {
			for (const crate of options.crates) {
				console.log(`Building ${path.basename(crate.path)}`);

				buildCrate(wasmPackPath, crate.path, crate.output, crate.target);
			}
		}

		api.onBeforeBuild(initialBuild);
		api.onBeforeStartProdServer(initialBuild);
		api.onBeforeStartDevServer(initialBuild);

		api.onAfterStartDevServer(() => {
			for (const [_path, watcher] of watchers) {
				watcher.close();
			}

			watchers = new Map(
				crates.map((crate) => [
					crate.path,
					fs.watch(crate.path, { encoding: "buffer" }, (event) => {
						if (event !== "change") return;

						console.log("Rebuilding ", path.basename(crate.path));

						buildCrate(wasmPackPath, crate.path, crate.output, crate.target);
					}),
				]),
			);
		});

		api.onCloseDevServer(() => {
			for (const [_path, watcher] of watchers) {
				watcher.close();
			}

			watchers.clear();
		});
	},
});

function buildCrate(
	wasmPackPath: string,
	cratePath: string,
	outputPath: string,
	target: CrateTarget["target"],
) {
	const result = runSync(
		wasmPackPath,
		["build", "--out-dir", outputPath, "--target", target],
		{
			stdio: "inherit",
			cwd: cratePath,
			env: {
				...process.env,
				PATH: `${process.env.PATH}:${path.resolve(
					process.env.HOME || "",
					".cargo/bin",
				)}`,
			},
		},
	);

	if (result.error) {
		throw new Error(`Failed to run wasm-pack: ${result.error.message}`);
	}

	if (result.status !== 0) {
		throw new Error(`wasm-pack exited with status code ${result.status}`);
	}
}
