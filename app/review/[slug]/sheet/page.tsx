import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { PrintSheet } from "@/components/review/PrintSheet";
import { getReview } from "@/lib/data";
import { reviewSchema } from "@/lib/review/schema";

export const metadata: Metadata = { title: "Printable notes sheet", robots: { index: false, follow: false } };

export default async function PrintSheetPage({ params }: PageProps<"/review/[slug]/sheet">) {
  const { slug } = await params;
  const record = await getReview(slug);
  const review = record ? reviewSchema.safeParse(record.spec) : undefined;
  if (!record || !review?.success || !review.data.printSheet) notFound();
  return <PrintSheet sheet={review.data.printSheet} slug={slug} courseCode={record.course.code} />;
}
