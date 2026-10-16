# Premium Car — Plano do sistema de gestão interna

## Ambiente inspecionado
- Projeto novo, sem código existente. Node.js 22 e PostgreSQL 16 disponíveis para desenvolvimento.
- Acesso ao registro do npm bloqueado no ambiente de desenvolvimento: o build do Next.js deve ser feito na máquina local ou na Vercel. O banco é testado aqui em PostgreSQL real.

## Stack
Next.js 15 (App Router, Server Actions) · React 19 · TypeScript · Tailwind CSS 4 · componentes próprios no padrão shadcn/ui ·
Supabase (PostgreSQL, Auth, Storage, Realtime) · Zod.

## Configurações externas necessárias
| Item | Para quê | Obrigatório |
|---|---|---|
| Projeto Supabase (URL + anon key) | banco, login, fotos | sim |
| `SUPABASE_SERVICE_ROLE_KEY` | criar/desativar logins de funcionários | sim, para gerir usuários |
| SMTP no Supabase | e-mail de recuperação de senha | recomendado |
| Conta Vercel | hospedagem | para publicar |

Nenhuma integração bancária, fiscal ou de mensagens é simulada.

## Modelo de dados
- **profiles** — usuários com login (1:1 com `auth.users`): função (admin/funcionário), ativo, permissões.
- **employees** — funcionários da empresa, com ou sem login (`profile_id` opcional). Responsáveis, executores e agenda apontam para cá.
- **customers**, **vehicles** (N veículos por cliente; placa antiga ou Mercosul).
- **services** (catálogo), **payment_methods**.
- **service_orders** → **service_order_items**, **order_status_history**, **order_events** (linha do tempo, somente inclusão), **order_photos** (remoção lógica), **payments** (confirmado/estornado).
- **appointments** → **appointment_services**.
- **company_settings**, **business_hours**, **audit_log**.

## Regras centrais (no banco, não só na interface)
- Totais, saldo e situação de pagamento calculados por gatilhos; não editáveis manualmente.
- Faturamento = pagamentos confirmados; estornos entram na data do estorno.
- Toda mudança de status grava usuário, data e hora; entregue registra a saída; OS encerrada só é alterada por administrador.
- Preço diferente do catálogo e descontos exigem permissão.
- Agenda: sem sobreposição por funcionário (constraint) e limite de boxes simultâneos (função com trava).
- Clientes e veículos nunca são apagados: desativação ou anonimização (LGPD).
- RLS em todas as tabelas; papel anônimo sem acesso; fotos em bucket privado com URLs assinadas.

## Etapas
1. Banco de dados + testes automatizados.
2. Base do app: login, layout, navegação, pesquisa global.
3. Clientes, veículos, entrada, ordens de serviço, Veículos na Empresa.
4. Dashboard, agenda, financeiro, relatórios (CSV), serviços, funcionários, configurações.
5. Verificação (tipos, telas renderizadas, testes) e documentação.
