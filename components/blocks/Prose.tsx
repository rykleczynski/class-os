import { Md } from "@/components/Md";
import type { ProseBlock } from "@/lib/lesson/schema";

export function Prose({ block }: { block: ProseBlock }) {
  return <Md text={block.md} className="text-[1.05rem] leading-relaxed" />;
}
