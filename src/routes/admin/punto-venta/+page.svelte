<script lang="ts">
	import { supabase } from '$lib/supabaseClient';
	import jsPDF from 'jspdf';
	import CustomerSearch from '$lib/components/customers/CustomerSearch.svelte';
	import type { Database } from '$lib/types/database.types';

	type Customer = Database['public']['Tables']['customers']['Row'];

	type Product = {
		id: string;
		sku: string | null;
		name: string;
		base_price: number | null;
		stock_quantity: number | null;
		is_active: boolean | null;
		category_id: string | null;
		product_variants?: Array<{
			id: string;
			name: string;
			sku: string | null;
			price: number | null;
			stock_quantity: number | null;
			is_active: boolean | null;
		}>;
	};

	type CandidateItem = {
		key: string; // variantId o productId
		productId: string;
		variantId: string | null;
		sku: string;
		productName: string;
		variantName: string | null;
		unitPrice: number;
		stockAvailable: number;
		categoryLevelId: string | null; // categoría (nivel 2)
		subcategoryId: string | null; // subcategoría (nivel 3) o null si el producto está en nivel 2
	};

	type CartItem = {
		lineId: string;
		productId: string;
		variantId: string | null;
		sku: string;
		productName: string;
		variantName: string | null;
		quantity: number;
		unitPrice: number;
		stockAvailable: number;
	};

	const supabaseAny: any = supabase;

	let loading = $state(true);
	let saving = $state(false);
	let products = $state<Product[]>([]);
	let candidates = $state<CandidateItem[]>([]);

	let productSearch = $state('');

	let cartItems = $state<CartItem[]>([]);

	let paymentMethod = $state<'cash' | 'card' | 'transfer'>('cash');
	let amountPaid = $state(0);
	let notes = $state('');
	let customerName = $state('PUBLICO GENERAL');
	let saleCustomerMode = $state<'public' | 'customer'>('public');
	let customerId = $state<string | null>(null);
	let showTicket = $state(false);
	let lastSaleNumber = $state<string | null>(null);
	let lastChange = $state(0);

	type SaleHistoryItem = {
		id: string;
		sale_number: string;
		payment_method: string | null;
		amount_paid: number;
		change_amount: number;
		subtotal_amount: number;
		total_amount: number;
		customer_name: string | null;
		created_at: string | null;
		status: string | null;
	};

	let salesHistory = $state<SaleHistoryItem[]>([]);
	let historyLoading = $state(false);
	let historyCancelingSaleId = $state<string | null>(null);

	let isFullscreen = $state(false);

	async function toggleFullscreen() {
		try {
			const el = typeof document !== 'undefined' ? document.getElementById('pos-fullscreen-root') : null;
			if (!el) return;

			if (!document.fullscreenElement) {
				await el.requestFullscreen();
				isFullscreen = true;
			} else {
				await document.exitFullscreen();
				isFullscreen = false;
			}
		} catch (e: any) {
			alert(e?.message || 'No se pudo activar pantalla completa.');
		}
	}

	type Category = {
		id: string;
		name: string;
		parent_id: string | null;
	};

	let categoriesLoading = $state(false);
	let categoriesLoaded = $state(false);
	let categories = $state<Category[]>([]);
	let categoryById: Record<string, Category> = {};

	let selectedCategoryId = $state<string | null>(null);
	let selectedSubcategoryId = $state<string | null>(null);

	// Si des-seleccionas categoría, también limpia subcategoría.
	$effect(() => {
		if (!selectedCategoryId) selectedSubcategoryId = null;
	});

	function categoryLevel2Options() {
		const familyIds = new Set(categories.filter((c) => c.parent_id === null).map((c) => c.id));
		return categories
			.filter((c) => c.parent_id !== null && familyIds.has(c.parent_id))
			.sort((a, b) => a.name.localeCompare(b.name));
	}

	function subcategoryOptions() {
		if (!selectedCategoryId) return [];
		return categories
			.filter((c) => c.parent_id === selectedCategoryId)
			.sort((a, b) => a.name.localeCompare(b.name));
	}

	function formatMoney(n: number) {
		return new Intl.NumberFormat('es-MX', { style: 'currency', currency: 'MXN' }).format(n);
	}

	const subtotal = $derived(cartItems.reduce((sum, it) => sum + it.quantity * it.unitPrice, 0));
	const computedChange = $derived(
		paymentMethod === 'cash' ? Math.max(amountPaid - subtotal, 0) : 0
	);

	let initDone = $state(false);

	$effect(() => {
		// Si están en efectivo, inicializa `amountPaid` con el total.
		if (paymentMethod === 'cash' && amountPaid === 0) {
			amountPaid = subtotal;
		}
	});

	$effect(() => {
		if (initDone) return;
		initDone = true;

		void (async () => {
			await loadCategories();
			await loadProducts();
		})();
	});

	$effect(() => {
		void loadSalesHistory();
	});

	async function loadCategories() {
		categoriesLoading = true;
		try {
			const { data, error } = await supabase
				.from('categories')
				.select('id, name, parent_id')
				.eq('is_active', true)
				.order('name');

			if (error) throw error;

			categories = (data ?? []) as Category[];

			categoryById = {};
			for (const c of categories) {
				categoryById[c.id] = c;
			}

			categoriesLoaded = true;
		} catch (e: any) {
			console.error('Error cargando categorías POS:', e);
			categories = [];
			categoryById = {};
			categoriesLoaded = false;
		} finally {
			categoriesLoading = false;
		}
	}

	function inferCategoryIds(categoryId: string | null) {
		if (!categoryId) return { categoryLevelId: null as string | null, subcategoryId: null as string | null };

		const cat = categoryById[categoryId];
		if (!cat) return { categoryLevelId: categoryId, subcategoryId: null };

		// Si es nivel 2 (parent es familia), entonces no hay subcategoría.
		if (cat.parent_id && categoryById[cat.parent_id]?.parent_id === null) {
			return { categoryLevelId: cat.id, subcategoryId: null };
		}

		// En caso contrario, tratamos que es subcategoría (nivel 3+).
		return { categoryLevelId: cat.parent_id, subcategoryId: cat.id };
	}

	async function loadProducts() {
		loading = true;
		const { data, error } = await supabase
			.from('products')
			.select(
				'id, sku, name, base_price, stock_quantity, category_id,' +
					' product_variants(id, name, sku, price, stock_quantity, is_active)'
			)
			.eq('is_active', true)
			.order('name');

		if (error) {
			alert('Error cargando productos: ' + (error.message || error));
			products = [];
			candidates = [];
			loading = false;
			return;
		}

		products = (data ?? []) as unknown as Product[];

		const nextCandidates: CandidateItem[] = [];
		for (const p of products) {
			const variants = (p.product_variants ?? []).filter((v) => v.is_active !== false);
			const { categoryLevelId, subcategoryId } = inferCategoryIds(p.category_id ?? null);

			if (variants.length > 0) {
				for (const v of variants) {
					const unitPrice = v.price ?? p.base_price ?? 0;
					nextCandidates.push({
						key: v.id,
						productId: p.id,
						variantId: v.id,
						sku: (v.sku || p.sku || '').trim(),
						productName: p.name,
						variantName: v.name,
						unitPrice,
						stockAvailable: v.stock_quantity ?? 0,
						categoryLevelId,
						subcategoryId
					});
				}
			} else {
				const unitPrice = p.base_price ?? 0;
				nextCandidates.push({
					key: p.id,
					productId: p.id,
					variantId: null,
					sku: (p.sku || '').trim(),
					productName: p.name,
					variantName: null,
					unitPrice,
					stockAvailable: p.stock_quantity ?? 0,
					categoryLevelId,
					subcategoryId
				});
			}
		}

		candidates = nextCandidates;
		loading = false;
	}

	function candidateDisplayName(c: CandidateItem) {
		return c.variantName ? `${c.productName} - ${c.variantName}` : c.productName;
	}

	function filteredCandidates() {
		const q = productSearch.trim().toLowerCase();
		const hasSearch = !!q;
		const hasCategoryFilter = !!selectedCategoryId || !!selectedSubcategoryId;

		// Evita mostrar una lista gigante cuando no hay filtros.
		if (!hasSearch && !hasCategoryFilter) return [];

		let list = candidates;

		if (hasSearch) {
			list = list.filter((c) => {
				const name = candidateDisplayName(c).toLowerCase();
				const sku = (c.sku || '').toLowerCase();
				return name.includes(q) || sku.includes(q);
			});
		}

		if (selectedSubcategoryId) {
			list = list.filter((c) => c.subcategoryId === selectedSubcategoryId);
		} else if (selectedCategoryId) {
			list = list.filter((c) => c.categoryLevelId === selectedCategoryId);
		}

		// Evita renderizar miles de renglones de golpe (rendimiento).
		return list.slice(0, 200);
	}

	function addToCart(c: CandidateItem) {
		// Permitir agregar aunque stock sea 0? Mejor bloquear para evitar ventas inválidas.
		if (c.stockAvailable <= 0) {
			alert('Este artículo no tiene inventario disponible.');
			return;
		}

		const existingByKey = cartItems.find((it) => it.productId === c.productId && it.variantId === c.variantId);
		if (existingByKey) {
			const nextQty = Math.min(existingByKey.quantity + 1, c.stockAvailable);
			existingByKey.quantity = nextQty;
			cartItems = [...cartItems];
			return;
		}

		cartItems = [
			...cartItems,
			{
				lineId:
					(typeof crypto !== 'undefined' && 'randomUUID' in crypto
						? crypto.randomUUID()
						: `line_${Date.now()}_${Math.floor(Math.random() * 10000)}`) as string,
				productId: c.productId,
				variantId: c.variantId,
				sku: c.sku,
				productName: c.productName,
				variantName: c.variantName,
				quantity: 1,
				unitPrice: c.unitPrice,
				stockAvailable: c.stockAvailable
			}
		];
	}

	function removeLine(lineId: string) {
		cartItems = cartItems.filter((it) => it.lineId !== lineId);
	}

	function updateQty(lineId: string, value: string) {
		const qty = Math.max(1, Math.floor(Number(value) || 1));
		cartItems = cartItems.map((it) => {
			if (it.lineId !== lineId) return it;
			const nextQty = Math.min(qty, it.stockAvailable);
			return { ...it, quantity: nextQty };
		});
	}

	function updateUnitPrice(lineId: string, value: string) {
		const unitPrice = Math.max(0, Number(value) || 0);
		cartItems = cartItems.map((it) => (it.lineId === lineId ? { ...it, unitPrice } : it));
	}

	function handleCustomerSelect(c: Customer) {
		saleCustomerMode = 'customer';
		customerId = c.id;
		customerName = c.company_name ? `${c.contact_name} - ${c.company_name}` : c.contact_name;
	}

	function setPublicCustomer() {
		saleCustomerMode = 'public';
		customerId = null;
		customerName = 'PUBLICO GENERAL';
	}

	function resetCheckout() {
		setPublicCustomer();
		notes = '';
		paymentMethod = 'cash';
		amountPaid = 0;
		lastSaleNumber = null;
		lastChange = 0;
		showTicket = false;
	}

	function buildTicketPdfData() {
		const saleNumber = lastSaleNumber ?? 'PV-XXXX';
		const now = new Date();

		return {
			saleNumber,
			dateText: now.toLocaleString('es-MX'),
			paymentMethodLabel:
				paymentMethod === 'cash' ? 'Efectivo' : paymentMethod === 'card' ? 'Tarjeta' : 'Transferencia',
			amountPaid,
			change: computedChange,
			items: cartItems.map((it) => ({
				displayName: it.variantName ? `${it.productName} - ${it.variantName}` : it.productName,
				sku: it.sku,
				quantity: it.quantity,
				unitPrice: it.unitPrice,
				lineTotal: it.quantity * it.unitPrice
			})),
			subtotal
		};
	}

	let logoDataUrl: string | null = null;

	async function loadLogoDataUrl(): Promise<string> {
		if (logoDataUrl) return logoDataUrl;
		const res = await fetch('/logorectangular.png');
		const blob = await res.blob();
		const dataUrl = await new Promise<string>((resolve, reject) => {
			const reader = new FileReader();
			reader.onloadend = () => resolve(String(reader.result));
			reader.onerror = reject;
			reader.readAsDataURL(blob);
		});
		logoDataUrl = dataUrl;
		return dataUrl;
	}

	async function generateTicketPdf() {
		const data = buildTicketPdfData();
		const logo = await loadLogoDataUrl();
		const logoW = 60;
		const ticketWidthMm = 80;

		// Doc temporal solo para medir logo y wrap de nombres (la altura real se calcula después).
		const measureDoc = new jsPDF({ unit: 'mm', format: [ticketWidthMm, 200] });
		const imgProps = (measureDoc as any).getImageProperties
			? (measureDoc as any).getImageProperties(logo)
			: null;
		const logoH =
			imgProps?.width && imgProps?.height ? (logoW * imgProps.height) / imgProps.width : 12;

		measureDoc.setFont('helvetica', 'normal');
		measureDoc.setFontSize(8);

		let contentY = 2 + logoH + 4; // título marca
		contentY += 4; // TICKET DE VENTA
		contentY += 4; // folio
		contentY += 4; // fecha
		contentY += 4; // pago
		if (customerName?.trim()) {
			const customerLines = measureDoc.splitTextToSize(`Cliente: ${customerName.trim()}`, 64);
			contentY += customerLines.length * 4;
		}
		contentY += 5; // separador

		for (const line of data.items) {
			const nameLines = measureDoc.splitTextToSize(line.displayName, 64);
			contentY += nameLines.length * 4;
			if (line.sku) contentY += 3.5;
			contentY += 5;
		}

		contentY += 2; // separador
		contentY += 4; // subtotal
		contentY += 5; // total
		contentY += paymentMethod === 'cash' ? 8 : 4; // recibido/cambio o monto
		contentY += 6; // espacio antes del footer
		contentY += 20; // gracias + url + whatsapp + margen inferior

		const heightMm = Math.max(120, Math.ceil(contentY));
		const doc = new jsPDF({ unit: 'mm', format: [ticketWidthMm, heightMm] });

		doc.addImage(logo, 'PNG', (ticketWidthMm - logoW) / 2, 2, logoW, logoH);

		let y = 2 + logoH + 4;
		doc.setFont('helvetica', 'bold');
		doc.setFontSize(10);
		doc.text('Guerra Laser México', 40, y, { align: 'center' });

		y += 4;
		doc.setFontSize(9);
		doc.text('TICKET DE VENTA', 40, y, { align: 'center' });

		y += 4;
		doc.setFontSize(8);
		doc.setFont('helvetica', 'normal');
		doc.text(`Folio: ${data.saleNumber}`, 8, y);
		y += 4;
		doc.text(`Fecha: ${data.dateText}`, 8, y);
		y += 4;

		doc.text(`Pago: ${data.paymentMethodLabel}`, 8, y);
		y += 4;

		if (customerName?.trim()) {
			const customerLines = doc.splitTextToSize(`Cliente: ${customerName.trim()}`, 64);
			doc.text(customerLines, 8, y);
			y += customerLines.length * 4;
		}

		y += 2;
		doc.setDrawColor(180, 180, 180);
		doc.line(6, y, 74, y);
		y += 3;

		doc.setFontSize(8);
		doc.setFont('helvetica', 'normal');

		for (const line of data.items) {
			const nameLines = doc.splitTextToSize(line.displayName, 64);
			doc.text(nameLines, 8, y);
			y += nameLines.length * 4;

			if (line.sku) {
				doc.setFontSize(7);
				doc.text(`SKU: ${line.sku}`, 8, y);
				y += 3.5;
				doc.setFontSize(8);
			}

			doc.text(`${line.quantity} x ${formatMoney(line.unitPrice)}`, 8, y);
			doc.text(`${formatMoney(line.lineTotal)}`, 74, y, { align: 'right' });
			y += 5;
		}

		y += 2;
		doc.line(6, y, 74, y);
		y += 4;

		doc.setFont('helvetica', 'bold');
		doc.text(`Subtotal: ${formatMoney(data.subtotal)}`, 74, y, { align: 'right' });
		y += 5;

		doc.setFont('helvetica', 'normal');
		doc.text(`Total: ${formatMoney(data.subtotal)}`, 74, y, { align: 'right' });
		y += 4;

		if (paymentMethod === 'cash') {
			doc.text(`Recibido: ${formatMoney(amountPaid)}`, 8, y);
			y += 4;
			doc.text(`Cambio: ${formatMoney(data.change)}`, 8, y);
			y += 4;
		} else {
			doc.text(`Monto: ${formatMoney(amountPaid)}`, 8, y);
			y += 4;
		}

		y += 4;
		doc.setDrawColor(180, 180, 180);
		doc.line(6, y, 74, y);
		y += 6;

		doc.setFont('helvetica', 'bold');
		doc.setFontSize(8);
		doc.text('Gracias por su preferencia', 40, y, { align: 'center' });

		doc.setFont('helvetica', 'normal');
		doc.text('https://guerralaser.com', 40, y + 4, { align: 'center' });
		doc.text('WhatsApp 3320152372', 40, y + 8, { align: 'center' });

		return doc;
	}

	async function downloadTicketPdf() {
		const doc = await generateTicketPdf();
		doc.save(`ticket-${lastSaleNumber ?? 'PV'}.pdf`);
	}

	async function printTicketPdf() {
		const doc = await generateTicketPdf();
		const blob = doc.output('blob');
		const url = URL.createObjectURL(blob);
		const win = window.open(url, '_blank');
		if (!win) {
			alert('Por favor permite popups para imprimir.');
			return;
		}
	}

	async function finalizeSale() {
		if (cartItems.length === 0) {
			alert('Agrega al menos un artículo.');
			return;
		}

		if (saleCustomerMode === 'customer' && !customerId) {
			alert('Selecciona un cliente o cambia a Público General.');
			return;
		}

		if (paymentMethod === 'cash') {
			if (amountPaid < subtotal) {
				alert('El efectivo recibido debe ser mayor o igual al total.');
				saving = false;
				return;
			}
		} else {
			// Para tarjeta/transferencia asumimos monto = total (sin cambio).
			if (amountPaid < subtotal) {
				alert('El monto debe ser mayor o igual al total.');
				saving = false;
				return;
			}
			amountPaid = subtotal;
		}

		saving = true;
		showTicket = false;

		try {
			const now = new Date();
			const saleNumber =
				'PV-' +
				now.toISOString().slice(0, 10).replaceAll('-', '') +
				'-' +
				String(Math.floor(Math.random() * 90000) + 10000);

			const itemsPayload = cartItems.map((it) => ({
				product_id: it.productId,
				variant_id: it.variantId,
				quantity: it.quantity,
				unit_price: it.unitPrice,
				sku: it.sku,
				product_name: it.productName,
				variant_name: it.variantName
			}));

			const { data, error } = await supabaseAny.rpc('create_pos_sale', {
				p_sale_number: saleNumber,
				p_payment_method: paymentMethod,
				p_amount_paid: amountPaid,
				p_customer_id: saleCustomerMode === 'customer' ? customerId : null,
				p_customer_name: customerName || null,
				p_notes: notes || null,
				p_items: itemsPayload
			});

			if (error) throw error;

			lastSaleNumber = saleNumber;
			lastChange = computedChange;
			showTicket = true;

			// Nota: no vaciamos el carrito para que se pueda imprimir; si quieres, se hace un botón "Nueva venta".
			void loadSalesHistory();
		} catch (e: any) {
			alert(e?.message || 'Error al finalizar venta POS');
		} finally {
			saving = false;
		}
	}

	function newSale() {
		cartItems = [];
		resetCheckout();
	}

	async function loadSalesHistory() {
		historyLoading = true;
		try {
			const { data, error } = await supabaseAny
				.from('pos_sales')
				.select(
					'id, sale_number, payment_method, amount_paid, change_amount, subtotal_amount, total_amount, customer_name, created_at, status'
				)
				.order('created_at', { ascending: false })
				.limit(20);

			if (error) throw error;
			salesHistory = (data ?? []) as SaleHistoryItem[];
		} catch (e: any) {
			console.error('Error cargando historial POS:', e);
			salesHistory = [];
		} finally {
			historyLoading = false;
		}
	}

	async function cancelSaleWithPrompt(sale: SaleHistoryItem) {
		if (!sale?.id) return;
		const ok = confirm(`¿Cancelar la venta ${sale.sale_number}? Esto regresará el inventario.`);
		if (!ok) return;

		const reason = window.prompt('Motivo de cancelación (opcional):', '') || '';

		historyCancelingSaleId = sale.id;
		try {
			const { error } = await supabaseAny.rpc('cancel_pos_sale', {
				p_pos_sale_id: sale.id,
				p_reason: reason.trim() ? reason.trim() : null
			});
			if (error) throw error;

			// Si estábamos viendo el ticket actual, lo ocultamos.
			showTicket = false;
			void loadSalesHistory();
		} catch (e: any) {
			alert(e?.message || 'Error al cancelar la venta');
		} finally {
			historyCancelingSaleId = null;
		}
	}
