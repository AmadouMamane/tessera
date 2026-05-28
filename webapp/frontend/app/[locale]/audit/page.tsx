import { getTranslations, setRequestLocale } from "next-intl/server";

import { AuditTable } from "@/components/audit/audit-table";
import { AppShell } from "@/components/layout/app-shell";

interface AuditPageProps {
  params: Promise<{ locale: string }>;
}

export async function generateMetadata({ params }: AuditPageProps) {
  const { locale } = await params;
  const t = await getTranslations({ locale, namespace: "audit" });
  return { title: t("title") };
}

export default async function AuditPage({ params }: AuditPageProps) {
  const { locale } = await params;
  setRequestLocale(locale);
  const t = await getTranslations({ locale, namespace: "audit" });

  return (
    <AppShell title={t("title")} description={t("description")}>
      <AuditTable />
    </AppShell>
  );
}
