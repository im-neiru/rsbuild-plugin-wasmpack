import * as fs from "node:fs";
import * as http from "node:http";
import * as https from "node:https";
import * as os from "node:os";
import path from "node:path";
import { sync as runSync } from "cross-spawn";
import type { RustInstallerOptions } from "./options.js";

export class RustInstaller {
  private readonly rustupInitSrc: string;
  private readonly rustupInitDestDir: string;
  private readonly rustInitName: string;
  private readonly args: string[];

  constructor(options: RustInstallerOptions) {
    // Default options

    if (!options?.profile) {
      options.profile = "minimal";
    }

    if (!options?.defaultToolchain) {
      options.defaultToolchain = "nightly";
    }

    if (!options?.targets) {
      options.targets = new Set(["wasm32-unknown-unknown"]);
    }

    const rustUpdateRoot =
      process.env.RUSTUP_UPDATE_ROOT || "https://static.rust-lang.org/rustup";

    const arch = RustInstaller.getArch();
    const onWindows = arch.includes("windows");
    const ext = onWindows ? ".exe" : "";

    this.rustInitName = `rustup-init${ext}`;
    this.rustupInitSrc = `${rustUpdateRoot}/dist/${arch}/rustup-init${ext}`;

    let tmpDir = os.tmpdir();
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

    this.rustupInitDestDir = path.join(tmpDir, "rustup-init-");
    this.args = RustInstaller.getSpawnArgs(options);
  }

  async install() {
    const tempDir = fs.mkdtempSync(this.rustupInitDestDir);
    const rustInitPath = path.join(tempDir, this.rustInitName);

    await RustInstaller.download(this.rustupInitSrc, rustInitPath);

    fs.chmodSync(rustInitPath, 0o755);

    console.info("Installing Rust toolchain, Please wait");

    runSync(rustInitPath, this.args, {
      stdio: "inherit",
    });

    fs.unlinkSync(rustInitPath);
    fs.rmdirSync(tempDir);

    return detectCargoBin();
  }

  private static getArch() {
    const type = os.type();
    let ostype = type;

    if (type === "Windows_NT") ostype = "pc-windows-gnu";
    if (type === "Darwin") ostype = "apple-darwin";
    if (type === "Linux") {
      let clib = "gnu";
      try {
        const ldd = runSync("ldd", ["--version"]);
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
          console.info("\nDownload complete!");
          file.close(() => resolve());
        });
      });

      req.on("error", reject);
    });
  }

  private static getSpawnArgs(options: RustInstallerOptions): string[] {
    const args: string[] = ["-y"];

    // --default-toolchain <name>
    if (options.defaultToolchain) {
      args.push("--default-toolchain", options.defaultToolchain);
    }

    // --profile <profile>
    if (options.profile) {
      args.push("--profile", options.profile);
    }

    // --component rustfmt,clippy,...
    if (options.components && options.components.size > 0) {
      args.push("--component", Array.from(options.components).join(","));
    }

    // --target wasm32-unknown-unknown,...
    if (options.targets && options.targets.size > 0) {
      args.push("--target", Array.from(options.targets).join(","));
    }

    return args;
  }
}

export function detectCargoBin(): string | null {
  let cargoHome: string | undefined;

  if (process.env.CARGO_HOME) {
    cargoHome = process.env.CARGO_HOME;
  } else {
    const homeDir = os.homedir();
    if (os.platform() === "win32") {
      cargoHome = path.join(homeDir, ".cargo");
    } else {
      cargoHome = path.join(homeDir, ".cargo");
    }
  }

  const binPath = path.join(cargoHome, "bin");

  if (fs.existsSync(binPath)) {
    return binPath;
  } else {
    return null;
  }
}