</script>

<svelte:head>
	<title>Punto de Venta - Admin</title>
</svelte:head>

<div id="pos-fullscreen-root" class="min-h-screen bg-gray-50">
	<div class="container mx-auto px-4 py-6 max-w-7xl">
		<div class="mb-6 flex items-start justify-between gap-4">
			<div>
				<h1 class="text-3xl font-bold text-gray-900">Punto de Venta (Bodega)</h1>
				<p class="text-gray-600 mt-1">Crea una venta rápida, descuenta inventario y genera ticket para el cliente.</p>
			</div>
			<div class="flex flex-col items-end gap-2">
				<img
					src="/logorectangular.png"
					alt="Guerra Láser"
					class="h-14 w-auto object-contain mt-0"
				/>
				<button
					type="button"
					class="px-3 py-2 rounded-md border bg-white hover:bg-gray-50 text-sm"
					onclick={() => void toggleFullscreen()}
				>
					{isFullscreen ? 'Salir pantalla completa' : 'Pantalla completa'}
				</button>
			</div>
		</div>

		{#if loading}
			<div class="bg-white rounded-lg shadow p-8 text-center text-gray-600">Cargando inventario...</div>
		{:else}
			<div class="grid grid-cols-1 lg:grid-cols-3 gap-4">
				<!-- Lado izquierdo: búsqueda y agregado -->
				<div class="lg:col-span-1">
					<div class="bg-white rounded-lg shadow p-4">
						<div class="flex items-center justify-between gap-2 mb-3">
							<h2 class="font-semibold text-gray-900">Buscar artículo</h2>
							<span class="text-xs text-gray-500">{filteredCandidates().length} resultados</span>
						</div>
						<input
							type="text"
							placeholder="Nombre o SKU"
							class="w-full border rounded-md px-3 py-2"
							bind:value={productSearch}
						/>

						<div class="mt-3 grid grid-cols-1 gap-3">
							<div>
								<div class="text-xs font-medium text-gray-700 mb-1">Categoría</div>
								<select
									class="w-full border rounded-md px-3 py-2"
									disabled={!categoriesLoaded || categoriesLoading}
									value={selectedCategoryId ?? ''}
									onchange={(e) => {
										selectedCategoryId = e.currentTarget.value || null;
										selectedSubcategoryId = null;
									}}
								>
									<option value="">Todas</option>
									{#each categoryLevel2Options() as c (c.id)}
										<option value={c.id}>{c.name}</option>
									{/each}
								</select>
							</div>

							<div>
								<div class="text-xs font-medium text-gray-700 mb-1">Subcategoría</div>
								<select
									class="w-full border rounded-md px-3 py-2"
									disabled={!categoriesLoaded || categoriesLoading || !selectedCategoryId}
									value={selectedSubcategoryId ?? ''}
									onchange={(e) => {
										selectedSubcategoryId = e.currentTarget.value || null;
									}}
								>
									<option value="">Todas</option>
									{#each subcategoryOptions() as c (c.id)}
										<option value={c.id}>{c.name}</option>
									{/each}
								</select>
							</div>
						</div>

						<div class="mt-3 max-h-[520px] overflow-auto border rounded-md">
							{#if filteredCandidates().length === 0}
								<div class="p-3 text-sm text-gray-500">
									{#if productSearch.trim() || selectedCategoryId || selectedSubcategoryId}
										Sin resultados para tu búsqueda/filtro.
									{:else}
										Escribe un nombre/SKU o selecciona categoría/subcategoría para ver opciones.
									{/if}
								</div>
							{:else}
								{#each filteredCandidates() as c (c.key + (c.variantId ?? ''))}
									<button
										type="button"
										class="w-full text-left p-3 border-b hover:bg-gray-50 transition"
										onclick={() => addToCart(c)}
									>
										<div class="font-medium text-gray-900 text-sm">{candidateDisplayName(c)}</div>
										<div class="text-xs text-gray-500 mt-1">
											{c.sku ? `SKU: ${c.sku} - ` : ''}Stock: {c.stockAvailable}
										</div>
										<div class="text-xs text-gray-700 mt-1">Precio: {formatMoney(c.unitPrice)}</div>
									</button>
								{/each}
							{/if}
						</div>
					</div>
				</div>

				<!-- Centro: carrito -->
				<div class="lg:col-span-2">
					<div class="bg-white rounded-lg shadow">
						<div class="p-4 border-b">
							<h2 class="font-semibold text-gray-900">Ticket</h2>
							<p class="text-sm text-gray-600 mt-1">Modifica cantidad y precio; al finalizar se descuenta inventario.</p>
						</div>

						<div class="p-4">
							{#if cartItems.length === 0}
								<div class="text-center py-10 text-gray-500">Agrega artículos desde la búsqueda.</div>
							{:else}
								<div class="overflow-auto border rounded-lg">
									<table class="w-full text-sm">
										<thead class="bg-gray-50">
											<tr>
												<th class="text-left px-3 py-2">Artículo</th>
												<th class="text-right px-3 py-2 w-28">Cant.</th>
												<th class="text-right px-3 py-2 w-32">Precio</th>
												<th class="text-right px-3 py-2 w-32">Importe</th>
												<th class="text-center px-3 py-2 w-10"> </th>
											</tr>
										</thead>
										<tbody>
											{#each cartItems as it (it.lineId)}
												<tr class="border-t">
													<td class="px-3 py-2 align-top">
														<div class="font-medium text-gray-900">{it.variantName ? `${it.productName} - ${it.variantName}` : it.productName}</div>
														{#if it.sku}
															<div class="text-xs text-gray-500 mt-1">SKU: {it.sku}</div>
														{/if}
														<div class="text-xs text-gray-500 mt-1">Stock: {it.stockAvailable}</div>
													</td>
													<td class="px-3 py-2 align-top">
														<input
															type="number"
															min="1"
															class="w-full border rounded-md px-2 py-1 text-right"
															value={it.quantity}
															onchange={(e) => updateQty(it.lineId, e.currentTarget.value)}
														/>
													</td>
													<td class="px-3 py-2 align-top">
														<input
															type="number"
															step="0.01"
															min="0"
															class="w-full border rounded-md px-2 py-1 text-right"
															value={it.unitPrice}
															onchange={(e) => updateUnitPrice(it.lineId, e.currentTarget.value)}
														/>
													</td>
													<td class="px-3 py-2 align-top text-right font-medium">
														{formatMoney(it.quantity * it.unitPrice)}
													</td>
													<td class="px-3 py-2 text-center align-top">
														<button class="text-red-600 hover:text-red-800 text-lg" onclick={() => removeLine(it.lineId)}>
															✕
														</button>
													</td>
												</tr>
											{/each}
										</tbody>
									</table>
								</div>

								<div class="mt-4 border-t pt-4 grid grid-cols-1 md:grid-cols-2 gap-4">
									<div>
										<div class="text-sm font-medium text-gray-800">Cliente o Público</div>

										<div class="mt-2 flex gap-2 flex-wrap">
											<button
												type="button"
												class={`px-3 py-2 rounded-md border text-sm ${
													saleCustomerMode === 'public' ? 'bg-purple-50 border-purple-300' : ''
												}`}
												onclick={setPublicCustomer}
											>
												Público General
											</button>
											<button
												type="button"
												class={`px-3 py-2 rounded-md border text-sm ${
													saleCustomerMode === 'customer' ? 'bg-purple-50 border-purple-300' : ''
												}`}
												onclick={() => (saleCustomerMode = 'customer')}
											>
												Cliente existente
											</button>
										</div>

										{#if saleCustomerMode === 'customer'}
											<div class="mt-2">
												<CustomerSearch
													placeholder="🔍 Buscar cliente y asociarlo al ticket..."
													onSelect={(c) => handleCustomerSelect(c)}
												/>
												<div class="mt-2 text-xs text-gray-600">
													Asociado: <span class="font-medium text-gray-800">{customerName}</span>
												</div>
											</div>
										{:else}
											<div class="mt-2 text-xs text-gray-600">
												Asociado: <span class="font-medium text-gray-800">{customerName}</span>
											</div>
										{/if}

										<div class="mt-3">
											<div class="text-sm font-medium text-gray-800">Notas</div>
											<input
												type="text"
												placeholder="Cualquier detalle"
												class="mt-2 w-full border rounded-md px-3 py-2"
												bind:value={notes}
											/>
										</div>
									</div>

									<div>
										<div class="text-sm font-medium text-gray-800">Cobro</div>
										<div class="mt-2 flex gap-2 flex-wrap">
											<button
												type="button"
												class={`px-3 py-2 rounded-md border text-sm ${paymentMethod === 'cash' ? 'bg-purple-50 border-purple-300' : ''}`}
												onclick={() => (paymentMethod = 'cash')}
											>
												Efectivo
											</button>
											<button
												type="button"
												class={`px-3 py-2 rounded-md border text-sm ${paymentMethod === 'card' ? 'bg-purple-50 border-purple-300' : ''}`}
												onclick={() => (paymentMethod = 'card')}
											>
												Tarjeta
											</button>
											<button
												type="button"
												class={`px-3 py-2 rounded-md border text-sm ${paymentMethod === 'transfer' ? 'bg-purple-50 border-purple-300' : ''}`}
												onclick={() => (paymentMethod = 'transfer')}
											>
												Transferencia
											</button>
										</div>

										<div class="mt-3">
											<div class="text-xs text-gray-600">Total: <span class="font-semibold">{formatMoney(subtotal)}</span></div>
										</div>

										<div class="mt-2">
											<div class="text-xs text-gray-600">
												{paymentMethod === 'cash' ? 'Dinero recibido' : 'Monto'}:
											</div>
											<input
												type="number"
												step="0.01"
												min="0"
												class="mt-1 w-full border rounded-md px-3 py-2 text-right"
												bind:value={amountPaid}
												onblur={() => {
													// Evita el bloqueo mientras se teclea (ej. "1000"),
													// pero garantiza que al salir del campo el monto sea válido.
													if (paymentMethod === 'cash' && amountPaid < subtotal) {
														amountPaid = subtotal;
													}
												}}
											/>
											{#if paymentMethod === 'cash' && computedChange > 0}
												<div class="text-xs text-green-700 mt-1">
													Cambio estimado: {formatMoney(computedChange)}
												</div>
											{/if}
										</div>
									</div>
								</div>

								<div class="mt-4 sticky bottom-0 bg-white p-4 border-t rounded-b-lg">
									<div class="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
										<div class="text-sm text-gray-600">
											Total a cobrar: <span class="font-semibold text-gray-900">{formatMoney(subtotal)}</span>
										</div>
										<div class="flex gap-2 flex-wrap justify-end">
											<button
												type="button"
												class="px-4 py-2 rounded-lg border bg-white hover:bg-gray-50"
												onclick={newSale}
												disabled={saving}
											>
												Nueva venta
											</button>
											<button
												type="button"
												class="px-5 py-2 rounded-lg bg-purple-600 text-white hover:bg-purple-700 font-medium disabled:opacity-50"
												onclick={finalizeSale}
												disabled={saving || subtotal <= 0}
											>
												{#if saving}Procesando...{:else}Cobrar y Finalizar{/if}
											</button>
										</div>
									</div>
								</div>
							{/if}
						</div>
					</div>

					{#if showTicket && lastSaleNumber}
						<div class="mt-4 bg-white rounded-lg shadow p-4">
							<div class="flex items-start justify-between gap-3">
								<div>
									<div class="text-lg font-bold text-gray-900">Venta finalizada</div>
									<div class="text-sm text-gray-600 mt-1">
										Folio: <span class="font-semibold">{lastSaleNumber}</span>
									</div>
									{#if paymentMethod === 'cash'}
										<div class="text-sm text-gray-600 mt-1">
											Cambio: <span class="font-semibold">{formatMoney(lastChange)}</span>
										</div>
									{/if}
								</div>
								<div class="flex gap-2 flex-wrap justify-end">
									<button
										type="button"
										class="px-4 py-2 rounded-lg border bg-white hover:bg-gray-50"
										onclick={downloadTicketPdf}
									>
										Descargar PDF
									</button>
									<button
										type="button"
										class="px-4 py-2 rounded-lg bg-green-600 text-white hover:bg-green-700 font-medium"
										onclick={printTicketPdf}
									>
										Imprimir (80mm)
									</button>
								</div>
							</div>
							<div class="text-xs text-gray-500 mt-3">
								Recomendación: en el diálogo de impresión selecciona “Ajustar al tamaño” y/o “Sin márgenes”.
							</div>
						</div>
					{/if}

					<div class="mt-4 bg-white rounded-lg shadow">
						<div class="p-4 border-b flex items-center justify-between gap-3">
							<div>
								<div class="text-lg font-bold text-gray-900">Historial de ventas</div>
								<div class="text-sm text-gray-600 mt-1">Últimas 20 ventas POS.</div>
							</div>
							<button
								type="button"
								class="px-3 py-2 rounded-md border bg-white hover:bg-gray-50 text-sm"
								onclick={() => void loadSalesHistory()}
								disabled={historyLoading}
							>
								{#if historyLoading}Cargando...{:else}Actualizar{/if}
							</button>
						</div>

						<div class="p-4">
							{#if historyLoading}
								<div class="text-center text-gray-500 py-6">Cargando historial...</div>
							{:else if salesHistory.length === 0}
								<div class="text-center text-gray-500 py-6">No hay ventas todavía.</div>
							{:else}
								<div class="overflow-auto">
									<table class="w-full text-sm">
										<thead class="bg-gray-50">
											<tr>
												<th class="text-left px-3 py-2">Folio</th>
												<th class="text-left px-3 py-2">Cliente</th>
												<th class="text-right px-3 py-2 w-28">Total</th>
												<th class="text-left px-3 py-2">Estado</th>
												<th class="text-center px-3 py-2 w-28">Acción</th>
											</tr>
										</thead>
										<tbody>
											{#each salesHistory as sale (sale.id)}
												<tr class="border-t">
													<td class="px-3 py-2">
														<div class="font-medium text-gray-900">{sale.sale_number}</div>
														<div class="text-xs text-gray-500">
															{sale.created_at ? new Date(sale.created_at).toLocaleString('es-MX') : '-'}
														</div>
													</td>
													<td class="px-3 py-2">
														<div class="text-gray-800">{sale.customer_name || 'Público General'}</div>
													</td>
													<td class="px-3 py-2 text-right font-medium">
														{formatMoney(sale.total_amount ?? sale.subtotal_amount ?? 0)}
													</td>
													<td class="px-3 py-2">
														<span
															class={`text-xs font-medium ${
																sale.status === 'cancelled' ? 'text-red-700' : 'text-green-700'
															}`}
														>
															{sale.status === 'cancelled' ? 'Cancelada' : 'Pagada'}
														</span>
													</td>
													<td class="px-3 py-2 text-center">
														{#if sale.status !== 'cancelled'}
															<button
																type="button"
																class="px-3 py-1.5 rounded-md border border-red-200 text-red-700 hover:bg-red-50 text-xs disabled:opacity-50"
																disabled={historyCancelingSaleId === sale.id}
																onclick={() => cancelSaleWithPrompt(sale)}
															>
																{#if historyCancelingSaleId === sale.id}Cancelando...{:else}Cancelar{/if}
															</button>
														{:else}
															<span class="text-xs text-gray-400">-</span>
														{/if}
													</td>
												</tr>
											{/each}
										</tbody>
									</table>
								</div>
							{/if}
						</div>
					</div>
				</div>
			</div>
		{/if}
	</div>
</div>

