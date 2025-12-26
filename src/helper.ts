import { PluginWasmPackOptions, CrateTarget } from "./options.js";

type CrateOptionEntry<Key extends keyof CrateTarget> = {
  env?: {
    name: string;
    map: (envValue?: string) => Required<CrateTarget>[Key];
  };
  cli?: {
    name: string;
    map: (argValue?: string) => Required<CrateTarget>[Key];
  };
};

type CrateOption = {
  liveReload?: CrateOptionEntry<"liveReload">;
  defaultFeatures?: CrateOptionEntry<"defaultFeatures">;
  features?: CrateOptionEntry<"features">;
};

export type OptionsFromEnvOrCliParams<Opt extends PluginWasmPackOptions> = {
  wasmpackPath?: {
    env: string;
  };
  crates?: Record<Opt["crates"][number]["path"], CrateOption>;
};

export function getOptionsFromEnvOrCli<Opt extends PluginWasmPackOptions>(
  params: OptionsFromEnvOrCliParams<Opt>,
  env: NodeJS.ProcessEnv = process.env,
  cliArgs?: Record<string, string>
): {
  wasmpackPath: Opt["wasmpackPath"];
  crates: Pick<
    Opt["crates"][number],
    "path" | "liveReload" | "features" | "defaultFeatures"
  >[];
} {
  const wasmpackPath = params.wasmpackPath?.env
    ? env[params.wasmpackPath.env]
    : undefined;

  const crates = params.crates
    ? Object.entries(params.crates).map(([path, opt]) => {
        const { liveReload, features, defaultFeatures } = opt as CrateOption;

        return {
          path,
          liveReload: liveReload
            ? processField<"liveReload">(liveReload, env, cliArgs)
            : undefined,
          features: features
            ? processField<"features">(features, env, cliArgs)
            : undefined,
          defaultFeatures: defaultFeatures
            ? processField<"defaultFeatures">(defaultFeatures, env, cliArgs)
            : undefined,
        } satisfies Pick<
          CrateTarget,
          "path" | "liveReload" | "features" | "defaultFeatures"
        >;
      })
    : [];

  return { wasmpackPath, crates };
}

function processField<Field extends keyof CrateOption>(
  params: CrateOptionEntry<Field>,
  env: NodeJS.ProcessEnv,
  cliArgs?: Record<string, string>
): Required<CrateTarget>[Field] {
  if (params.cli?.name && cliArgs && cliArgs[params.cli.name] !== undefined) {
    return params.cli.map(cliArgs[params.cli.name]);
  }

  if (params.env?.name && env[params.env.name] !== undefined) {
    return params.env.map(env[params.env.name]);
  }

  if (params.cli?.map) return params.cli.map(undefined);
  if (params.env?.map) return params.env.map(undefined);

  throw new Error("processField: no mapping function provided");
}
