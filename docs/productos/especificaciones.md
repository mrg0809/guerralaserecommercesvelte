# Especificaciones de Productos

Instalación y uso del panel de especificaciones técnicas de productos.

## Tabla de contenidos

1. [Instalación](#instalación)
2. [Uso en el panel de administración](#uso-en-el-panel-de-administración)

---

# Instalación de Especificaciones de Productos

## Paso 1: Ejecutar el SQL en Supabase

1. Ve a tu proyecto en [Supabase Dashboard](https://app.supabase.com)
2. Selecciona tu proyecto "guerralaserecommercesvelte"
3. Ve a la sección **SQL Editor** en el lado izquierdo
4. Copia y pega el contenido del archivo `database/migrations/create_product_specifications.sql`
5. Haz click en **Run** para ejecutar el script

## Paso 2: Estructura de la Tabla

La tabla `product_specifications` tiene los siguientes campos:

- **id** (uuid): Identificador único
- **product_id** (uuid): Referencia al producto
- **specification_key** (text): Nombre del atributo (ej: "Potencia", "Velocidad", "Tamaño de Cama")
- **specification_value** (text): Valor del atributo (ej: "40W", "100mm/s", "600x400mm")
- **data_type** (text): Tipo de dato - puede ser:
  - `text`: Texto libre
  - `number`: Número
  - `boolean`: Verdadero/Falso
  - `select`: Valor de un listado
- **created_at** / **updated_at**: Timestamps

## Ejemplo de Uso

Para un producto "Máquina Láser CO2 40W" podrías agregar:

```
specification_key: "Potencia"
specification_value: "40W"
data_type: "text"

specification_key: "Velocidad de Corte"
specification_value: "100"
data_type: "number"

specification_key: "Tamaño de Cama"
specification_value: "600x400"
data_type: "text"
```

## Búsquedas Posibles

Con esta estructura puedes realizar búsquedas como:

```typescript
// Buscar todos los productos con potencia de 40W
const { data } = await supabase
  .from('product_specifications')
  .select('product_id')
  .eq('specification_key', 'Potencia')
  .eq('specification_value', '40W');

// Buscar productos con velocidad > 100
const { data } = await supabase
  .from('product_specifications')
  .select('product_id')
  .eq('specification_key', 'Velocidad de Corte')
  .gt('specification_value::numeric', 100);
```

## Próximos Pasos

1. Crear panel de administración para gestionar especificaciones por producto
2. Implementar filtros avanzados de búsqueda basados en especificaciones
3. Crear página de comparativa de productos por especificaciones


---


# 📋 Panel de Gestión de Especificaciones de Productos

## Acceso

1. Ve a `/admin`
2. Haz click en **"Gestión de Productos"** (primera tarjeta)
3. Se abrirá una tabla con todos los productos
4. Para cada producto, verás un botón **"Specs"** en color púrpura
5. Click en **"Specs"** para gestionar las especificaciones de ese producto

## Gestionar Especificaciones

### Agregar una Nueva Especificación

1. En la página de especificaciones del producto, haz click en **"+ Nueva Especificación"**
2. Se abrirá un modal con tres campos:
   - **Clave**: Nombre del atributo (ej: "Potencia", "Velocidad", "Tamaño de Cama")
   - **Valor**: El valor específico (ej: "40W", "100mm/s", "600x400mm")
   - **Tipo de Dato**: Selecciona uno de:
     - `Texto`: Para valores de texto libre
     - `Número`: Para valores numéricos
     - `Sí/No`: Para atributos booleanos
     - `Selección`: Para valores de un listado predefinido

3. Haz click en **"Agregar"**

### Editar una Especificación

1. En el producto, busca la especificación que quieres editar
2. Haz click en el botón **editar** (lápiz azul)
3. Modifica los valores necesarios
4. Haz click en **"Actualizar"**

### Eliminar una Especificación

1. Busca la especificación
2. Haz click en el botón **eliminar** (X roja)
3. Confirma la eliminación

## Ejemplos de Especificaciones

### Para Máquinas Láser CO2:
```
Potencia (Texto): 40W
Velocidad de Corte (Número): 100
Tamaño de Cama (Texto): 600x400mm
Refrigeración (Sí/No): Sí
Tipo de Tubo (Texto): RF-30W
```

### Para Máquinas Laser Fibra:
```
Potencia (Número): 20
Rango de Marcado (Texto): 110x110mm
Velocidad de Marcado (Número): 7000
Fuente de Luz (Texto): Fibra Óptica
```

## Búsquedas Futuras

Una vez agregadas las especificaciones, los clientes podrán:
- Filtrar productos por especificaciones
- Buscar máquinas por rango de potencia
- Comparar productos lado a lado
- Ver especificaciones detalladas en la página del producto

## Estructura en Base de Datos

Todas las especificaciones se guardan en la tabla `product_specifications` con:
- Referencia al producto (`product_id`)
- Clave del atributo (`specification_key`)
- Valor del atributo (`specification_value`)
- Tipo de dato (`data_type`)
- Timestamps de creación y actualización
