export type RustInstallerOptions = {
  defaultToolchain: "stable" | "beta" | "nightly" | "none";
  profile: "default" | "minimal" | "complete";
  components: Set<"rustfmt" | "clippy" | "rust-docs" | "llvm-tools-preview">;
  targets: Set<
    | "wasm32-unknown-unknown"
    | "x86_64-pc-windows-gnu"
    | "aarch64-apple-darwin"
    | "armv7-unknown-linux-gnueabihf"
  >;
};

export class RustInstaller {
  constructor(options: RustInstallerOptions) {}
}
