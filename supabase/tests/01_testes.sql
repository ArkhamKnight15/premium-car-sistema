-- =====================================================================
-- Testes automatizados: fluxo completo, regras de negócio e segurança
-- =====================================================================
\set ON_ERROR_STOP on
set client_min_messages = warning;
create schema t;
grant usage on schema t to anon, authenticated, service_role;
create table t.vars (k text primary key, v text);
grant select, insert, update on t.vars to anon, authenticated, service_role;
create function t.ok(c boolean, m text) returns void language plpgsql as $$
begin if c is not true then raise exception 'FALHOU: %', m; end if; raise notice 'ok - %', m; end $$;
create function t.throws(q text, pat text, m text) returns void language plpgsql as $$
begin
  begin execute q;
  exception when others then
    if sqlerrm ~* pat then raise notice 'ok - % (%)', m, sqlerrm; return; end if;
    raise exception 'FALHOU: % — erro inesperado: %', m, sqlerrm;
  end;
  raise exception 'FALHOU: % — deveria ter falhado', m;
end $$;
create function t.v(k text) returns text language sql stable as $$ select v from t.vars where vars.k = $1 $$;
create function t.u(k text) returns uuid language sql stable as $$ select v::uuid from t.vars where vars.k = $1 $$;
-- dia d a partir da segunda-feira desta semana (0 = segunda), horário local
create function t.at(d int, hhmm text) returns timestamptz language sql stable as $$
  select ((date_trunc('week', now() at time zone 'America/Sao_Paulo'))::date + d + hhmm::time) at time zone 'America/Sao_Paulo' $$;
create function t.svc(n text) returns uuid language sql stable security definer as $$ select id from public.services where name = n $$;
create function t.pm(n text) returns uuid language sql stable security definer as $$ select id from public.payment_methods where name = n $$;
create function t.emp(n text) returns uuid language sql stable security definer as $$ select id from public.employees where full_name = n $$;
create procedure t.login(p uuid) language plpgsql as $$
begin perform set_config('request.jwt.claims', json_build_object('sub', p, 'role', 'authenticated')::text, false); end $$;
grant execute on all functions in schema t to anon, authenticated, service_role;
grant execute on all procedures in schema t to anon, authenticated, service_role;
set client_min_messages = notice;

\set DONO  '''a0000000-0000-0000-0000-000000000001'''
\set JOAO  '''b0000000-0000-0000-0000-000000000001'''
\set MARIA '''b0000000-0000-0000-0000-000000000002'''
\set NOVO  '''b0000000-0000-0000-0000-000000000009'''

\echo '== Usuários, funcionários e permissões =='
insert into auth.users (id, email, raw_user_meta_data) values
  (:DONO, 'dono@premiumcar.test', '{"full_name":"Ricardo Dono"}'),
  (:JOAO, 'joao@premiumcar.test', '{"full_name":"João Silva"}'),
  (:MARIA, 'maria@premiumcar.test', '{"full_name":"Maria Souza"}'),
  (:NOVO, 'novo@premiumcar.test', '{"full_name":"Cadastro Indevido"}');
select t.ok((select count(*) = 4 and bool_and(not active) from public.profiles), 'todo usuário novo nasce sem acesso');
update public.profiles set role = 'admin', active = true where id = :DONO;
update public.profiles set active = true where id = :JOAO;
update public.profiles set active = true, perm_all_orders = false, perm_customers = false where id = :MARIA;
insert into public.employees (full_name, job_title, profile_id) values
  ('Ricardo Dono', 'Proprietário', :DONO), ('João Silva', 'Detalhador', :JOAO), ('Maria Souza', 'Polidora', :MARIA);
insert into public.employees (full_name, job_title) values ('Pedro Lavador', 'Lavador');
select t.ok((select count(*) = 1 from public.employees where profile_id is null), 'funcionário pode existir sem login');

