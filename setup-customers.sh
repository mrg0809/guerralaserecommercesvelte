#!/bin/bash

# Script para configurar la tabla de clientes en Supabase
# Guerra Laser - FASE 1 CRM

echo "🚀 Configurando módulo de Clientes..."
echo ""

# Colores
GREEN='\033[0;32m'
BLUE='\033[0;34m'
YELLOW='\033[1;33m'
RED='\033[0;31m'
NC='\033[0m' # No Color

# Verificar que estamos en el directorio correcto
if [ ! -f "package.json" ]; then
    echo -e "${RED}❌ Error: Debes ejecutar este script desde la raíz del proyecto${NC}"
    exit 1
fi

echo -e "${BLUE}📋 Paso 1: Verificando conexión con Supabase...${NC}"
supabase --version > /dev/null 2>&1
if [ $? -ne 0 ]; then
    echo -e "${RED}❌ Supabase CLI no está instalado${NC}"
    echo "Instala con: npm install -g supabase"
    exit 1
fi

# Verificar login
echo -e "${BLUE}🔐 Verificando autenticación...${NC}"
supabase projects list > /dev/null 2>&1
if [ $? -ne 0 ]; then
    echo -e "${YELLOW}⚠️  No estás autenticado en Supabase${NC}"
    echo "Ejecuta: supabase login"
    exit 1
fi

echo -e "${GREEN}✅ Conexión verificada${NC}"
echo ""

# Ejecutar migration
echo -e "${BLUE}📊 Paso 2: Ejecutando migration de clientes...${NC}"
echo "Archivo: database/migrations/create_customers_table.sql"
echo ""

PROJECT_ID="ugxuhfmjxvhglswxspiv"

# Leer el archivo SQL
SQL_FILE="database/migrations/create_customers_table.sql"

if [ ! -f "$SQL_FILE" ]; then
    echo -e "${RED}❌ Error: No se encontró el archivo de migration${NC}"
    exit 1
fi

# Ejecutar la migration via Supabase CLI
echo "Ejecutando SQL en proyecto: $PROJECT_ID"
supabase db push --project-ref $PROJECT_ID --include-all

if [ $? -ne 0 ]; then
    echo -e "${YELLOW}⚠️  Método automático falló, intentando método alternativo...${NC}"
    echo ""
    echo -e "${BLUE}Opciones para ejecutar la migration:${NC}"
    echo ""
    echo "1️⃣  Opción 1 - Supabase Dashboard (Recomendado):"
    echo "   - Ve a: https://supabase.com/dashboard/project/$PROJECT_ID/editor"
    echo "   - Copia y pega el contenido de: database/migrations/create_customers_table.sql"
    echo "   - Click en 'Run'"
    echo ""
    echo "2️⃣  Opción 2 - psql directo:"
    echo "   Ejecuta:"
    echo "   psql -h db.$PROJECT_ID.supabase.co -U postgres -d postgres -f $SQL_FILE"
    echo ""
    read -p "¿Ya ejecutaste la migration? (s/n): " executed
    if [ "$executed" != "s" ]; then
        echo -e "${YELLOW}⏸️  Proceso pausado. Ejecuta la migration y vuelve a correr este script${NC}"
        exit 1
    fi
fi

echo -e "${GREEN}✅ Migration ejecutada${NC}"
echo ""

# Generar tipos TypeScript
echo -e "${BLUE}📝 Paso 3: Generando tipos TypeScript...${NC}"
supabase gen types typescript --project-id $PROJECT_ID > src/lib/types/database.types.ts

if [ $? -eq 0 ]; then
    echo -e "${GREEN}✅ Tipos generados en: src/lib/types/database.types.ts${NC}"
else
    echo -e "${YELLOW}⚠️  Error generando tipos automáticamente${NC}"
    echo "Genera manualmente con:"
    echo "supabase gen types typescript --project-id $PROJECT_ID > src/lib/types/database.types.ts"
fi

echo ""
echo -e "${GREEN}🎉 ¡Configuración completada!${NC}"
echo ""
echo -e "${BLUE}📚 Próximos pasos:${NC}"
echo ""
echo "1. Verifica la tabla en Supabase Dashboard:"
echo "   https://supabase.com/dashboard/project/$PROJECT_ID/editor"
echo ""
echo "2. Prueba el módulo de clientes:"
echo "   - Inicia el servidor: npm run dev"
echo "   - Ve a: http://localhost:5173/admin/clientes"
echo ""
echo "3. Crea tu primer cliente desde la UI"
echo ""
echo "4. Prueba la búsqueda en cotizaciones:"
echo "   - Ve a: http://localhost:5173/admin/cotizaciones"
echo "   - Busca un cliente existente"
echo "   - Los datos se autocompletarán"
echo ""
echo -e "${GREEN}✨ ¡Todo listo para usar el módulo de Clientes!${NC}"
