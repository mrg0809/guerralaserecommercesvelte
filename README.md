# Guerra Láser Ecommerce

Tienda en línea de máquinas de corte y grabado láser construida con SvelteKit y Supabase.

## 🚀 Características

- **Frontend moderno** con SvelteKit 2 y Tailwind CSS
- **Base de datos en la nube** con Supabase (PostgreSQL)
- **Sin backend tradicional** - Toda la lógica en el cliente y Supabase
- **Sistema de productos** completo con variantes y multimedia
- **Gestión de categorías** con jerarquía
- **Carrito de compras** persistente en localStorage
- **Proceso de checkout** con información de envío
- **Panel de administración** para gestionar productos, categorías y pedidos
- **Diseño responsive** optimizado para móviles y escritorio
- **Alta velocidad** gracias a SvelteKit

## 📋 Requisitos Previos

- Node.js 18 o superior
- npm, yarn, pnpm o bun
- Cuenta en [Supabase](https://supabase.com/) (gratuita)

## 🛠️ Instalación y Configuración

### 1. Clonar el Repositorio

```bash
git clone https://github.com/mrg0809/guerralaserecommercesvelte.git
cd guerralaserecommercesvelte
```

### 2. Instalar Dependencias

```bash
npm install
```

### 3. Configurar Supabase

#### 3.1. Crear un Proyecto en Supabase

1. Ve a [supabase.com](https://supabase.com/)
2. Crea una cuenta o inicia sesión
3. Crea un nuevo proyecto
4. Guarda tu **URL del proyecto** y tu **Anon Key**

#### 3.2. Configurar la Base de Datos

1. En el panel de Supabase, ve a **SQL Editor**
2. Copia y pega el contenido del script SQL de abajo
3. Ejecuta el script para crear todas las tablas, funciones y políticas

<details>
<summary>Database Schema SQL (Click para expandir)</summary>

```sql
-- Guerra Laser Store - Supabase Database Schema

-- Enable UUID extension
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- Categories Table
CREATE TABLE IF NOT EXISTS categories (
  id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
  name VARCHAR(255) NOT NULL,
  slug VARCHAR(255) NOT NULL UNIQUE,
  description TEXT,
  parent_id UUID REFERENCES categories(id) ON DELETE CASCADE,
  image_url TEXT,
  display_order INTEGER DEFAULT 0,
  is_active BOOLEAN DEFAULT true,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Products Table
CREATE TABLE IF NOT EXISTS products (
  id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
  name VARCHAR(255) NOT NULL,
  slug VARCHAR(255) NOT NULL UNIQUE,
  description TEXT,
  short_description TEXT,
  base_price DECIMAL(10, 2) NOT NULL,
  category_id UUID REFERENCES categories(id) ON DELETE SET NULL,
  is_active BOOLEAN DEFAULT true,
  is_featured BOOLEAN DEFAULT false,
  stock_quantity INTEGER DEFAULT 0,
  sku VARCHAR(100) UNIQUE,
  meta_title VARCHAR(255),
  meta_description TEXT,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Product Variants Table
CREATE TABLE IF NOT EXISTS product_variants (
  id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
  product_id UUID REFERENCES products(id) ON DELETE CASCADE NOT NULL,
  name VARCHAR(255) NOT NULL,
  sku VARCHAR(100) UNIQUE,
  price DECIMAL(10, 2) NOT NULL,
  stock_quantity INTEGER DEFAULT 0,
  attributes JSONB,
  is_active BOOLEAN DEFAULT true,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Product Media Table
CREATE TABLE IF NOT EXISTS product_media (
  id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
  product_id UUID REFERENCES products(id) ON DELETE CASCADE NOT NULL,
  media_type VARCHAR(50) NOT NULL,
  url TEXT NOT NULL,
  thumbnail_url TEXT,
  alt_text VARCHAR(255),
  display_order INTEGER DEFAULT 0,
  is_primary BOOLEAN DEFAULT false,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Discounts Table
CREATE TABLE IF NOT EXISTS discounts (
  id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
  name VARCHAR(255) NOT NULL,
  description TEXT,
  discount_type VARCHAR(50) NOT NULL,
  discount_value DECIMAL(10, 2) NOT NULL,
  start_date TIMESTAMP WITH TIME ZONE,
  end_date TIMESTAMP WITH TIME ZONE,
  is_active BOOLEAN DEFAULT true,
  min_purchase_amount DECIMAL(10, 2),
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Product Discounts Table
CREATE TABLE IF NOT EXISTS product_discounts (
  id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
  product_id UUID REFERENCES products(id) ON DELETE CASCADE NOT NULL,
  discount_id UUID REFERENCES discounts(id) ON DELETE CASCADE NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  UNIQUE(product_id, discount_id)
);

-- Orders Table
CREATE TABLE IF NOT EXISTS orders (
  id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
  order_number VARCHAR(50) UNIQUE NOT NULL,
  customer_name VARCHAR(255) NOT NULL,
  customer_email VARCHAR(255) NOT NULL,
  customer_phone VARCHAR(50),
  shipping_address JSONB,
  billing_address JSONB,
  subtotal DECIMAL(10, 2) NOT NULL,
  discount_amount DECIMAL(10, 2) DEFAULT 0,
  tax_amount DECIMAL(10, 2) DEFAULT 0,
  shipping_amount DECIMAL(10, 2) DEFAULT 0,
  total_amount DECIMAL(10, 2) NOT NULL,
  status VARCHAR(50) DEFAULT 'pending',
  payment_status VARCHAR(50) DEFAULT 'pending',
  payment_method VARCHAR(50),
  payment_id TEXT,
  notes TEXT,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Order Items Table
CREATE TABLE IF NOT EXISTS order_items (
  id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
  order_id UUID REFERENCES orders(id) ON DELETE CASCADE NOT NULL,
  product_id UUID REFERENCES products(id) ON DELETE SET NULL,
  variant_id UUID REFERENCES product_variants(id) ON DELETE SET NULL,
  product_name VARCHAR(255) NOT NULL,
  variant_name VARCHAR(255),
  quantity INTEGER NOT NULL,
  unit_price DECIMAL(10, 2) NOT NULL,
  total_price DECIMAL(10, 2) NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Create indexes
CREATE INDEX idx_products_category ON products(category_id);
CREATE INDEX idx_products_slug ON products(slug);
CREATE INDEX idx_products_active ON products(is_active);
CREATE INDEX idx_products_featured ON products(is_featured);
CREATE INDEX idx_categories_slug ON categories(slug);
CREATE INDEX idx_categories_parent ON categories(parent_id);
CREATE INDEX idx_product_variants_product ON product_variants(product_id);
CREATE INDEX idx_product_media_product ON product_media(product_id);
CREATE INDEX idx_orders_status ON orders(status);
CREATE INDEX idx_orders_customer_email ON orders(customer_email);

-- Function to update updated_at timestamp
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ language 'plpgsql';

-- Create triggers for updated_at
CREATE TRIGGER update_categories_updated_at BEFORE UPDATE ON categories
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_products_updated_at BEFORE UPDATE ON products
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_product_variants_updated_at BEFORE UPDATE ON product_variants
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_orders_updated_at BEFORE UPDATE ON orders
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- Enable Row Level Security
ALTER TABLE categories ENABLE ROW LEVEL SECURITY;
ALTER TABLE products ENABLE ROW LEVEL SECURITY;
ALTER TABLE product_variants ENABLE ROW LEVEL SECURITY;
ALTER TABLE product_media ENABLE ROW LEVEL SECURITY;
ALTER TABLE discounts ENABLE ROW LEVEL SECURITY;
ALTER TABLE product_discounts ENABLE ROW LEVEL SECURITY;
ALTER TABLE orders ENABLE ROW LEVEL SECURITY;
ALTER TABLE order_items ENABLE ROW LEVEL SECURITY;

-- Public read access policies
CREATE POLICY "Public can view active categories" ON categories
  FOR SELECT USING (is_active = true);

CREATE POLICY "Public can view active products" ON products
  FOR SELECT USING (is_active = true);

CREATE POLICY "Public can view active variants" ON product_variants
  FOR SELECT USING (is_active = true);

CREATE POLICY "Public can view product media" ON product_media
  FOR SELECT USING (true);

CREATE POLICY "Public can view active discounts" ON discounts
  FOR SELECT USING (is_active = true);

CREATE POLICY "Public can view product discounts" ON product_discounts
  FOR SELECT USING (true);

-- Orders policies
CREATE POLICY "Users can create orders" ON orders
  FOR INSERT WITH CHECK (true);

CREATE POLICY "Public can view orders" ON orders
  FOR SELECT USING (true);

CREATE POLICY "Public can view order items" ON order_items
  FOR SELECT USING (true);

-- Admin policies (temporary - allow all for development)
CREATE POLICY "Allow all on categories" ON categories
  FOR ALL USING (true) WITH CHECK (true);

CREATE POLICY "Allow all on products" ON products
  FOR ALL USING (true) WITH CHECK (true);

CREATE POLICY "Allow all on variants" ON product_variants
  FOR ALL USING (true) WITH CHECK (true);

CREATE POLICY "Allow all on media" ON product_media
  FOR ALL USING (true) WITH CHECK (true);

CREATE POLICY "Allow all on discounts" ON discounts
  FOR ALL USING (true) WITH CHECK (true);

CREATE POLICY "Allow all on product_discounts" ON product_discounts
  FOR ALL USING (true) WITH CHECK (true);

CREATE POLICY "Allow all on orders" ON orders
  FOR ALL USING (true) WITH CHECK (true);

CREATE POLICY "Allow all on order_items" ON order_items
  FOR ALL USING (true) WITH CHECK (true);

-- Sample data
INSERT INTO categories (name, slug, description, is_active) VALUES
  ('Máquinas Láser', 'maquinas-laser', 'Máquinas de corte y grabado láser de alta precisión', true),
  ('Refacciones', 'refacciones', 'Refacciones y repuestos para máquinas láser', true),
  ('Accesorios', 'accesorios', 'Accesorios y complementos para tu equipo láser', true);
```
</details>

#### 3.3. Configurar Variables de Entorno

Crea un archivo `.env` en la raíz del proyecto (puedes copiar `.env.example`):

```bash
cp .env.example .env
```

Edita el archivo `.env` y agrega tus credenciales de Supabase:

```env
PUBLIC_SUPABASE_URL=tu-url-de-supabase
PUBLIC_SUPABASE_ANON_KEY=tu-anon-key-de-supabase
```

### 4. Ejecutar en Desarrollo

```bash
npm run dev
```

La aplicación estará disponible en `http://localhost:5173`

### 5. Construir para Producción

```bash
npm run build
npm run preview
```

## 📁 Estructura del Proyecto

```
guerralaserecommercesvelte/
├── src/
│   ├── lib/
│   │   ├── supabaseClient.ts      # Cliente de Supabase
│   │   ├── types/                 # Definiciones de TypeScript
│   │   ├── stores/                # Stores de Svelte (carrito)
│   │   └── utils.ts               # Funciones utilitarias
│   ├── routes/
│   │   ├── +page.svelte           # Página principal
│   │   ├── +layout.svelte         # Layout principal
│   │   ├── productos/             # Listado y detalle de productos
│   │   ├── categorias/            # Listado y vista por categoría
│   │   ├── carrito/               # Carrito de compras
│   │   ├── checkout/              # Proceso de pago
│   │   ├── pedido/                # Confirmación de pedido
│   │   └── admin/                 # Panel de administración
│   │       ├── productos/         # Gestión de productos
│   │       ├── categorias/        # Gestión de categorías
│   │       └── pedidos/           # Gestión de pedidos
│   └── app.css                    # Estilos globales
├── static/                        # Archivos estáticos
├── .env.example                   # Ejemplo de variables de entorno
├── package.json
└── README.md
```

## 🎯 Funcionalidades

### Tienda Pública

- **Página de Inicio**: Banner hero, categorías destacadas, productos destacados
- **Catálogo de Productos**: Búsqueda, filtros por categoría, vista en grid
- **Detalle de Producto**: Galería de imágenes, variantes, selector de cantidad
- **Carrito de Compras**: Persistente, actualización en tiempo real
- **Checkout**: Formulario de información de cliente y envío
- **Confirmación**: Página de confirmación con detalles del pedido

### Panel de Administración

**Nota**: En desarrollo, todas las funciones están accesibles. Para producción, implementa autenticación y roles.

- **Dashboard**: Estadísticas generales
- **Productos**: CRUD completo (crear, leer, actualizar, eliminar)
- **Categorías**: Gestión de categorías con imágenes
- **Pedidos**: Visualización y gestión de pedidos, cambio de estados

## 🔐 Seguridad

### Para Producción

1. **Implementar Autenticación**:
   - Configura Supabase Auth
   - Agrega login/registro para administradores
   - Implementa middleware de autenticación

2. **Actualizar Políticas RLS**:
   - Modifica las políticas de Supabase para requerir roles de admin
   - Elimina las políticas temporales "Allow all"
   - Ejemplo de política admin:
   ```sql
   CREATE POLICY "Only admins can modify products" ON products
     FOR ALL USING (
       auth.jwt() ->> 'role' = 'admin'
     );
   ```

3. **Variables de Entorno**:
   - Nunca subas el archivo `.env` al repositorio
   - Usa variables de entorno en tu servicio de hosting

## 🚀 Despliegue

### Vercel (Recomendado para SvelteKit)

1. Conecta tu repositorio en [vercel.com](https://vercel.com)
2. Configura las variables de entorno en Vercel
3. Despliega automáticamente

### Netlify

1. Conecta tu repositorio en [netlify.com](https://netlify.com)
2. Configura las variables de entorno
3. Build command: `npm run build`
4. Publish directory: `build`

### Otros Proveedores

Cualquier proveedor que soporte Node.js y SvelteKit funcionará (Railway, Render, etc.)

## 📝 Uso

### Agregar Productos

1. Ve a `/admin`
2. Click en "Gestionar Productos"
3. Click en "+ Nuevo Producto"
4. Completa el formulario
5. Guarda

### Gestionar Categorías

1. Ve a `/admin/categorias`
2. Crea, edita o elimina categorías
3. Las categorías aparecerán automáticamente en el frontend

### Procesar Pedidos

1. Ve a `/admin/pedidos`
2. Visualiza todos los pedidos
3. Cambia el estado de los pedidos
4. Consulta detalles del cliente y productos

## 🛠️ Tecnologías Utilizadas

- **[SvelteKit](https://kit.svelte.dev/)** - Framework web moderno
- **[Svelte 5](https://svelte.dev/)** - Framework reactivo
- **[Supabase](https://supabase.com/)** - Backend as a Service
- **[Tailwind CSS](https://tailwindcss.com/)** - Framework de CSS
- **[TypeScript](https://www.typescriptlang.org/)** - Tipado estático
- **PostgreSQL** - Base de datos (via Supabase)

## 🤝 Contribuir

Las contribuciones son bienvenidas. Por favor:

1. Fork el proyecto
2. Crea una rama para tu feature (`git checkout -b feature/AmazingFeature`)
3. Commit tus cambios (`git commit -m 'Add some AmazingFeature'`)
4. Push a la rama (`git push origin feature/AmazingFeature`)
5. Abre un Pull Request

## 📄 Licencia

Este proyecto es de código abierto y está disponible bajo la licencia MIT.

## 📧 Contacto

Para preguntas o soporte:
- Email: contacto@guerralaser.com
- GitHub: [@mrg0809](https://github.com/mrg0809)

---

Desarrollado con ❤️ usando SvelteKit y Supabase
