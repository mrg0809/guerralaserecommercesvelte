#!/bin/bash

# Script para generar tipos de TypeScript desde Supabase sin CLI login

PROJECT_ID="ugxuhfmjxvhglswxspiv"

echo "🔐 Para generar los tipos necesitas tu Access Token de Supabase"
echo ""
echo "Opción 1 - Usar el navegador (MÁS FÁCIL):"
echo "=========================================="
echo "1. Ve a: https://supabase.com/dashboard/account/tokens"
echo "2. Genera un nuevo Access Token (o usa uno existente)"
echo "3. Copia el token"
echo "4. Ejecuta:"
echo "   export SUPABASE_ACCESS_TOKEN='tu_token_aqui'"
echo "   npx supabase gen types typescript --project-id $PROJECT_ID > src/lib/types/database.types.ts"
echo ""
echo "Opción 2 - Login manual:"
echo "========================"
echo "   npx supabase login --token TU_ACCESS_TOKEN"
echo "   npx supabase gen types typescript --project-id $PROJECT_ID > src/lib/types/database.types.ts"
echo ""
echo "Opción 3 - Sin regenerar tipos (TEMPORAL):"
echo "==========================================="
echo "Los tipos TypeScript son OPCIONALES. El código funcionará sin ellos,"
echo "solo tendrás algunos warnings en el editor."
echo ""
echo "Puedes usar el sistema ahora y regenerar los tipos después."
echo ""
