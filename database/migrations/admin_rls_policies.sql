-- Políticas RLS para permitir SOLO a usuarios con rol "admin" en user_metadata
-- Ajusta según tu estructura: si guardas el rol en app_metadata, cambia user_metadata por app_metadata

-- Habilita RLS en todas las tablas relevantes (si no está ya)
alter table products enable row level security;
alter table product_variants enable row level security;
alter table product_media enable row level security;
alter table product_specifications enable row level security;
alter table tags enable row level security;
alter table product_tags enable row level security;
alter table discounts enable row level security;
alter table product_discounts enable row level security;
alter table categories enable row level security;

-- ==============================================================================
-- IMPORTANTE: Determina dónde guardas el rol admin
-- ==============================================================================
-- Opción A: Si usas user_metadata (ej. user_metadata.role = 'admin'):
--   (auth.jwt() -> 'user_metadata' ->> 'role') = 'admin'
--
-- Opción B: Si usas app_metadata (ej. app_metadata.role = 'admin'):
--   (auth.jwt() -> 'app_metadata' ->> 'role') = 'admin'
--
-- Este script usa user_metadata. Si usas app_metadata, reemplaza todas las 
-- ocurrencias de 'user_metadata' por 'app_metadata' abajo.
-- ==============================================================================

-- PRODUCTS
drop policy if exists "auth select products" on products;
drop policy if exists "auth insert products" on products;
drop policy if exists "auth update products" on products;
drop policy if exists "auth delete products" on products;
drop policy if exists "public can view active products" on products;

-- Público puede ver productos activos
create policy "public can view active products" on products
  for select using (is_active = true);

-- Solo admin puede insertar
create policy "admin insert products" on products
  for insert with check (
    (auth.jwt() -> 'user_metadata' ->> 'role') = 'admin'
  );

-- Solo admin puede actualizar
create policy "admin update products" on products
  for update using (
    (auth.jwt() -> 'user_metadata' ->> 'role') = 'admin'
  ) with check (
    (auth.jwt() -> 'user_metadata' ->> 'role') = 'admin'
  );

-- Solo admin puede eliminar
create policy "admin delete products" on products
  for delete using (
    (auth.jwt() -> 'user_metadata' ->> 'role') = 'admin'
  );

-- PRODUCT VARIANTS
drop policy if exists "auth select product_variants" on product_variants;
drop policy if exists "auth insert product_variants" on product_variants;
drop policy if exists "auth update product_variants" on product_variants;
drop policy if exists "auth delete product_variants" on product_variants;
drop policy if exists "public can view active variants" on product_variants;

-- Público puede ver variantes activas
create policy "public can view active variants" on product_variants
  for select using (is_active = true);

create policy "admin insert product_variants" on product_variants
  for insert with check (
    (auth.jwt() -> 'user_metadata' ->> 'role') = 'admin'
  );

create policy "admin update product_variants" on product_variants
  for update using (
    (auth.jwt() -> 'user_metadata' ->> 'role') = 'admin'
  ) with check (
    (auth.jwt() -> 'user_metadata' ->> 'role') = 'admin'
  );

create policy "admin delete product_variants" on product_variants
  for delete using (
    (auth.jwt() -> 'user_metadata' ->> 'role') = 'admin'
  );

-- PRODUCT MEDIA
drop policy if exists "auth select product_media" on product_media;
drop policy if exists "auth insert product_media" on product_media;
drop policy if exists "auth delete product_media" on product_media;
drop policy if exists "public can view product_media" on product_media;

-- Público puede ver imágenes
create policy "public can view product_media" on product_media
  for select using (true);

create policy "admin insert product_media" on product_media
  for insert with check (
    (auth.jwt() -> 'user_metadata' ->> 'role') = 'admin'
  );

create policy "admin delete product_media" on product_media
  for delete using (
    (auth.jwt() -> 'user_metadata' ->> 'role') = 'admin'
  );

-- PRODUCT SPECIFICATIONS
drop policy if exists "auth select product_specifications" on product_specifications;
drop policy if exists "auth insert product_specifications" on product_specifications;
drop policy if exists "auth update product_specifications" on product_specifications;
drop policy if exists "auth delete product_specifications" on product_specifications;
drop policy if exists "public can view specs" on product_specifications;

-- Público puede ver especificaciones
create policy "public can view specs" on product_specifications
  for select using (true);

create policy "admin insert product_specifications" on product_specifications
  for insert with check (
    (auth.jwt() -> 'user_metadata' ->> 'role') = 'admin'
  );

