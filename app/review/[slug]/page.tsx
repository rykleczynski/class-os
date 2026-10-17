import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { ReviewView } from "@/components/review/ReviewView";
import { getReview } from "@/lib/data";
import { parseTab } from "@/lib/review/tabs";

export const metadata: Metadata = { robots: { index: false, follow: false } };

export default async function ReviewPage({ params, searchParams }: PageProps<"/review/[slug]">) {
  const { slug } = await params;
  const { tab } = await searchParams;
  const review = await getReview(slug);
  if (!review) notFound();
  return <ReviewView spec={review.spec} course={{ code: review.course.code, slug: review.course.slug }} initialTab={parseTab(tab)} />;
}
