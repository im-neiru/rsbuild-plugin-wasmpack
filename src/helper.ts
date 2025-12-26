import { PluginWasmPackOptions } from "./options.js";

export type OptionsFromEnvOrCliParams = {
  wasmpack?: {
    pathEnv: string;
  };
};

export function getOptionsFromEnvOrCli(
  params: OptionsFromEnvOrCliParams,
  env: NodeJS.ProcessEnv = process.env
): Pick<PluginWasmPackOptions, "wasmpackPath"> {
  const wasmpackPath = params.wasmpack?.pathEnv
    ? env[params.wasmpack?.pathEnv]
    : undefined;

  return { wasmpackPath };
}
