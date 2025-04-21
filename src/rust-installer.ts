import * as os from "node:os";
import * as fs from "node:fs";
import path from "node:path";
import * as https from "node:https";
import * as http from "node:http";
import { spawnSync } from "node:child_process";

export type RustInstallerOptions = {
  defaultToolchain?: "stable" | "beta" | "nightly" | "none";
  profile?: "default" | "minimal" | "complete";
  components?: Set<"rustfmt" | "clippy" | "rust-docs" | "llvm-tools-preview">;
  targets?: Set<
    | "wasm32-unknown-unknown"
    | "x86_64-pc-windows-gnu"
    | "aarch64-apple-darwin"
    | "armv7-unknown-linux-gnueabihf"
  >;
};

export class RustInstaller {
  private readonly rustupInitSrc: string;
  private readonly rustupInitDestDir: string;
  private readonly rustInitName: string;

  constructor(options: RustInstallerOptions) {
    const rustUpdateRoot =
      process.env.RUSTUP_UPDATE_ROOT || "https://static.rust-lang.org/rustup";

    const arch = RustInstaller.getArch();
    const onWindows = arch.includes("windows");
    const ext = onWindows ? ".exe" : "";

    this.rustInitName = `rustup-init${ext}`;
    this.rustupInitSrc = `${rustUpdateRoot}/dist/${arch}/rustup-init${ext}`;

    let tmpDir = os.tmpdir();

    {
      // tmpDir fallbacks
      if (!fs.existsSync(tmpDir)) {
        tmpDir =
          process.env.TEMP || process.env.TMP || onWindows
            ? "C:\\Windows\\Temp"
            : "/tmp";
      }

      if (!fs.existsSync(tmpDir)) {
        tmpDir = process.env.TMP || onWindows ? "C:\\Windows\\Temp" : "/tmp";
      }

      if (!fs.existsSync(tmpDir)) {
        tmpDir = onWindows ? "C:\\Windows\\Temp" : "/tmp";
      }
    }

    console.log(tmpDir);

    this.rustupInitDestDir = path.join(tmpDir, "rustup-init-");
  }

  async install() {
    const destDir = fs.mkdtempSync(path.dirname(this.rustupInitDestDir));
    RustInstaller.download(
      this.rustupInitSrc,
      path.join(destDir, this.rustInitName)
    );
  }

  private static getArch() {
    const type = os.type();
    let ostype = type;

    if (type === "Windows_NT") ostype = "pc-windows-gnu";
    if (type === "Darwin") ostype = "apple-darwin";
    if (type === "Linux") {
      let clib = "gnu";
      try {
        const ldd = spawnSync("ldd", ["--version"]);
        if (
          Buffer.isBuffer(ldd.stdout) &&
          ldd.stdout.toString().includes("musl")
        ) {
          clib = "musl";
        }
      } catch {}
      ostype = `unknown-linux-${clib}`;
    }

    const archMap = new Map<string, string>([
      ["x64", "x86_64"],
      ["ia32", "i686"],
      ["arm", "arm"],
      ["arm64", "aarch64"],
      ["riscv64", "riscv64gc"],
    ]);

    const cpu = archMap.get(os.arch()) || os.arch();

    return `${cpu}-${ostype}`;
  }

  private static download(urlStr: string, dest: string): Promise<void> {
    return new Promise((resolve, reject) => {
      const urlObj = new URL(urlStr);
      const get = urlObj.protocol === "https:" ? https.get : http.get;

      const req = get(urlObj, (res) => {
        if (res.statusCode && res.statusCode >= 400) {
          reject(new Error(`HTTP ${res.statusCode}`));
          return;
        }

        const totalBytes = parseInt(res.headers["content-length"] || "0", 10);
        let downloadedBytes = 0;

        const file = fs.createWriteStream(dest, { mode: 0o755 });
        res.pipe(file);

        res.on("data", (chunk) => {
          downloadedBytes += chunk.length;
          if (totalBytes) {
            const percent = ((downloadedBytes / totalBytes) * 100).toFixed(2);
            process.stdout.write(`\rDownloading rustup-init: ${percent}%`);
          }
        });

        file.on("finish", () => {
          console.log("\nDownload complete!");
          file.close(() => resolve());
        });
      });

      req.on("error", reject);
    });
  }
}