set role authenticated;
call t.login(:NOVO);
select t.ok((select count(*) = 0 from public.services), 'usuário sem acesso não vê dados');
select t.throws($$update public.profiles set active = true where id = auth.uid()$$, 'administradores', 'usuário não libera o próprio acesso');
call t.login(:JOAO);
select t.throws($$update public.profiles set role = 'admin' where id = auth.uid()$$, 'administradores', 'funcionário não se promove a administrador');
select t.throws($$update public.profiles set perm_discounts = true where id = auth.uid()$$, 'administradores', 'funcionário não altera as próprias permissões');
select t.throws($$insert into public.employees (full_name) values ('Teste')$$, 'row-level', 'funcionário não gerencia a equipe');
reset role;
set role anon;
select t.throws('select count(*) from public.customers', 'permission denied', 'acesso anônimo bloqueado');
reset role;

\echo '== Cadastro de clientes =='
set role authenticated;
call t.login(:JOAO);
insert into public.customers (person_type, full_name, document, phone, whatsapp, email, city, state, notes)
values ('PF', 'Carlos Andrade', '52998224725', '11988887777', '11988887777', 'carlos@exemplo.test', 'São Paulo', 'SP', 'Prefere contato por WhatsApp');
insert into t.vars select 'cli', id from public.customers where document = '52998224725';
select t.ok((select created_by = auth.uid() from public.customers where id = t.u('cli')), 'cadastro registra quem criou e a data');
select t.throws($$insert into public.customers (full_name, document, phone) values ('Outro', '52998224725', '11911112222')$$, 'duplicate', 'CPF duplicado é bloqueado');
select t.throws($$insert into public.customers (full_name) values ('Sem Contato')$$, 'contact_required', 'cliente precisa de ao menos um contato');
select t.ok((select reason like '%telefone%' from public.find_customer_duplicates('Fulano', null, '(11) 98888-7777', null)), 'aviso de duplicado pelo telefone');
insert into public.customers (full_name, phone) values ('carlos andrade', '11977776666');
select t.ok((select count(*) = 1 from public.possible_duplicate_customers()), 'lista de possíveis cadastros duplicados');
call t.login(:MARIA);
select t.ok((select count(*) = 2 from public.customers), 'funcionário restrito consulta clientes');
select t.throws($$insert into public.customers (full_name, phone) values ('Teste', '11900001111')$$, 'row-level', 'sem permissão de cadastro não cria cliente');

\echo '== Cadastro de veículos =='
call t.login(:JOAO);
insert into public.vehicles (customer_id, plate, brand, model, manufacture_year, model_year, color, vehicle_type, mileage_km)
values (t.u('cli'), 'BRA2E19', 'BMW', '320i M Sport', 2022, 2023, 'Preto Safira', 'carro', 18200),
       (t.u('cli'), 'ABC1234', 'Toyota', 'Hilux SRX', 2019, 2019, 'Prata', 'picape', 81000);
insert into t.vars select 'v1', id from public.vehicles where plate = 'BRA2E19';
insert into t.vars select 'v2', id from public.vehicles where plate = 'ABC1234';
select t.ok(true, 'cliente com mais de um veículo; placas Mercosul e antiga aceitas');
select t.throws($$insert into public.vehicles (customer_id, plate, brand, model) values (t.u('cli'), 'AB12345', 'X', 'Y')$$, 'plate_check', 'placa fora do padrão é rejeitada');
select t.throws($$insert into public.vehicles (customer_id, plate, brand, model) values (t.u('cli'), 'BRA2E19', 'X', 'Y')$$, 'duplicate', 'placa duplicada é rejeitada');
select t.throws($$insert into public.vehicles (customer_id, brand, model, manufacture_year, model_year) values (t.u('cli'), 'X', 'Y', 2020, 2023)$$, 'vehicles_years', 'ano-modelo incoerente é rejeitado');

