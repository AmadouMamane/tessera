import { redirect } from "@/i18n/navigation";

interface RootPageProps {
  params: Promise<{ locale: string }>;
}

/**
 * Locale root → always lands on /chat. The redirect preserves the locale
 * segment through the i18n-aware `redirect` helper.
 */
export default async function RootPage({ params }: RootPageProps) {
  const { locale } = await params;
  redirect({ href: "/chat", locale });
}
