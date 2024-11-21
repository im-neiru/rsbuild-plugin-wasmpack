import { dirname } from "node:path";
import { fileURLToPath } from "node:url";
import { expect, test } from "@playwright/test";
import { createRsbuild } from "@rsbuild/core";
import { pluginWasmPack } from "../src/index";
import { getRandomPort } from "../helper";

const __dirname = dirname(fileURLToPath(import.meta.url));

test("should render page as expected", async ({ page }) => {
  const rsbuild = await createRsbuild({
    cwd: __dirname,
    rsbuildConfig: {
      plugins: [pluginWasmPack()],
      server: {
        port: getRandomPort(),
      },
    },
  });

  const { server, urls } = await rsbuild.startDevServer();

  await server.close();
});

test("should build succeed", async ({ page }) => {
  const rsbuild = await createRsbuild({
    cwd: __dirname,
    rsbuildConfig: {
      plugins: [pluginWasmPack()],
    },
  });

  await rsbuild.build();
  const { server, urls } = await rsbuild.preview();

  await server.close();
});