\echo '== Entrada do veículo e ordem de serviço =='
insert into t.vars select 'os1', public.open_service_order(
  p_customer_id => t.u('cli'), p_vehicle_id => t.u('v1'),
  p_items => jsonb_build_array(
    jsonb_build_object('service_id', t.svc('Lavagem técnica'), 'employee_id', t.emp('Pedro Lavador')),
    jsonb_build_object('service_id', t.svc('Polimento comercial')),
    jsonb_build_object('description', 'Remoção de chuva ácida no teto', 'unit_price', 130)),
  p_expected_at => t.at(2, '17:00'), p_mileage_km => 18350, p_fuel_level => '1/2',
  p_initial_condition => 'Pintura com marcas de lavagem automática', p_damages => 'Risco no para-choque traseiro');
select t.ok((select o.subtotal = 800 and o.total = 800 and o.status = 'received' and o.payment_status = 'pending'
                    and o.responsible_id = t.emp('João Silva') and o.number >= 1001
               from public.service_orders o where o.id = t.u('os1')),
            'OS aberta: número sequencial, 3 serviços, total calculado e funcionário responsável');
select t.ok((select count(*) = 1 from public.order_status_history where order_id = t.u('os1') and to_status = 'received' and changed_by = :JOAO),
            'entrada registrada no histórico de status com usuário');
select t.throws($$select public.open_service_order(t.u('cli'), t.u('v1'), '[{"description":"Teste","unit_price":10}]')$$, 'já possui uma OS em aberto', 'um veículo não tem duas OS abertas');
select t.throws($$insert into public.service_order_items (order_id, service_id, description, unit_price) values (t.u('os1'), t.svc('Enceramento'), 'Enceramento', 50)$$,
  'preço', 'sem permissão não altera preço do catálogo');
select t.throws($$update public.service_orders set discount = 50 where id = t.u('os1')$$, 'descontos', 'sem permissão não concede desconto');
update public.service_orders set total = 1, amount_paid = 999 where id = t.u('os1');
select t.ok((select total = 800 and amount_paid = 0 from public.service_orders where id = t.u('os1')), 'total e valor pago não são editáveis manualmente');
select t.throws($$update public.vehicles set active = false where id = t.u('v1')$$, 'em aberto', 'não desativa veículo com OS aberta');

call t.login(:DONO);
update public.profiles set perm_discounts = true where id = :JOAO;
call t.login(:JOAO);
update public.service_orders set discount = 50 where id = t.u('os1');
update public.service_order_items set discount = 20 where order_id = t.u('os1') and description = 'Lavagem técnica';
select t.ok((select subtotal = 780 and total = 730 from public.service_orders where id = t.u('os1')), 'com permissão: descontos por item e na OS recalculam o total');

\echo '== Visibilidade por funcionário =='
call t.login(:MARIA);
select t.ok((select count(*) = 0 from public.service_orders), 'funcionário restrito não vê OS de outros');
select t.ok((select count(*) = 0 from public.order_events), 'nem a linha do tempo delas');
call t.login(:JOAO);
update public.service_order_items set employee_id = t.emp('Maria Souza') where order_id = t.u('os1') and description = 'Polimento comercial';
call t.login(:MARIA);
select t.ok((select count(*) = 1 from public.service_orders), 'passa a ver a OS em que executa um serviço');
select t.throws($$select public.register_payment(t.u('os1'), 10, t.pm('Pix'))$$, 'permissão', 'sem permissão financeira não registra pagamento');
select t.ok((select count(*) = 0 from public.payments), 'e não vê pagamentos');

