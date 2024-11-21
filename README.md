# rsbuild-plugin-wasmpack

Plugin for rsbuild for compiling building Rust crate to wasm via wasmpack.

## Usage

```Typescript

import { pluginWasmPack } from "rsbuild-plugin-wasmpack";

export default {
  plugins: [pluginWasmPack({
        crate: "rust",
        output: "wasm",
        target: "web",
    })],
};

```
