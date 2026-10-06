"use client";

import type { ComponentType } from "react";
import { blockSchema, type Block, type OnAttempt } from "@/lib/lesson/schema";
import { BlockBoundary } from "./BlockBoundary";
import { BlockFallback } from "./BlockFallback";
import { Chart } from "./Chart";
import { Compare } from "./Compare";
import { Custom } from "./Custom";
import { Flip } from "./Flip";
import { InTheNews } from "./InTheNews";
import { KeyIdea } from "./KeyIdea";
import { Mcq } from "./Mcq";
import { Prose } from "./Prose";
import { Scenario } from "./Scenario";
import { Slider } from "./Slider";
import { SortOrMatch } from "./SortOrMatch";
import { Stepper } from "./Stepper";
import { SupplyDemand } from "./SupplyDemand";
import { Timeline } from "./Timeline";
import type { BlockProps } from "./shared";

export type BlockOverride = ComponentType<BlockProps<Block>>;

type Props = {
  /** Raw, unvalidated block data. Validated here with safeParse. */
  block: unknown;
  stepId: string;
  index: number;
  onAttempt?: OnAttempt;
  /** Test hook for the dev gallery: swap the component used for a given block id. */
  overrides?: Record<string, BlockOverride>;
};

function render(block: Block, blockId: string, onAttempt?: OnAttempt) {
  const p = { blockId, onAttempt };
  switch (block.type) {
    case "prose": return <Prose block={block} />;
    case "keyIdea": return <KeyIdea block={block} />;
    case "chart": return <Chart block={block} {...p} />;
    case "slider": return <Slider block={block} {...p} />;
    case "supplyDemand": return <SupplyDemand block={block} {...p} />;
    case "timeline": return <Timeline block={block} {...p} />;
    case "compare": return <Compare block={block} {...p} />;
    case "stepper": return <Stepper block={block} {...p} />;
    case "flip": return <Flip block={block} {...p} />;
    case "mcq": return <Mcq block={block} {...p} />;
    case "sortOrMatch": return <SortOrMatch block={block} {...p} />;
    case "scenario": return <Scenario block={block} {...p} />;
    case "inTheNews": return <InTheNews block={block} {...p} />;
    case "custom": return <Custom block={block} {...p} />;
  }
}

export function BlockRenderer({ block, stepId, index, onAttempt, overrides }: Props) {
  const parsed = blockSchema.safeParse(block);
  if (!parsed.success) {
    const type = typeof block === "object" && block && "type" in block ? String((block as { type: unknown }).type) : "unknown";
    const first = parsed.error.issues[0];
    return (
      <BlockFallback
        title={`Skipped an invalid "${type}" block`}
        detail={first ? `${first.path.join(".") || "(root)"}: ${first.message}` : undefined}
      />
    );
  }
  const b = parsed.data;
  const blockId = b.id ?? `${stepId}:${index}`;
  const Override = overrides?.[blockId];
  return (
    <BlockBoundary label={b.type}>
      {Override ? <Override block={b} blockId={blockId} onAttempt={onAttempt} /> : render(b, blockId, onAttempt)}
    </BlockBoundary>
  );
}