\echo '== Execução e linha do tempo =='
call t.login(:JOAO);
select public.change_order_status(t.u('os1'), 'evaluation');
select public.change_order_status(t.u('os1'), 'waiting');
select public.change_order_status(t.u('os1'), 'in_progress', 'Iniciada a descontaminação');
update public.service_order_items set status = 'in_progress' where order_id = t.u('os1') and description = 'Lavagem técnica';
update public.service_orders set expected_at = t.at(2, '18:00') where id = t.u('os1');
select public.add_order_note(t.u('os1'), 'Cliente pediu atenção especial às rodas');
select t.ok((select count(*) = 4 from public.order_status_history where order_id = t.u('os1') and changed_by = :JOAO), 'cada alteração de status registra usuário, data e hora');
select t.ok((select started_at is not null from public.service_order_items where description = 'Lavagem técnica'), 'serviço em execução registra horário de início');
select t.ok((select string_agg(distinct kind, ',' order by kind) from public.order_events where order_id = t.u('os1'))
             = 'created,discount,forecast,item_added,item_updated,note,status',
            'linha do tempo: criação, serviços, desconto, status, previsão e observações');
update public.service_order_items set status = 'done' where order_id = t.u('os1');
select t.throws($$select public.change_order_status(t.u('os1'), 'delivered')$$, 'saldo pendente', 'entrega com saldo pendente exige confirmação');

\echo '== Pagamentos =='
call t.login(:DONO);
update public.profiles set perm_payments = true where id = :JOAO;
call t.login(:JOAO);
select public.register_payment(t.u('os1'), 300, t.pm('Pix'));
select t.ok((select amount_paid = 300 and payment_status = 'partial' from public.service_orders where id = t.u('os1')), 'pagamento parcial e saldo calculado');
select t.throws($$select public.register_payment(t.u('os1'), 500, t.pm('Pix'))$$, 'saldo pendente', 'não aceita valor acima do saldo');
select t.throws($$select public.register_payment(t.u('os1'), 10, t.pm('Pix'), now() + interval '2 days')$$, 'futuro', 'não aceita data futura');
insert into t.vars select 'pg2', public.register_payment(t.u('os1'), 430, t.pm('Cartão de crédito'));
select t.ok((select amount_paid = 730 and payment_status = 'paid' from public.service_orders where id = t.u('os1')), 'OS paga');
select t.throws($$select public.refund_payment(t.u('pg2'), 'erro')$$, 'administradores', 'funcionário não estorna');
select t.throws($$select public.change_order_status(t.u('os1'), 'cancelled', 'desistiu')$$, 'Estorne', 'não cancela OS com pagamentos ativos');

\echo '== Conclusão e entrega =='
select public.change_order_status(t.u('os1'), 'quality_control');
select public.change_order_status(t.u('os1'), 'completed');
select t.ok((select completed_at is not null from public.service_orders where id = t.u('os1')), 'conclusão registra data e hora');
select public.change_order_status(t.u('os1'), 'awaiting_pickup');
select public.change_order_status(t.u('os1'), 'delivered');
select t.ok((select status = 'delivered' and delivered_at is not null from public.service_orders where id = t.u('os1')), 'entrega registra data e hora de saída');
select t.ok(((select count(*) from public.dashboard_stats() d, lateral (select (d ->> 'in_shop')::int n) x where n = 0) = 1), 'veículo entregue sai da lista "na empresa"');
select t.throws($$update public.service_orders set notes = 'x' where id = t.u('os1')$$, 'encerrada', 'OS entregue não é alterada por funcionário');
select t.throws($$delete from public.service_order_items where order_id = t.u('os1')$$, 'encerrada', 'serviços de OS entregue não são apagados');

call t.login(:DONO);
select public.refund_payment(t.u('pg2'), 'Cobrança em duplicidade na maquininha');
select t.ok((select amount_paid = 300 and payment_status = 'partial' from public.service_orders where id = t.u('os1')), 'estorno reabre o saldo');
call t.login(:JOAO);
select public.register_payment(t.u('os1'), 430, t.pm('Dinheiro'));
select t.ok((select payment_status = 'paid' from public.service_orders where id = t.u('os1')), 'saldo pode ser recebido após a entrega');
select t.ok((select count(*) = 1 from public.order_events where order_id = t.u('os1') and kind = 'refund'), 'estorno aparece na linha do tempo');

