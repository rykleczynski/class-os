"use client";

import Link from "next/link";
import { useEffect, useRef, useState } from "react";
import { ArrowLeft, Printer, TriangleAlert } from "lucide-react";
import { MdInline } from "@/components/Md";
import type { PrintSheet as Sheet } from "@/lib/review/schema";

type Tone = Sheet["sides"][number][number]["tone"];

// Fixed colours, not theme tokens: this is a sheet of paper, so it stays black on white in dark mode too.
const TONE: Record<Tone, { band: string; ink: string }> = {
  blue: { band: "#dbe8f6", ink: "#1d4b7a" },
  green: { band: "#dcefe0", ink: "#1f6236" },
  orange: { band: "#fbe5cc", ink: "#8a4a0c" },
  purple: { band: "#ebe1f3", ink: "#5b2f7d" },
  red: { band: "#f9dcd8", ink: "#9b2b20" },
  gray: { band: "#e9e7e3", ink: "#333333" },
};

const CSS = `
@page { size: letter; margin: 0; }
.sheet-page { width: 8.5in; height: 11in; padding: 0.3in 0.32in; background: #fff; color: #111; box-sizing: border-box; }
/* A fixed height, not flex: column-fill auto needs it to start the second column. 10.4in of page less the title. */
.sheet-cols { height: 10.1in; columns: 2; column-gap: 0.22in; column-fill: auto; overflow: hidden; font-size: 10pt; line-height: 1.28; }
.sheet-cols code { background: #f1f1ef; color: #111; border-radius: 3px; padding: 0 2px; font-size: 0.97em; white-space: normal; }
.sheet-block { break-inside: avoid; margin-bottom: 0.09in; }
@media print {
  html, body { background: #fff !important; }
  .sheet-page { box-shadow: none !important; margin: 0 !important; break-after: page; }
  .sheet-page:last-child { break-after: auto; }
  * { -webkit-print-color-adjust: exact; print-color-adjust: exact; }
}
`;

/** The notes sheet laid out on letter paper, one page per side, ready to print double-sided. */
export function PrintSheet({ sheet, slug, courseCode }: { sheet: Sheet; slug: string; courseCode: string }) {
  const cols = useRef<(HTMLDivElement | null)[]>([]);
  const [overfull, setOverfull] = useState<number[]>([]);

  // Two columns of fixed height: anything that does not fit spills into a third column, off the page.
  useEffect(() => {
    const check = () => setOverfull(cols.current.flatMap((el, i) => (el && el.scrollWidth > el.clientWidth + 1 ? [i + 1] : [])));
    check();
    window.addEventListener("resize", check);
    return () => window.removeEventListener("resize", check);
  }, [sheet]);

  return (
    <div className="min-h-dvh bg-[#e8e6e1] pb-10 print:bg-white print:pb-0">
      <style>{CSS}</style>
      <header className="sticky top-0 z-10 border-b border-black/10 bg-[#f5f3ef] text-[#111] print:hidden">
        <div className="mx-auto flex max-w-[8.5in] flex-wrap items-center gap-3 px-4 py-3">
          <Link href={`/review/${slug}?tab=sheet`} aria-label="Back to the review" className="flex h-10 w-10 items-center justify-center rounded-full border border-black/15 bg-white">
            <ArrowLeft className="h-4 w-4" />
          </Link>
          <div className="min-w-0 flex-1">
            <p className="text-xs font-semibold uppercase tracking-wide text-[#555]">{courseCode} · Printable notes sheet</p>
            <p className="text-sm">Print double-sided (flip on long edge), letter paper, scale 100%.</p>
          </div>
          <button type="button" onClick={() => window.print()} className="inline-flex min-h-11 items-center gap-2 rounded-full bg-[#111] px-5 text-sm font-semibold text-white">
            <Printer className="h-4 w-4" aria-hidden /> Print
          </button>
        </div>
        {overfull.length > 0 && (
          <p role="alert" className="mx-auto flex max-w-[8.5in] items-center gap-2 px-4 pb-3 text-sm font-semibold text-[#9b2b20]">
            <TriangleAlert className="h-4 w-4" aria-hidden /> Side {overfull.join(" and ")} has more than fits on the page, so the end is cut off.
          </p>
        )}
      </header>

      <div className="mx-auto mt-6 flex w-fit flex-col gap-6 print:mt-0 print:gap-0">
        {sheet.sides.map((side, i) => (
          <article key={i} aria-label={`Side ${i + 1}`} className="sheet-page shadow-lg">
            <p className="flex h-[0.24in] items-end justify-between mb-[0.06in] border-b border-[#111] pb-[0.03in] text-[9pt] font-bold">
              <span>{sheet.title}</span>
              <span>
                Side {i + 1} of {sheet.sides.length}
              </span>
            </p>
            <div ref={(el) => void (cols.current[i] = el)} className="sheet-cols">
              {side.map((b, j) => (
                <section key={j} className="sheet-block">
                  <h2 className="rounded-[3px] px-[5px] py-[1px] text-[10.5pt] font-bold" style={{ background: TONE[b.tone].band, color: TONE[b.tone].ink }}>
                    {b.heading}
                  </h2>
                  <ul className="mt-[2px] space-y-[1.5px] pl-[2px]">
                    {b.lines.map((l, k) => (
                      <li key={k} className="flex gap-[5px]">
                        <span aria-hidden style={{ color: TONE[b.tone].ink }}>
                          •
                        </span>
                        <span className="min-w-0">
                          <MdInline text={l} />
                        </span>
                      </li>
                    ))}
                    {b.watch.map((l, k) => (
                      <li key={`w${k}`} className="flex gap-[5px] text-[#9b2b20]">
                        <span aria-hidden className="font-bold">
                          !
                        </span>
                        <span className="min-w-0">
                          <strong>Watch out:</strong> <MdInline text={l} />
                        </span>
                      </li>
                    ))}
                  </ul>
                </section>
              ))}
            </div>
          </article>
        ))}
      </div>
    </div>
  );
}
