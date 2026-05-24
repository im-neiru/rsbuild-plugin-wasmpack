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
  pkgsDir: string,
  rootPath: string
): void {
  const tsconfigPath = path.resolve(rootPath, "tsconfig.json");
  if (!fs.existsSync(tsconfigPath)) return;

  const raw = fs.readFileSync(tsconfigPath, "utf-8");
  const json = cjson.parse(raw, undefined, true) as TsConfig;

  json.compilerOptions ??= {};
  json.compilerOptions.paths ??= {};
  const paths = json.compilerOptions.paths;

  const aliasKey = `${alias}/*`;

  const relativePath =
    json.compilerOptions.baseUrl === "."
      ? path.relative(rootPath, pkgsDir).replace(/\\/g, "/")
      : `./${path.relative(rootPath, pkgsDir).replace(/\\/g, "/")}`;

  const aliasValue = [`${relativePath}/*`];

  const currentValue = paths[aliasKey];
  const isAlreadyAliased =
    Array.isArray(currentValue) &&
    currentValue.length === 1 &&
    currentValue[0] === aliasValue[0];

  if (isAlreadyAliased) {
    return;
  }

  if (oldAlias) {
    const oldKey = `${oldAlias}/*`;
    if (paths[oldKey]) {
      delete paths[oldKey];
    }
  }

  paths[aliasKey] = aliasValue;

  const output = cjson.stringify(json, null, 2);
  fs.writeFileSync(tsconfigPath, output, "utf-8");
}

function getStorePath(rootPath: string): string {
  return path.resolve(
    rootPath,
    "node_modules/.rsbuild-plugin-wasmpack/oldAlias.json"
  );
}

export function saveOldAlias(alias: string, rootPath: string): void {
  const storePath = getStorePath(rootPath);
  const dir = path.dirname(storePath);
  if (!fs.existsSync(dir)) {
    fs.mkdirSync(dir, { recursive: true });
  }

  fs.writeFileSync(storePath, JSON.stringify({ alias }), "utf-8");
}

export function loadOldAlias(rootPath: string): string | undefined {
  const storePath = getStorePath(rootPath);
  if (!fs.existsSync(storePath)) return undefined;

  try {
    const data = JSON.parse(fs.readFileSync(storePath, "utf-8"));
    if (typeof data.alias === "string") {
      return data.alias;
    }
  } catch {
    // corrupted or unreadable file, ignore
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
