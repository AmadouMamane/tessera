import { getTranslations, setRequestLocale } from "next-intl/server";

import { AppShell } from "@/components/layout/app-shell";
import { ChatRoom } from "@/components/chat/chat-room";

interface ChatPageProps {
  params: Promise<{ locale: string }>;
}

export async function generateMetadata({ params }: ChatPageProps) {
  const { locale } = await params;
  const t = await getTranslations({ locale, namespace: "chat" });
  return { title: t("title") };
}

export default async function ChatPage({ params }: ChatPageProps) {
  const { locale } = await params;
  setRequestLocale(locale);
  const t = await getTranslations({ locale, namespace: "chat" });

  return (
    <AppShell title={t("title")}>
      <ChatRoom />
    </AppShell>
  );
}
