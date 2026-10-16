-- =====================================================================
-- Premium Car · Dados iniciais (editáveis pelo sistema)
-- Os preços dos serviços são apenas referência inicial e ficam marcados
-- como "a revisar" até o administrador confirmá-los.
-- =====================================================================
insert into public.company_settings (id, company_name) values (1, 'Premium Car') on conflict (id) do nothing;

insert into public.business_hours (weekday, is_open, open_time, close_time) values
  (0, false, '08:00', '12:00'), (1, true, '08:00', '18:00'), (2, true, '08:00', '18:00'), (3, true, '08:00', '18:00'),
  (4, true, '08:00', '18:00'), (5, true, '08:00', '18:00'), (6, true, '08:00', '13:00')
on conflict (weekday) do nothing;

insert into public.payment_methods (name, sort_order) values
  ('Pix', 1), ('Cartão de crédito', 2), ('Cartão de débito', 3), ('Dinheiro', 4), ('Transferência', 5)
on conflict do nothing;

insert into public.services (name, description, category, default_price, estimated_minutes, sort_order) values
  ('Lavagem detalhada', 'Lavagem externa minuciosa, rodas, caixas de roda e acabamento dos pneus.', 'Lavagem', 120, 90, 10),
  ('Lavagem técnica', 'Pré-lavagem, descontaminação, frisos, emblemas e motor externo.', 'Lavagem', 220, 180, 20),
  ('Higienização interna', 'Aspiração, painel, portas, carpetes e eliminação de odores.', 'Higienização', 280, 240, 30),
  ('Higienização de bancos e estofados', 'Extração profunda em bancos de tecido e remoção de manchas.', 'Higienização', 250, 240, 40),
  ('Polimento comercial', 'Polimento em etapa única para recuperar o brilho.', 'Polimento', 450, 300, 50),
  ('Polimento técnico', 'Correção de pintura em múltiplas etapas com medição de camada.', 'Polimento', 900, 480, 60),
  ('Vitrificação de pintura', 'Proteção cerâmica de longa duração (requer avaliação da pintura).', 'Proteção', 1500, 600, 70),
  ('Enceramento', 'Cera de carnaúba para brilho e proteção.', 'Proteção', 150, 90, 80),
  ('Limpeza e proteção de couro', 'Limpeza, hidratação e proteção dos bancos de couro.', 'Higienização', 300, 180, 90),
  ('Revitalização de faróis', 'Lixamento, polimento e proteção UV.', 'Acabamento', 180, 120, 100),
  ('Serviço personalizado', 'Para serviços fora do catálogo: ajuste a descrição e o valor na OS.', 'Outros', 0, 60, 110)
on conflict do nothing;

-- Primeiro administrador: usuários criados em Authentication → Users ANTES desta
-- instalação ganham o perfil, e o mais antigo vira administrador (se ainda não houver um).
insert into public.profiles (id, full_name, email)
select id, split_part(email, '@', 1), lower(email) from auth.users
on conflict (id) do nothing;

with primeiro as (
  select p.id from public.profiles p
  where not exists (select 1 from public.profiles where role = 'admin')
  order by p.created_at, p.email limit 1
)
update public.profiles set role = 'admin', active = true, perm_payments = true, perm_discounts = true
where id in (select id from primeiro);

insert into public.employees (full_name, job_title, profile_id)
select p.full_name, 'Administrador', p.id from public.profiles p
where p.role = 'admin' and not exists (select 1 from public.employees e where e.profile_id = p.id);

-- Resultado: deve listar o seu e-mail como admin
select email, role, active from public.profiles;
