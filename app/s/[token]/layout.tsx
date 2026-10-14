import type { Metadata } from "next";

// Guest links are private: keep them out of search results and never leak the token through Referer.
export const metadata: Metadata = {
  title: "Shared course",
  description: "A course shared with you.",
  robots: { index: false, follow: false, nocache: true, googleBot: { index: false, follow: false } },
  referrer: "no-referrer",
};

export default function ShareLayout({ children }: LayoutProps<"/s/[token]">) {
  return children;
}
