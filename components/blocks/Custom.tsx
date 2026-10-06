"use client";

import { useMemo } from "react";
import type { CustomBlock } from "@/lib/lesson/schema";
import { BlockFrame, type BlockProps } from "./shared";

/**
 * Scripts may load only from these CDNs (plus inline). No network access
 * otherwise, no forms, and the frame has no allow-same-origin, so it cannot
 * touch the app's cookies, storage, or DOM.
 */
export const CUSTOM_CSP = [
  "default-src 'none'",
  "script-src 'unsafe-inline' https://cdn.jsdelivr.net https://cdnjs.cloudflare.com",
  "style-src 'unsafe-inline' https://cdn.jsdelivr.net https://cdnjs.cloudflare.com",
  "font-src data: https://cdn.jsdelivr.net https://cdnjs.cloudflare.com",
  "img-src data: blob:",
  "connect-src 'none'",
  "form-action 'none'",
].join("; ");

export function buildSrcDoc(html: string): string {
  return `<!doctype html><html><head><meta charset="utf-8"><meta http-equiv="Content-Security-Policy" content="${CUSTOM_CSP}"><meta name="viewport" content="width=device-width,initial-scale=1"><style>html,body{margin:0;padding:0;font-family:system-ui,-apple-system,sans-serif;color:#1f1d1a;background:transparent}</style></head><body>${html}</body></html>`;
}

export function Custom({ block }: BlockProps<CustomBlock>) {
  const srcDoc = useMemo(() => buildSrcDoc(block.html), [block.html]);
  return (
    <BlockFrame caption={block.caption} className="overflow-hidden !p-0">
      <iframe
        title={block.caption ?? "Interactive widget"}
        sandbox="allow-scripts"
        srcDoc={srcDoc}
        style={{ height: block.height }}
        className="block w-full border-0 bg-[#fcfaf6]"
      />
    </BlockFrame>
  );
}