\echo '== Fotos =='
insert into storage.objects (bucket_id, name) values ('order-photos', 'orders/' || t.v('os1') || '/entrada-frente.jpg');
insert into public.order_photos (order_id, storage_path, kind, caption) values (t.u('os1'), 'orders/' || t.v('os1') || '/entrada-frente.jpg', 'entry', 'Frente');
select t.throws($$insert into storage.objects (bucket_id, name) values ('order-photos', 'outra/pasta.jpg')$$, 'row-level', 'envio fora da pasta de uma OS é bloqueado');
select t.throws(format($$insert into public.order_photos (order_id, storage_path) values (%L, %L)$$, t.v('os1'), 'orders/' || t.v('os1') || '/nao-enviado.jpg'), 'não encontrado', 'registro de foto exige o arquivo no Storage');
select t.ok((select uploaded_by = :JOAO from public.order_photos where caption = 'Frente'), 'autor da foto é o usuário da sessão');
select public.remove_order_photo((select id from public.order_photos limit 1));
select t.ok((select removed_at is not null and removed_by = :JOAO from public.order_photos limit 1), 'remoção de foto é lógica e registrada');
call t.login(:NOVO);
select t.ok((select count(*) = 0 from storage.objects), 'usuário sem acesso não lê fotos');

\echo '== Cancelamento =='
call t.login(:JOAO);
insert into t.vars select 'os2', public.open_service_order(t.u('cli'), t.u('v2'), jsonb_build_array(jsonb_build_object('service_id', t.svc('Enceramento'))));
select t.throws($$select public.change_order_status(t.u('os2'), 'cancelled')$$, 'motivo', 'cancelamento exige motivo');
select public.change_order_status(t.u('os2'), 'cancelled', 'Cliente desistiu');
select t.ok((select cancelled_at is not null and cancel_reason = 'Cliente desistiu' from public.service_orders where id = t.u('os2')), 'cancelamento registrado com motivo');

\echo '== Agenda =='
insert into t.vars select 'ag1', public.create_appointment(t.u('cli'), t.u('v2'), t.at(7, '09:00'), array[t.svc('Lavagem detalhada')], t.emp('João Silva'), null, 'whatsapp', 'Prefere manhã');
select t.ok((select ends_at - starts_at = interval '90 min' from public.appointments where id = t.u('ag1')), 'duração calculada pelos serviços');
select t.throws($$select public.create_appointment(t.u('cli'), t.u('v1'), t.at(7, '10:00'), array[t.svc('Enceramento')], t.emp('João Silva'))$$,
  'employee_busy', 'conflito de horário do funcionário');
select public.create_appointment(t.u('cli'), t.u('v1'), t.at(7, '10:00'), array[t.svc('Enceramento')], null);
select public.create_appointment(t.u('cli'), t.u('v1'), t.at(7, '10:00'), array[t.svc('Enceramento')], t.emp('Pedro Lavador'));
select t.throws($$select public.create_appointment(t.u('cli'), t.u('v1'), t.at(7, '10:00'), array[t.svc('Enceramento')], null)$$, 'bays_full', 'limite de boxes simultâneos');
select t.throws($$select public.create_appointment(t.u('cli'), t.u('v1'), t.at(6, '10:00'), array[t.svc('Enceramento')], null)$$, 'closed', 'domingo fechado');
select t.throws($$select public.create_appointment(t.u('cli'), t.u('v1'), t.at(7, '17:30'), array[t.svc('Enceramento')], null)$$, 'outside_hours', 'respeita o horário de funcionamento');
select t.throws($$update public.appointments set starts_at = starts_at + interval '1 hour' where id = t.u('ag1')$$, 'reagendamento', 'horário só muda pelo reagendamento');
select public.reschedule_appointment(t.u('ag1'), t.at(8, '14:00'));
select t.ok((select starts_at = t.at(8, '14:00') and ends_at = t.at(8, '15:30') from public.appointments where id = t.u('ag1')), 'reagendamento mantém a duração');
update public.appointments set status = 'confirmed' where id = t.u('ag1');
insert into t.vars select 'os3', public.convert_appointment(t.u('ag1'), 82000, 'Sem avarias aparentes');
select t.ok((select a.status = 'converted' and o.responsible_id = t.emp('João Silva') and o.total = 120
               from public.appointments a join public.service_orders o on o.id = a.service_order_id where a.id = t.u('ag1')),
            'agendamento convertido em OS quando o veículo chega');
