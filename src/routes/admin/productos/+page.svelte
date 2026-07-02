<script lang="ts">
	import { onMount } from 'svelte';
	import { supabase } from '$lib/supabaseClient';
	import { formatPrice, generateSlug, getDisplayPrice, getDisplayStock } from '$lib/utils';
	import { getProductImageUrl } from '$lib/storage';
	import type { Product, Category, ProductSpecification, Discount, Tag, ProductMedia, ProductVariant } from '$lib/types';

	let products: Product[] = $state([]);
	let categories: Category[] = $state([]);
	let discounts: Discount[] = $state([]);
	let allTags: Tag[] = $state([]);
	type ShippingTypeOption = {
		id: string;
		name: string;
		description: string | null;
		carrier: string | null;
		service: string | null;
		base_price: number;
		estimated_days: number | null;
		is_active: boolean | null;
	};
	let shippingTypes: ShippingTypeOption[] = $state([]);
	let selectedShippingTypeIds: string[] = $state([]);
	let loading = $state(true);
	let showModal = $state(false);
	let editingProduct = $state<Product | null>(null);
	let categoryHierarchy: Record<string, string> = $state({});
	let specifications: ProductSpecification[] = $state([]);
	let newSpec = $state({ key: '', value: '', data_type: 'text' });
	let selectedDiscounts: string[] = $state([]);
	let selectedTags: string[] = $state([]);
	let newTagName = $state('');
	
	// Mapa de variantes por producto
	let productVariantsMap: Record<string, ProductVariant[]> = $state({});
	
	// Variables de paginación y filtros
	let searchQuery = $state('');
	let selectedCategoryFilter = $state('');
	let currentPage = $state(1);
	let itemsPerPage = $state(20);
	let totalProducts = $state(0);
	
	// Variables para gestión de imágenes
	let productImages: ProductMedia[] = $state([]);
	let uploadingImages = $state(false);
	let selectedFiles: File[] = $state([]);
	let imagePreviews: string[] = $state([]);
	
	let formData = $state({
		name: '',
		slug: '',
		description: '',
		short_description: '',
		base_price: 0,
		cost: 0,
		category_id: '',
		is_active: true,
		is_featured: false,
		stock_quantity: 0,
		sku: '',
		shipping_type_id: '',
		technical_sheet_url: '',
		manual_pdf_url: ''
	});

	type VariantForm = {
		id?: string;
		name: string;
		sku: string;
		price: number;
		stock_quantity: number;
		is_active: boolean;
		color?: string;
		color_hex?: string;
		grosor?: string;
		tamano?: string;
	};

	let variants: VariantForm[] = $state([]);
	let newVariant: VariantForm = $state({
		name: '',
		sku: '',
		price: 0,
		stock_quantity: 0,
		is_active: true,
		color: '',
		color_hex: '',
		grosor: '',
		tamano: ''
	});

	let duplicateColorFrom = $state('');
	let duplicateColorName = $state('');
	let duplicateColorHex = $state('');
	let duplicateColorSkuCode = $state('');
	const duplicateStockDefault = 1;

	let duplicateColorOptions = $derived.by(() => {
		const colors = variants.map((v) => (v.color ?? '').trim()).filter(Boolean);
		return [...new Set(colors)].sort((a, b) =>
			a.localeCompare(b, 'es', { sensitivity: 'base' })
		);
	});

	/** Misma regla que la tienda y ACRILICO_VARIANTS_GUIDE.md: spec tipo_producto = acrilico */
	const ACRYLIC_SPEC_KEY = 'tipo_producto';
	const ACRYLIC_SPEC_VALUE = 'acrilico';

	let isAcrylicSheetProduct = $derived.by(() =>
		specifications.some(
			(s) =>
				s.specification_key?.trim().toLowerCase() === ACRYLIC_SPEC_KEY &&
				s.specification_value?.trim().toLowerCase() === ACRYLIC_SPEC_VALUE
		)
	);

	// Categorías ordenadas alfabéticamente por su jerarquía
	let sortedCategories = $derived.by(() => {
		return [...categories].sort((a, b) => {
			const nameA = categoryHierarchy[a.id] || a.name;
			const nameB = categoryHierarchy[b.id] || b.name;
			return nameA.localeCompare(nameB, 'es', { sensitivity: 'base' });
		});
	});

	let sortedCategoryHierarchy = $derived.by(() => {
		const entries = Object.entries(categoryHierarchy);
		return entries.sort((a, b) => a[1].localeCompare(b[1], 'es', { sensitivity: 'base' }));
	});

	function escapeRegExp(value: string) {
		return value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
	}

	function buildSkuWithNewColor(sku: string, colorCode: string) {
		const parts = (sku || '').split('-');
		if (parts.length >= 5) {
			parts[2] = colorCode.toUpperCase();
			return parts.join('-');
		}
		return `${sku}-${colorCode.toUpperCase()}`;
	}

	function buildVariantName(
		name: string,
		sourceColor: string,
		newColor: string,
		grosor?: string,
		tamano?: string
	) {
		const safeName = (name || '').trim();
		if (safeName && sourceColor) {
			const regex = new RegExp(`\\b${escapeRegExp(sourceColor)}\\b`, 'i');
			if (regex.test(safeName)) return safeName.replace(regex, newColor);
		}
		const parts = [newColor, grosor, tamano].filter(Boolean);
		return parts.join(' ').trim() || safeName || newColor;
	}

	function duplicateColorVariants() {
		const source = duplicateColorFrom.trim();
		const newName = duplicateColorName.trim();
		const newCode = duplicateColorSkuCode.trim().toUpperCase();
		const newHex = duplicateColorHex.trim();

		if (!source || !newName || !newCode) {
			alert('Selecciona un color base y completa Color nuevo + Código SKU.');
			return;
		}

		const sourceVariants = variants.filter(
			(v) => (v.color ?? '').trim().toLowerCase() === source.toLowerCase()
		);

		if (sourceVariants.length === 0) {
			alert('No hay variantes del color seleccionado.');
			return;
		}

		const duplicates = sourceVariants.map((v) => {
			const newSku = buildSkuWithNewColor(v.sku, newCode);
			const newNameFinal = buildVariantName(v.name, source, newName, v.grosor, v.tamano);
			return {
				...v,
				id: undefined,
				name: newNameFinal,
				sku: newSku,
				color: newName,
				color_hex: newHex || v.color_hex || '',
				stock_quantity: duplicateStockDefault
			};
		});

		variants = [...variants, ...duplicates];
		duplicateColorName = '';
		duplicateColorHex = '';
		duplicateColorSkuCode = '';
	}

	// Variables para datos PIM (Product Information Management)
	let satData = $state({
		clave_prod_serv: '',
		clave_unidad: '',
		unidad_medida: '',
		material_peligroso: false
	});

	let amazonData = $state({
		sku_amazon: '',
		asin: '',
		feed_product_type: '',
		browse_node_path: '',
		price: 0,
		bullet_points: ['', '', '', '', ''],
		specific_attributes: {} as Record<string, string>
	});

	let mercadolibreData = $state({
		ml_id: '',
		listing_type: 'gold_special',
		price: 0,
		attributes: {} as Record<string, string>
	});

	// Variables para editar JSON en textareas
	let amazonAttributesJson = $state('{}');
	let mercadolibreAttributesJson = $state('{}');

	// Catálogos SAT
	const satUnidades = [
		{ clave: 'H87', descripcion: 'Pieza' },
		{ clave: 'E48', descripcion: 'Unidad de servicio' },
		{ clave: 'E51', descripcion: 'Metro' },
		{ clave: 'E54', descripcion: 'Metro cuadrado' },
		{ clave: 'MTR', descripcion: 'Metro lineal' },
		{ clave: 'KGM', descripcion: 'Kilogramo' },
		{ clave: 'GRM', descripcion: 'Gramo' },
		{ clave: 'LTR', descripcion: 'Litro' },
		{ clave: 'XBX', descripcion: 'Caja' },
		{ clave: 'XPK', descripcion: 'Paquete' },
		{ clave: 'SET', descripcion: 'Conjunto' },
		{ clave: 'ACT', descripcion: 'Actividad' },
		{ clave: 'E49', descripcion: 'Día' },
		{ clave: 'HUR', descripcion: 'Hora' }
	];

	// Mapeo de categorías a claves SAT (por nombre de categoría)
	const satClavesCategoria: Record<string, string> = {
		'bomba': '40151500',
		'chiller': '43201538',
		'compresor': '40151601',
		'driver': '32101600',
		'extractor': '40101502',
		'fuente': '39121004',
		'lente': '31242003',
		'manguera': '40142000',
		'maquinas-corte-laser': '23241505',
		'maquinas-grabado': '23153602',
		'regulador': '39121635',
		'rotativo': '25171705',
		'tubos-laser': '39101600',
		'accesorios': '20121445',
		'accesorios-y-partes': '20121445',
		'partes': '20121445'
	};

	// Catálogos de categorías Amazon (con Browse Node Paths y atributos comunes)
	const amazonCategories = [
		{
			path: 'Industria, Empresas y Ciencia›Hidráulica, Neumática y Plomería',
			feed_type: 'Industrial',
			common_attributes: ['material_type', 'item_dimensions', 'item_weight', 'manufacturer', 'model_number', 'part_number']
		},
		{
			path: 'Industria, Empresas y Ciencia›Material de Laboratorio Científico',
			feed_type: 'Industrial',
			common_attributes: ['material_type', 'measurement_range', 'accuracy', 'power_source']
		},
		{
			path: 'Herramientas y Mejoras del Hogar›Energía y Herramientas Manuales›Herramientas Eléctricas',
			feed_type: 'Tools',
			common_attributes: ['voltage', 'wattage', 'battery_type', 'tool_type', 'warranty']
		},
		{
			path: 'Herramientas y Mejoras del Hogar›Soldadura',
			feed_type: 'Tools',
			common_attributes: ['power_source', 'amperage', 'voltage', 'duty_cycle']
		},
		{
			path: 'Electrónica›Componentes y Repuestos Electrónicos',
			feed_type: 'CE',
			common_attributes: ['voltage', 'current_rating', 'power_rating', 'connector_type']
		},
		{
			path: 'Industria, Empresas y Ciencia›Abrasivos y Acabados',
			feed_type: 'Industrial',
			common_attributes: ['grit_size', 'material_type', 'item_dimensions', 'abrasive_material']
		},
		{
			path: 'Industria, Empresas y Ciencia›Automatización Industrial y Controles',
			feed_type: 'Industrial',
			common_attributes: ['voltage', 'current_rating', 'protocol', 'interface_type']
		},
		{
			path: 'Herramientas y Mejoras del Hogar›Productos de Iluminación y Ventiladores de Techo',
			feed_type: 'Home',
			common_attributes: ['wattage', 'voltage', 'bulb_type', 'color_temperature', 'lumens']
		}
	];

	// Plantillas de atributos comunes para diferentes categorías
	const amazonAttributeTemplates: Record<string, Record<string, string>> = {
		'Hidráulica, Neumática y Plomería': {
			material_type: 'Acero inoxidable / Aluminio / Plástico',
			thread_size: 'Tamaño de rosca (ej: 1/4", M8)',
			pressure_rating: 'Presión máxima (ej: 150 PSI)',
			temperature_range: 'Rango de temperatura (ej: -20°C a 80°C)',
			connection_type: 'Tipo de conexión'
		},
		'Herramientas Eléctricas': {
			voltage: 'Voltaje (ej: 110V, 220V)',
			wattage: 'Potencia en watts',
			speed_settings: 'Velocidades disponibles',
			chuck_size: 'Tamaño del portabrocas',
			battery_included: 'true / false'
		},
		'Componentes Electrónicos': {
			voltage: 'Voltaje nominal',
			current_rating: 'Corriente nominal',
			power_rating: 'Potencia nominal',
			wavelength: 'Longitud de onda (para láseres)',
			beam_divergence: 'Divergencia del haz'
		},
		'Soldadura': {
			amperage: 'Amperaje (ej: 200A)',
			duty_cycle: 'Ciclo de trabajo (ej: 60%)',
			input_voltage: 'Voltaje de entrada',
			welding_process: 'Proceso (ej: MIG, TIG, Stick)'
		}
	};

	let activeTab = $state<'general' | 'variants' | 'specs' | 'sat' | 'amazon' | 'mercadolibre'>('general');

	// Función para obtener todas las categorías hijas (recursivo)
	function getChildCategoryIds(categoryId: string): string[] {
		const childIds: string[] = [categoryId];
		const children = categories.filter(c => c.parent_id === categoryId);
		
		for (const child of children) {
			childIds.push(...getChildCategoryIds(child.id));
		}
		
		return childIds;
	}

	// Computed: productos filtrados y paginados
	let filteredProducts = $derived.by(() => {
		let filtered = products;

		// Filtrar por búsqueda (nombre o SKU)
		if (searchQuery.trim()) {
			const query = searchQuery.toLowerCase();
			filtered = filtered.filter(p => 
				p.name.toLowerCase().includes(query) || 
				(p.sku && p.sku.toLowerCase().includes(query))
			);
		}

		// Filtrar por categoría (incluye categorías hijas)
		if (selectedCategoryFilter) {
			const categoryIds = getChildCategoryIds(selectedCategoryFilter);
			filtered = filtered.filter(p => p.category_id && categoryIds.includes(p.category_id));
		}

		return filtered;
	});

	let paginatedProducts = $derived.by(() => {
		const start = (currentPage - 1) * itemsPerPage;
		const end = start + itemsPerPage;
		return filteredProducts.slice(start, end);
	});

	let totalPages = $derived(Math.ceil(filteredProducts.length / itemsPerPage));

	// Reset a página 1 cuando cambian los filtros
	$effect(() => {
		searchQuery;
		selectedCategoryFilter;
		currentPage = 1;
	});

	// Sincronizar SKU de Amazon con SKU del producto
	$effect(() => {
		// Solo actualizar si el SKU de Amazon está vacío o es igual al SKU anterior del producto
		if (formData.sku && (!amazonData.sku_amazon || amazonData.sku_amazon === '')) {
			amazonData.sku_amazon = formData.sku;
		}
	});

	onMount(async () => {
		console.log('🔍 Iniciando carga de datos del módulo de productos...');
		
		try {
			// Primero probar la conexión
			const connectionOk = await testSupabaseConnection();
			if (!connectionOk) {
				console.error('❌ No se puede continuar sin conexión a Supabase');
				return;
			}
			
			// Cargar secuencialmente para evitar sobrecargar la base de datos
			console.log('🔍 Paso 1/5: Cargando productos...');
			await loadProducts();
			
			console.log('🔍 Paso 2/5: Cargando categorías...');
			await loadCategories();
			
			console.log('🔍 Paso 3/6: Cargando descuentos...');
			await loadDiscounts();
			
			console.log('🔍 Paso 4/6: Cargando etiquetas...');
			await loadTags();
			
			console.log('🔍 Paso 5/6: Cargando tipos de envío...');
			await loadShippingTypes();
			
			console.log('🔍 Paso 6/6: Cargando variantes...');
			await loadAllProductVariants();
			
			console.log('✅ Todos los datos cargados exitosamente');
		} catch (error) {
			console.error('❌ Error en la carga inicial:', error);
		}
	});

	async function loadProducts() {
		console.log('🔍 Cargando productos...');
		loading = true;
		
		try {
			const startTime = Date.now();
			console.log('🔍 Iniciando consulta a Supabase...');
			
			// Aumentar timeout a 30 segundos y agregar diagnóstico
			const timeoutPromise = new Promise((_, reject) => {
				setTimeout(() => reject(new Error('Timeout al cargar productos (30s)')), 30000);
			});
			
			const dataPromise = supabase
				.from('products')
				.select(`
					id,
					name,
					slug,
					description,
					short_description,
					base_price,
					cost,
					stock_quantity,
					sku,
					shipping_type_id,
					technical_sheet_url,
					manual_pdf_url,
					category_id,
					is_active,
					is_featured,
					created_at
				`)
				.order('created_at', { ascending: false });

			console.log('🔍 Esperando respuesta de Supabase...');
			const result = await Promise.race([dataPromise, timeoutPromise]);
			const { data, error } = result as any;
			
			const endTime = Date.now();
			console.log(`🔍 Respuesta recibida en ${endTime - startTime}ms`);

			if (error) {
				console.error('❌ Error de Supabase:', error);
				throw error;
			}

			if (data) {
				products = data;
				console.log(`✅ ${products.length} productos cargados en ${endTime - startTime}ms`);
			} else {
				console.log('🔍 No se encontraron productos');
				products = [];
			}
		} catch (error) {
			console.error('❌ Error cargando productos:', error);
			// No lanzar el error para no bloquear la UI, solo mostrar en consola
			products = [];
		}
		
		loading = false;
	}

	async function loadAllProductVariants() {
		console.log('🔍 Cargando variantes de productos...');
		
		try {
			const startTime = Date.now();
			console.log('🔍 Iniciando consulta de variantes a Supabase...');
			
			// Timeout de 15 segundos para variantes
			const timeoutPromise = new Promise((_, reject) => {
				setTimeout(() => reject(new Error('Timeout al cargar variantes (15s)')), 15000);
			});
			
			const dataPromise = supabase
				.from('product_variants')
				.select('*')
				.order('created_at');

			console.log('🔍 Esperando respuesta de variantes...');
			const result = await Promise.race([dataPromise, timeoutPromise]);
			const { data, error } = result as any;
			
			const endTime = Date.now();
			console.log(`🔍 Respuesta de variantes recibida en ${endTime - startTime}ms`);

			if (error) {
				console.error('❌ Error de Supabase en variantes:', error);
				throw error;
			}

			if (data) {
				// Agrupar variantes por product_id
				productVariantsMap = {};
				for (const variant of data) {
					if (!productVariantsMap[variant.product_id]) {
						productVariantsMap[variant.product_id] = [];
					}
					productVariantsMap[variant.product_id].push(variant);
				}
				console.log(`✅ ${data.length} variantes cargadas y agrupadas para ${Object.keys(productVariantsMap).length} productos`);
			} else {
				console.log('🔍 No se encontraron variantes');
				productVariantsMap = {};
			}
		} catch (error) {
			console.error('❌ Error cargando variantes:', error);
			productVariantsMap = {};
		}
	}

	// Función para probar la conexión con Supabase
	async function testSupabaseConnection() {
		console.log('🔍 Probando conexión con Supabase...');
		try {
			const startTime = Date.now();
			
			// Consulta simple y rápida
			const { data, error } = await supabase
				.from('products')
				.select('id')
				.limit(1);
			
			const endTime = Date.now();
			console.log(`🔍 Conexión probada en ${endTime - startTime}ms`);
			
			if (error) {
				console.error('❌ Error en conexión:', error);
				return false;
			}
			
			console.log('✅ Conexión con Supabase exitosa');
			return true;
		} catch (error) {
			console.error('❌ Error crítico de conexión:', error);
			return false;
		}
	}

	async function loadCategories() {
		console.log('🔍 Cargando categorías...');
		try {
			const { data } = await supabase.from('categories').select('id, name, parent_id, is_active').eq('is_active', true);
			if (data) {
				categories = data.sort((a, b) => a.name.localeCompare(b.name, 'es', { sensitivity: 'base' }));
				buildCategoryHierarchy();
				console.log(`✅ ${data.length} categorías cargadas`);
			}
		} catch (error) {
			console.error('❌ Error cargando categorías:', error);
			categories = [];
		}
	}

	function buildCategoryHierarchy() {
		categoryHierarchy = {};
		categories.forEach(cat => {
			if (cat.parent_id) {
				const parent = categories.find(c => c.id === cat.parent_id);
				if (parent) {
					categoryHierarchy[cat.id] = `${parent.name} → ${cat.name}`;
				}
			} else {
				categoryHierarchy[cat.id] = cat.name;
			}
		});
	}

	async function loadDiscounts() {
		const { data } = await supabase
			.from('discounts')
			.select('id, name, discount_type, discount_value, is_active')
			.eq('is_active', true)
			.order('name');

		if (data) {
			discounts = data;
		}
	}

	async function loadTags() {
		const { data } = await supabase.from('tags').select('id, name').order('name');

		if (data) {
			allTags = data;
		}
	}

	async function loadShippingTypes() {
		const { data, error } = await (supabase as any)
			.from('shipping_types')
			.select('id, name, description, carrier, service, base_price, estimated_days, is_active')
			.eq('is_active', true)
			.order('display_order', { ascending: true });

		if (error) {
			console.error('❌ Error cargando tipos de envío:', error);
			shippingTypes = [];
			return;
		}

		shippingTypes = data || [];
	}

	// Función para sugerir clave SAT basada en la categoría del producto
	function getSuggestedSatCode(categoryId: number | null): string {
		if (!categoryId) return '';
		
		const category = categories.find(c => c.id === categoryId);
		if (!category || !category.slug) return '';
		
		return satClavesCategoria[category.slug] || '';
	}

	async function openModal(product?: Product) {
		console.log('🔍 openModal llamado con:', product ? 'producto existente' : 'nuevo producto');
		activeTab = 'general';
		if (product) {
			console.log('🔍 Datos del producto:', {
				name: product.name,
				description: product.description,
				short_description: product.short_description
			});
			
			editingProduct = product;
			formData = {
				name: product.name,
				slug: product.slug,
				description: product.description || '',
				short_description: product.short_description || '',
				base_price: product.base_price,
				cost: (product as any).cost ?? 0,
				category_id: product.category_id || '',
				is_active: product.is_active,
				is_featured: product.is_featured || false,
				stock_quantity: product.stock_quantity || 0,
				sku: product.sku || '',
				shipping_type_id: (product as any).shipping_type_id || '',
				technical_sheet_url: product.technical_sheet_url || '',
				manual_pdf_url: product.manual_pdf_url || ''
			};
			
			console.log('🔍 formData después de cargar:', {
				description: formData.description,
				short_description: formData.short_description
			});
			
			// Limpiar imágenes antes de cargar nuevas para evitar problemas de estado
			productImages = [];
			
			// Cargar todas las funciones de forma paralela, pero asegurar que las imágenes se carguen correctamente
			await Promise.all([
				loadProductSpecifications(product.id),
				loadProductDiscounts(product.id),
				loadProductTags(product.id),
				loadProductShippingTypes(product.id),
				loadProductImages(product.id),
				loadProductVariants(product.id),
				loadSatData(product.id),
				loadAmazonData(product.id),
				loadMercadolibreData(product.id)
			]);
		} else {
			editingProduct = null;
			formData = {
				name: '',
				slug: '',
				description: '',
				short_description: '',
				base_price: 0,
				cost: 0,
				category_id: '',
				is_active: true,
				is_featured: false,
				stock_quantity: 0,
				sku: '',
				shipping_type_id: '',
				technical_sheet_url: '',
				manual_pdf_url: ''
			};
			specifications = [];
			selectedDiscounts = [];
			selectedTags = [];
			selectedShippingTypeIds = [];
			productImages = [];
			variants = [];
			resetPimData();
		}
		newSpec = { key: '', value: '', data_type: 'text' };
		newVariant = {
			name: '',
			sku: '',
			price: 0,
			stock_quantity: 0,
			is_active: true,
			color: '',
			color_hex: '',
			grosor: '',
			tamano: ''
		};
		newTagName = '';
		selectedFiles = [];
		imagePreviews = [];
		showModal = true;
	}

	async function duplicateProduct(product: Product) {
		activeTab = 'general';
		editingProduct = null; // Importante: null para crear uno nuevo
		
		// Copiar todos los datos del producto original
		formData = {
			name: `${product.name} (Copia)`,
			slug: '', // Se auto-generará en handleNameChange
			description: product.description || '',
			short_description: product.short_description || '',
			base_price: product.base_price,
			cost: (product as any).cost ?? 0,
			category_id: product.category_id || '',
			is_active: product.is_active,
			is_featured: false, // No destacar la copia por defecto
			stock_quantity: product.stock_quantity,
			sku: product.sku ? `${product.sku}-COPIA` : '',
			shipping_type_id: (product as any).shipping_type_id || '',
			technical_sheet_url: product.technical_sheet_url || '',
			manual_pdf_url: product.manual_pdf_url || ''
		};
		
		// Cargar especificaciones del producto original
		await loadProductSpecifications(product.id);
		
		// Cargar descuentos del producto original
		await loadProductDiscounts(product.id);
		
		// Cargar etiquetas del producto original
		await loadProductTags(product.id);

		// Cargar tipos de envío del producto original
		await loadProductShippingTypes(product.id);
		
		// Cargar variantes del producto original (sin IDs para crear nuevas)
		await loadProductVariants(product.id);
		variants = variants.map(v => ({
			...v,
			id: undefined, // Remover ID para crear nuevas variantes
			sku: v.sku ? `${v.sku}-COPIA` : ''
		}));
		
		// Cargar datos PIM del producto original
		await loadSatData(product.id);
		await loadAmazonData(product.id);
		await loadMercadolibreData(product.id);
		
		// NO copiar imágenes automáticamente (el usuario puede subirlas)
		productImages = [];
		
		newSpec = { key: '', value: '', data_type: 'text' };
		newVariant = {
			name: '',
			sku: '',
			price: 0,
			stock_quantity: 0,
			is_active: true,
			color: '',
			color_hex: '',
			grosor: '',
			tamano: ''
		};
		newTagName = '';
		selectedFiles = [];
		imagePreviews = [];
		showModal = true;
	}

	async function loadProductShippingTypes(productId: string) {
		const { data, error } = await (supabase as any)
			.from('product_shipping_types')
			.select('shipping_type_id')
			.eq('product_id', productId);

		if (error) {
			console.error('❌ Error cargando tipos de envío del producto:', error);
			selectedShippingTypeIds = [];
			return;
		}

		if (data && data.length > 0) {
			selectedShippingTypeIds = data.map((row: any) => row.shipping_type_id);
		} else {
			const fallbackId = (editingProduct as any)?.shipping_type_id || '';
			selectedShippingTypeIds = fallbackId ? [fallbackId] : [];
		}

		if (!formData.shipping_type_id && selectedShippingTypeIds.length > 0) {
			formData.shipping_type_id = selectedShippingTypeIds[0];
		}
	}

	async function loadProductDiscounts(productId: string) {
		const { data } = await supabase
			.from('product_discounts')
			.select('discount_id')
			.eq('product_id', productId);

		if (data) {
			selectedDiscounts = data.map(d => d.discount_id);
		}
	}

	async function loadProductTags(productId: string) {
		const { data } = await supabase
			.from('product_tags')
			.select('tag_id')
			.eq('product_id', productId);

		if (data) {
			selectedTags = data.map(t => t.tag_id);
		}
	}

	async function loadProductImages(productId: string) {
		const { data, error } = await supabase
			.from('product_media')
			.select('*')
			.eq('product_id', productId)
			.order('is_primary', { ascending: false })
			.order('display_order', { ascending: true });

		if (error) {
			console.error('Error cargando imágenes:', error);
			productImages = [];
			return;
		}

		if (data) {
			// Ordenar manualmente para asegurar orden correcto
			const sortedData = [...data].sort((a, b) => {
				// Primero por is_primary (true primero)
				if (a.is_primary !== b.is_primary) {
					return (b.is_primary ? 1 : 0) - (a.is_primary ? 1 : 0);
				}
				// Luego por display_order
				const orderA = a.display_order ?? 9999;
				const orderB = b.display_order ?? 9999;
				return orderA - orderB;
			});
			
			// Forzar reactividad en Svelte 5
			productImages = sortedData;
		} else {
			productImages = [];
		}
	}

	async function loadProductVariants(productId: string) {
		const { data } = await supabase
			.from('product_variants')
			.select('*')
			.eq('product_id', productId)
			.order('created_at');

		if (data) {
			variants = data.map((v: ProductVariant) => {
				const attributes = (v as any)?.attributes && typeof (v as any).attributes === 'object'
					? ((v as any).attributes as Record<string, any>)
					: {};
				return {
				id: v.id,
				name: v.name || '',
				sku: v.sku || '',
				price: v.price || 0,
				stock_quantity: v.stock_quantity || 0,
				is_active: v.is_active ?? true,
				color: attributes.color || '',
				color_hex: attributes.color_hex || '',
				grosor: attributes.grosor || '',
				tamano: attributes.tamano || ''
			};
			});
		}
	}

	async function loadSatData(productId: string) {
		const { data } = await supabase
			.from('sat_product_info')
			.select('*')
			.eq('product_id', productId)
			.single();

		if (data) {
			satData = {
				clave_prod_serv: data.clave_prod_serv || getSuggestedSatCode(formData.category_id),
				clave_unidad: data.clave_unidad || 'H87',
				unidad_medida: data.unidad_medida || 'Pieza',
				material_peligroso: data.material_peligroso || false
			};
		} else {
			// Si no hay datos SAT previos, auto-sugerir basándose en categoría
			satData = {
				clave_prod_serv: getSuggestedSatCode(formData.category_id),
				clave_unidad: 'H87',
				unidad_medida: 'Pieza',
				material_peligroso: false
			};
		}
	}

	async function loadAmazonData(productId: string) {
		const { data } = await supabase
			.from('amazon_listings')
			.select('*')
			.eq('product_id', productId)
			.single();

		if (data) {
			const bulletPoints = Array.isArray(data.bullet_points) 
				? data.bullet_points 
				: (data.bullet_points as any)?.points || ['', '', '', '', ''];
			
			amazonData = {
				sku_amazon: data.sku_amazon || formData.sku || '',
				asin: data.asin || '',
				feed_product_type: data.feed_product_type || '',
				browse_node_path: data.browse_node_path || '',
				price: data.price || formData.base_price || 0,
				bullet_points: [...bulletPoints, '', '', '', '', ''].slice(0, 5),
				specific_attributes: (data.specific_attributes as Record<string, string>) || {}
			};
			amazonAttributesJson = JSON.stringify(amazonData.specific_attributes, null, 2);
		} else {
			// Si no hay datos de Amazon previos, usar el SKU del producto por defecto
			amazonData = {
				sku_amazon: formData.sku || '',
				asin: '',
				feed_product_type: '',
				browse_node_path: '',
				price: formData.base_price || 0,
				bullet_points: ['', '', '', '', ''],
				specific_attributes: {}
			};
			amazonAttributesJson = '{}';
		}
	}

	async function loadMercadolibreData(productId: string) {
		const { data } = await supabase
			.from('mercadolibre_listings')
			.select('*')
			.eq('product_id', productId)
			.single();

		if (data) {
			mercadolibreData = {
				ml_id: data.ml_id || '',
				listing_type: data.listing_type || 'gold_special',
				price: data.price || formData.base_price || 0,
				attributes: (data.attributes as Record<string, string>) || {}
			};
			mercadolibreAttributesJson = JSON.stringify(mercadolibreData.attributes, null, 2);
		} else {
			mercadolibreData = {
				ml_id: '',
				listing_type: 'gold_special',
				price: formData.base_price || 0,
				attributes: {}
			};
			mercadolibreAttributesJson = '{}';
		}
	}

	function resetPimData() {
		satData = {
			clave_prod_serv: getSuggestedSatCode(formData.category_id),
			clave_unidad: 'H87',
			unidad_medida: 'Pieza',
			material_peligroso: false
		};
		amazonData = {
			sku_amazon: formData.sku || '',
			asin: '',
			feed_product_type: '',
			browse_node_path: '',
			price: formData.base_price || 0,
			bullet_points: ['', '', '', '', ''],
			specific_attributes: {}
		};
		mercadolibreData = {
			ml_id: '',
			listing_type: 'gold_special',
			price: formData.base_price || 0,
			attributes: {}
		};
		amazonAttributesJson = '{}';
		mercadolibreAttributesJson = '{}';
	}

	function handleImageSelect(event: Event) {
		const input = event.target as HTMLInputElement;
		if (input.files) {
			const files = Array.from(input.files);
			
			// Validar cada archivo
			const validFiles: File[] = [];
			const validPreviews: string[] = [];
			
			for (const file of files) {
				// Validar tipo
				const validTypes = ['image/jpeg', 'image/jpg', 'image/png', 'image/webp', 'image/gif'];
				if (!validTypes.includes(file.type)) {
					alert(`El archivo ${file.name} no es una imagen válida (JPG, PNG, WEBP o GIF)`);
					continue;
				}
				
				// Validar tamaño (max 5MB)
				if (file.size > 5 * 1024 * 1024) {
					alert(`El archivo ${file.name} supera los 5MB`);
					continue;
				}
				
				validFiles.push(file);
				
				// Crear preview
				const reader = new FileReader();
				reader.onload = (e) => {
					validPreviews.push(e.target?.result as string);
					if (validPreviews.length === validFiles.length) {
						imagePreviews = [...imagePreviews, ...validPreviews];
					}
				};
				reader.readAsDataURL(file);
			}
			
			selectedFiles = [...selectedFiles, ...validFiles];
		}
	}

	function addVariant() {
		if (!newVariant.name.trim() || !newVariant.sku.trim()) {
			alert('La variante requiere Nombre y SKU');
			return;
		}

		variants = [...variants, { ...newVariant }];
		newVariant = {
			name: '',
			sku: '',
			price: 0,
			stock_quantity: 0,
			is_active: true,
			color: '',
			color_hex: '',
			grosor: '',
			tamano: ''
		};
	}

	function removeVariant(index: number) {
		variants = variants.filter((_, i) => i !== index);
	}

	async function uploadProductImages(productId: string): Promise<boolean> {
		if (selectedFiles.length === 0) return true;
		
		uploadingImages = true;
		try {
			const uploadPromises = selectedFiles.map(async (file, index) => {
				// Generar nombre único
				const timestamp = Date.now();
				const randomStr = Math.random().toString(36).substring(7);
				const fileExt = file.name.split('.').pop();
				const fileName = `products/${formData.slug || 'product'}-${timestamp}-${randomStr}.${fileExt}`;
				
				// Subir archivo
				const { data, error } = await supabase.storage
					.from('product-images')
					.upload(fileName, file, {
						cacheControl: '3600',
						upsert: false
					});
				
				if (error) throw error;
				
				// Obtener URL pública
				const publicUrl = getProductImageUrl(fileName);
				
				// Guardar en product_media
				const displayOrder = productImages.length + index;
				// La primera imagen subida será principal si no hay otras imágenes principales
				const isPrimary = productImages.length === 0 && index === 0;
				
				const { error: mediaError } = await supabase
					.from('product_media')
					.insert({
						product_id: productId,
						url: publicUrl,
						media_type: 'image',
						is_primary: isPrimary,
						display_order: displayOrder
					});
				
				if (mediaError) throw mediaError;
			});
			
			await Promise.all(uploadPromises);
			return true;
		} catch (error: any) {
			console.error('Error uploading images:', error);
			alert('Error al subir imágenes: ' + error.message);
			return false;
		} finally {
			uploadingImages = false;
		}
	}

	async function removeProductImage(imageId: string, imageUrl: string) {
		if (!confirm('¿Estás seguro de eliminar esta imagen?')) return;
		
		try {
			// Extraer el path del archivo de la URL
			const urlParts = imageUrl.split('/product-images/');
			if (urlParts.length === 2) {
				const filePath = urlParts[1];
				
				// Eliminar del storage
				const { error: storageError } = await supabase.storage
					.from('product-images')
					.remove([filePath]);
				
				if (storageError) console.error('Error deleting from storage:', storageError);
			}
			
			// Eliminar de la base de datos
			const { error } = await supabase
				.from('product_media')
				.delete()
				.eq('id', imageId);
			
			if (error) throw error;
			
			productImages = productImages.filter(img => img.id !== imageId);
		} catch (error: any) {
			alert('Error al eliminar imagen: ' + error.message);
		}
	}

	async function setPrimaryImage(imageId: string) {
		if (!editingProduct) {
			alert('No hay producto seleccionado');
			return;
		}
		
		try {
			// Verificar que la imagen existe y pertenece al producto
			const { data: imageCheck, error: checkError } = await supabase
				.from('product_media')
				.select('id, product_id, is_primary')
				.eq('id', imageId)
				.single();
			
			if (checkError || !imageCheck) {
				console.error('Error verificando imagen:', checkError);
				throw new Error('Imagen no encontrada: ' + (checkError?.message || 'No existe'));
			}
			
			if (imageCheck.product_id !== editingProduct.id) {
				throw new Error('La imagen no pertenece a este producto');
			}
			
			// Si ya es principal, no hacer nada
			if (imageCheck.is_primary) {
				return;
			}
			
			// Primero, quitar primary de todas las imágenes del producto
			const { error: resetError } = await supabase
				.from('product_media')
				.update({ is_primary: false })
				.eq('product_id', editingProduct.id);
			
			if (resetError) {
				console.error('Error quitando primary de otras:', resetError);
				throw resetError;
			}
			
			// Luego, establecer la imagen seleccionada como principal
			const { error: updateError, data: updateData } = await supabase
				.from('product_media')
				.update({ is_primary: true })
				.eq('id', imageId)
				.select();
			
			if (updateError) {
				console.error('Error estableciendo primary:', updateError);
				throw updateError;
			}
			
			if (!updateData || updateData.length === 0) {
				throw new Error('No se pudo actualizar la imagen. Verifica que la imagen existe y que tienes permisos.');
			}
			
			// Actualizar el estado local inmediatamente para feedback visual
			productImages = productImages.map(img => ({
				...img,
				is_primary: img.id === imageId
			}));
			
			// Recargar desde la base de datos para asegurar consistencia
			await loadProductImages(editingProduct.id);
			
		} catch (error: any) {
			console.error('Error al establecer imagen principal:', error);
			alert('Error al establecer imagen principal: ' + error.message);
			// Recargar imágenes para mantener consistencia
			if (editingProduct) {
				await loadProductImages(editingProduct.id);
			}
		}
	}

	function removePreviewImage(index: number) {
		selectedFiles = selectedFiles.filter((_, i) => i !== index);
		imagePreviews = imagePreviews.filter((_, i) => i !== index);
	}

	async function loadProductSpecifications(productId: string) {
		const { data } = await supabase
			.from('product_specifications')
			.select('*')
			.eq('product_id', productId);

		if (data) {
			specifications = data;
		}
	}

	async function addSpecification() {
		if (!newSpec.key || !newSpec.value) {
			alert('Por favor completa clave y valor de la especificación');
			return;
		}

		if (!editingProduct) {
			alert('Primero debes crear el producto');
			return;
		}

		try {
			const { data, error } = await supabase
				.from('product_specifications')
				.insert([
					{
						product_id: editingProduct.id,
						specification_key: newSpec.key,
						specification_value: newSpec.value,
						data_type: newSpec.data_type
					}
				])
				.select();

			if (error) throw error;

			if (data) {
				specifications = [...specifications, ...data];
				newSpec = { key: '', value: '', data_type: 'text' };
			}
		} catch (error: any) {
			alert('Error al agregar especificación: ' + error.message);
		}
	}

	async function removeSpecification(specId: string) {
		try {
			const { error } = await supabase
				.from('product_specifications')
				.delete()
				.eq('id', specId);

			if (error) throw error;

			specifications = specifications.filter(s => s.id !== specId);
		} catch (error: any) {
			alert('Error al eliminar especificación: ' + error.message);
		}
	}

	function closeModal() {
		showModal = false;
		editingProduct = null;
		selectedFiles = [];
		imagePreviews = [];
		productImages = [];
	}

	function updateSlug() {
		if (formData.name && !editingProduct) {
			formData.slug = generateSlug(formData.name);
		}
	}

	async function saveProduct() {
		console.log('🔍 saveProduct() iniciado');
		const formDataSnapshot = $state.snapshot(formData);
		console.log('🔍 formData completo:', formDataSnapshot);
		console.log('🔍 Campos de descripción:', {
			description: formDataSnapshot.description,
			short_description: formDataSnapshot.short_description
		});
		console.log('🔍 editingProduct:', $state.snapshot(editingProduct));
		
		try {
			let productId: string;

			if (editingProduct) {
				console.log('🔍 Actualizando producto existente...');
				// Usar snapshot para evitar problemas con proxies
				const formDataSnapshot = $state.snapshot(formData);
				const { error } = await supabase
					.from('products')
					.update(formDataSnapshot as any)
					.eq('id', editingProduct.id);

				if (error) {
					console.error('❌ Error de Supabase:', error);
					throw error;
				}
				productId = editingProduct.id;
				console.log('✅ Producto actualizado:', productId);
			} else {
				console.log('🔍 Creando nuevo producto...');
				const { data, error } = await supabase
					.from('products')
					.insert([formData as any])
					.select();

				if (error) throw error;
				if (!data || data.length === 0) throw new Error('No se pudo crear el producto');
				productId = data[0].id;
				console.log('✅ Producto creado:', productId);
			}

			// Subir imágenes nuevas
			if (selectedFiles.length > 0) {
				console.log('🔍 Subiendo imágenes...');
				const uploadSuccess = await uploadProductImages(productId);
				if (!uploadSuccess) {
					alert('El producto se guardó pero hubo errores al subir algunas imágenes');
				}
				// Recargar imágenes después de subir nuevas para asegurar orden correcto
				if (editingProduct) {
					await loadProductImages(productId);
				}
			}

			// Guardar descuentos
			console.log('🔍 Guardando descuentos...');
			await saveProductDiscounts(productId);

			// Guardar etiquetas
			console.log('🔍 Guardando etiquetas...');
			await saveProductTags(productId);

			// Guardar tipos de envío compatibles
			console.log('🔍 Guardando tipos de envío...');
			await saveProductShippingTypes(productId);

			// Guardar variantes
			console.log('🔍 Guardando variantes...');
			await saveProductVariants(productId);

			// Guardar datos PIM
			console.log('🔍 Guardando datos PIM...');
			await saveSatData(productId);
			await saveAmazonData(productId);
			await saveMercadolibreData(productId);

			console.log('🔍 Cerrando modal y recargando...');
			closeModal();
			await loadProducts();
			await loadAllProductVariants();
			console.log('✅ Proceso completado');
		} catch (error: any) {
			console.error('❌ Error en saveProduct:', error);
			alert('Error al guardar producto: ' + error.message);
		}
	}

	async function saveProductShippingTypes(productId: string) {
		try {
			await (supabase as any).from('product_shipping_types').delete().eq('product_id', productId);

			if (selectedShippingTypeIds.length > 0) {
				const rows = selectedShippingTypeIds.map((shippingTypeId) => ({
					product_id: productId,
					shipping_type_id: shippingTypeId
				}));

				const { error } = await (supabase as any).from('product_shipping_types').insert(rows);
				if (error) throw error;

				// Keep compatibility with existing single-column usage (first selection)
				await (supabase as any)
					.from('products')
					.update({ shipping_type_id: selectedShippingTypeIds[0] })
					.eq('id', productId);
			} else {
				await (supabase as any)
					.from('products')
					.update({ shipping_type_id: null })
					.eq('id', productId);
			}
		} catch (error) {
			console.error('❌ Error guardando tipos de envío del producto:', error);
			throw error;
		}
	}

	async function saveProductDiscounts(productId: string) {
		console.log('🔍 saveProductDiscounts iniciado');
		try {
			// Eliminar descuentos existentes con timeout
			const deletePromise = supabase.from('product_discounts').delete().eq('product_id', productId);
			await Promise.race([deletePromise, new Promise((_, reject) => {
				setTimeout(() => reject(new Error('Timeout eliminando descuentos')), 5000);
			})]);

			// Agregar nuevos descuentos seleccionados
			if (selectedDiscounts.length > 0) {
				const discountInserts = selectedDiscounts.map(discountId => ({
					product_id: productId,
					discount_id: discountId
				}));

				const insertPromise = supabase.from('product_discounts').insert(discountInserts);
				await Promise.race([insertPromise, new Promise((_, reject) => {
				setTimeout(() => reject(new Error('Timeout insertando descuentos')), 5000);
			})]);
			}
			console.log('✅ Descuentos guardados');
		} catch (error) {
			console.error('❌ Error en saveProductDiscounts:', error);
			throw error;
		}
	}

	async function saveProductTags(productId: string) {
		console.log('🔍 saveProductTags iniciado');
		try {
			// Eliminar tags existentes con timeout
			const deletePromise = supabase.from('product_tags').delete().eq('product_id', productId);
			await Promise.race([deletePromise, new Promise((_, reject) => {
				setTimeout(() => reject(new Error('Timeout eliminando tags')), 5000);
			})]);

			// Agregar nuevas tags seleccionadas
			if (selectedTags.length > 0) {
				const tagInserts = selectedTags.map(tagId => ({
					product_id: productId,
					tag_id: tagId
				}));

				const insertPromise = supabase.from('product_tags').insert(tagInserts);
				await Promise.race([insertPromise, new Promise((_, reject) => {
				setTimeout(() => reject(new Error('Timeout insertando tags')), 5000);
			})]);
			}
			console.log('✅ Tags guardados');
		} catch (error) {
			console.error('❌ Error en saveProductTags:', error);
			throw error;
		}
	}

	async function saveProductVariants(productId: string) {
		console.log('🔍 saveProductVariants iniciado');
		try {
			// Reemplaza todas las variantes actuales por las definidas en la UI
			const deletePromise = supabase.from('product_variants').delete().eq('product_id', productId);
			await Promise.race([deletePromise, new Promise((_, reject) => {
				setTimeout(() => reject(new Error('Timeout eliminando variantes')), 5000);
			})]);

			if (variants.length === 0) {
				console.log('🔍 No hay variantes que guardar');
				return;
			}

			const inserts = variants.map(v => {
				const attributes = {
					color: v.color?.trim() || undefined,
					color_hex: v.color_hex?.trim() || undefined,
					grosor: v.grosor?.trim() || undefined,
					tamano: v.tamano?.trim() || undefined
				};
				const hasAttributes = Object.values(attributes).some(Boolean);
				return {
					product_id: productId,
					name: v.name,
					sku: v.sku,
					price: v.price,
					stock_quantity: v.stock_quantity,
					is_active: v.is_active,
					attributes: hasAttributes ? attributes : null
				};
			});

			const insertPromise = supabase.from('product_variants').insert(inserts);
			await Promise.race([insertPromise, new Promise((_, reject) => {
				setTimeout(() => reject(new Error('Timeout insertando variantes')), 5000);
			})]);
			console.log('✅ Variantes guardadas');
		} catch (error) {
			console.error('❌ Error en saveProductVariants:', error);
			throw error;
		}
	}

	async function saveSatData(productId: string) {
		// Solo guardar si hay datos completos (todos los campos requeridos)
		if (!satData.clave_prod_serv || !satData.clave_unidad || !satData.unidad_medida) {
			console.log('❌ SAT: Faltan campos requeridos', {
				clave_prod_serv: satData.clave_prod_serv,
				clave_unidad: satData.clave_unidad,
				unidad_medida: satData.unidad_medida
			});
			return;
		}

		// Validar que clave_prod_serv tenga exactamente 8 caracteres
		if (satData.clave_prod_serv.length !== 8) {
			alert(`Error SAT: La clave de producto debe tener exactamente 8 dígitos. Actualmente tiene ${satData.clave_prod_serv.length} caracteres.`);
			return;
		}

		// Verificar si ya existe
		const { data: existing } = await supabase
			.from('sat_product_info')
			.select('id')
			.eq('product_id', productId)
			.single();

		const satPayload = {
			product_id: productId,
			clave_prod_serv: satData.clave_prod_serv.trim(),
			clave_unidad: satData.clave_unidad.trim(),
			unidad_medida: satData.unidad_medida.trim(),
			material_peligroso: satData.material_peligroso
		};

		console.log('📤 Guardando datos SAT:', satPayload);

		if (existing) {
			// Actualizar
			const { error } = await supabase
				.from('sat_product_info')
				.update(satPayload)
				.eq('product_id', productId);
			
			if (error) {
				console.error('❌ Error actualizando SAT:', error);
				alert('Error al actualizar información SAT: ' + error.message);
			} else {
				console.log('✅ SAT actualizado correctamente');
			}
		} else {
			// Insertar
			const { error } = await supabase
				.from('sat_product_info')
				.insert([satPayload]);
			
			if (error) {
				console.error('❌ Error insertando SAT:', error);
				alert('Error al guardar información SAT: ' + error.message);
			} else {
				console.log('✅ SAT insertado correctamente');
			}
		}
	}

	async function saveAmazonData(productId: string) {
		// Solo guardar si hay datos
		if (!amazonData.sku_amazon && !amazonData.asin && !amazonData.feed_product_type) {
			return;
		}

		// Parsear attributes del JSON
		try {
			amazonData.specific_attributes = JSON.parse(amazonAttributesJson || '{}');
		} catch (e) {
			amazonData.specific_attributes = {};
		}

		// Verificar si ya existe
		const { data: existing } = await supabase
			.from('amazon_listings')
			.select('id')
			.eq('product_id', productId)
			.single();

		// Filtrar bullet points vacíos
		const bulletPoints = amazonData.bullet_points.filter(bp => bp.trim() !== '');

		const amazonPayload = {
			product_id: productId,
			sku_amazon: amazonData.sku_amazon || null,
			asin: amazonData.asin || null,
			feed_product_type: amazonData.feed_product_type || null,
			browse_node_path: amazonData.browse_node_path || null,
			price: amazonData.price || null,
			bullet_points: bulletPoints.length > 0 ? bulletPoints : null,
			specific_attributes: Object.keys(amazonData.specific_attributes).length > 0 
				? amazonData.specific_attributes 
				: null
		};

		if (existing) {
			// Actualizar
			await supabase
				.from('amazon_listings')
				.update(amazonPayload)
				.eq('product_id', productId);
		} else {
			// Insertar
			await supabase
				.from('amazon_listings')
				.insert([amazonPayload]);
		}
	}

	async function saveMercadolibreData(productId: string) {
		// Solo guardar si hay datos
		if (!mercadolibreData.ml_id && !mercadolibreData.listing_type) {
			return;
		}

		// Parsear attributes del JSON
		try {
			mercadolibreData.attributes = JSON.parse(mercadolibreAttributesJson || '{}');
		} catch (e) {
			mercadolibreData.attributes = {};
		}

		// Verificar si ya existe
		const { data: existing } = await supabase
			.from('mercadolibre_listings')
			.select('id')
			.eq('product_id', productId)
			.single();

		const mlPayload = {
			product_id: productId,
			ml_id: mercadolibreData.ml_id || null,
			listing_type: mercadolibreData.listing_type || 'gold_special',
			price: mercadolibreData.price || null,
			attributes: Object.keys(mercadolibreData.attributes).length > 0 
				? mercadolibreData.attributes 
				: null
		};

		if (existing) {
			// Actualizar
			await supabase
				.from('mercadolibre_listings')
				.update(mlPayload)
				.eq('product_id', productId);
		} else {
			// Insertar
			await supabase
				.from('mercadolibre_listings')
				.insert([mlPayload]);
		}
	}

	async function createNewTag() {
		if (!newTagName.trim()) {
			alert('Por favor ingresa un nombre para la etiqueta');
			return;
		}

		try {
			const slug = generateSlug(newTagName);
			const { data, error } = await supabase
				.from('tags')
				.insert([{ name: newTagName, slug }])
				.select();

			if (error) throw error;

			if (data && data.length > 0) {
				allTags = [...allTags, data[0]];
				selectedTags = [...selectedTags, data[0].id];
				newTagName = '';
			}
		} catch (error: any) {
			alert('Error al crear etiqueta: ' + error.message);
		}
	}

	async function deleteProduct(id: string) {
		if (!confirm('¿Estás seguro de eliminar este producto?')) return;

		try {
			const { error } = await supabase.from('products').delete().eq('id', id);

			if (error) throw error;

			await loadProducts();
			await loadAllProductVariants();
		} catch (error: any) {
			alert('Error al eliminar producto: ' + error.message);
		}
	}
