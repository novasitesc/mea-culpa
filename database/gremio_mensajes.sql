-- Chat de gremio. Pegar en el SQL Editor de Supabase y ejecutar una vez.
-- Sigue la convención del resto del esquema: columnas en español, `creado_en`.

create table if not exists public.gremio_mensajes (
  id          bigserial primary key,
  gremio_id   bigint not null references public.gremios(id) on delete cascade,
  usuario_id  uuid   not null references public.perfiles(id) on delete cascade,
  contenido   text   not null check (char_length(btrim(contenido)) between 1 and 500),
  creado_en   timestamptz not null default now()
);

-- El chat siempre se lee "los últimos N de este gremio".
create index if not exists idx_gremio_mensajes_gremio_creado
  on public.gremio_mensajes (gremio_id, creado_en desc);

alter table public.gremio_mensajes enable row level security;

-- Solo miembros del gremio leen su chat. La escritura pasa por la API
-- (service role), que además valida pertenencia y rate limit.
drop policy if exists "miembros leen su chat" on public.gremio_mensajes;
create policy "miembros leen su chat" on public.gremio_mensajes
  for select using (
    exists (
      select 1 from public.gremio_miembros m
      where m.gremio_id = gremio_mensajes.gremio_id
        and m.usuario_id = auth.uid()
    )
  );

-- Realtime: el cliente escucha el canal broadcast `gremio-chat-<id>`, que emite
-- la API tras insertar. No hace falta añadir la tabla a supabase_realtime.