select t.throws($$update public.appointments set status = 'cancelled', cancel_reason = 'x' where id = t.u('ag1')$$, 'encerrado', 'compromisso convertido não é cancelado');

\echo '== Dashboard, pesquisa e relatórios =='
select t.ok((public.dashboard_stats() ->> 'revenue_month') is null, 'funcionário não vê faturamento');
select t.ok((public.dashboard_stats() ->> 'in_shop')::int = 1, 'veículos na empresa = OS em aberto');
select t.ok(exists (select 1 from public.global_search('bra-2e19') where kind = 'vehicle'), 'pesquisa global por placa');
select t.ok(exists (select 1 from public.global_search('OS ' || (select number from public.service_orders where id = t.u('os1'))) where kind = 'order'), 'pesquisa global por número da OS');
select t.ok(exists (select 1 from public.global_search('98888-7777') where kind = 'customer'), 'pesquisa global por telefone');
select t.throws($$select * from public.report_revenue(current_date - 1, current_date)$$, 'administradores', 'funcionário não acessa relatórios');

call t.login(:DONO);
select t.ok((public.dashboard_stats() ->> 'revenue_today')::numeric = 730, 'faturamento do dia = pagamentos confirmados (líquido de estornos)');
select t.ok((select sum(received) - sum(refunded) = 730 from public.report_revenue(current_date - 1, current_date + 1)), 'relatório de faturamento: recebido − estornado');
select t.ok((select sum(received) filter (where method = 'Pix') = 300 from public.report_revenue(current_date - 1, current_date + 1)), 'faturamento por forma de pagamento');
select t.ok((select count(*) = 4 from public.report_top_services(current_date - 1, current_date + 1)), 'serviços mais realizados (ignora OS cancelada)');
select t.ok((select count(*) = 2 from public.report_vehicles_served(current_date - 1, current_date + 1)), 'veículos atendidos no período');
select t.ok((select orders_responsible = 2 and orders_completed = 1 from public.report_productivity(current_date - 1, current_date + 1) where employee = 'João Silva')
        and (select items_done = 1 and items_value = 450 from public.report_productivity(current_date - 1, current_date + 1) where employee = 'Maria Souza'),
            'produtividade por funcionário (responsável e executor)');

\echo '== LGPD, auditoria e administração =='
select t.throws($$select public.anonymize_customer(t.u('cli'))$$, 'em aberto', 'não anonimiza cliente com OS em aberto');
select t.throws($$update public.profiles set role = 'employee' where id = auth.uid()$$, 'pelo menos um administrador', 'não remove o último administrador');
select t.ok((select count(*) > 0 from public.audit_log where entity = 'customers'), 'cadastros registrados na auditoria');
insert into t.vars select 'cli2', id from public.customers where phone = '11977776666';
select public.anonymize_customer(t.u('cli2'));
select t.ok((select full_name = 'Cliente anonimizado' and phone is null and not active from public.customers where id = t.u('cli2')), 'anonimização (LGPD)');
call t.login(:JOAO);
select t.ok((select count(*) = 0 from public.audit_log), 'funcionário não lê a auditoria');
delete from public.customers;
delete from public.payments;
select t.ok((select count(*) = 2 from public.customers), 'clientes não podem ser apagados');
call t.login(:DONO);
select t.ok((select count(*) = 3 from public.payments), 'pagamentos não podem ser apagados');

\echo '== Todos os testes passaram =='
