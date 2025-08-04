import fs from "node:fs";
import path from "node:path";
import * as cjson from "comment-json";

type TsConfig = {
  compilerOptions?: {
    baseUrl?: string;
    paths?: {
      [key: string]: string[];
    };
    [key: string]: unknown;
  };
  [key: string]: unknown;
};

export function aliasTsconfig(alias: string, pkgsDir: string): void {
  const tsconfigPath = path.resolve(process.cwd(), "tsconfig.json");
  if (!fs.existsSync(tsconfigPath)) return;

  const raw = fs.readFileSync(tsconfigPath, "utf-8");
  const json = cjson.parse(raw, undefined, true) as TsConfig;

  json.compilerOptions ??= {};
  json.compilerOptions.paths ??= {};

  const baseUrl = json.compilerOptions.baseUrl;

  const aliasKey = `${alias}/*`;
  let aliasValue: string[];

  if (baseUrl === ".") {
    aliasValue = [`${alias}/*`];
  } else {
    const relativePath = path
      .relative(process.cwd(), pkgsDir)
      .replace(/\\/g, "/");
    aliasValue = [`./${relativePath}/*`];
  }

  const existing = json.compilerOptions.paths[aliasKey];

  const needsUpdate =
    !existing || JSON.stringify(existing) !== JSON.stringify(aliasValue);

  if (needsUpdate) {
    json.compilerOptions.paths[aliasKey] = aliasValue;

    const output = cjson.stringify(json, null, 2);
    fs.writeFileSync(tsconfigPath, output, "utf-8");
  }
}
