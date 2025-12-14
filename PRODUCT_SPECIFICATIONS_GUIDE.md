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
