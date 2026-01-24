-- ============================================
-- Funciones para gestión de usuarios
-- ============================================

-- Función para obtener todos los usuarios con sus roles
-- Esta función permite a los admins ver usuarios sin acceso directo a auth.users
CREATE OR REPLACE FUNCTION get_all_users_with_roles()
RETURNS TABLE (
    id UUID,
    email TEXT,
    created_at TIMESTAMPTZ,
    last_sign_in_at TIMESTAMPTZ,
    roles TEXT[]
) 
SECURITY DEFINER
SET search_path = public
LANGUAGE plpgsql
AS $$
BEGIN
    -- Verificar que el usuario tenga permisos de admin
    IF NOT EXISTS (
        SELECT 1 FROM user_roles ur
        JOIN roles r ON ur.role_id = r.id
        WHERE ur.user_id = auth.uid()
        AND ur.is_active = true
        AND r.name IN ('admin', 'superadmin')
    ) THEN
        RAISE EXCEPTION 'No tienes permisos para ver usuarios';
    END IF;

    RETURN QUERY
    SELECT 
        au.id,
        au.email::TEXT,
        au.created_at,
        au.last_sign_in_at,
        COALESCE(
            ARRAY_AGG(r.name) FILTER (WHERE r.name IS NOT NULL),
            ARRAY[]::TEXT[]
        ) as roles
    FROM auth.users au
    LEFT JOIN user_roles ur ON au.id = ur.user_id AND ur.is_active = true
    LEFT JOIN roles r ON ur.role_id = r.id AND r.is_active = true
    GROUP BY au.id, au.email, au.created_at, au.last_sign_in_at
    ORDER BY au.created_at DESC;
END;
$$;

-- Comentario
COMMENT ON FUNCTION get_all_users_with_roles() IS 'Obtiene todos los usuarios con sus roles asignados. Requiere permisos de admin o superadmin';
