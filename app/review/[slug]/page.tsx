import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { ReviewView } from "@/components/review/ReviewView";
import { getGeneratedExams, getReview } from "@/lib/data";
import { parseTab } from "@/lib/review/tabs";

export const metadata: Metadata = { robots: { index: false, follow: false } };
// Generating a practice exam (a server action on this page) is one long model call.
export const maxDuration = 300;

export default async function ReviewPage({ params, searchParams }: PageProps<"/review/[slug]">) {
  const { slug } = await params;
  const { tab } = await searchParams;
  const review = await getReview(slug);
  if (!review) notFound();
  const generated = await getGeneratedExams(slug);
  return <ReviewView spec={review.spec} generated={generated} course={{ code: review.course.code, slug: review.course.slug }} initialTab={parseTab(tab)} />;
}
