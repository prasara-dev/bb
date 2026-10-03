import { useMemo, useState } from "react";
import type { CodeThemeFiles, CodeThemeSide } from "@bb/domain";
import { Button } from "@bb/shared-ui/button";
import { cn } from "@bb/shared-ui/lib/utils";

const SIDES: readonly CodeThemeSide[] = ["dark", "light"];

const SIDE_LABELS: Record<CodeThemeSide, string> = {
  dark: "Dark",
  light: "Light",
};

function parseDraft(
  value: string,
): { ok: true } | { ok: false; message: string } {
  if (value.trim().length === 0) return { ok: true };
  try {
    const parsed: unknown = JSON.parse(value);
    if (
      parsed === null ||
      typeof parsed !== "object" ||
      Array.isArray(parsed)
    ) {
      return { ok: false, message: "Expected a JSON object." };
    }
    return { ok: true };
  } catch (error) {
    return {
      ok: false,
      message: error instanceof Error ? error.message : "Invalid JSON.",
    };
  }
}

function pretty(value: string): string {
  try {
    return `${JSON.stringify(JSON.parse(value), null, 2)}\n`;
  } catch {
    return value;
  }
}

export interface CodeThemeEditorProps {
  files: CodeThemeFiles | null;
  pending: boolean;
  onSave: (side: CodeThemeSide, text: string | null) => Promise<void>;
}

export function CodeThemeEditor({
  files,
  pending,
  onSave,
}: CodeThemeEditorProps) {
  const [drafts, setDrafts] = useState<Record<CodeThemeSide, string>>({
    dark: files?.dark.text ?? "",
    light: files?.light.text ?? "",
  });
  const [saved, setSaved] = useState<Record<CodeThemeSide, boolean>>({
    dark: false,
    light: false,
  });

  const checks = useMemo(
    () => ({
      dark: parseDraft(drafts.dark),
      light: parseDraft(drafts.light),
    }),
    [drafts],
  );

  return (
    <div className="space-y-3 rounded-md border p-2">
      <div className="text-2xs text-muted-foreground">
        Code colors for diffs and file previews. Save applies to the app; these
        are separate files beside <code className="font-mono">theme.css</code>.
      </div>

      {SIDES.map((side) => {
        const state = files?.[side];
        const check = checks[side];
        const dirty = drafts[side] !== (state?.text ?? "");

        return (
          <div key={side} className="space-y-1">
            <div className="flex items-center gap-2">
              <span className="text-2xs font-medium">{SIDE_LABELS[side]}</span>
              {state?.overriddenByManifest ? (
                <span className="text-2xs text-attention">
                  theme.json overrides this side with “{state.manifestValue}”
                </span>
              ) : state?.text ? null : (
                <span className="text-2xs text-muted-foreground">
                  No sidecar file
                </span>
              )}
              {saved[side] && !dirty ? (
                <span className="text-2xs text-success">Saved</span>
              ) : null}
            </div>

            <textarea
              aria-label={`${SIDE_LABELS[side]} code theme JSON`}
              spellCheck={false}
              value={drafts[side]}
              placeholder={'{"name":"…","type":"dark","colors":{…}}'}
              onChange={(event) =>
                setDrafts((previous) => ({
                  ...previous,
                  [side]: event.target.value,
                }))
              }
              className={cn(
                "h-28 w-full resize-y rounded-md border bg-background p-2 font-mono text-2xs leading-relaxed",
                !check.ok && "border-destructive",
              )}
            />

            {!check.ok ? (
              <p role="alert" className="text-2xs text-destructive-text">
                {check.message}
              </p>
            ) : null}

            <div className="flex items-center gap-2">
              <Button
                size="sm"
                disabled={pending || !check.ok || !dirty}
                onClick={() => {
                  const text = drafts[side].trim();
                  void onSave(
                    side,
                    text.length === 0 ? null : pretty(text),
                  ).then(() =>
                    setSaved((previous) => ({ ...previous, [side]: true })),
                  );
                }}
              >
                Save {SIDE_LABELS[side].toLowerCase()}
              </Button>
              <Button
                size="sm"
                variant="outline"
                aria-label={`Clear ${SIDE_LABELS[side].toLowerCase()} code theme`}
                disabled={pending || state?.text == null}
                onClick={() => {
                  void onSave(side, null).then(() => {
                    setDrafts((previous) => ({ ...previous, [side]: "" }));
                    setSaved((previous) => ({ ...previous, [side]: true }));
                  });
                }}
              >
                Clear
              </Button>
            </div>
          </div>
        );
      })}
    </div>
  );
}
