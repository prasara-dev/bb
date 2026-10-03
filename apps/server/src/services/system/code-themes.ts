import {
  existsSync,
  mkdirSync,
  readFileSync,
  rmSync,
  writeFileSync,
} from "node:fs";
import { isAbsolute, join, resolve } from "node:path";
import {
  CUSTOM_CODE_THEME_JSON_MAX_LENGTH,
  codeThemeNameSchema,
  formatRegisteredCodeThemeName,
  isCodeThemeFilePath,
  parseVscodeThemeJson,
  type CodeThemeFileState,
  type CodeThemeFiles,
  type CodeThemeSide,
  type DeclaredCodeTheme,
  type DeclaredCodeThemeSlot,
  type UiCodeThemeDeclaration,
} from "@bb/domain";
import { isPathWithinDirectory } from "@bb/process-utils";

const THEME_MANIFEST_FILE_NAME = "theme.json";
const CONVENTION_CODE_THEME_FILES = {
  dark: "pierre-dark.json",
  light: "pierre-light.json",
} as const;

interface PluginThemeCodeThemePaths {
  dark?: string;
  light?: string;
}

function resolveWithinRoot(
  rootDir: string,
  entry: string,
  label: string,
): string {
  if (isAbsolute(entry)) {
    throw new Error(`${label} must be relative, got "${entry}"`);
  }
  const resolved = resolve(rootDir, entry);
  if (!isPathWithinDirectory(resolve(rootDir), resolved)) {
    throw new Error(`${label} escapes the theme directory: "${entry}"`);
  }
  return resolved;
}

function readThemeJsonFile(path: string): DeclaredCodeThemeSlot["file"] | null {
  let raw: string;
  try {
    raw = readFileSync(path, "utf8");
  } catch {
    return null;
  }
  if (raw.length > CUSTOM_CODE_THEME_JSON_MAX_LENGTH) return null;
  let parsed: unknown;
  try {
    parsed = JSON.parse(raw);
  } catch {
    return null;
  }
  return parseVscodeThemeJson(parsed);
}

function resolveDeclaredSlot(
  sourceId: string,
  side: "dark" | "light",
  value: string,
  rootDir: string,
): DeclaredCodeThemeSlot | undefined {
  if (!isCodeThemeFilePath(value)) {
    const name = codeThemeNameSchema.safeParse(value);
    return name.success ? { name: name.data } : undefined;
  }
  let path: string;
  try {
    path = resolveWithinRoot(rootDir, value, `codeTheme.${side}`);
  } catch {
    return undefined;
  }
  const file = readThemeJsonFile(path);
  if (file === null) return undefined;
  return {
    name: formatRegisteredCodeThemeName(sourceId, side),
    file,
  };
}

function readThemeManifestDeclaration(
  themeDir: string,
): UiCodeThemeDeclaration | null {
  const path = join(themeDir, THEME_MANIFEST_FILE_NAME);
  if (!existsSync(path)) return null;
  let raw: string;
  try {
    raw = readFileSync(path, "utf8");
  } catch {
    return null;
  }
  if (raw.length > CUSTOM_CODE_THEME_JSON_MAX_LENGTH) return null;
  let parsed: unknown;
  try {
    parsed = JSON.parse(raw);
  } catch {
    return null;
  }
  if (parsed === null || typeof parsed !== "object") return null;
  const codeTheme = (parsed as { codeTheme?: unknown }).codeTheme;
  if (codeTheme === undefined) return {};
  if (codeTheme === null || typeof codeTheme !== "object") return null;
  const record = codeTheme as { dark?: unknown; light?: unknown };
  const declaration: UiCodeThemeDeclaration = {};
  if (typeof record.dark === "string") declaration.dark = record.dark;
  if (typeof record.light === "string") declaration.light = record.light;
  return declaration;
}

export function readCustomThemeCodeTheme(
  themeRoot: string,
  name: string,
): DeclaredCodeTheme | null {
  const themeDir = join(themeRoot, name);
  const manifest = readThemeManifestDeclaration(themeDir);
  const darkRef = manifest?.dark ?? CONVENTION_CODE_THEME_FILES.dark;
  const lightRef = manifest?.light ?? CONVENTION_CODE_THEME_FILES.light;
  const declared: DeclaredCodeTheme = {};
  const dark = resolveDeclaredSlot(name, "dark", darkRef, themeDir);
  const light = resolveDeclaredSlot(name, "light", lightRef, themeDir);
  if (dark) declared.dark = dark;
  if (light) declared.light = light;
  return declared.dark || declared.light ? declared : null;
}

export function readPluginThemeCodeTheme(
  sourceId: string,
  declaration: UiCodeThemeDeclaration | undefined,
  paths: PluginThemeCodeThemePaths,
): DeclaredCodeTheme | null {
  const declared: DeclaredCodeTheme = {};
  for (const side of ["dark", "light"] as const) {
    const path = paths[side];
    const declaredValue = declaration?.[side];
    if (path !== undefined) {
      const file = readThemeJsonFile(path);
      if (file !== null) {
        declared[side] = {
          name: formatRegisteredCodeThemeName(sourceId, side),
          file,
        };
      }
    } else if (
      declaredValue !== undefined &&
      !isCodeThemeFilePath(declaredValue)
    ) {
      const name = codeThemeNameSchema.safeParse(declaredValue);
      if (name.success) declared[side] = { name: name.data };
    }
  }
  return declared.dark || declared.light ? declared : null;
}

export function readCodeThemeFiles(
  themeRoot: string,
  name: string,
): CodeThemeFiles {
  const themeDir = join(themeRoot, name);
  const manifest = readThemeManifestDeclaration(themeDir);
  const build = (side: CodeThemeSide): CodeThemeFileState => {
    const manifestValue = manifest?.[side] ?? null;
    let text: string | null = null;
    try {
      text = readFileSync(
        join(themeDir, CONVENTION_CODE_THEME_FILES[side]),
        "utf8",
      );
    } catch {
      text = null;
    }
    return {
      text,
      overriddenByManifest: manifestValue !== null,
      manifestValue,
    };
  };
  return { dark: build("dark"), light: build("light") };
}

export function writeCodeThemeFile(
  themeRoot: string,
  name: string,
  side: CodeThemeSide,
  text: string | null,
): void {
  const themeDir = join(themeRoot, name);
  const path = resolveWithinRoot(
    themeDir,
    CONVENTION_CODE_THEME_FILES[side],
    `codeTheme.${side}`,
  );
  if (text === null) {
    rmSync(path, { force: true });
    return;
  }
  mkdirSync(themeDir, { recursive: true });
  writeFileSync(path, text, "utf8");
}

export function resolvePluginCodeThemePath(
  rootDir: string,
  themeId: string,
  side: "dark" | "light",
  value: string,
): string {
  return resolveWithinRoot(
    rootDir,
    value,
    `bb.themes.${themeId}.codeTheme.${side}`,
  );
}
