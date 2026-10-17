import type { Metadata } from "next";
import { requirePerm } from "@/lib/auth";
import { getSettings } from "@/lib/data";
import { PageHeader } from "@/components/ui/layout-bits";
import { ContactImporter } from "@/components/domain/contact-importer";
import { ContactExportGuide } from "@/components/domain/contact-export-guide";
import { digits } from "@/lib/utils";

export const metadata: Metadata = { title: "Importar contatos" };

export default async function ImportContactsPage() {
  await requirePerm("customers");
  const settings = await getSettings();
  const companyNumber = digits(settings?.whatsapp ?? settings?.phone);
  return (
    <>
      <PageHeader title="Importar contatos" back={{ href: "/clientes", label: "Clientes" }}
        description="Cadastre de uma vez os clientes da agenda do WhatsApp. Quem já é cliente é identificado pelo número e não é duplicado." />
      <ContactImporter defaultDdd={companyNumber.length >= 10 ? companyNumber.slice(0, 2) : ""} guide={<ContactExportGuide />} />
    </>
  );
}
