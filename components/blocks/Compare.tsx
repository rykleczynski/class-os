import type { CompareBlock } from "@/lib/lesson/schema";
import { BlockFrame, type BlockProps } from "./shared";

export function Compare({ block }: BlockProps<CompareBlock>) {
  return (
    <BlockFrame title={block.title} caption={block.caption}>
      <div className="-mx-1 overflow-x-auto">
        <table className="w-full min-w-[22rem] border-separate border-spacing-0 text-left text-sm">
          <thead>
            <tr>
              <th className="p-2" />
              {block.columns.map((c, i) => (
                <th
                  key={i}
                  scope="col"
                  className={`p-2.5 align-bottom font-semibold ${block.highlight === i ? "rounded-t-xl bg-ink text-ink-foreground" : ""}`}
                >
                  {c}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {block.rows.map((r, ri) => (
              <tr key={ri}>
                <th scope="row" className="border-t border-border p-2.5 align-top text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                  {r.label}
                </th>
                {block.columns.map((_, ci) => (
                  <td
                    key={ci}
                    className={`border-t border-border p-2.5 align-top ${block.highlight === ci ? "bg-muted" : ""}`}
                  >
                    {r.cells[ci] ?? ""}
                  </td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </BlockFrame>
  );
}
