-- Configuración general editable desde el panel de administración
create table if not exists public.admin_settings (
	id uuid primary key default gen_random_uuid(),
	setting_key text not null unique,
	setting_value text not null default '',
	description text,
	updated_by uuid references auth.users(id) on delete set null,
	created_at timestamptz not null default now(),
	updated_at timestamptz not null default now()
);

create index if not exists idx_admin_settings_setting_key on public.admin_settings(setting_key);

create or replace function public.set_updated_at_admin_settings()
returns trigger
language plpgsql
as $$
begin
	new.updated_at = now();
	return new;
end;
$$;

drop trigger if exists trg_set_updated_at_admin_settings on public.admin_settings;
create trigger trg_set_updated_at_admin_settings
	before update on public.admin_settings
	for each row
	execute function public.set_updated_at_admin_settings();

insert into public.admin_settings (setting_key, setting_value, description)
values (
	'order_notification_emails',
	'',
	'Lista de correos internos (separados por coma o salto de línea) para avisos de nueva venta'
)
on conflict (setting_key) do nothing;
