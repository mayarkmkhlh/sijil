alter table threads add column if not exists channel text not null default 'shop_link';
alter table threads add column if not exists customer_phone text;

create unique index if not exists threads_seller_phone_key
  on threads (seller_id, customer_phone)
  where customer_phone is not null;

alter table thread_messages add column if not exists wa_message_id text;

create unique index if not exists thread_messages_wa_message_id_key
  on thread_messages (wa_message_id)
  where wa_message_id is not null;
