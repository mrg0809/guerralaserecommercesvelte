-- =====================================================
-- FIX: Políticas RLS para tabla customers
-- Solución al error: permission denied for table users
-- =====================================================

-- Eliminar políticas anteriores
DROP POLICY IF EXISTS "Admins can do everything on customers" ON customers;
DROP POLICY IF EXISTS "Authenticated users can view customers" ON customers;

-- OPCIÓN 1: Permitir todo a usuarios autenticados (Recomendado para desarrollo)
-- Úsala mientras configuras roles
CREATE POLICY "Allow all for authenticated users" ON customers
    FOR ALL
    USING (auth.uid() IS NOT NULL)
    WITH CHECK (auth.uid() IS NOT NULL);

-- =====================================================
-- OPCIÓN 2: Política basada en metadata (para producción)
-- Descomenta estas líneas cuando hayas configurado roles
-- =====================================================

-- Primero, crea una función helper
/*
CREATE OR REPLACE FUNCTION auth.is_admin()
RETURNS BOOLEAN AS $$
BEGIN
    RETURN (
        SELECT COALESCE(
            (auth.jwt() -> 'user_metadata' ->> 'role') IN ('admin', 'super_admin'),
            false
        )
    );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Luego crea las políticas usando la función
DROP POLICY IF EXISTS "Allow all for authenticated users" ON customers;

CREATE POLICY "Admins can do everything on customers" ON customers
    FOR ALL
    USING (auth.is_admin())
    WITH CHECK (auth.is_admin());

CREATE POLICY "Users can view customers" ON customers
    FOR SELECT
    USING (auth.uid() IS NOT NULL);
*/

-- =====================================================
-- Verificar políticas activas
-- =====================================================
SELECT schemaname, tablename, policyname, permissive, roles, cmd, qual
FROM pg_policies 
WHERE tablename = 'customers';
