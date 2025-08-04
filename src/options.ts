/**
 * Configuration options for the `pluginWasmPack`.
 */
export type PluginWasmPackOptions = {
  /**
   * A list of Rust crates to be built using `wasm-pack`.
   * Each crate must include a `Cargo.toml` file and a `src` directory.
   */
  crates: CrateTarget[];

  /**
   * Optional path to the `wasm-pack` executable.
   * If not provided, the plugin will try to locate it in the user's Cargo bin directory.
   */
  wasmpackPath?: string;

  /**
   * If true, will attempt to install `wasm-pack` using Cargo if it is not found.
   */
  autoInstallWasmPack?: boolean;
} & (
  | {
      /**
       * If set to false, the plugin will not attempt to install the Rust toolchain.
       */
      autoInstallRust: false | null | undefined;
    }
  | {
      /**
       * If true, the plugin will attempt to install the Rust toolchain if it's missing.
       */
      autoInstallRust: true;

      /**
       * Toolchain installation configuration used if `autoInstallRust` is enabled.
       */
      rustToolchainOptions: RustInstallerOptions;
    }
);

/**
 * Configuration for an individual Rust crate to be compiled.
 */
export type CrateTarget = {
  /**
   * Path to the crate folder, which must contain a valid `Cargo.toml` and a `src/` directory.
   */
  path: string;

  /**
   * Target format for the WebAssembly package.
   *
   * - `"nodejs"` for Node.js runtime
   * - `"web"` for browser environments
   * - `"deno"` for Deno-compatible output
   */
  target: "nodejs" | "web" | "deno";

  /**
   * Build profile to use in development mode (defaults to `"dev"`).
   */
  profileOnDev?: ProfileType;

  /**
   * Build profile to use in production mode (defaults to `"release"`).
   */
  profileOnProd?: ProfileType;
};

/**
 * Supported Cargo build profiles.
 */
export type ProfileType = "dev" | "release" | "profiling";

/**
 * Configuration for installing the Rust toolchain.
 */
export type RustInstallerOptions = {
  /**
   * Rust toolchain version to install. If `none`, it must be managed manually.
   */
  defaultToolchain?: "stable" | "beta" | "nightly" | "none";

  /**
   * Level of installation detail for the Rustup toolchain.
   * - `"default"`: Includes rustc, cargo, etc.
   * - `"minimal"`: Smallest possible install
   * - `"complete"`: All optional components
   */
  profile?: "default" | "minimal" | "complete";

  /**
   * Additional Rust components to install alongside the toolchain.
   */
  components?: Set<"rustfmt" | "clippy" | "rust-docs" | "llvm-tools-preview">;

  /**
   * Additional target architectures to install.
   */
  targets?: Set<
    | "wasm32-unknown-unknown"
    | "x86_64-pc-windows-gnu"
    | "aarch64-apple-darwin"
    | "armv7-unknown-linux-gnueabihf"
  >;
};
