# `rsbuild-plugin-wasmpack`

[![version](https://img.shields.io/npm/v/rsbuild-plugin-wasmpack?style=flat-square&colorA=DEA584&colorB=5E4CEF)](https://www.npmjs.com/package/rsbuild-plugin-wasmpack)
[![downloads](https://img.shields.io/npm/dt/rsbuild-plugin-wasmpack?style=flat-square&colorA=DEA584&colorB=5E4CEF)](https://www.npmjs.com/package/rsbuild-plugin-wasmpack)
[![license](https://img.shields.io/github/license/nshen/vite-plugin-wasm-pack?style=flat-square&colorA=DEA584&colorB=5E4CEF)](./LICENSE)

`rsbuild-plugin-wasmpack` is a plugin for [rsbuild](https://rsbuild.dev/) that enables you to compile and build Rust crates into WebAssembly (Wasm) using [wasm-pack](https://rustwasm.github.io/wasm-pack/).

This plugin simplifies the integration of Rust to WebAssembly in your rsbuild projects, allowing you to easily compile and bundle your Rust code for use in web applications.

## Prerequisites

Before you can use this plugin, you'll need to have [wasm-pack](https://rustwasm.github.io/wasm-pack/) installed.

```Shell
cargo install wasm-pack
```

## Usage

Once installed, you can add the plugin to your `rsbuild` configuration. Here’s an example configuration for compiling a Rust crate to WebAssembly:

### Example `rsbuild.config.js`

```typescript
import { defineConfig } from "@rsbuild/core";
import { pluginWasmPack } from "rsbuild-plugin-wasmpack";

export default defineConfig({
  plugins: [
    pluginWasmPack({
      crate: "rust", // The path to your Rust crate
      output: "wasm", // The output directory for your wasm package
      target: "web", // The target environment (e.g., 'web', 'nodejs')
    }),
  ],
});

```

### Configuration Options

- `crate` (string): The path to your Rust crate or project. This is typically the folder containing `Cargo.toml`.

- `output` (string): The directory where the generated `.wasm` package will be placed.

- `target` (string): The WebAssembly target. [see all supported target by wasm-pack](https://rustwasm.github.io/wasm-pack/book/commands/build.html#target).
