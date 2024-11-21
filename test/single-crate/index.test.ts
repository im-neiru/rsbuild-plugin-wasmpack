import { dirname } from "node:path";
import { fileURLToPath } from "node:url";
import { test } from "@playwright/test";
import { createRsbuild } from "@rsbuild/core";
import { pluginWasmPack } from "../../src/index";
import { getRandomPort } from "../../helper";

const __dirname = dirname(fileURLToPath(import.meta.url));

test("should build wasm", async ({ page }) => {
  const rsbuild = await createRsbuild({
    cwd: __dirname,
    rsbuildConfig: {
      plugins: [
        pluginWasmPack({
          crate: "test/single-crate/rust",
          output: "pkg",
          target: "nodejs",
        }),
      ],
      server: {
        port: getRandomPort(),
      },
    },
  });

  await rsbuild.build();
  const { server, urls } = await rsbuild.startDevServer();

  await page.goto(urls[0]);

  await server.close();
});
