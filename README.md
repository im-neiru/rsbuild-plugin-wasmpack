# `rsbuild-plugin-wasmpack`

[![version](https://img.shields.io/npm/v/rsbuild-plugin-wasmpack?style=flat-square&colorA=DEA584&colorB=5E4CEF)](https://www.npmjs.com/package/rsbuild-plugin-wasmpack)
[![downloads](https://img.shields.io/npm/dt/rsbuild-plugin-wasmpack?style=flat-square&colorA=DEA584&colorB=5E4CEF)](https://www.npmjs.com/package/rsbuild-plugin-wasmpack)
[![license](https://img.shields.io/github/license/nshen/vite-plugin-wasm-pack?style=flat-square&colorA=DEA584&colorB=5E4CEF)](./LICENSE)

`rsbuild-plugin-wasmpack` is a plugin for [Rsbuild](https://rsbuild.dev/) that enables you to compile Rust crates into WebAssembly (Wasm) using [`wasm-pack`](https://drager.github.io/wasm-pack/). It simplifies integration of Rust code into web applications with support for hot-reloading, crate aliasing, and automatic Rust toolchain management.

---

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
    - [`crates` (required)](#crates-required)
    - [`wasmpackPath` (optional)](#wasmpackpath-optional)
    - [`pkgsDir` (optional)](#pkgsdir-optional)
    - [`aliasPkgDir` (optional)](#aliaspkgdir-optional)
    - [`autoInstallWasmPack` (optional)](#autoinstallwasmpack-optional)
    - [`autoInstallRust` (optional)](#autoinstallrust-optional)

---

## Demo

![Demo](./assets/hotreload.webp)

The demo above showcases live reloading of compiled WebAssembly as Rust code is updated.

---

## Prerequisites

Ensure the following are available in your environment:

- [`wasm-pack`](https://drager.github.io/wasm-pack/installer/)

  ```bash
  cargo install wasm-pack
  ```

- A working [Rsbuild](https://rsbuild.dev/) setup in your project.

> If you don’t have Rust or `wasm-pack`, the plugin can optionally install them for you (see [Configuration Options](#configuration-options)).

---

## Installation

Install using your package manager of choice:

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

---

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
          path: "crate1",
          target: "web",
          liveReload: false // Optional if false disable liveReload (defaults to true).
        },
        {
          path: "crate2",
          target: "web",
          profileOnDev: "profiling",
          profileOnProd: "release",
        },
        {
          path: "crate3",
          target: "web",
          features: ["serde"] // Optional (defaults to none)
          defaultFeatures: false // Optional (defaults to true)
        },
      ],
      wasmpackPath: "~/.cargo/bin/wasm-pack", // Optional (this can be loaded from envfile)
      pkgsDir: "pkgs", // Optional (default is "pkgs")
      aliasPkgDir: true, // Optional (default is true)
      autoInstallWasmPack: true, // Optional

      // Optional Rust auto-install setup
      autoInstallRust: true,
      rustToolchainOptions: {
        defaultToolchain: "stable",
        profile: "minimal",
        components: ["clippy"],
        targets: ["wasm32-unknown-unknown"],
      },
    }),
  ],
});
```

> 💡 When `aliasPkgDir` is enabled, an alias will be created that maps `@pkgs/*` to the contents of `pkgsDir` (default is `"pkgs"`).
> The plugin also attempts to update your `tsconfig.json` with the correct alias. Be sure to check it manually if the automatic patch fails.

---

### Example usage

```typescript
import initializeRust1 from "@pkgs/rust1"; // Maps to pkgs/rust1 based on pkgsDir and aliasPkgDir
import initializeRust2 from "@pkgs/rust2";

// 🔔 Note: This import alias only works if `aliasPkgDir` is enabled.
// If disabled, you must import from the actual relative path (e.g., "../pkgs/rust1").

initializeRust1().then((rust1) => {
  rust1.greet("World1");
});

initializeRust2().then((rust2) => {
  rust2.greet("World2");
});
```

---

## Configuration Options

### `crates` (required)

An array of objects representing the Rust crates you want to compile. Each object should have the following properties:

- `path` (string): The path to your Rust crate or project. This is typically the folder containing `Cargo.toml`.

- `target` ("web" | "nodejs" | "deno"): The WebAssembly target.

- `profileOnDev` ("dev"| "profiling" | "release"): The profile to use when building the crate in development mode. This is optional and defaults to `dev`.

- `profileOnProd` ("dev"| "profiling" | "release"): The profile to use when building the crate in production mode. This is optional and defaults to `release`.

- `features` A list of Cargo features to explicitly enable when building the crate. This maps directly to `--features` flag. Example: `["serde", "simd", "unstable-api"]`.

- `defaultFeatures` (`true` | `false`) Controls whether Cargo’s default features are enabled when building the crate. If false the `--no-default-features` flag will be passed.

- `liveReload` (`true` | `false`) If `true` changes to source files automatically trigger a rebuild and reload the page. Defaults to `true`

- `stripWasm` Profiles for which the output `.wasm` binary should be stripped using wabt. Example: `stripBinary: ["release"]`.

---

### `wasmpackPath` (optional)

Custom path to the `wasm-pack` binary.
Defaults to the standard Cargo bin path (`~/.cargo/bin/wasm-pack`).

---

### `pkgsDir` (optional)

The directory where compiled Wasm output will be written.
Defaults to `"pkgs"`.

---

### `aliasPkgDir` (optional)

If enabled (`true` by default), the plugin will:

- Create an alias mapping `@pkgs` to the `pkgsDir`
- Attempt to update your `tsconfig.json` with the following path:

```json
{
  "compilerOptions": {
    "paths": {
      "@pkgs/*": ["./pkgs/*"]
    }
  }
}
```

> ⚠️ You may need to manually verify this mapping if automatic insertion fails.

---

### `autoInstallWasmPack` (optional)

If `true`, the plugin will install `wasm-pack` via Cargo if it's not found in your system.

---

### `autoInstallRust` (optional)

Configure how the Rust toolchain should be handled.
