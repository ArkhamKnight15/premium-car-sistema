# Premium Car — Sistema de Gestão

Sistema **interno** de gestão para estética automotiva: clientes, veículos, entrada de veículos e ordens de serviço (OS), "Veículos na Empresa" com 9 status, financeiro, agenda interna, funcionários com login individual, relatórios com exportação CSV e busca global. Não tem área pública para clientes.

**Stack:** Next.js 15 (App Router, Server Actions) · React 19 · TypeScript · Tailwind CSS 4 · Zod · Supabase (Postgres + RLS, Auth, Storage, Realtime) · deploy na Vercel.

## 1. Supabase

1. Crie um projeto em [supabase.com](https://supabase.com) (região São Paulo).
2. **SQL Editor** → cole o conteúdo de `supabase/setup.sql` e execute **uma vez**. Ele cria as tabelas, as regras, o RLS, o bucket privado `order-photos` e os dados iniciais (horários, formas de pagamento e um catálogo de serviços com **preços de referência**, que devem ser revisados em *Serviços*).
   - Como alternativa, use a Supabase CLI: `supabase db push` (pasta `supabase/migrations`) e depois rode `supabase/seed.sql`.
3. **Authentication → Sign In / Providers → Email:** desative **"Allow new users to sign up"**. As contas são criadas só pelo administrador, dentro do sistema.
4. **Authentication → URL Configuration:** em *Site URL* coloque a URL do sistema (ex.: `https://premium-car.vercel.app`) e, em *Redirect URLs*, `https://SEU-DOMINIO/auth/callback`. Para testar localmente, adicione também `http://localhost:3000/auth/callback`.
5. **SMTP (recomendado):** em *Authentication → SMTP Settings*, configure um provedor (Resend, Brevo, SES…). Sem isso, o Supabase limita muito os e-mails de convite e de "esqueci a senha".

## 2. Variáveis de ambiente

Copie `.env.example` para `.env.local` e preencha com os dados de *Project Settings → API*:

| Variável | Onde é usada |
|---|---|
| `NEXT_PUBLIC_SUPABASE_URL` | URL do projeto |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` | chave pública (anon). Sozinha não lê nenhum dado: o RLS bloqueia o papel anônimo |
| `SUPABASE_SERVICE_ROLE_KEY` | **secreta, só no servidor.** Usada apenas para criar, bloquear e reativar logins de funcionários. Nunca use o prefixo `NEXT_PUBLIC_` nela |
| `NEXT_PUBLIC_SITE_URL` | URL pública do sistema (links de convite e de redefinição de senha) |

## 3. Primeiro administrador

```bash
npm install
npm run criar-admin -- --email voce@empresa.com --nome "Seu Nome" --senha "SenhaForte123"
npm run dev   # http://localhost:3000
```

O script cria (ou promove) o usuário administrador e o cadastro dele como funcionário. Os demais funcionários são criados em **Funcionários → Novo**, com senha temporária ou convite por e-mail, e com permissões individuais: clientes, ver todas as OS, pagamentos e descontos.

## 4. Deploy na Vercel

1. Em [vercel.com](https://vercel.com) → *Add New → Project* → importe este repositório (o framework Next.js é detectado sozinho).
2. Em *Environment Variables*, cadastre as 4 variáveis acima. Marque `SUPABASE_SERVICE_ROLE_KEY` como **Sensitive**.
3. Faça o deploy e atualize *Site URL* e *Redirect URLs* no Supabase com o domínio final.

## 5. Segurança

- **RLS em todas as tabelas.** O papel anônimo não tem acesso a nada.
- **Permissões conferidas no banco.** Funções `SECURITY DEFINER` verificam o papel do usuário, e o servidor confere de novo em cada Server Action. Esconder um botão na tela nunca é a única barreira.
- **Escopo de OS.** Um funcionário sem "ver todas as OS" acessa apenas as OS em que é responsável, executor ou criador.
- **Valores calculados pelo banco.** Totais, saldo e situação de pagamento são recalculados por gatilhos e não podem ser editados à mão. O faturamento soma os pagamentos efetivos menos os estornos.
- **Nada importante é apagado.** Clientes e veículos são desativados. Histórico de status, linha do tempo e pagamentos não aceitam exclusão. Pagamentos são estornados, e fotos são retiradas da OS por remoção lógica.
- **Fotos.** Ficam em bucket privado (`orders/<id-da-OS>/…`) e só aparecem por URL assinada temporária. O navegador envia o arquivo direto ao Storage, já com a imagem reduzida, e o banco só aceita registrar uma foto se o arquivo estiver na pasta da própria OS.
- **Agenda.** Uma restrição de exclusão impede dois horários sobrepostos para o mesmo funcionário. O sistema também respeita os horários de funcionamento e o número de boxes.
- **Auditoria e LGPD.** Há trilha de auditoria (visível só para o administrador), exportação dos dados de um cliente (JSON) e anonimização.
- **Indexação.** Cabeçalhos `noindex` e anti-iframe.

## 6. Testes do banco

```bash
# requer PostgreSQL 16 local; simula auth/storage do Supabase
PGHOST=localhost PGPORT=5432 PGUSER=postgres npm run test:db
bash supabase/tests/concorrencia.sh   # agendamentos simultâneos no mesmo horário
```

São 85 verificações: fluxo completo da OS, permissões e RLS, financeiro e estornos, agenda e conflitos, relatórios, LGPD e auditoria.

## 7. O que está pronto e o que depende de configuração externa

**Funciona assim que o Supabase e as variáveis estiverem configurados:** todos os módulos do sistema, com login individual, permissões, fotos, tempo real em "Veículos na Empresa", relatórios e CSV.

**Depende de você:**
- Criar o projeto Supabase, rodar o `setup.sql` e preencher as variáveis de ambiente.
- Configurar SMTP para convites e redefinição de senha.
- Revisar os preços do catálogo. Os valores iniciais são apenas referência, e todos são editáveis.
- Preencher os dados da empresa em *Configurações*.

**Não incluído (sem integração simulada):**
- Gateway de pagamento ou Pix automático. Os pagamentos são lançados manualmente.
- Envio automático por WhatsApp. O botão abre uma conversa pelo `wa.me`.
- Emissão de nota fiscal.

**Observação:** o ambiente em que o código foi escrito não tinha acesso ao registro do npm. Por isso, o `npm install` e o `next build` não puderam ser executados lá. O banco foi testado em PostgreSQL 16 real, e a aplicação passou por verificação de sintaxe e de tipos com declarações simplificadas. Rode `npm install && npm run build` no primeiro uso. A Vercel faz isso automaticamente.
