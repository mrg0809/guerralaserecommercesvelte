-- Función para agregar roles y permisos al token JWT
CREATE OR REPLACE FUNCTION auth.jwt() 
RETURNS json 
LANGUAGE plpgsql 
SECURITY DEFINER 
SET search_path = public 
AS $$
DECLARE
    user_roles text[];
    user_permissions text[];
    payload json;
BEGIN
    -- Obtener el payload actual del token
    payload := auth.jwt();
    
    -- Si hay un usuario autenticado, agregar sus roles y permisos
    IF payload ->> 'sub' IS NOT NULL THEN
        -- Obtener roles del usuario
        SELECT COALESCE(array_agg(r.name), '{}')
        INTO user_roles
        FROM user_roles ur
        JOIN roles r ON ur.role_id = r.id
        WHERE ur.user_id = payload ->> 'sub';
        
        -- Obtener permisos del usuario (basados en sus roles)
        SELECT COALESCE(array_agg(DISTINCT p.name), '{}')
        INTO user_permissions
        FROM role_permissions rp
        JOIN permissions p ON rp.permission_id = p.id
        JOIN user_roles ur ON rp.role_id = ur.role_id
        WHERE ur.user_id = payload ->> 'sub';
        
        -- Agregar roles y permisos al payload
        payload := payload || jsonb_build_object(
            'user_roles', user_roles,
            'permissions', user_permissions
        );
    END IF;
    
    RETURN payload;
END;
$$;

-- Crear vista para facilitar la consulta de roles y permisos
CREATE OR REPLACE VIEW user_jwt_claims AS
SELECT 
    u.id as user_id,
    u.email,
    COALESCE(array_agg(r.name), '{}') as roles,
    COALESCE(array_agg(DISTINCT p.name), '{}') as permissions
FROM users u
LEFT JOIN user_roles ur ON u.id = ur.user_id
LEFT JOIN roles r ON ur.role_id = r.id
LEFT JOIN role_permissions rp ON r.id = rp.role_id
LEFT JOIN permissions p ON rp.permission_id = p.id
GROUP BY u.id, u.email;
