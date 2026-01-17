<script lang="ts">
	import { supabase } from '$lib/supabaseClient';
	import jsPDF from 'jspdf';

	let products = $state<any[]>([]);
	let loading = $state(true);
	let saving = $state(false);
	let sendingEmail = $state(false);
	let savedQuotationId = $state<string | null>(null);

	// Estado para cotizaciones
	type QuotationItem = {
		productId: string;
		sku: string;
		description: string;
		quantity: number;
		price: number;
		discount: number; // porcentaje por línea
	};

	let quotationItems = $state<QuotationItem[]>([]);
	let productSearch = $state('');
	let generalDiscount = $state(0); // porcentaje de descuento general

	// Datos de cliente para la cotización
	let customerName = $state('');
	let customerCompany = $state('');
	let customerRfc = $state('');
	let customerEmail = $state('');
	let customerPhone = $state('');
	let customerAddress = $state('');
	let quotationValidityDays = $state(15);
	let paymentTerms = $state('Contado');
	let notes = $state('');

	$effect(() => {
		loadProducts();
	});

	async function loadProducts() {
		loading = true;

		// Cargar productos con precio
		const { data: productsData } = await supabase
			.from('products')
			.select('id, sku, name, base_price, stock_quantity')
			.eq('is_active', true)
			.order('name');

		products = productsData || [];
		loading = false;
	}

	// --- Utilidades de cotización ---

	function filteredProductsForQuotation() {
		if (!productSearch.trim()) return products;
		const query = productSearch.toLowerCase();
		return products.filter((p) => {
			const name = (p.name || '').toLowerCase();
			const sku = (p.sku || '').toLowerCase();
			return name.includes(query) || sku.includes(query);
		});
	}

	function addProductToQuotation(product: any) {
		if (!product) return;
		const existing = quotationItems.find((item) => item.productId === product.id);
		if (existing) {
			existing.quantity += 1;
			quotationItems = [...quotationItems];
			return;
		}

		const basePrice = product.base_price || 0;
		quotationItems = [
			...quotationItems,
			{
				productId: product.id,
				sku: product.sku || '',
				description: product.name || '',
				quantity: 1,
				price: basePrice,
				discount: 0
			}
		];
	}

	function updateItemQuantity(index: number, value: string) {
		const qty = Math.max(1, Number(value) || 1);
		quotationItems[index].quantity = qty;
		quotationItems = [...quotationItems];
	}

	function updateItemPrice(index: number, value: string) {
		const price = Math.max(0, Number(value) || 0);
		quotationItems[index].price = price;
		quotationItems = [...quotationItems];
	}

	function updateItemDiscount(index: number, value: string) {
		let discount = Number(value) || 0;
		if (discount < 0) discount = 0;
		if (discount > 100) discount = 100;
		quotationItems[index].discount = discount;
		quotationItems = [...quotationItems];
	}

	function removeQuotationItem(index: number) {
		quotationItems = quotationItems.filter((_, i) => i !== index);
	}

	function lineSubtotal(item: QuotationItem): number {
		return item.quantity * item.price;
	}

	function lineTotal(item: QuotationItem): number {
		const subtotal = lineSubtotal(item);
		const discountAmount = (subtotal * item.discount) / 100;
		return subtotal - discountAmount;
	}

	function quotationSubtotal(): number {
		return quotationItems.reduce((sum, item) => sum + lineTotal(item), 0);
	}

	function generalDiscountAmount(): number {
		const subtotal = quotationSubtotal();
		if (!generalDiscount) return 0;
		return (subtotal * generalDiscount) / 100;
	}

	function quotationTotal(): number {
		const subtotal = quotationSubtotal();
		return subtotal - generalDiscountAmount();
	}

	function resetQuotation() {
		quotationItems = [];
		productSearch = '';
		generalDiscount = 0;
		customerName = '';
		customerCompany = '';
		customerRfc = '';
		customerEmail = '';
		customerPhone = '';
		customerAddress = '';
		quotationValidityDays = 15;
		paymentTerms = 'Contado';
		notes = '';
		savedQuotationId = null;
	}

	async function saveQuotation() {
		if (!quotationItems.length) {
			alert('Agrega al menos un producto a la cotización.');
			return;
		}

		if (!customerName.trim()) {
			alert('El nombre del cliente es obligatorio.');
			return;
		}

		saving = true;
		try {
			// Opción A: Usar función de base de datos (más confiable con concurrencia)
			const { data: quotationNumber, error: numberError } = await supabase
				.rpc('generate_quotation_number');

			// Opción B: Si la función no existe, generar manualmente
			let finalQuotationNumber = quotationNumber;
			
			if (numberError || !quotationNumber) {
				console.log('Generando número manualmente...');
				const year = new Date().getFullYear();
				
				const { data: lastQuotation } = await supabase
					.from('quotations')
					.select('quotation_number')
					.like('quotation_number', `COT-${year}-%`)
					.order('quotation_number', { ascending: false })
					.limit(1)
					.single();

				let nextNumber = 1;
				if (lastQuotation?.quotation_number) {
					const lastNumberStr = lastQuotation.quotation_number.split('-')[2];
					nextNumber = parseInt(lastNumberStr) + 1;
				}

				finalQuotationNumber = `COT-${year}-${String(nextNumber).padStart(4, '0')}`;
			}

			// Calcular totales
			const subtotal = quotationSubtotal();
			const generalDiscountAmt = generalDiscountAmount();
			const total = quotationTotal();

			// Insertar cotización
			const { data: quotation, error: quotationError } = await supabase
				.from('quotations')
				.insert({
					quotation_number: finalQuotationNumber as any,
					customer_name: customerName,
					customer_company: customerCompany || null,
					customer_rfc: customerRfc || null,
					customer_email: customerEmail || null,
					customer_phone: customerPhone || null,
					customer_address: customerAddress || null,
					subtotal: subtotal,
					general_discount_percentage: generalDiscount,
					discount_amount: generalDiscountAmt,
					total_amount: total,
					validity_days: quotationValidityDays,
					payment_terms: paymentTerms,
					notes: notes || null,
					status: 'draft'
				})
				.select()
				.single();

			if (quotationError) {
				console.error('Error guardando cotización:', quotationError);
				alert('Error guardando cotización');
				return;
			}

			// Insertar items
			const items = quotationItems.map(item => ({
				quotation_id: quotation.id,
				product_id: item.productId,
				sku: item.sku,
				description: item.description,
				quantity: item.quantity,
				unit_price: item.price,
				line_discount_percentage: item.discount,
				total_price: lineTotal(item)
			}));

			const { error: itemsError } = await supabase
				.from('quotation_items')
				.insert(items);

			if (itemsError) {
				console.error('Error guardando items:', itemsError);
				alert('Error guardando items de la cotización');
				return;
			}

			savedQuotationId = quotation.id;
			alert(`✅ Cotización guardada exitosamente.\nNúmero: ${finalQuotationNumber}`);

		} catch (error) {
			console.error('Error guardando cotización:', error);
			alert('Error guardando cotización');
		} finally {
			saving = false;
		}
	}

	async function loadLogoImage(): Promise<HTMLImageElement | null> {
		return new Promise((resolve) => {
			const img = new Image();
			img.src = '/logorectangular.png';
			img.onload = () => resolve(img);
			img.onerror = () => resolve(null);
		});
	}

	async function generateQuotationPdf(mode: 'preview' | 'download') {
		if (!quotationItems.length) {
			alert('Agrega al menos un producto a la cotización.');
			return;
		}

		const doc = await createPdfDocument();
		
		if (mode === 'download') {
			const today = new Date();
			const fileName = `Cotizacion_${today.toISOString().split('T')[0]}.pdf`;
			doc.save(fileName);
		} else {
			doc.output('dataurlnewwindow');
		}
	}

	async function sendQuotationByEmail() {
		if (!quotationItems.length) {
			alert('Agrega al menos un producto a la cotización.');
			return;
		}

		if (!customerEmail?.trim()) {
			alert('El correo del cliente es requerido para enviar la cotización.');
			return;
		}

		if (!customerName?.trim()) {
			alert('El nombre del cliente es requerido.');
			return;
		}

		const confirmSend = confirm(
			`¿Enviar cotización por email a:\n${customerEmail}?\n\nLa cotización se guardará automáticamente antes de enviar.`
		);

		if (!confirmSend) return;

		sendingEmail = true;
		try {
			// Guardar la cotización primero si no está guardada
			if (!savedQuotationId) {
				await saveQuotation();
				if (!savedQuotationId) {
					alert('❌ Error: No se pudo guardar la cotización.');
					return;
				}
			}

			const doc = await createPdfDocument();
			const pdfBase64 = doc.output('datauristring').split(',')[1];

			// Obtener el número real de la cotización guardada
			let quotationNumber = 'COT-' + new Date().getFullYear() + '-0000';
			if (savedQuotationId) {
				const { data } = await supabase
					.from('quotations')
					.select('quotation_number')
					.eq('id', savedQuotationId)
					.single();
				
				if (data?.quotation_number) {
					quotationNumber = data.quotation_number;
				}
			}

			const response = await fetch('/api/send-quotation', {
				method: 'POST',
				headers: {
					'Content-Type': 'application/json'
				},
				body: JSON.stringify({
					customerEmail: customerEmail,
					customerName: customerName,
					pdfData: pdfBase64,
					quotationNumber: quotationNumber,
					validityDays: quotationValidityDays
				})
			});

			const result = await response.json();

			if (response.ok && result.success) {
				alert('✅ Cotización enviada exitosamente por email!');
			} else {
				alert('⚠️ ' + (result.message || result.error || 'Configura tu servicio de email'));
			}
		} catch (error) {
			console.error('Error enviando email:', error);
			alert('❌ Error enviando el email. Verifica la configuración del servidor.');
		} finally {
			sendingEmail = false;
		}
	}

	async function createPdfDocument(): Promise<any> {
		if (!quotationItems.length) {
			alert('Agrega al menos un producto a la cotización.');
			return;
		}

		const doc = new jsPDF();
		let currentY = 10;
		
		// Colores corporativos (rojo y azul)
		const redColor = [220, 38, 38]; // Tailwind red-600
		const blueColor = [37, 99, 235]; // Tailwind blue-600

		// Logo con relación de aspecto correcta
		try {
			const logo = await loadLogoImage();
			if (logo) {
				// Calcular dimensiones manteniendo aspect ratio
				const logoWidth = 50;
				const aspectRatio = logo.height / logo.width;
				const logoHeight = logoWidth * aspectRatio;
				doc.addImage(logo, 'PNG', 10, currentY, logoWidth, logoHeight);
				currentY += logoHeight + 5;
			}
		} catch (e) {
			// Si falla el logo, continuar sin él
		}

		// Encabezado - Título y datos de la empresa
		doc.setFontSize(16);
		doc.setFont('helvetica', 'bold');
		doc.setTextColor(redColor[0], redColor[1], redColor[2]);
		doc.text('COTIZACIÓN', 200, 15, { align: 'right' });
		
		doc.setFontSize(9);
		doc.setFont('helvetica', 'normal');
		doc.setTextColor(0, 0, 0);
		const today = new Date();
		doc.text(`Fecha: ${today.toLocaleDateString('es-MX')}`, 200, 22, { align: 'right' });
		doc.text(`Vigencia: ${quotationValidityDays || 15} días`, 200, 27, { align: 'right' });
		
		// Datos de contacto de la empresa
		doc.setFontSize(8);
		doc.setTextColor(80, 80, 80);
		doc.text('Guerra Laser México', 200, 35, { align: 'right' });
		doc.text('Tel: 33 2015 2372', 200, 39, { align: 'right' });
		doc.text('Cel: 33 3475 8653 | 33 1864 0008', 200, 43, { align: 'right' });
		doc.text('contacto@guerralaser.com', 200, 47, { align: 'right' });
		doc.text('Av. Las Torres 5301, Col. Glorias del Colli', 200, 51, { align: 'right' });
		doc.text('Zapopan, Jalisco CP 45010', 200, 55, { align: 'right' });

		currentY = Math.max(currentY, 62);

		// Línea divisoria superior
		doc.setDrawColor(blueColor[0], blueColor[1], blueColor[2]);
		doc.setLineWidth(0.5);
		doc.line(10, currentY, 200, currentY);
		currentY += 6;

		// Datos del cliente
		doc.setFontSize(11);
		doc.setFont('helvetica', 'bold');
		doc.setTextColor(0, 0, 0);
		doc.text('DATOS DEL CLIENTE', 10, currentY);
		doc.setFont('helvetica', 'normal');
		doc.setFontSize(9);
		currentY += 6;
		doc.text(`Nombre: ${customerName || '-'}`, 10, currentY);
		currentY += 4;
		doc.text(`Empresa: ${customerCompany || '-'}`, 10, currentY);
		currentY += 4;
		doc.text(`RFC: ${customerRfc || '-'}`, 10, currentY);
		currentY += 4;
		doc.text(`Correo: ${customerEmail || '-'}`, 10, currentY);
		currentY += 4;
		doc.text(`Teléfono: ${customerPhone || '-'}`, 10, currentY);
		currentY += 4;
		const addressLines = doc.splitTextToSize(`Dirección: ${customerAddress || '-'}`, 90);
		doc.text(addressLines, 10, currentY);
		currentY += (addressLines.length * 4) + 2;

		// Condiciones comerciales
		doc.setFontSize(11);
		doc.setFont('helvetica', 'bold');
		doc.text('CONDICIONES COMERCIALES', 110, currentY - (addressLines.length * 4) - 2);
		doc.setFont('helvetica', 'normal');
		doc.setFontSize(9);
		doc.text(`Forma de pago: ${paymentTerms || 'Contado'}`, 110, currentY - (addressLines.length * 4) + 4);
		currentY += 4;

		// Línea divisoria antes de la tabla
		doc.setDrawColor(redColor[0], redColor[1], redColor[2]);
		doc.line(10, currentY, 200, currentY);
		currentY += 5;

		// Encabezados de tabla con fondo
		doc.setFillColor(240, 240, 240);
		doc.rect(10, currentY - 4, 190, 6, 'F');
		doc.setFontSize(9);
		doc.setFont('helvetica', 'bold');
		doc.text('SKU', 11, currentY);
		doc.text('Descripción', 32, currentY);
		doc.text('Cant.', 110, currentY, { align: 'right' });
		doc.text('Precio Unit.', 135, currentY, { align: 'right' });
		doc.text('Desc.%', 160, currentY, { align: 'right' });
		doc.text('Total', 195, currentY, { align: 'right' });
		currentY += 5;
		
		doc.setFont('helvetica', 'normal');
		doc.setFontSize(8);

		// Filas de productos con mejor manejo de texto
		for (const item of quotationItems) {
			const subtotal = lineSubtotal(item);
			const total = lineTotal(item);

			// Calcular altura necesaria para esta fila
			const skuLines = doc.splitTextToSize(item.sku || '-', 18);
			const descLines = doc.splitTextToSize(item.description || '', 75);
			const maxLines = Math.max(skuLines.length, descLines.length);
			const rowHeight = maxLines * 4;

			// Salto de página si es necesario
			if (currentY + rowHeight > 270) {
				doc.addPage();
				currentY = 20;
				
				// Repetir encabezados en nueva página
				doc.setFillColor(240, 240, 240);
				doc.rect(10, currentY - 4, 190, 6, 'F');
				doc.setFont('helvetica', 'bold');
				doc.setFontSize(9);
				doc.text('SKU', 11, currentY);
				doc.text('Descripción', 32, currentY);
				doc.text('Cant.', 110, currentY, { align: 'right' });
				doc.text('Precio Unit.', 135, currentY, { align: 'right' });
				doc.text('Desc.%', 160, currentY, { align: 'right' });
				doc.text('Total', 195, currentY, { align: 'right' });
				currentY += 5;
				doc.setFont('helvetica', 'normal');
				doc.setFontSize(8);
			}

			// Dibujar contenido de la fila
			doc.text(skuLines, 11, currentY);
			doc.text(descLines, 32, currentY);
			doc.text(String(item.quantity), 110, currentY + 2, { align: 'right' });
			doc.text(`$${item.price.toFixed(2)}`, 135, currentY + 2, { align: 'right' });
			doc.text(`${item.discount.toFixed(1)}%`, 160, currentY + 2, { align: 'right' });
			doc.text(`$${total.toFixed(2)}`, 195, currentY + 2, { align: 'right' });
			
			currentY += rowHeight + 1;
			
			// Línea divisoria entre productos (azul suave)
			doc.setDrawColor(200, 210, 230);
			doc.setLineWidth(0.1);
			doc.line(10, currentY, 200, currentY);
			currentY += 1;
		}

		// Totales
		currentY += 3;
		doc.setDrawColor(blueColor[0], blueColor[1], blueColor[2]);
		doc.setLineWidth(0.5);
		doc.line(120, currentY, 200, currentY);
		currentY += 6;
		
		const subtotal = quotationSubtotal();
		const genDiscount = generalDiscountAmount();
		const total = quotationTotal();

		doc.setFontSize(9);
		doc.text('Subtotal:', 155, currentY, { align: 'right' });
		doc.text(`$${subtotal.toFixed(2)} MXN`, 195, currentY, { align: 'right' });
		currentY += 5;
		
		if (genDiscount > 0) {
			doc.setTextColor(redColor[0], redColor[1], redColor[2]);
			doc.text(`Descuento general (${generalDiscount || 0}%):`, 155, currentY, { align: 'right' });
			doc.text(`-$${genDiscount.toFixed(2)} MXN`, 195, currentY, { align: 'right' });
			doc.setTextColor(0, 0, 0);
			currentY += 5;
		}
		
		doc.setFont('helvetica', 'bold');
		doc.setFontSize(11);
		doc.setTextColor(blueColor[0], blueColor[1], blueColor[2]);
		doc.text('Total:', 155, currentY, { align: 'right' });
		doc.text(`$${total.toFixed(2)} MXN`, 195, currentY, { align: 'right' });
		doc.setTextColor(0, 0, 0);
		doc.setFont('helvetica', 'normal');
		currentY += 8;

		// Notas
		if (notes) {
			doc.setFontSize(9);
			doc.setFont('helvetica', 'bold');
			doc.text('Notas:', 10, currentY);
			doc.setFont('helvetica', 'normal');
			doc.setFontSize(8);
			const splitNotes = doc.splitTextToSize(notes, 180);
			doc.text(splitNotes, 10, currentY + 4);
			currentY += (splitNotes.length * 4) + 6;
		}

		// Pie de página
		if (currentY < 260) {
			currentY = 260;
		}
		doc.setDrawColor(redColor[0], redColor[1], redColor[2]);
		doc.line(10, currentY, 200, currentY);
		doc.setFontSize(7);
		doc.setTextColor(100, 100, 100);
		doc.text('Esta cotización tiene una vigencia de ' + (quotationValidityDays || 15) + ' días naturales a partir de la fecha de emisión.', 105, currentY + 4, { align: 'center' });
		doc.text('Gracias por su preferencia - Guerra Laser México', 105, currentY + 8, { align: 'center' });

		return doc;
	}
