# `rsbuild-plugin-wasmpack`

[![version](https://img.shields.io/npm/v/rsbuild-plugin-wasmpack?style=flat-square&colorA=DEA584&colorB=5E4CEF)](https://www.npmjs.com/package/rsbuild-plugin-wasmpack)
[![downloads](https://img.shields.io/npm/dt/rsbuild-plugin-wasmpack?style=flat-square&colorA=DEA584&colorB=5E4CEF)](https://www.npmjs.com/package/rsbuild-plugin-wasmpack)
[![license](https://img.shields.io/github/license/nshen/vite-plugin-wasm-pack?style=flat-square&colorA=DEA584&colorB=5E4CEF)](./LICENSE)

`rsbuild-plugin-wasmpack` is a plugin for [rsbuild](https://rsbuild.dev/) that enables you to compile and build Rust crates into WebAssembly (Wasm) using [wasm-pack](https://rustwasm.github.io/wasm-pack/).

This plugin simplifies the integration of Rust to WebAssembly in your rsbuild projects, allowing you to easily compile and bundle your Rust code for use in web applications.

## Prerequisites

Before using the plugin, make sure you have:

- [wasm-pack](https://rustwasm.github.io/wasm-pack/) installed:

  ```bash
  cargo install wasm-pack
  ```

- [rsbuild](https://rsbuild.dev/guide/start/quick-start) set up in your project.

## Installation

You can add `rsbuild-plugin-wasmpack` as a development dependency using your preferred package manager:

### npm

```bash
npm install --save-dev rsbuild-plugin-wasmpack
```

### bun

```bash
bun add -d rsbuild-plugin-wasmpack
```

### pnpm

```bash
pnpm add -D rsbuild-plugin-wasmpack
```

### yarn

```bash
yarn add -D rsbuild-plugin-wasmpack
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
      crates: [
        {
          path:   "rust1", // The path to your Rust crate
          output: "wasm1", // The output directory for your wasm package
          target: "web",   // The target environment (e.g., 'web', 'nodejs')
        },
        {
          path:   "rust2",
          output: "wasm2",
          target: "web",
        },
      ],
    }),
  ],
});
```

### Configuration Options

- `path` (string): The path to your Rust crate or project. This is typically the folder containing `Cargo.toml`.

- `output` (string): The directory where the generated `.wasm` package will be placed.

- `target` (string): The WebAssembly target. [see all supported target by wasm-pack](https://rustwasm.github.io/wasm-pack/book/commands/build.html#target).
