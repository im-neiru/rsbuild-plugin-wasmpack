# `rsbuild-plugin-wasmpack`

[![version](https://img.shields.io/npm/v/rsbuild-plugin-wasmpack?style=flat-square&colorA=DEA584&colorB=5E4CEF)](https://www.npmjs.com/package/rsbuild-plugin-wasmpack)
[![downloads](https://img.shields.io/npm/dt/rsbuild-plugin-wasmpack?style=flat-square&colorA=DEA584&colorB=5E4CEF)](https://www.npmjs.com/package/rsbuild-plugin-wasmpack)
[![license](https://img.shields.io/github/license/nshen/vite-plugin-wasm-pack?style=flat-square&colorA=DEA584&colorB=5E4CEF)](./LICENSE)

`rsbuild-plugin-wasmpack` is a plugin for [rsbuild](https://rsbuild.dev/) that enables you to compile and build Rust crates into WebAssembly (Wasm) using [wasm-pack](https://rustwasm.github.io/wasm-pack/).

This plugin simplifies the integration of Rust to WebAssembly in your projects, allowing you to easily compile and bundle your Rust code for use in web applications.

## Table of Contents

- [`rsbuild-plugin-wasmpack`](#rsbuild-plugin-wasmpack)
  - [Table of Contents](#table-of-contents)
  - [Demo](#demo)
  - [Prerequisites](#prerequisites)
  - [Installation](#installation)
    - [npm](#npm)
    - [bun](#bun)
    - [pnpm](#pnpm)
    - [yarn](#yarn)
  - [Usage](#usage)
    - [Example `rsbuild.config.js`](#example-rsbuildconfigjs)
    - [Example usage](#example-usage)
    - [Configuration Options](#configuration-options)

## Demo

![Demo](./assets/hotreload.webp)

This demo shows the hot-reloading feature of the `rsbuild-plugin-wasmpack` in action. As you make changes to your Rust code, the plugin automatically rebuilds the WebAssembly package and updates the web application without requiring a full page reload.

## Prerequisites

Before using the plugin, make sure you have:

- [wasm-pack](https://rustwasm.github.io/wasm-pack/installer/) installed:

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
            target: "web",   // The target environment (e.g., 'web', 'nodejs')
          },
          {
            path:   "rust2",
            target: "web",
            profileOnDev: "profiling", // Optional: The profile to use when building the crate in development mode (default: 'dev')
            profileOnProd: "release",   // Optional: The profile to use when building the crate in production mode (default: 'release')
          },
        ],
      },
      wasmpackPath: "path/to/wasm-pack", // Optional: The path to the wasm-pack executable (default: '~/.cargo/bin/wasm-pack')
    ),
  ],
});
```

### Example usage

```typescript
import initializeRust1 from "rust1"; // Note that the package name is the specified name in the `Cargo.toml` file
import initializeRust2 from "rust2";

initializeRust1().then((rust1) => {
  rust1.greet("World1"); // Call the exported function from the Rust crate
});

initializeRust2().then((rust2) => {
  rust2.greet("World2");
});

```

### Configuration Options

- `crates` (array): An array of objects representing the Rust crates you want to compile. Each object should have the following properties:
  - `path` (string): The path to your Rust crate or project. This is typically the folder containing `Cargo.toml`.

  - `target` (string): The WebAssembly target. [See all supported targets in the wasm-pack documentation](https://rustwasm.github.io/wasm-pack/book/commands/build.html#target).

  - `profileOnDev` ("dev"| "profiling" | "release"): The profile to use when building the crate in development mode. This is optional and defaults to `dev`.

  - `profileOnProd` ("dev"| "profiling" | "release"): The profile to use when building the crate in production mode. This is optional and defaults to `dev`.

- `wasmpackPath` (string): The path to the wasm-pack executable. This is optional and defaults to `~/.cargo/bin/wasm-pack`.

