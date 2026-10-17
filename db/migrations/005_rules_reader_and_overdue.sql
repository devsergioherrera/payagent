-- 1. RLS (003) hid base tables from rules_reader: an empty read means NOT_APPLICABLE, i.e. fail-open.
-- 2. A missing due date is not "overdue"; only a known past due date escalates.
begin;
do $$
declare t text;
begin
  foreach t in array array['invoice', 'vendor', 'purchase_order', 'decision', 'approval', 'budget'] loop
    execute format('drop policy if exists rules_reader_select on public.%I', t);
    execute format('create policy rules_reader_select on public.%I for select to rules_reader using (true)', t);
  end loop;
end $$;

update rule_condition set position = 2
  where rule_id = '20000000-0000-0000-0000-000000000015' and position = 1;
insert into rule_condition (rule_id, position, source, column_name, operator)
  values ('20000000-0000-0000-0000-000000000015', 1, 'invoice', 'due_date', 'IS_NOT_NULL');
update rule set natural_language = 'Si la factura tiene fecha de vencimiento y ya venció, escálala.'
  where id = '20000000-0000-0000-0000-000000000015';
commit;
