import { defineConfig } from "tsup";

export default defineConfig({
  entry: ["src/index.ts", "src/backup-cli.ts", "src/backup-loop.ts"],
  format: ["esm"],
  outDir: "dist",
  target: "node24",
  sourcemap: false,
  clean: true,
  /**
   * `node:sqlite` is a builtin of node, it may not be packed into the file.
   *
   * Without this the packer drops the `node:` in front of it and the server
   * looks for a package called "sqlite".
   */
  external: ["node:sqlite"],
});