</script>

<svelte:head>
	<title>Cotizaciones - Admin</title>
</svelte:head>

<div class="min-h-screen bg-gray-50">
	<div class="container mx-auto px-4 py-6 max-w-7xl">
		<div class="mb-6 flex items-center justify-between">
			<div>
				<h1 class="text-3xl font-bold">Nueva Cotización</h1>
				<p class="text-gray-600 mt-1">Crea cotizaciones profesionales para tus clientes</p>
			</div>
			<a href="/admin" class="px-4 py-2 border border-gray-300 rounded-lg hover:bg-gray-50">
				← Volver al Dashboard
			</a>
		</div>

		<!-- Datos del cliente -->
		<div class="bg-white rounded-lg shadow-md p-6 mb-6">
			<h2 class="text-xl font-bold mb-4">Datos del Cliente</h2>
			<div class="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
				<div>
					<label class="block text-sm font-medium text-gray-700 mb-1">Nombre del cliente *</label>
					<input
						type="text"
						class="w-full border rounded-md px-3 py-2"
						bind:value={customerName}
						placeholder="Nombre completo"
					/>
				</div>
				<div>
					<label class="block text-sm font-medium text-gray-700 mb-1">Empresa</label>
					<input
						type="text"
						class="w-full border rounded-md px-3 py-2"
						bind:value={customerCompany}
						placeholder="Nombre de la empresa"
					/>
				</div>
				<div>
					<label class="block text-sm font-medium text-gray-700 mb-1">RFC</label>
					<input
						type="text"
						class="w-full border rounded-md px-3 py-2"
						bind:value={customerRfc}
						placeholder="RFC"
					/>
				</div>
				<div>
					<label class="block text-sm font-medium text-gray-700 mb-1">Correo</label>
					<input
						type="email"
						class="w-full border rounded-md px-3 py-2"
						bind:value={customerEmail}
						placeholder="correo@ejemplo.com"
					/>
				</div>
				<div>
					<label class="block text-sm font-medium text-gray-700 mb-1">Teléfono</label>
					<input
						type="tel"
						class="w-full border rounded-md px-3 py-2"
						bind:value={customerPhone}
						placeholder="33 1234 5678"
					/>
				</div>
				<div class="lg:col-span-1 md:col-span-2 col-span-1">
					<label class="block text-sm font-medium text-gray-700 mb-1">Dirección</label>
					<input
						type="text"
						class="w-full border rounded-md px-3 py-2"
						bind:value={customerAddress}
						placeholder="Dirección completa"
					/>
				</div>
			</div>
		</div>

		<!-- Condiciones comerciales -->
		<div class="bg-white rounded-lg shadow-md p-6 mb-6">
			<h2 class="text-xl font-bold mb-4">Condiciones Comerciales</h2>
			<div class="grid grid-cols-1 md:grid-cols-3 gap-4">
				<div>
					<label class="block text-sm font-medium text-gray-700 mb-1">Vigencia (días)</label>
					<input
						type="number"
						min="1"
						class="w-full border rounded-md px-3 py-2"
						bind:value={quotationValidityDays}
					/>
				</div>
				<div>
					<label class="block text-sm font-medium text-gray-700 mb-1">Forma de pago</label>
					<input
						type="text"
						class="w-full border rounded-md px-3 py-2"
						bind:value={paymentTerms}
						placeholder="Ej: Contado, Crédito 30 días"
					/>
				</div>
				<div class="md:col-span-1">
					<label class="block text-sm font-medium text-gray-700 mb-1">Notas adicionales</label>
					<textarea
						rows="1"
						class="w-full border rounded-md px-3 py-2"
						bind:value={notes}
						placeholder="Información adicional..."
					></textarea>
				</div>
			</div>
		</div>

		<!-- Contenido principal: búsqueda y detalle -->
		<div class="grid grid-cols-1 lg:grid-cols-4 gap-6 mb-6">
			<!-- Búsqueda de productos -->
			<div class="lg:col-span-1">
				<div class="bg-white rounded-lg shadow-md p-4 sticky top-4">
					<h3 class="text-lg font-semibold mb-3">Buscar Productos</h3>
					<input
						type="text"
						placeholder="Buscar por nombre o SKU"
						class="w-full border rounded-md px-3 py-2 text-sm mb-3"
						bind:value={productSearch}
					/>
					<div class="max-h-96 overflow-y-auto divide-y">
						{#if loading}
							<p class="text-sm text-gray-500 py-2">Cargando productos...</p>
						{:else if filteredProductsForQuotation().length === 0}
							<p class="text-sm text-gray-500 py-2">No se encontraron productos.</p>
						{:else}
							{#each filteredProductsForQuotation() as product}
								<div class="py-2">
									<div class="flex items-start justify-between gap-2 mb-2">
										<div class="flex-1 min-w-0">
											<p class="text-sm font-medium text-gray-800 truncate">{product.name}</p>
											<p class="text-xs text-gray-500">SKU: {product.sku || '-'}</p>
											<p class="text-xs" class:text-green-600={product.stock_quantity > 10} class:text-yellow-600={product.stock_quantity > 0 && product.stock_quantity <= 10} class:text-red-600={product.stock_quantity === 0}>
												Existencia: {product.stock_quantity || 0}
											</p>
										</div>
									</div>
									<button
										onclick={() => addProductToQuotation(product)}
										class="w-full px-3 py-1.5 text-xs bg-blue-600 text-white rounded-md hover:bg-blue-700"
									>
										Agregar a cotización
									</button>
								</div>
							{/each}
						{/if}
					</div>
				</div>
			</div>

			<!-- Detalle de cotización -->
			<div class="lg:col-span-3">
				<div class="bg-white rounded-lg shadow-md p-6">
					<div class="flex justify-between items-center mb-4">
						<h3 class="text-lg font-semibold">Productos en la Cotización</h3>
						<button
							onclick={resetQuotation}
							class="text-sm text-red-600 hover:text-red-700 underline"
						>
							Limpiar todo
						</button>
					</div>

					{#if quotationItems.length === 0}
						<div class="text-center py-12 text-gray-500">
							<div class="text-6xl mb-4">📋</div>
							<p class="text-lg font-medium">No hay productos en la cotización</p>
							<p class="text-sm">Busca y agrega productos desde el panel de la izquierda</p>
						</div>
					{:else}
						<div class="overflow-x-auto mb-6">
							<table class="min-w-full text-sm border">
								<thead class="bg-gray-100">
									<tr>
										<th class="px-3 py-2 text-left border">SKU</th>
										<th class="px-3 py-2 text-left border">Descripción</th>
										<th class="px-3 py-2 text-right border w-24">Cantidad</th>
										<th class="px-3 py-2 text-right border w-28">Precio Unit.</th>
										<th class="px-3 py-2 text-right border w-24">Desc. %</th>
										<th class="px-3 py-2 text-right border w-28">Total</th>
										<th class="px-3 py-2 text-center border w-16">Quitar</th>
									</tr>
								</thead>
								<tbody>
									{#each quotationItems as item, index}
										<tr class="border-t">
											<td class="px-3 py-2 border align-top">{item.sku}</td>
											<td class="px-3 py-2 border align-top">
												<textarea
													rows="2"
													class="w-full border rounded-md px-2 py-1 text-sm"
													bind:value={item.description}
												></textarea>
											</td>
											<td class="px-3 py-2 border align-top">
												<input
													type="number"
													min="1"
													class="w-full border rounded-md px-2 py-1 text-right"
													value={item.quantity}
													onchange={(e) => updateItemQuantity(index, e.currentTarget.value)}
												/>
											</td>
											<td class="px-3 py-2 border align-top">
												<input
													type="number"
													step="0.01"
													min="0"
													class="w-full border rounded-md px-2 py-1 text-right"
													value={item.price}
													onchange={(e) => updateItemPrice(index, e.currentTarget.value)}
												/>
											</td>
											<td class="px-3 py-2 border align-top">
												<input
													type="number"
													step="0.01"
													min="0"
													max="100"
													class="w-full border rounded-md px-2 py-1 text-right"
													value={item.discount}
													onchange={(e) => updateItemDiscount(index, e.currentTarget.value)}
												/>
											</td>
											<td class="px-3 py-2 border align-top text-right font-medium">
												${lineTotal(item).toFixed(2)}
											</td>
											<td class="px-3 py-2 border align-top text-center">
												<button
													onclick={() => removeQuotationItem(index)}
													class="text-red-600 hover:text-red-800 text-lg"
												>
													✕
												</button>
											</td>
										</tr>
									{/each}
								</tbody>
							</table>
						</div>

						<!-- Totales -->
						<div class="border-t pt-4">
							<div class="flex flex-col md:flex-row md:items-start md:justify-between gap-4">
								<div class="flex items-center gap-3">
									<label class="text-sm font-medium text-gray-700">Descuento general (%):</label>
									<input
										type="number"
										min="0"
										max="100"
										step="0.01"
										class="w-32 border rounded-md px-3 py-2 text-right"
										bind:value={generalDiscount}
									/>
								</div>

								<div class="bg-gray-50 rounded-lg p-4 min-w-[280px]">
									<div class="space-y-2">
										<div class="flex justify-between text-sm">
											<span class="font-medium">Subtotal:</span>
											<span class="font-semibold">${quotationSubtotal().toFixed(2)}</span>
										</div>
										{#if generalDiscount > 0}
											<div class="flex justify-between text-sm text-red-600">
												<span class="font-medium">Descuento ({generalDiscount}%):</span>
												<span class="font-semibold">-${generalDiscountAmount().toFixed(2)}</span>
											</div>
										{/if}
										<div class="flex justify-between text-lg font-bold border-t pt-2">
											<span>Total:</span>
											<span class="text-blue-600">${quotationTotal().toFixed(2)} MXN</span>
										</div>
									</div>
								</div>
							</div>
						</div>
					{/if}
				</div>
			</div>
		</div>

		<!-- Botones de acción fijos en la parte inferior -->
		<div class="sticky bottom-0 bg-white border-t shadow-lg rounded-t-lg p-4">
			<div class="container mx-auto max-w-7xl flex flex-col sm:flex-row justify-between items-center gap-3">
				<p class="text-sm text-gray-600">
					💡 Guarda la cotización, genera el PDF o envíala por email al cliente
				</p>
				<div class="flex flex-wrap gap-3 justify-center">
					<button
						onclick={saveQuotation}
						class="px-6 py-2.5 bg-purple-600 text-white rounded-lg hover:bg-purple-700 font-medium"
						disabled={quotationItems.length === 0 || saving}
					>
						{#if saving}
							⏳ Guardando...
						{:else if savedQuotationId}
							✅ Guardada
						{:else}
							💾 Guardar Cotización
						{/if}
					</button>
					<button
						onclick={sendQuotationByEmail}
						class="px-6 py-2.5 bg-orange-600 text-white rounded-lg hover:bg-orange-700 font-medium"
						disabled={quotationItems.length === 0 || !customerEmail || sendingEmail}
					>
						{#if sendingEmail}
							⏳ Enviando...
						{:else}
							📧 Enviar por Email
						{/if}
					</button>
					<button
						onclick={() => generateQuotationPdf('preview')}
						class="px-6 py-2.5 bg-blue-600 text-white rounded-lg hover:bg-blue-700 font-medium"
						disabled={quotationItems.length === 0}
					>
						👁️ Previsualizar PDF
					</button>
					<button
						onclick={() => generateQuotationPdf('download')}
						class="px-6 py-2.5 bg-green-600 text-white rounded-lg hover:bg-green-700 font-medium"
						disabled={quotationItems.length === 0}
					>
						📥 Descargar PDF
					</button>
				</div>
			</div>
		</div>
	</div>
</div>

<style>
	button:disabled {
		opacity: 0.5;
		cursor: not-allowed;
	}
</style>
