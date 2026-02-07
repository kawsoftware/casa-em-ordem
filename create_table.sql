-- Criação da tabela pivot profile_services
create table if not exists public.profile_services (
  id uuid default gen_random_uuid() primary key,
  profile_id uuid references public.profiles(id) on delete cascade not null,
  service_id uuid references public.services(id) on delete cascade not null,
  created_at timestamp with time zone default timezone('utc'::text, now()) not null,
  unique(profile_id, service_id)
);

-- Habilitar RLS (Row Level Security)
alter table public.profile_services enable row level security;

-- Política de Acesso (Permitir leitura e escrita para todos os usuários autenticados)
create policy "Enable all access for authenticated users"
on public.profile_services
for all
to authenticated
using (true)
with check (true);