</script>

<svelte:head>
	<title>Gestión de Productos - Admin</title>
</svelte:head>

<div class="container mx-auto px-4 py-8">
	<div class="flex justify-between items-center mb-8">
		<h1 class="text-4xl font-bold">Gestión de Productos</h1>
		<div class="flex gap-4">
			<a
				href="/admin"
				class="px-6 py-2 bg-gray-500 text-white rounded-lg hover:bg-gray-600 transition"
			>
				← Volver
			</a>
			<a
				href="/admin/productos/editar-precios"
				class="px-6 py-2 bg-purple-600 text-white rounded-lg hover:bg-purple-700 transition flex items-center gap-2"
			>
				<svg class="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
					<path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 8c-1.657 0-3 .895-3 2s1.343 2 3 2 3 .895 3 2-1.343 2-3 2m0-8c1.11 0 2.08.402 2.599 1M12 8V7m0 1v8m0 0v1m0-1c-1.11 0-2.08-.402-2.599-1M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
				</svg>
				Editar Precios y Stock
			</a>
			<a
				href="/admin/importar"
				class="px-6 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 transition flex items-center gap-2"
			>
				<svg class="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
					<path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M7 16a4 4 0 01-.88-7.903A5 5 0 1115.9 6L16 6a5 5 0 011 9.9M9 13h6m-3-3v6m5 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
				</svg>
				Importar Excel
			</a>
			<button
				onclick={() => openModal()}
				class="px-6 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition"
			>
				+ Nuevo Producto
			</button>
		</div>
	</div>

	<!-- Filtros y búsqueda -->
	{#if !loading && products.length > 0}
		<div class="bg-white rounded-lg shadow-md p-4 mb-6">
			<div class="grid grid-cols-1 md:grid-cols-3 gap-4">
				<!-- Búsqueda -->
				<div class="md:col-span-2">
					<label class="block text-sm font-medium mb-2" for="product-search">Buscar por nombre o SKU</label>
					<input
						id="product-search"
						type="text"
						bind:value={searchQuery}
						placeholder="Escribe para buscar..."
						class="w-full px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
					/>
				</div>

				<!-- Filtro por categoría -->
				<div>
					<label class="block text-sm font-medium mb-2" for="product-category-filter">Filtrar por categoría</label>
					<select
						id="product-category-filter"
						bind:value={selectedCategoryFilter}
						class="w-full px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
					>
						<option value="">Todas las categorías</option>
						{#each sortedCategories as category}
							<option value={category.id}>
								{categoryHierarchy[category.id] || category.name}
							</option>
						{/each}
					</select>
				</div>
			</div>

			<!-- Resultados y items por página -->
			<div class="flex justify-between items-center mt-4 pt-4 border-t">
				<p class="text-sm text-gray-600">
					Mostrando {paginatedProducts.length} de {filteredProducts.length} productos
					{#if searchQuery || selectedCategoryFilter}
						<button
							onclick={() => { searchQuery = ''; selectedCategoryFilter = ''; }}
							class="ml-2 text-blue-600 hover:underline"
						>
							Limpiar filtros
						</button>
					{/if}
				</p>
				<div class="flex items-center gap-2">
					<label class="text-sm text-gray-600" for="items-per-page">Items por página:</label>
					<select
						id="items-per-page"
						bind:value={itemsPerPage}
						class="px-3 py-1 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
					>
						<option value={10}>10</option>
						<option value={20}>20</option>
						<option value={50}>50</option>
						<option value={100}>100</option>
					</select>
				</div>
			</div>
		</div>
	{/if}

	{#if loading}
		<div class="text-center py-12">
			<p class="text-xl text-gray-600">Cargando productos...</p>
		</div>
	{:else if products.length === 0}
		<div class="bg-gray-50 rounded-lg p-8 text-center">
			<p class="text-xl text-gray-600 mb-4">No hay productos registrados</p>
			<button
				onclick={() => openModal()}
				class="px-6 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition"
			>
				Crear Primer Producto
			</button>
		</div>
	{:else if filteredProducts.length === 0}
		<div class="bg-gray-50 rounded-lg p-8 text-center">
			<p class="text-xl text-gray-600 mb-4">No se encontraron productos con los filtros aplicados</p>
			<button
				onclick={() => { searchQuery = ''; selectedCategoryFilter = ''; }}
				class="px-6 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition"
			>
				Limpiar filtros
			</button>
		</div>
	{:else}
		<div class="bg-white rounded-lg shadow-md overflow-hidden">
			<table class="w-full">
				<thead class="bg-gray-100">
					<tr>
						<th class="px-4 py-3 text-left">Producto</th>
						<th class="px-4 py-3 text-left">SKU</th>
						<th class="px-4 py-3 text-left">Precio</th>
						<th class="px-4 py-3 text-left">Stock</th>
						<th class="px-4 py-3 text-left">Variantes</th>
						<th class="px-4 py-3 text-right">Acciones</th>
					</tr>
				</thead>
				<tbody>
					{#each paginatedProducts as product}
						{@const displayPrice = getDisplayPrice({ ...product, product_variants: productVariantsMap[product.id] || [] })}
						{@const displayStock = getDisplayStock({ ...product, product_variants: productVariantsMap[product.id] || [] })}
						<tr class="border-t hover:bg-gray-50">
							<td class="px-4 py-3">
								<div>
									<p class="font-semibold">{product.name}</p>
									<p class="text-sm text-gray-600">{product.slug}</p>
								</div>
							</td>
							<td class="px-4 py-3 text-sm">{product.sku || '-'}</td>
							<td class="px-4 py-3">
								{formatPrice(displayPrice.price)}
							</td>
							<td class="px-4 py-3">
								{displayStock}
								{#if productVariantsMap[product.id] && productVariantsMap[product.id].length > 0}
									<span class="text-xs text-gray-500">(suma)</span>
								{/if}
							</td>
							<td class="px-4 py-3">
								{#if productVariantsMap[product.id] && productVariantsMap[product.id].length > 0}
									<div class="flex flex-wrap gap-1">
										{#each productVariantsMap[product.id] as variant}
											<span class="inline-block px-2 py-1 text-xs bg-blue-100 text-blue-800 rounded">
												{variant.name || variant.sku}
											</span>
										{/each}
									</div>
								{:else}
									<span class="text-xs text-gray-400">Sin variantes</span>
								{/if}
							</td>
							<td class="px-4 py-3 text-right">
								<button
									onclick={() => openModal(product)}
									class="text-blue-600 hover:text-blue-800 mr-3"
									title="Editar producto"
								>
									Editar
								</button>
								<button
									onclick={() => duplicateProduct(product)}
									class="text-green-600 hover:text-green-800 mr-3"
									title="Duplicar producto"
								>
									📋 Duplicar
								</button>
								<a
									href="/admin/productos/{product.id}/especificaciones"
									class="text-purple-600 hover:text-purple-800 mr-3"
								>
									Specs
								</a>
								<button
									onclick={() => deleteProduct(product.id)}
									class="text-red-600 hover:text-red-800"
								>
									Eliminar
								</button>
							</td>
						</tr>
					{/each}
				</tbody>
			</table>

			<!-- Paginación -->
			{#if totalPages > 1}
				<div class="px-4 py-4 border-t bg-gray-50 flex justify-between items-center">
					<div class="text-sm text-gray-600">
						Página {currentPage} de {totalPages}
					</div>
					<div class="flex gap-2">
						<button
							onclick={() => currentPage = 1}
							disabled={currentPage === 1}
							class="px-3 py-1 border rounded-lg hover:bg-gray-100 disabled:opacity-50 disabled:cursor-not-allowed"
						>
							«
						</button>
						<button
							onclick={() => currentPage = currentPage - 1}
							disabled={currentPage === 1}
							class="px-3 py-1 border rounded-lg hover:bg-gray-100 disabled:opacity-50 disabled:cursor-not-allowed"
						>
							‹ Anterior
						</button>
						
						<!-- Números de página -->
						{#each Array.from({ length: Math.min(5, totalPages) }, (_, i) => {
							const startPage = Math.max(1, Math.min(currentPage - 2, totalPages - 4));
							return startPage + i;
						}) as pageNum}
							<button
								onclick={() => currentPage = pageNum}
								class="px-3 py-1 border rounded-lg hover:bg-gray-100 {currentPage === pageNum ? 'bg-blue-600 text-white hover:bg-blue-700' : ''}"
							>
								{pageNum}
							</button>
						{/each}

						<button
							onclick={() => currentPage = currentPage + 1}
							disabled={currentPage === totalPages}
							class="px-3 py-1 border rounded-lg hover:bg-gray-100 disabled:opacity-50 disabled:cursor-not-allowed"
						>
							Siguiente ›
						</button>
						<button
							onclick={() => currentPage = totalPages}
							disabled={currentPage === totalPages}
							class="px-3 py-1 border rounded-lg hover:bg-gray-100 disabled:opacity-50 disabled:cursor-not-allowed"
						>
							»
						</button>
					</div>
				</div>
			{/if}
		</div>
	{/if}
</div>

<!-- Modal -->
{#if showModal}
	<div class="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
		<div class="bg-white rounded-lg max-w-4xl w-full max-h-[90vh] flex flex-col">
			<!-- Header -->
			<div class="sticky top-0 bg-white border-b px-6 py-4 flex justify-between items-center rounded-t-lg">
				<h2 class="text-2xl font-bold">
					{#if editingProduct}
						Editar Producto
					{:else if formData.name.includes('(Copia)')}
						📋 Duplicar Producto
					{:else}
						Nuevo Producto
					{/if}
				</h2>
				<button onclick={closeModal} class="text-gray-500 hover:text-gray-700 text-2xl">
					×
				</button>
			</div>

			<!-- Tabs -->
			<div class="border-b bg-gray-50">
				<div class="flex px-6">
					<button
						type="button"
						onclick={() => activeTab = 'general'}
						class="px-6 py-3 font-medium text-sm border-b-2 transition {activeTab === 'general' ? 'border-blue-600 text-blue-600' : 'border-transparent text-gray-600 hover:text-gray-800'}"
					>
						📦 General
					</button>
					<button
						type="button"
						onclick={() => activeTab = 'variants'}
						class="px-6 py-3 font-medium text-sm border-b-2 transition {activeTab === 'variants' ? 'border-blue-600 text-blue-600' : 'border-transparent text-gray-600 hover:text-gray-800'}"
					>
						🔧 Variantes
						{#if variants.length > 0}
							<span class="ml-1 bg-blue-100 text-blue-700 px-2 py-0.5 rounded-full text-xs">{variants.length}</span>
						{/if}
					</button>
					<button
						type="button"
						onclick={() => activeTab = 'specs'}
						class="px-6 py-3 font-medium text-sm border-b-2 transition {activeTab === 'specs' ? 'border-blue-600 text-blue-600' : 'border-transparent text-gray-600 hover:text-gray-800'}"
					>
						📋 Especificaciones
						{#if specifications.length > 0}
							<span class="ml-1 bg-blue-100 text-blue-700 px-2 py-0.5 rounded-full text-xs">{specifications.length}</span>
						{/if}
					</button>
					<button
						type="button"
						onclick={() => activeTab = 'sat'}
						class="px-6 py-3 font-medium text-sm border-b-2 transition {activeTab === 'sat' ? 'border-blue-600 text-blue-600' : 'border-transparent text-gray-600 hover:text-gray-800'}"
					>
						🇲🇽 SAT
					</button>
					<button
						type="button"
						onclick={() => activeTab = 'amazon'}
						class="px-6 py-3 font-medium text-sm border-b-2 transition {activeTab === 'amazon' ? 'border-blue-600 text-blue-600' : 'border-transparent text-gray-600 hover:text-gray-800'}"
					>
						📦 Amazon
					</button>
					<button
						type="button"
						onclick={() => activeTab = 'mercadolibre'}
						class="px-6 py-3 font-medium text-sm border-b-2 transition {activeTab === 'mercadolibre' ? 'border-blue-600 text-blue-600' : 'border-transparent text-gray-600 hover:text-gray-800'}"
					>
						💛 Mercado Libre
					</button>
				</div>
			</div>

			<!-- Tab Content -->
			<form onsubmit={(e) => { 
		console.log('🔍 Formulario enviado'); 
		e.preventDefault(); 
		saveProduct(); 
	}} class="flex-1 overflow-y-auto">
				<div class="p-6">
					{#if !editingProduct && formData.name.includes('(Copia)')}
						<!-- Aviso de duplicación -->
						<div class="mb-6 bg-blue-50 border border-blue-200 rounded-lg p-4">
							<div class="flex items-start gap-3">
								<span class="text-2xl">📋</span>
								<div class="flex-1">
									<h3 class="font-bold text-blue-900 mb-1">Duplicando Producto</h3>
									<p class="text-sm text-blue-800">
										Se han copiado todos los datos del producto original. Recuerda modificar:
									</p>
									<ul class="text-sm text-blue-700 mt-2 space-y-1 list-disc list-inside">
										<li>El <strong>Nombre</strong> del producto</li>
										<li>El <strong>SKU</strong> (ya se agregó "-COPIA" automáticamente)</li>
										<li>El <strong>Slug</strong> (se generará automáticamente al cambiar el nombre)</li>
										<li>Las <strong>imágenes</strong> (no se copian automáticamente)</li>
									</ul>
								</div>
							</div>
						</div>
					{/if}
					
					{#if activeTab === 'general'}
						<!-- PESTAÑA GENERAL -->
						<div class="space-y-4">
							<div>
								<label class="block text-sm font-semibold mb-2" for="product-name">Nombre *</label>
								<input
									id="product-name"
									type="text"
									bind:value={formData.name}
									onblur={updateSlug}
									required
									class="w-full px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
								/>
							</div>

							<div>
								<label class="block text-sm font-semibold mb-2" for="product-slug">Slug *</label>
								<input
									id="product-slug"
									type="text"
									bind:value={formData.slug}
									required
									class="w-full px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
								/>
							</div>

							<div>
								<label class="block text-sm font-semibold mb-2" for="product-short-description">Descripción Corta</label>
								<textarea
									id="product-short-description"
									bind:value={formData.short_description}
									rows="3"
									class="w-full px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
								></textarea>
								<p class="text-xs text-gray-500 mt-1">Soporta saltos de línea y markdown básico (**negrita**, listas con -).</p>
							</div>

							<div>
								<label class="block text-sm font-semibold mb-2" for="product-description">Descripción</label>
								<textarea
									id="product-description"
									bind:value={formData.description}
									rows="8"
									class="w-full px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
								></textarea>
								<p class="text-xs text-gray-500 mt-1">Soporta saltos de línea y markdown básico (**negrita**, listas con -, ## títulos).</p>
							</div>

							<div class="border border-gray-200 rounded-lg p-4 bg-gray-50">
								<p class="block text-sm font-semibold mb-3">Archivos PDF (Opcional)</p>
								<div class="grid grid-cols-1 md:grid-cols-2 gap-4">
									<div>
										<label class="block text-sm font-medium mb-2" for="product-technical-sheet">Ficha técnica (URL)</label>
										<input
											id="product-technical-sheet"
											type="url"
											placeholder="https://.../ficha-tecnica.pdf"
											bind:value={formData.technical_sheet_url}
											class="w-full px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
										/>
									</div>

									<div>
										<label class="block text-sm font-medium mb-2" for="product-manual-pdf">Manual (URL)</label>
										<input
											id="product-manual-pdf"
											type="url"
											placeholder="https://.../manual.pdf"
											bind:value={formData.manual_pdf_url}
											class="w-full px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
										/>
									</div>
								</div>
								<p class="text-xs text-gray-500 mt-2">Estos enlaces se mostrarán como descargables en el detalle del producto.</p>
							</div>

							<div class="grid grid-cols-3 gap-4">
								<div>
									<label class="block text-sm font-semibold mb-2" for="product-base-price">Precio Base *</label>
									<input
										id="product-base-price"
										type="number"
										bind:value={formData.base_price}
										step="0.01"
										min="0"
										required
										class="w-full px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
									/>
								</div>

								<div>
									<label class="block text-sm font-semibold mb-2" for="product-cost">Costo USD</label>
									<input
										id="product-cost"
										type="number"
										bind:value={formData.cost}
										step="0.01"
										min="0"
										class="w-full px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
									/>
								</div>

								<div>
									<label class="block text-sm font-semibold mb-2" for="product-stock">Stock</label>
									<input
										id="product-stock"
										type="number"
										bind:value={formData.stock_quantity}
										min="0"
										class="w-full px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
									/>
								</div>
							</div>

							<div class="grid grid-cols-2 gap-4">
								<div>
									<label class="block text-sm font-semibold mb-2" for="product-category">Categoría</label>
									<select
										id="product-category"
										bind:value={formData.category_id}
										class="w-full px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
									>
										<option value="">Sin categoría</option>
										{#each sortedCategoryHierarchy as [id, label]}
											<option value={id}>{label}</option>
										{/each}
									</select>
								</div>

								<div>
									<label class="block text-sm font-semibold mb-2" for="product-sku">SKU</label>
									<input
										id="product-sku"
										type="text"
										bind:value={formData.sku}
										class="w-full px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
									/>
								</div>
							</div>

							<div>
								<p class="block text-sm font-semibold mb-2">Tipos de envío compatibles</p>
								<div class="border border-gray-300 rounded-lg p-3 space-y-2 max-h-48 overflow-y-auto">
									{#if shippingTypes.length === 0}
										<p class="text-sm text-gray-500">No hay tipos de envío activos.</p>
									{:else}
										{#each shippingTypes as shippingType}
											<label class="flex items-start gap-2 py-1">
												<input
													type="checkbox"
													checked={selectedShippingTypeIds.includes(shippingType.id)}
													onchange={(e) => {
														if (e.currentTarget.checked) {
															selectedShippingTypeIds = [...selectedShippingTypeIds, shippingType.id];
														} else {
															selectedShippingTypeIds = selectedShippingTypeIds.filter((id) => id !== shippingType.id);
														}

														formData.shipping_type_id = selectedShippingTypeIds[0] || '';
													}}
													class="w-4 h-4 mt-0.5"
												/>
												<span class="text-sm">
													<strong>{shippingType.name}</strong> — {formatPrice(shippingType.base_price)}
													{#if shippingType.description}
														<span class="text-gray-600"> · {shippingType.description}</span>
													{/if}
												</span>
											</label>
										{/each}
									{/if}
								</div>
								<p class="text-xs text-gray-500 mt-1">
									Puedes seleccionar varios tipos. En checkout se mostrarán solo los compatibles.
									Si no seleccionas ninguno, se intentará usar FedEx Standard por defecto.
								</p>
							</div>

							<!-- Descuentos -->
							<div>
								<p class="block text-sm font-semibold mb-2">Descuentos Aplicables</p>
								<div class="border border-gray-300 rounded-lg p-3 max-h-40 overflow-y-auto">
									{#if discounts.length === 0}
										<p class="text-sm text-gray-500">No hay descuentos disponibles</p>
									{:else}
										{#each discounts as discount}
											<label class="flex items-center gap-2 py-1">
												<input
													type="checkbox"
													value={discount.id}
													checked={selectedDiscounts.includes(discount.id)}
													onchange={(e) => {
														if (e.currentTarget.checked) {
															selectedDiscounts = [...selectedDiscounts, discount.id];
														} else {
															selectedDiscounts = selectedDiscounts.filter(d => d !== discount.id);
														}
													}}
													class="w-4 h-4"
												/>
												<span class="text-sm">
													{discount.name} ({discount.discount_type === 'percentage' ? discount.discount_value + '%' : '$' + discount.discount_value})
												</span>
											</label>
										{/each}
									{/if}
								</div>
							</div>

							<!-- Etiquetas -->
							<div>
								<p class="block text-sm font-semibold mb-2">Etiquetas</p>
								<div class="border border-gray-300 rounded-lg p-3">
									<div class="flex flex-wrap gap-2 mb-3">
										{#if selectedTags.length === 0}
											<p class="text-sm text-gray-500">Sin etiquetas</p>
										{:else}
											{#each selectedTags as tagId}
												{@const tag = allTags.find(t => t.id === tagId)}
												{#if tag}
													<span class="bg-blue-100 text-blue-800 px-3 py-1 rounded-full text-sm flex items-center gap-1">
														{tag.name}
														<button
															type="button"
															onclick={() => {
																selectedTags = selectedTags.filter(t => t !== tagId);
															}}
															class="hover:text-blue-900"
														>
															✕
														</button>
													</span>
												{/if}
											{/each}
										{/if}
									</div>

									<div class="border-t pt-3">
										<p class="text-xs font-semibold mb-2">Seleccionar etiquetas:</p>
										<div class="flex flex-wrap gap-2 mb-3 max-h-32 overflow-y-auto">
											{#each allTags.filter(t => !selectedTags.includes(t.id)) as tag}
												<button
													type="button"
													onclick={() => {
														selectedTags = [...selectedTags, tag.id];
													}}
													class="bg-gray-100 text-gray-700 px-3 py-1 rounded-full text-sm hover:bg-gray-200"
												>
													+ {tag.name}
												</button>
											{/each}
										</div>

										<div class="flex gap-2">
											<input
												type="text"
												bind:value={newTagName}
												placeholder="Nueva etiqueta..."
												class="flex-1 px-3 py-1 border border-gray-300 rounded text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
											/>
											<button
												type="button"
												onclick={createNewTag}
												class="bg-green-600 text-white px-4 py-1 rounded text-sm hover:bg-green-700"
											>
												Crear
											</button>
										</div>
									</div>
								</div>
							</div>

							<!-- Gestión de Imágenes -->
							<div class="border-t pt-4">
								<p class="block text-sm font-semibold mb-3">Imágenes del Producto</p>
								
								<!-- Imágenes existentes (para productos editándose) -->
								{#if editingProduct && productImages.length > 0}
									<div class="mb-4">
										<p class="text-sm text-gray-600 mb-2">Imágenes actuales:</p>
										<div class="grid grid-cols-3 gap-3">
											{#each productImages as image}
												<div class="relative group">
													<img 
														src={image.url} 
														alt="Imagen del producto" 
														class="w-full h-32 object-cover rounded-lg border-2 {image.is_primary ? 'border-blue-500' : 'border-gray-300'}"
													/>
													{#if image.is_primary}
														<span class="absolute top-1 left-1 bg-blue-500 text-white text-xs px-2 py-1 rounded">
															Principal
														</span>
													{:else}
														<button
															type="button"
															onclick={() => setPrimaryImage(image.id)}
															class="absolute top-1 left-1 bg-gray-800 bg-opacity-75 text-white text-xs px-2 py-1 rounded opacity-0 group-hover:opacity-100 transition"
														>
															Hacer Principal
														</button>
													{/if}
													<button
														type="button"
														onclick={() => removeProductImage(image.id, image.url)}
														class="absolute top-1 right-1 bg-red-600 text-white w-6 h-6 rounded-full opacity-0 group-hover:opacity-100 transition flex items-center justify-center"
													>
														×
													</button>
												</div>
											{/each}
										</div>
									</div>
								{/if}
								
								<!-- Preview de nuevas imágenes -->
								{#if imagePreviews.length > 0}
									<div class="mb-4">
										<p class="text-sm text-gray-600 mb-2">Nuevas imágenes a subir:</p>
										<div class="grid grid-cols-3 gap-3">
											{#each imagePreviews as preview, index}
												<div class="relative group">
													<img 
														src={preview} 
														alt="Preview" 
														class="w-full h-32 object-cover rounded-lg border-2 border-green-300"
													/>
													<span class="absolute top-1 left-1 bg-green-500 text-white text-xs px-2 py-1 rounded">
														Nueva
													</span>
													<button
														type="button"
														onclick={() => removePreviewImage(index)}
														class="absolute top-1 right-1 bg-red-600 text-white w-6 h-6 rounded-full opacity-0 group-hover:opacity-100 transition flex items-center justify-center"
													>
														×
													</button>
												</div>
											{/each}
										</div>
									</div>
								{/if}
								
								<!-- Input para agregar más imágenes -->
								<div class="border-2 border-dashed border-gray-300 rounded-lg p-4 hover:border-blue-500 transition">
									<input
										type="file"
										accept="image/jpeg,image/jpg,image/png,image/webp,image/gif"
										multiple
										onchange={handleImageSelect}
										class="w-full text-sm text-gray-500 file:mr-4 file:py-2 file:px-4 file:rounded-lg file:border-0 file:text-sm file:font-semibold file:bg-blue-50 file:text-blue-700 hover:file:bg-blue-100"
									/>
									<p class="text-xs text-gray-500 mt-2">
										Puedes seleccionar múltiples imágenes. Formatos: JPG, PNG, WEBP, GIF. Máx: 5MB cada una.
									</p>
									{#if productImages.length === 0 && imagePreviews.length === 0}
										<p class="text-xs text-orange-600 mt-1">
											⚠️ La primera imagen será la imagen principal del producto
										</p>
									{/if}
								</div>
							</div>

							<div class="flex gap-4">
								<label class="flex items-center gap-2">
									<input type="checkbox" bind:checked={formData.is_active} class="w-4 h-4" />
									<span class="text-sm">Producto Activo</span>
								</label>

								<label class="flex items-center gap-2">
									<input type="checkbox" bind:checked={formData.is_featured} class="w-4 h-4" />
									<span class="text-sm">Producto Destacado</span>
								</label>
							</div>
						</div>

					{:else if activeTab === 'variants'}
						<!-- PESTAÑA VARIANTES -->
						<div class="space-y-4">
							<div class="flex items-center justify-between">
								<div>
									<h3 class="text-lg font-semibold">Variantes del Producto</h3>
									<p class="text-sm text-gray-600">Ej: tallas, colores, potencias</p>
									{#if editingProduct && !isAcrylicSheetProduct}
										<p class="text-xs text-amber-700 mt-1 max-w-xl">
											Las columnas Color / HEX / Grosor / Tamaño y la herramienta <strong>Duplicar color</strong> solo
											aparecen en láminas de acrílico: agrega la especificación
											<code class="bg-amber-100 px-1 rounded">tipo_producto</code> =
											<code class="bg-amber-100 px-1 rounded">acrilico</code> en la pestaña Especificaciones.
										</p>
									{/if}
								</div>
							</div>

							{#if variants.length > 0}
								<div class="overflow-x-auto border border-gray-200 rounded-lg">
									<table class="min-w-full text-sm">
										<thead class="bg-gray-50 text-gray-700 uppercase text-xs">
											<tr>
												<th class="px-4 py-3 text-left">Nombre</th>
												<th class="px-4 py-3 text-left">SKU</th>
												{#if isAcrylicSheetProduct}
													<th class="px-4 py-3 text-left">Color</th>
													<th class="px-4 py-3 text-left">Color HEX</th>
													<th class="px-4 py-3 text-left">Grosor</th>
													<th class="px-4 py-3 text-left">Tamaño</th>
												{/if}
												<th class="px-4 py-3 text-left">Precio</th>
												<th class="px-4 py-3 text-left">Stock</th>
												<th class="px-4 py-3 text-left">Activo</th>
												<th class="px-4 py-3"></th>
											</tr>
										</thead>
										<tbody class="divide-y divide-gray-100">
											{#each variants as variant, idx}
												<tr class="hover:bg-gray-50">
													<td class="px-4 py-3">
														<input
															type="text"
															bind:value={variant.name}
															placeholder="Nombre"
															class="w-full px-2 py-1 border border-gray-300 rounded"
														/>
													</td>
													<td class="px-4 py-3">
														<input
															type="text"
															bind:value={variant.sku}
															placeholder="SKU"
															class="w-full px-2 py-1 border border-gray-300 rounded font-mono text-xs"
														/>
													</td>
													{#if isAcrylicSheetProduct}
														<td class="px-4 py-3">
															<input
																type="text"
																bind:value={variant.color}
																placeholder="Ej: verde"
																class="w-full px-2 py-1 border border-gray-300 rounded"
															/>
														</td>
														<td class="px-4 py-3">
															<input
																type="text"
																bind:value={variant.color_hex}
																placeholder="#22c55e"
																class="w-full px-2 py-1 border border-gray-300 rounded font-mono text-xs"
															/>
														</td>
														<td class="px-4 py-3">
															<input
																type="text"
																bind:value={variant.grosor}
																placeholder="Ej: 3mm"
																class="w-full px-2 py-1 border border-gray-300 rounded"
															/>
														</td>
														<td class="px-4 py-3">
															<input
																type="text"
																bind:value={variant.tamano}
																placeholder="Ej: 60x90"
																class="w-full px-2 py-1 border border-gray-300 rounded"
															/>
														</td>
													{/if}
													<td class="px-4 py-3">
														<input
															type="number"
															min="0"
															step="0.01"
															bind:value={variant.price}
															class="w-full px-2 py-1 border border-gray-300 rounded"
														/>
													</td>
													<td class="px-4 py-3">
														<input
															type="number"
															min="0"
															bind:value={variant.stock_quantity}
															class="w-full px-2 py-1 border border-gray-300 rounded"
														/>
													</td>
													<td class="px-4 py-3">
														<label class="inline-flex items-center gap-2">
															<input type="checkbox" bind:checked={variant.is_active} class="w-4 h-4" />
															<span class="text-xs text-gray-600">Activo</span>
														</label>
													</td>
													<td class="px-4 py-3 text-right">
														<button
															type="button"
															onclick={() => removeVariant(idx)}
															class="text-red-600 hover:text-red-800 text-sm font-medium"
														>
															Eliminar
														</button>
													</td>
												</tr>
											{/each}
										</tbody>
									</table>
								</div>
							{:else}
								<div class="text-center py-8 bg-gray-50 rounded-lg border-2 border-dashed border-gray-300">
									<p class="text-gray-500 mb-2">No hay variantes agregadas</p>
									<p class="text-sm text-gray-400">Usa el formulario abajo para agregar variantes</p>
								</div>
							{/if}

							{#if isAcrylicSheetProduct && variants.length > 0}
								<div class="bg-white border border-gray-200 rounded-lg p-4 space-y-4">
									<h4 class="font-semibold text-sm text-gray-800">Duplicar color</h4>
									<p class="text-xs text-gray-500">
										Copia todas las medidas del color seleccionado. Stock nuevo en 1.
									</p>

									<div class="grid grid-cols-1 md:grid-cols-4 gap-3">
										<div>
											<label class="block text-sm font-semibold mb-1" for="dup-color-from">Color base</label>
											<select
												id="dup-color-from"
												bind:value={duplicateColorFrom}
												class="w-full px-3 py-2 border border-gray-300 rounded focus:outline-none focus:ring-2 focus:ring-blue-500"
											>
												<option value="">Selecciona un color</option>
												{#each duplicateColorOptions as colorOption}
													<option value={colorOption}>{colorOption}</option>
												{/each}
											</select>
										</div>

										<div>
											<label class="block text-sm font-semibold mb-1" for="dup-color-name">Color nuevo</label>
											<input
												id="dup-color-name"
												type="text"
												bind:value={duplicateColorName}
												placeholder="Ej: Azul"
												class="w-full px-3 py-2 border border-gray-300 rounded focus:outline-none focus:ring-2 focus:ring-blue-500"
											/>
										</div>

										<div>
											<label class="block text-sm font-semibold mb-1" for="dup-color-code">Código SKU color</label>
											<input
												id="dup-color-code"
												type="text"
												bind:value={duplicateColorSkuCode}
												placeholder="Ej: AZU"
												class="w-full px-3 py-2 border border-gray-300 rounded focus:outline-none focus:ring-2 focus:ring-blue-500 font-mono text-sm"
											/>
											<p class="text-xs text-gray-500 mt-1">
												Reemplaza el 3er bloque del SKU: MAT-ACR-AAA-3MM-2030
											</p>
										</div>

										<div>
											<label class="block text-sm font-semibold mb-1" for="dup-color-hex">Color HEX</label>
											<input
												id="dup-color-hex"
												type="text"
												bind:value={duplicateColorHex}
												placeholder="#1d4ed8"
												class="w-full px-3 py-2 border border-gray-300 rounded focus:outline-none focus:ring-2 focus:ring-blue-500 font-mono text-sm"
											/>
										</div>
									</div>

									<div class="flex justify-end">
										<button
											type="button"
											onclick={duplicateColorVariants}
											class="bg-blue-600 text-white px-6 py-2 rounded-lg hover:bg-blue-700 transition font-medium"
										>
											Duplicar medidas del color
										</button>
									</div>
								</div>
							{/if}

							<div class="bg-blue-50 border border-blue-200 rounded-lg p-4 space-y-4">
								<h4 class="font-semibold text-sm text-blue-900">Agregar Nueva Variante</h4>
							
								<div class="grid grid-cols-1 md:grid-cols-2 gap-3">
									<div>
										<label class="block text-sm font-semibold mb-1" for="new-variant-name">Nombre de Variante *</label>
										<input
											id="new-variant-name"
											type="text"
											bind:value={newVariant.name}
											placeholder="Ej: 100W, Talla M, Rojo"
											class="w-full px-3 py-2 border border-gray-300 rounded focus:outline-none focus:ring-2 focus:ring-blue-500"
										/>
									</div>
									<div>
										<label class="block text-sm font-semibold mb-1" for="new-variant-sku">SKU *</label>
										<input
											id="new-variant-sku"
											type="text"
											bind:value={newVariant.sku}
											placeholder="SKU único de la variante"
											class="w-full px-3 py-2 border border-gray-300 rounded focus:outline-none focus:ring-2 focus:ring-blue-500 font-mono text-sm"
										/>
									</div>
								</div>

									{#if isAcrylicSheetProduct}
										<div class="grid grid-cols-1 md:grid-cols-4 gap-3">
											<div>
												<label class="block text-sm font-semibold mb-1" for="new-variant-color">Color</label>
												<input
													id="new-variant-color"
													type="text"
													bind:value={newVariant.color}
													placeholder="Ej: verde"
													class="w-full px-3 py-2 border border-gray-300 rounded focus:outline-none focus:ring-2 focus:ring-blue-500"
												/>
											</div>
											<div>
												<label class="block text-sm font-semibold mb-1" for="new-variant-color-hex">Color HEX</label>
												<input
													id="new-variant-color-hex"
													type="text"
													bind:value={newVariant.color_hex}
													placeholder="#22c55e"
													class="w-full px-3 py-2 border border-gray-300 rounded focus:outline-none focus:ring-2 focus:ring-blue-500 font-mono text-sm"
												/>
											</div>
											<div>
												<label class="block text-sm font-semibold mb-1" for="new-variant-grosor">Grosor</label>
												<input
													id="new-variant-grosor"
													type="text"
													bind:value={newVariant.grosor}
													placeholder="Ej: 3mm"
													class="w-full px-3 py-2 border border-gray-300 rounded focus:outline-none focus:ring-2 focus:ring-blue-500"
												/>
											</div>
											<div>
												<label class="block text-sm font-semibold mb-1" for="new-variant-tamano">Tamaño</label>
												<input
													id="new-variant-tamano"
													type="text"
													bind:value={newVariant.tamano}
													placeholder="Ej: 60x90"
													class="w-full px-3 py-2 border border-gray-300 rounded focus:outline-none focus:ring-2 focus:ring-blue-500"
												/>
											</div>
										</div>
									{/if}

								<div class="grid grid-cols-1 md:grid-cols-3 gap-3">
									<div>
										<label class="block text-sm font-semibold mb-1" for="new-variant-price">Precio</label>
										<input
											id="new-variant-price"
											type="number"
											bind:value={newVariant.price}
											min="0"
											step="0.01"
											placeholder="0.00"
											class="w-full px-3 py-2 border border-gray-300 rounded focus:outline-none focus:ring-2 focus:ring-blue-500"
										/>
									</div>
									<div>
										<label class="block text-sm font-semibold mb-1" for="new-variant-stock">Stock</label>
										<input
											id="new-variant-stock"
											type="number"
											bind:value={newVariant.stock_quantity}
											min="0"
											placeholder="0"
											class="w-full px-3 py-2 border border-gray-300 rounded focus:outline-none focus:ring-2 focus:ring-blue-500"
										/>
									</div>
									<div class="flex items-center gap-2 mt-7">
										<input type="checkbox" bind:checked={newVariant.is_active} class="w-4 h-4" />
										<span class="text-sm font-medium">Variante Activa</span>
									</div>
								</div>

								<div class="flex justify-end">
									<button
										type="button"
										onclick={addVariant}
										class="bg-green-600 text-white px-6 py-2 rounded-lg hover:bg-green-700 transition font-medium"
									>
										+ Agregar Variante
									</button>
								</div>
							</div>
						</div>

					{:else if activeTab === 'specs'}
						<!-- PESTAÑA ESPECIFICACIONES -->
						<div class="space-y-4">
							{#if editingProduct}
								<div>
									<h3 class="text-lg font-semibold mb-4">Especificaciones del Producto</h3>
									
									{#if specifications.length > 0}
										<div class="mb-4 space-y-2">
											{#each specifications as spec}
												<div class="flex items-center justify-between bg-gray-50 p-3 rounded-lg border border-gray-200">
													<div class="flex-1">
														<p class="font-medium text-sm">{spec.specification_key}</p>
														<p class="text-sm text-gray-600">{spec.specification_value} <span class="text-xs text-gray-400">({spec.data_type})</span></p>
													</div>
													<button
														type="button"
														onclick={() => removeSpecification(spec.id)}
														class="text-red-600 hover:text-red-800 ml-4 font-medium"
													>
														✕
													</button>
												</div>
											{/each}
										</div>
									{:else}
										<div class="text-center py-8 bg-gray-50 rounded-lg border-2 border-dashed border-gray-300 mb-4">
											<p class="text-gray-500 mb-2">No hay especificaciones agregadas</p>
											<p class="text-sm text-gray-400">Usa el formulario abajo para agregar especificaciones</p>
										</div>
									{/if}

									<div class="space-y-3 bg-blue-50 p-4 rounded-lg border border-blue-200">
										<h4 class="font-semibold text-sm text-blue-900">Agregar Nueva Especificación</h4>
								
										<div>
											<label class="block text-sm font-semibold mb-1" for="new-spec-key">Clave de Especificación *</label>
											<input
												id="new-spec-key"
												type="text"
												bind:value={newSpec.key}
												placeholder="Ej: Potencia, Velocidad, Voltaje"
												class="w-full px-3 py-2 border border-gray-300 rounded text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
											/>
										</div>

										<div>
											<label class="block text-sm font-semibold mb-1" for="new-spec-value">Valor *</label>
											<input
												id="new-spec-value"
												type="text"
												bind:value={newSpec.value}
												placeholder="Ej: 40W, 100mm/s, 110V"
												class="w-full px-3 py-2 border border-gray-300 rounded text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
											/>
										</div>

										<div>
											<label class="block text-sm font-semibold mb-1" for="new-spec-type">Tipo de Dato</label>
											<select
												id="new-spec-type"
												bind:value={newSpec.data_type}
												class="w-full px-3 py-2 border border-gray-300 rounded text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
											>
												<option value="text">Texto</option>
												<option value="number">Número</option>
												<option value="boolean">Sí/No</option>
												<option value="select">Seleccionar</option>
											</select>
										</div>

										<button
											type="button"
											onclick={addSpecification}
											class="w-full bg-green-600 text-white px-4 py-2 rounded-lg hover:bg-green-700 transition font-medium"
										>
											+ Agregar Especificación
										</button>
									</div>
								</div>
							{:else}
								<div class="text-center py-12 bg-yellow-50 border-2 border-yellow-200 rounded-lg">
									<div class="text-4xl mb-3">💡</div>
									<p class="text-lg font-medium text-yellow-900 mb-2">Primero crea el producto</p>
									<p class="text-sm text-yellow-700">Las especificaciones se pueden agregar después de crear el producto</p>
								</div>
							{/if}
						</div>

					{:else if activeTab === 'sat'}
						<!-- PESTAÑA SAT (Sistema de Administración Tributaria México) -->
						<div class="space-y-4">
							<div class="bg-blue-50 border border-blue-200 rounded-lg p-4 mb-4">
								<h3 class="font-bold text-blue-900 mb-1">🇲🇽 Información Fiscal SAT</h3>
								<p class="text-sm text-blue-700">
									Información requerida por el Sistema de Administración Tributaria de México para facturación electrónica.
								</p>
							</div>

							<div>
								<label class="block text-sm font-semibold mb-2" for="sat-clave-prod">Clave Producto/Servicio SAT *</label>
								<input
									id="sat-clave-prod"
									type="text"
									bind:value={satData.clave_prod_serv}
									placeholder="Ej: 43211500"
									maxlength="8"
									inputmode="numeric"
									class="w-full px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
									oninput={(e) => {
										// Solo permitir números
										const target = e.currentTarget;
										target.value = target.value.replace(/[^0-9]/g, '');
										satData.clave_prod_serv = target.value;
									}}
								/>
								<p class="text-xs text-gray-500 mt-1">
									Código de 8 dígitos del catálogo SAT
									{#if satData.clave_prod_serv && satData.clave_prod_serv.length !== 8}
										<span class="text-red-600 font-medium">⚠️ Debe tener exactamente 8 dígitos ({satData.clave_prod_serv.length}/8)</span>
									{/if}
									{#if formData.category_id}
										{@const suggestedCode = getSuggestedSatCode(formData.category_id)}
										{#if suggestedCode && suggestedCode !== satData.clave_prod_serv}
											<button 
												type="button"
												onclick={() => satData.clave_prod_serv = suggestedCode}
												class="ml-2 text-blue-600 hover:text-blue-800 font-medium"
											>
												💡 Usar sugerido: {suggestedCode}
											</button>
										{/if}
									{/if}
								</p>
							</div>

							<div>
								<label class="block text-sm font-semibold mb-2" for="sat-clave-unidad">Clave de Unidad SAT *</label>
								<select
									id="sat-clave-unidad"
									bind:value={satData.clave_unidad}
									onchange={(e) => {
										const selectedUnit = satUnidades.find(u => u.clave === e.currentTarget.value);
										if (selectedUnit) {
											satData.unidad_medida = selectedUnit.descripcion;
										}
									}}
									class="w-full px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
								>
									<option value="">Seleccionar clave...</option>
									{#each satUnidades as unidad}
										<option value={unidad.clave}>{unidad.clave} - {unidad.descripcion}</option>
									{/each}
								</select>
								<p class="text-xs text-gray-500 mt-1">
									Código de unidad de medida SAT
									{#if !satData.clave_unidad}
										<span class="text-amber-600 font-medium">⚠️ Campo requerido</span>
									{/if}
								</p>
							</div>

							<div>
								<label class="block text-sm font-semibold mb-2" for="sat-unidad-medida">Unidad de Medida *</label>
								<select
									id="sat-unidad-medida"
									bind:value={satData.unidad_medida}
									onchange={(e) => {
										const selectedDesc = e.currentTarget.value;
										const unit = satUnidades.find(u => u.descripcion === selectedDesc);
										if (unit) {
											satData.clave_unidad = unit.clave;
										}
									}}
									class="w-full px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
								>
									<option value="">Seleccionar unidad...</option>
									{#each satUnidades as unidad}
										<option value={unidad.descripcion}>{unidad.descripcion}</option>
									{/each}
								</select>
								<p class="text-xs text-gray-500 mt-1">
									Descripción de la unidad de medida
									{#if !satData.unidad_medida}
										<span class="text-amber-600 font-medium">⚠️ Campo requerido</span>
									{/if}
								</p>
							</div>

							<div class="flex items-center gap-3 bg-amber-50 border border-amber-200 rounded-lg p-4">
								<input
									id="sat-material-peligroso"
									type="checkbox"
									bind:checked={satData.material_peligroso}
									class="w-5 h-5 text-blue-600 border-gray-300 rounded focus:ring-blue-500"
								/>
								<label for="sat-material-peligroso" class="text-sm font-medium cursor-pointer">
									⚠️ Material Peligroso
									<span class="block text-xs text-gray-600 font-normal">Marcar si el producto contiene materiales peligrosos</span>
								</label>
							</div>
						</div>
					{:else if activeTab === 'amazon'}
						<!-- PESTAÑA AMAZON -->
						<div class="space-y-4">
							<div class="bg-orange-50 border border-orange-200 rounded-lg p-4 mb-4">
								<h3 class="font-bold text-orange-900 mb-1">📦 Amazon Listing</h3>
								<p class="text-sm text-orange-700">
									Información específica para el listado del producto en Amazon Marketplace.
								</p>
							</div>

							<div class="grid grid-cols-1 md:grid-cols-2 gap-4">
								<div>
									<label class="block text-sm font-semibold mb-2" for="amazon-sku">SKU Amazon</label>
									<input
										id="amazon-sku"
										type="text"
										bind:value={amazonData.sku_amazon}
										placeholder="Ej: GLT-SEN-001"
										class="w-full px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-orange-500"
									/>
									<p class="text-xs text-gray-500 mt-1">SKU específico para Amazon (sincronizado con SKU interno)</p>
								</div>

								<div>
									<label class="block text-sm font-semibold mb-2" for="amazon-asin">ASIN</label>
									<input
										id="amazon-asin"
										type="text"
										bind:value={amazonData.asin}
										placeholder="Ej: B08XYZ1234"
										maxlength="10"
										class="w-full px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-orange-500"
									/>
									<p class="text-xs text-gray-500 mt-1">Amazon Standard Identification Number</p>
								</div>
							</div>

							<div class="grid grid-cols-1 md:grid-cols-2 gap-4">
								<div>
									<label class="block text-sm font-semibold mb-2" for="amazon-price">Precio en Amazon</label>
									<div class="relative">
										<span class="absolute left-3 top-1/2 -translate-y-1/2 text-gray-500">$</span>
										<input
											id="amazon-price"
											type="number"
											bind:value={amazonData.price}
											placeholder="0.00"
											step="0.01"
											min="0"
											class="w-full pl-8 pr-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-orange-500"
										/>
									</div>
									<p class="text-xs text-gray-500 mt-1">
										Precio base: ${formData.base_price.toFixed(2)}
										{#if amazonData.price && amazonData.price !== formData.base_price}
											<span class="text-orange-600 font-medium">
												({amazonData.price > formData.base_price ? '+' : ''}{((amazonData.price - formData.base_price) / formData.base_price * 100).toFixed(1)}%)
											</span>
										{/if}
									</p>
								</div>

								<div class="bg-blue-50 border border-blue-200 rounded-lg p-3 flex items-center">
									<div class="text-xs text-blue-800">
										<p class="font-semibold mb-1">💡 Comisiones Amazon México:</p>
										<p>• Referral fee: 8-15% según categoría</p>
										<p>• Fulfillment: Variable según tamaño/peso</p>
										<p class="mt-1 text-blue-900 font-medium">Ajusta el precio para compensar comisiones</p>
									</div>
								</div>
							</div>

							<div>
								<label class="block text-sm font-semibold mb-2" for="amazon-category">Categoría Amazon (Browse Node Path) *</label>
								<select
									id="amazon-category"
									bind:value={amazonData.browse_node_path}
									onchange={(e) => {
										const selectedCategory = amazonCategories.find(c => c.path === e.currentTarget.value);
										if (selectedCategory) {
											amazonData.feed_product_type = selectedCategory.feed_type;
										}
									}}
									class="w-full px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-orange-500"
								>
									<option value="">Seleccionar categoría...</option>
									{#each amazonCategories as category}
										<option value={category.path}>{category.path}</option>
									{/each}
								</select>
								<p class="text-xs text-gray-500 mt-1">
									Categoría completa del producto en Amazon
									{#if !amazonData.browse_node_path}
										<span class="text-amber-600 font-medium">⚠️ Requerido para publicar en Amazon</span>
									{/if}
								</p>
								{#if amazonData.browse_node_path}
									{@const selectedCategory = amazonCategories.find(c => c.path === amazonData.browse_node_path)}
									{#if selectedCategory}
										<div class="mt-2 bg-blue-50 border border-blue-200 rounded p-2">
											<p class="text-xs font-medium text-blue-900">💡 Atributos comunes para esta categoría:</p>
											<p class="text-xs text-blue-700 mt-1">{selectedCategory.common_attributes.join(', ')}</p>
										</div>
									{/if}
								{/if}
							</div>

							<div>
								<label class="block text-sm font-semibold mb-2" for="amazon-feed-type">Tipo de Producto (Feed)</label>
								<select
									id="amazon-feed-type"
									bind:value={amazonData.feed_product_type}
									class="w-full px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-orange-500"
								>
									<option value="">Seleccionar tipo...</option>
									<option value="Home">Home (Hogar)</option>
									<option value="CE">Consumer Electronics (Electrónica)</option>
									<option value="Industrial">Industrial & Scientific (Industria)</option>
									<option value="Tools">Tools (Herramientas)</option>
									<option value="AutoAccessory">Auto Accessories (Accesorios Auto)</option>
									<option value="Sports">Sports (Deportes)</option>
									<option value="MusicalInstruments">Musical Instruments (Instrumentos)</option>
								</select>
								<p class="text-xs text-gray-500 mt-1">Se establece automáticamente según la categoría seleccionada</p>
							</div>

							<div>
								<label class="block text-sm font-semibold mb-2">Bullet Points (Viñetas)</label>
								<p class="text-xs text-gray-500 mb-2">Características clave del producto (máximo 5)</p>
								{#each amazonData.bullet_points as point, i}
									<input
										type="text"
										bind:value={amazonData.bullet_points[i]}
										placeholder={`Viñeta ${i + 1}`}
										class="w-full px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-orange-500 mb-2"
										maxlength="200"
									/>
								{/each}
							</div>

							<div class="bg-gray-50 border border-gray-200 rounded-lg p-4">
								<h4 class="font-semibold text-sm mb-3 flex items-center justify-between">
									<span>Atributos Específicos (JSON)</span>
									{#if amazonData.browse_node_path}
										{@const categoryKey = amazonData.browse_node_path.split('›').pop()?.trim() || ''}
										{@const template = amazonAttributeTemplates[categoryKey]}
										{#if template}
											<button
												type="button"
												onclick={() => {
													amazonAttributesJson = JSON.stringify(template, null, 2);
												}}
												class="text-xs bg-blue-500 text-white px-3 py-1 rounded hover:bg-blue-600"
											>
												💡 Usar plantilla
											</button>
										{/if}
									{/if}
								</h4>
								<p class="text-xs text-gray-500 mb-3">
									Atributos adicionales requeridos por la categoría específica de Amazon.
									{#if amazonData.browse_node_path}
										Consulta la <a href="https://sellercentral.amazon.com.mx/help/hub/reference/G1641" target="_blank" class="text-blue-600 hover:underline">guía de atributos de Amazon</a> para tu categoría.
									{/if}
								</p>
								<textarea
									bind:value={amazonAttributesJson}
									placeholder={'{"voltage": "220V", "wattage": "100W", "material_type": "Acero inoxidable"}'}
									class="w-full px-3 py-2 border border-gray-300 rounded text-sm font-mono h-32"
								></textarea>
							</div>
						</div>

					{:else if activeTab === 'mercadolibre'}
						<!-- PESTAÑA MERCADO LIBRE -->
						<div class="space-y-4">
							<div class="bg-yellow-50 border border-yellow-300 rounded-lg p-4 mb-4">
								<h3 class="font-bold text-yellow-900 mb-1">💛 Mercado Libre Listing</h3>
								<p class="text-sm text-yellow-800">
									Información específica para el listado del producto en Mercado Libre.
								</p>
							</div>

							<div class="grid grid-cols-1 md:grid-cols-2 gap-4">
								<div>
									<label class="block text-sm font-semibold mb-2" for="ml-id">ID de Mercado Libre</label>
									<input
										id="ml-id"
										type="text"
										bind:value={mercadolibreData.ml_id}
										placeholder="Ej: MLM123456789"
										class="w-full px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-yellow-500"
									/>
									<p class="text-xs text-gray-500 mt-1">ID único del listado en Mercado Libre (se genera al publicar)</p>
								</div>

								<div>
									<label class="block text-sm font-semibold mb-2" for="ml-price">Precio en Mercado Libre</label>
									<div class="relative">
										<span class="absolute left-3 top-1/2 -translate-y-1/2 text-gray-500">$</span>
										<input
											id="ml-price"
											type="number"
											bind:value={mercadolibreData.price}
											placeholder="0.00"
											step="0.01"
											min="0"
											class="w-full pl-8 pr-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-yellow-500"
										/>
									</div>
									<p class="text-xs text-gray-500 mt-1">
										Precio base: ${formData.base_price.toFixed(2)}
										{#if mercadolibreData.price && mercadolibreData.price !== formData.base_price}
											<span class="text-yellow-700 font-medium">
												({mercadolibreData.price > formData.base_price ? '+' : ''}{((mercadolibreData.price - formData.base_price) / formData.base_price * 100).toFixed(1)}%)
											</span>
										{/if}
									</p>
								</div>
							</div>

							<div>
								<label class="block text-sm font-semibold mb-2" for="ml-listing-type">Tipo de Publicación</label>
								<select
									id="ml-listing-type"
									bind:value={mercadolibreData.listing_type}
									class="w-full px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-yellow-500"
								>
									<option value="gold_special">Gold Special (Recomendado - 16% comisión)</option>
									<option value="gold_premium">Gold Premium (16% comisión)</option>
									<option value="gold_pro">Gold Pro (16% comisión)</option>
									<option value="gold">Gold (15% comisión)</option>
									<option value="silver">Silver (13% comisión)</option>
									<option value="bronze">Bronze (11% comisión)</option>
									<option value="free">Gratuita (11% comisión)</option>
								</select>
								<p class="text-xs text-gray-500 mt-1">Tipo de publicación define la visibilidad y comisiones. Ajusta el precio arriba para compensar.</p>
							</div>

							<div class="bg-gray-50 border border-gray-200 rounded-lg p-4">
								<h4 class="font-semibold text-sm mb-3">Atributos del Producto</h4>
								<p class="text-xs text-gray-500 mb-3">Atributos específicos de Mercado Libre (BRAND, MODEL, WARRANTY_TYPE, etc.)</p>
								<textarea
									bind:value={mercadolibreAttributesJson}
									placeholder={'{"BRAND": "Mi Marca", "MODEL": "2024"}'}
									class="w-full px-3 py-2 border border-gray-300 rounded text-sm font-mono h-32"
								></textarea>
								<p class="text-xs text-gray-400 mt-2">💡 Formato JSON: Usar MAYÚSCULAS para las claves según API de Mercado Libre</p>
							</div>

							<div class="bg-blue-50 border border-blue-200 rounded-lg p-3">
								<p class="text-xs text-blue-800">
									<strong>Nota:</strong> Los atributos varían según la categoría. Consulta la API de Mercado Libre para conocer los atributos requeridos de tu categoría.
								</p>
							</div>
						</div>
					{/if}
				</div>

				<!-- Footer con botones -->
				<div class="border-t bg-gray-50 px-6 py-4 flex gap-4 rounded-b-lg">
					<button
						type="button"
						onclick={() => {
							console.log('🔍 Botón crear producto clickeado');
							console.log('🔍 formData actual:', formData);
							saveProduct();
						}}
						disabled={uploadingImages}
						class="flex-1 bg-blue-600 text-white px-6 py-2 rounded-lg hover:bg-blue-700 transition disabled:bg-gray-400 disabled:cursor-not-allowed font-medium"
					>
						{uploadingImages ? 'Subiendo imágenes...' : editingProduct ? 'Actualizar' : 'Crear'} Producto
					</button>
					<button
						type="button"
						onclick={closeModal}
						disabled={uploadingImages}
						class="px-6 py-2 bg-gray-200 hover:bg-gray-300 rounded-lg transition disabled:bg-gray-100 disabled:cursor-not-allowed font-medium"
					>
						Cancelar
					</button>
				</div>
			</form>
		</div>
	</div>
{/if}