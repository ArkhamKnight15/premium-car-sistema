export type NavIcon =
  | "dashboard" | "garage" | "orders" | "customers" | "vehicles" | "agenda" | "services" | "finance" | "reports" | "team" | "settings";

export type NavItem = { href: string; label: string; icon: NavIcon; adminOnly?: boolean; group: "operacao" | "cadastros" | "gestao" };

export const NAV: NavItem[] = [
  { href: "/dashboard", label: "Dashboard", icon: "dashboard", group: "operacao" },
  { href: "/na-empresa", label: "Veículos na Empresa", icon: "garage", group: "operacao" },
  { href: "/ordens", label: "Ordens de Serviço", icon: "orders", group: "operacao" },
  { href: "/agenda", label: "Agenda", icon: "agenda", group: "operacao" },
  { href: "/clientes", label: "Clientes", icon: "customers", group: "cadastros" },
  { href: "/veiculos", label: "Veículos", icon: "vehicles", group: "cadastros" },
  { href: "/servicos", label: "Serviços e Preços", icon: "services", group: "cadastros" },
  { href: "/financeiro", label: "Financeiro", icon: "finance", group: "gestao", adminOnly: true },
  { href: "/relatorios", label: "Relatórios", icon: "reports", group: "gestao", adminOnly: true },
  { href: "/funcionarios", label: "Funcionários", icon: "team", group: "gestao", adminOnly: true },
  { href: "/configuracoes", label: "Configurações", icon: "settings", group: "gestao", adminOnly: true },
];

export const GROUP_LABEL = { operacao: "Operação", cadastros: "Cadastros", gestao: "Gestão" } as const;
