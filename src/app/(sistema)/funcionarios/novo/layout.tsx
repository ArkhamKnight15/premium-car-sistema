import type { Metadata } from "next";
import { requireAdmin } from "@/lib/auth";

export const metadata: Metadata = { title: "Novo funcionário" };

export default async function Layout({ children }: { children: React.ReactNode }) {
  await requireAdmin();
  return children;
}
