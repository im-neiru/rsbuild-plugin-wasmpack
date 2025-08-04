import fs from "node:fs";
import path from "node:path";
import * as cjson from "comment-json";

type TsConfig = {
  compilerOptions?: {
    baseUrl?: string;
    paths?: Record<string, string[]>;
    [key: string]: unknown;
  };
  [key: string]: unknown;
};

export function aliasTsconfig(
  alias: string,
  oldAlias: string | undefined,
  pkgsDir: string
): void {
  const tsconfigPath = path.resolve(process.cwd(), "tsconfig.json");
  if (!fs.existsSync(tsconfigPath)) return;

  const raw = fs.readFileSync(tsconfigPath, "utf-8");
  const json = cjson.parse(raw, undefined, true) as TsConfig;

  json.compilerOptions ??= {};
  json.compilerOptions.paths ??= {};
  const paths = json.compilerOptions.paths;

  if (oldAlias) {
    const oldKey = `${oldAlias}/*`;
    if (paths[oldKey]) {
      delete paths[oldKey];
    }
  }

  const aliasKey = `${alias}/*`;

  const relativePath =
    json.compilerOptions.baseUrl === "."
      ? path.relative(process.cwd(), pkgsDir).replace(/\\/g, "/")
      : `./${pkgsDir}`;

  const aliasValue = [`${relativePath}/*`];

  paths[aliasKey] = aliasValue;

  const output = cjson.stringify(json, null, 2);
  fs.writeFileSync(tsconfigPath, output, "utf-8");
}

const STORE_PATH = path.resolve(
  "node_modules/.rsbuild-plugin-wasmpack/oldAlias.json"
);

export function saveOldPkgsDir(pkgsDir: string): void {
  const dir = path.dirname(STORE_PATH);
  if (!fs.existsSync(dir)) {
    fs.mkdirSync(dir, { recursive: true });
  }

  fs.writeFileSync(STORE_PATH, JSON.stringify({ pkgsDir }), "utf-8");
}

export function loadOldPkgsDir(): string | undefined {
  if (!fs.existsSync(STORE_PATH)) return undefined;

  try {
    const data = JSON.parse(fs.readFileSync(STORE_PATH, "utf-8"));
    if (typeof data.pkgsDir === "string") {
      return data.pkgsDir;
    }
  } catch {
    // corrupted or unreadable file — ignore
  }

  return undefined;
}

export function isValidUnscopedModuleName(name: string): boolean {
  if (typeof name !== "string" || name.trim() === "") return false;

  if (name.startsWith("@")) return false;

  if (
    name.startsWith("./") ||
    name.startsWith("../") ||
    name.startsWith("/") ||
    /^[a-zA-Z]:\\/.test(name)
  ) {
    return false;
  }

  const validUnscopedPackageRegex = /^[a-z0-9][a-z0-9._-]*$/i;

  return validUnscopedPackageRegex.test(name);
}
