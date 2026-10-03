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
  archiveCustomTheme,
  customThemeExists,
  deleteCustomTheme,
  isArchivedCustomTheme,
  listArchivedThemeNames,
  listCustomThemeNames,
  readCustomThemeCss,
  renameCustomTheme,
  resolveCustomThemeCssPath,
  resolveThemeRootPath,
  restoreCustomTheme,
  writeCustomThemeCss,
} from "./custom-themes.js";

let dataDir: string;
let themeRoot: string;

beforeEach(() => {
  dataDir = mkdtempSync(join(tmpdir(), "bb-theme-test-"));
  themeRoot = resolveThemeRootPath(dataDir);
});

afterEach(() => {
  rmSync(dataDir, { recursive: true, force: true });
});

describe("custom theme writes", () => {
  it("creates the theme folder and writes the stylesheet", () => {
    writeCustomThemeCss(themeRoot, "ocean", ":root { --canvas: #fff; }");

    expect(customThemeExists(themeRoot, "ocean")).toBe(true);
    expect(readCustomThemeCss(themeRoot, "ocean")).toBe(
      ":root { --canvas: #fff; }",
    );
    expect(listCustomThemeNames(themeRoot)).toEqual(["ocean"]);
  });

  it("overwrites an existing stylesheet in place", () => {
    writeCustomThemeCss(themeRoot, "ocean", ":root { --canvas: #fff; }");
    writeCustomThemeCss(themeRoot, "ocean", ":root { --canvas: #000; }");

    expect(readCustomThemeCss(themeRoot, "ocean")).toBe(
      ":root { --canvas: #000; }",
    );
    expect(listCustomThemeNames(themeRoot)).toEqual(["ocean"]);
  });

  it("keeps other themes when one is deleted", () => {
    writeCustomThemeCss(themeRoot, "ocean", ":root { --canvas: #fff; }");
    writeCustomThemeCss(themeRoot, "ember", ":root { --canvas: #000; }");

    deleteCustomTheme(themeRoot, "ocean");

    expect(customThemeExists(themeRoot, "ocean")).toBe(false);
    expect(listCustomThemeNames(themeRoot)).toEqual(["ember"]);
  });

  it("deletes a theme that is already missing without throwing", () => {
    expect(() => deleteCustomTheme(themeRoot, "ghost")).not.toThrow();
    expect(listCustomThemeNames(themeRoot)).toEqual([]);
  });

  it("renames by moving the folder so sibling files travel with it", () => {
    writeCustomThemeCss(themeRoot, "before", ":root { --canvas: #fff; }");
    mkdirSync(join(themeRoot, "before", "nested"), { recursive: true });
    writeFileSync(
      join(themeRoot, "before", "pierre-dark.json"),
      '{"name":"x"}',
      "utf8",
    );
    writeFileSync(
      join(themeRoot, "before", "nested", "keep.txt"),
      "keep me",
      "utf8",
    );

    renameCustomTheme(themeRoot, "before", "after");

    expect(listCustomThemeNames(themeRoot)).toEqual(["after"]);
    expect(readCustomThemeCss(themeRoot, "after")).toBe(
      ":root { --canvas: #fff; }",
    );
    expect(
      readFileSync(join(themeRoot, "after", "pierre-dark.json"), "utf8"),
    ).toBe('{"name":"x"}');
    expect(
      readFileSync(join(themeRoot, "after", "nested", "keep.txt"), "utf8"),
    ).toBe("keep me");
  });

  it("refuses to rename onto an existing theme", () => {
    writeCustomThemeCss(themeRoot, "one", ":root { --canvas: #fff; }");
    writeCustomThemeCss(themeRoot, "two", ":root { --canvas: #000; }");

    expect(() => renameCustomTheme(themeRoot, "one", "two")).toThrow(
      /already exists/,
    );
    expect(listCustomThemeNames(themeRoot)).toEqual(["one", "two"]);
  });

  it("refuses to rename a theme that is missing", () => {
    expect(() => renameCustomTheme(themeRoot, "ghost", "other")).toThrow(
      /not found/,
    );
  });

  it("archives into .trash, out of the catalog but intact", () => {
    writeCustomThemeCss(themeRoot, "retired", ":root { --canvas: #fff; }");
    writeFileSync(
      join(themeRoot, "retired", "pierre-dark.json"),
      '{"name":"x"}',
      "utf8",
    );

    archiveCustomTheme(themeRoot, "retired");

    expect(listCustomThemeNames(themeRoot)).toEqual([]);
    expect(listArchivedThemeNames(themeRoot)).toEqual(["retired"]);
    expect(isArchivedCustomTheme(themeRoot, "retired")).toBe(true);
    expect(readCustomThemeCss(themeRoot, "retired")).toBeNull();
    expect(
      readFileSync(join(themeRoot, ".trash", "retired", "pierre-dark.json"), "utf8"),
    ).toBe('{"name":"x"}');
  });

  it("restores an archived theme back into the catalog", () => {
    writeCustomThemeCss(themeRoot, "retired", ":root { --canvas: #fff; }");
    archiveCustomTheme(themeRoot, "retired");

    restoreCustomTheme(themeRoot, "retired");

    expect(listCustomThemeNames(themeRoot)).toEqual(["retired"]);
    expect(listArchivedThemeNames(themeRoot)).toEqual([]);
    expect(readCustomThemeCss(themeRoot, "retired")).toBe(
      ":root { --canvas: #fff; }",
    );
  });

  it("refuses to archive a missing theme or restore onto an existing one", () => {
    expect(() => archiveCustomTheme(themeRoot, "ghost")).toThrow(/not found/);

    writeCustomThemeCss(themeRoot, "dup", ":root { --canvas: #111; }");
    archiveCustomTheme(themeRoot, "dup");
    writeCustomThemeCss(themeRoot, "dup", ":root { --canvas: #222; }");

    expect(() => restoreCustomTheme(themeRoot, "dup")).toThrow(
      /already exists/,
    );
    expect(readCustomThemeCss(themeRoot, "dup")).toBe(
      ":root { --canvas: #222; }",
    );
  });

  it("keeps the trash folder itself out of both name lists", () => {
    writeCustomThemeCss(themeRoot, "live", ":root { --canvas: #fff; }");
    archiveCustomTheme(themeRoot, "live");

    expect(listCustomThemeNames(themeRoot)).not.toContain(".trash");
    expect(listArchivedThemeNames(themeRoot)).not.toContain(".trash");
    expect(listArchivedThemeNames(themeRoot)).toEqual(["live"]);
  });

  it("omits folders without a theme.css and names the schema rejects", () => {
    writeCustomThemeCss(themeRoot, "valid", ":root { --canvas: #fff; }");

    expect(listCustomThemeNames(themeRoot)).toEqual(["valid"]);
    expect(resolveCustomThemeCssPath(themeRoot, "valid")).toBe(
      join(themeRoot, "valid", "theme.css"),
    );
  });
});