create policy "admin update product_specifications" on product_specifications
  for update using (
    (auth.jwt() -> 'user_metadata' ->> 'role') = 'admin'
  ) with check (
    (auth.jwt() -> 'user_metadata' ->> 'role') = 'admin'
  );

create policy "admin delete product_specifications" on product_specifications
  for delete using (
    (auth.jwt() -> 'user_metadata' ->> 'role') = 'admin'
  );

-- TAGS
drop policy if exists "auth select tags" on tags;
drop policy if exists "auth insert tags" on tags;
drop policy if exists "public can view tags" on tags;

-- Público puede ver tags
create policy "public can view tags" on tags
  for select using (true);

create policy "admin insert tags" on tags
  for insert with check (
    (auth.jwt() -> 'user_metadata' ->> 'role') = 'admin'
  );

-- PRODUCT TAGS
drop policy if exists "auth select product_tags" on product_tags;
drop policy if exists "auth insert product_tags" on product_tags;
drop policy if exists "auth delete product_tags" on product_tags;
drop policy if exists "public can view product_tags" on product_tags;

-- Público puede ver relaciones producto-tag
create policy "public can view product_tags" on product_tags
  for select using (true);

create policy "admin insert product_tags" on product_tags
  for insert with check (
    (auth.jwt() -> 'user_metadata' ->> 'role') = 'admin'
  );

create policy "admin delete product_tags" on product_tags
  for delete using (
    (auth.jwt() -> 'user_metadata' ->> 'role') = 'admin'
  );

-- DISCOUNTS
drop policy if exists "auth select discounts" on discounts;
drop policy if exists "auth insert discounts" on discounts;
drop policy if exists "auth update discounts" on discounts;
drop policy if exists "public can view active discounts" on discounts;

-- Público puede ver descuentos activos
create policy "public can view active discounts" on discounts
  for select using (is_active = true);

create policy "admin insert discounts" on discounts
  for insert with check (
    (auth.jwt() -> 'user_metadata' ->> 'role') = 'admin'
  );

create policy "admin update discounts" on discounts
  for update using (
    (auth.jwt() -> 'user_metadata' ->> 'role') = 'admin'
  ) with check (
    (auth.jwt() -> 'user_metadata' ->> 'role') = 'admin'
  );

-- PRODUCT DISCOUNTS
drop policy if exists "auth select product_discounts" on product_discounts;
drop policy if exists "auth insert product_discounts" on product_discounts;
drop policy if exists "auth delete product_discounts" on product_discounts;
drop policy if exists "public can view product_discounts" on product_discounts;

-- Público puede ver relaciones producto-descuento
create policy "public can view product_discounts" on product_discounts
  for select using (true);

create policy "admin insert product_discounts" on product_discounts
  for insert with check (
    (auth.jwt() -> 'user_metadata' ->> 'role') = 'admin'
  );

create policy "admin delete product_discounts" on product_discounts
  for delete using (
    (auth.jwt() -> 'user_metadata' ->> 'role') = 'admin'
  );

-- CATEGORIES
drop policy if exists "auth select categories" on categories;
drop policy if exists "auth insert categories" on categories;
drop policy if exists "auth update categories" on categories;
drop policy if exists "auth delete categories" on categories;
drop policy if exists "public can view active categories" on categories;

-- Público puede ver categorías activas
create policy "public can view active categories" on categories
  for select using (is_active = true);

create policy "admin insert categories" on categories
  for insert with check (
    (auth.jwt() -> 'user_metadata' ->> 'role') = 'admin'
  );

create policy "admin update categories" on categories
  for update using (
    (auth.jwt() -> 'user_metadata' ->> 'role') = 'admin'
  ) with check (
    (auth.jwt() -> 'user_metadata' ->> 'role') = 'admin'
  );

create policy "admin delete categories" on categories
  for delete using (
    (auth.jwt() -> 'user_metadata' ->> 'role') = 'admin'
  );

-- ==============================================================================
-- NOTAS FINALES
-- ==============================================================================
-- 1. Ejecuta este script en el SQL Editor de Supabase.
-- 2. Asegúrate de asignar el rol 'admin' en user_metadata al crear/actualizar usuarios:
--    UPDATE auth.users SET raw_user_meta_data = jsonb_set(raw_user_meta_data, '{role}', '"admin"') WHERE email = 'admin@example.com';
-- 3. Verifica que las políticas quedaron correctamente:
--    SELECT * FROM pg_policies WHERE schemaname = 'public';
