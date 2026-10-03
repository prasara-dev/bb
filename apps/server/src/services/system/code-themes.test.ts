import {
  mkdirSync,
  mkdtempSync,
  readFileSync,
  rmSync,
  writeFileSync,
} from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import {
  readCodeThemeFiles,
  readCustomThemeCodeTheme,
  writeCodeThemeFile,
} from "./code-themes.js";

const VALID = JSON.stringify({
  name: "QA",
  type: "dark",
  colors: { "editor.background": "#101010" },
});

let root: string;

beforeEach(() => {
  root = mkdtempSync(join(tmpdir(), "bb-code-theme-"));
});

afterEach(() => {
  rmSync(root, { recursive: true, force: true });
});

describe("code theme sidecar files", () => {
  it("reports no sidecar for a theme that has none", () => {
    mkdirSync(join(root, "mine"), { recursive: true });

    const files = readCodeThemeFiles(root, "mine");

    expect(files.dark.text).toBeNull();
    expect(files.light.text).toBeNull();
    expect(files.dark.overriddenByManifest).toBe(false);
  });

  it("writes and clears the conventional sidecar file", () => {
    mkdirSync(join(root, "mine"), { recursive: true });

    writeCodeThemeFile(root, "mine", "dark", VALID);
    expect(readFileSync(join(root, "mine", "pierre-dark.json"), "utf8")).toBe(
      VALID,
    );
    expect(readCodeThemeFiles(root, "mine").dark.text).toBe(VALID);

    writeCodeThemeFile(root, "mine", "dark", null);
    expect(readCodeThemeFiles(root, "mine").dark.text).toBeNull();
  });

  it("keeps the two sides independent", () => {
    mkdirSync(join(root, "mine"), { recursive: true });

    writeCodeThemeFile(root, "mine", "dark", VALID);

    const files = readCodeThemeFiles(root, "mine");
    expect(files.dark.text).toBe(VALID);
    expect(files.light.text).toBeNull();
  });

  it("flags a side that theme.json overrides", () => {
    const dir = join(root, "mine");
    mkdirSync(dir, { recursive: true });
    writeFileSync(
      join(dir, "theme.json"),
      JSON.stringify({
        codeTheme: { dark: "github-dark", light: "github-light" },
      }),
      "utf8",
    );

    const files = readCodeThemeFiles(root, "mine");

    expect(files.dark.overriddenByManifest).toBe(true);
    expect(files.dark.manifestValue).toBe("github-dark");
    expect(files.light.manifestValue).toBe("github-light");
  });

  it("does not flag a side that theme.json leaves alone", () => {
    const dir = join(root, "mine");
    mkdirSync(dir, { recursive: true });
    writeFileSync(
      join(dir, "theme.json"),
      JSON.stringify({ codeTheme: { dark: "github-dark" } }),
      "utf8",
    );

    const files = readCodeThemeFiles(root, "mine");

    expect(files.dark.overriddenByManifest).toBe(true);
    expect(files.light.overriddenByManifest).toBe(false);
    expect(files.light.manifestValue).toBeNull();
  });
});

describe("written sidecars actually resolve", () => {
  it("is picked up by code theme resolution", () => {
    mkdirSync(join(root, "mine"), { recursive: true });

    writeCodeThemeFile(root, "mine", "dark", VALID);
    const declared = readCustomThemeCodeTheme(root, "mine");

    expect(declared?.dark?.name).toBe("bb:mine:dark");
    expect(declared?.dark?.file).not.toBeNull();
    expect(declared?.light).toBeUndefined();
  });
});
