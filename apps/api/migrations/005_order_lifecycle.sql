create sequence if not exists shop_order_number_seq start with 1001;

alter table shop_orders add column if not exists order_number text;
alter table shop_orders add column if not exists payment_status text not null default 'unpaid';
alter table shop_orders add column if not exists fulfillment_status text not null default 'confirmed';
alter table shop_orders add column if not exists updated_at timestamptz not null default now();
alter table shop_orders add column if not exists paid_at timestamptz;
alter table shop_orders add column if not exists fulfilled_at timestamptz;

update shop_orders
set order_number = 'SJ-' || nextval('shop_order_number_seq')::text
where order_number is null;

alter table shop_orders alter column order_number set not null;
alter table shop_orders alter column order_number set default ('SJ-' || nextval('shop_order_number_seq')::text);

create unique index if not exists shop_orders_order_number_key on shop_orders (order_number);

do $$
begin
  if not exists (select 1 from pg_constraint where conname = 'shop_orders_payment_status_check') then
    alter table shop_orders
      add constraint shop_orders_payment_status_check
      check (payment_status in ('unpaid', 'paid', 'refunded'));
  end if;
  if not exists (select 1 from pg_constraint where conname = 'shop_orders_fulfillment_status_check') then
    alter table shop_orders
      add constraint shop_orders_fulfillment_status_check
      check (fulfillment_status in ('confirmed', 'preparing', 'shipped', 'delivered', 'cancelled'));
  end if;
end $$;
