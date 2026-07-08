<script lang="ts">
	import { supabase } from '$lib/supabaseClient';
	import { page } from '$app/stores';
	import jsPDF from 'jspdf';
	import CustomerSearch from '$lib/components/customers/CustomerSearch.svelte';
	import ExtraCostField from '$lib/components/quotations/ExtraCostField.svelte';
	import { getPrimaryProductImageUrl, buildCatalogDetail } from '$lib/utils/productMedia';
	import { loadImageForPdf } from '$lib/utils/pdfImages';
	import {
		buildQuotationTotalLines,
		calculateQuotationSummary,
		displayQuotationAmount
	} from '$lib/utils/quotationTax';
	import {
		drawQuotationTableHeader,
		QUOTATION_PDF_COL
	} from '$lib/utils/quotationPdfTableHeader';
	import { extraCostBillableAmount } from '$lib/types/quotationExtraCost';
	import type { QuotationExtraCostMode } from '$lib/types/quotationExtraCost';
	import {
		adminFormToQuotationInput,
		getSavedQuotation,
		saveQuotationInput,
		savedQuotationToAdminForm
	} from '$lib/services/quotationApi';
	import type { QuotationSource } from '$lib/types/savedQuotation';
	import type { Database } from '$lib/types/database.types';

	type Customer = Database['public']['Tables']['customers']['Row'];

	let products = $state<any[]>([]);
	let productItems = $state<any[]>([]); // Items para mostrar (productos sin variantes + variantes)
	let loading = $state(true);
	let saving = $state(false);
	let sendingEmail = $state(false);
	let savedQuotationId = $state<string | null>(null);
	let quotationNumber = $state<string | null>(null);
	let quotationSource = $state<QuotationSource>('manual');
	let loadingQuotation = $state(false);
	let loadedEditId = $state<string | null>(null);

	// Estado para cotizaciones
	type QuotationItem = {
		productId: string;
		sku: string;
		description: string;
		quantity: number;
		price: number;
		discount: number; // porcentaje por línea
		isVariant?: boolean;
		variantId?: string | null;
		imageUrl?: string;
		catalogDetail?: string;
		detailDescription?: string;
		includeDetail?: boolean;
	};

	let quotationItems = $state<QuotationItem[]>([]);
	let productSearch = $state('');
	let generalDiscount = $state(0); // porcentaje de descuento general
	let includeAllDetails = $state(false);

	// Datos de cliente para la cotización
	let selectedCustomerId = $state<string | null>(null);
	let customerName = $state('');
	let customerCompany = $state('');
	let customerRfc = $state('');
	let customerEmail = $state('');
	let customerPhone = $state('');
	let customerAddress = $state('');
	let quotationValidityDays = $state(15);
	let paymentTerms = $state('Contado');
	let notes = $state('');
	let shippingCost = $state(0);
	let installationCost = $state(0);
	let shippingMode = $state<QuotationExtraCostMode>('na');
	let installationMode = $state<QuotationExtraCostMode>('na');
	let pricesExcludeIva = $state(false);

	// Función para cargar datos de cliente existente
	function handleCustomerSelect(customer: Customer) {
		selectedCustomerId = customer.id;
		customerName = customer.contact_name;
		customerCompany = customer.company_name || '';
		customerRfc = customer.rfc || '';
		customerEmail = customer.email;
		customerPhone = customer.phone || customer.mobile || '';
		
		// Construir dirección completa
		const addressParts = [
			customer.street,
			customer.neighborhood,
			customer.city,
			customer.state,
			customer.zip_code
		].filter(Boolean);
		customerAddress = addressParts.join(', ');
	}

	// Limpiar cliente seleccionado
	function clearCustomer() {
		selectedCustomerId = null;
		customerName = '';
		customerCompany = '';
		customerRfc = '';
		customerEmail = '';
		customerPhone = '';
		customerAddress = '';
	}

	$effect(() => {
		loadProducts();
	});

	$effect(() => {
		const editId = $page.url.searchParams.get('edit');
		if (editId && editId !== loadedEditId) {
			loadQuotationForEdit(editId);
		}
	});

	async function loadQuotationForEdit(id: string) {
		loadingQuotation = true;
		try {
			const quotation = await getSavedQuotation(id);
			const form = savedQuotationToAdminForm(quotation);
			savedQuotationId = form.id;
			quotationNumber = form.quotationNumber;
			quotationSource = (form.source as QuotationSource) ?? 'manual';
			selectedCustomerId = form.selectedCustomerId;
			customerName = form.customerName;
			customerCompany = form.customerCompany;
			customerRfc = form.customerRfc;
			customerEmail = form.customerEmail;
			customerPhone = form.customerPhone;
			customerAddress = form.customerAddress;
			generalDiscount = form.generalDiscount;
			shippingCost = form.shippingCost;
			installationCost = form.installationCost;
			shippingMode = form.shippingMode;
			installationMode = form.installationMode;
			pricesExcludeIva = form.pricesExcludeIva;
			includeAllDetails = form.includeAllDetails;
			quotationValidityDays = form.quotationValidityDays;
			paymentTerms = form.paymentTerms;
			notes = form.notes;
			quotationItems = form.items;
			loadedEditId = id;
		} catch (error) {
			console.error('Error cargando cotización:', error);
			alert('No se pudo cargar la cotización');
		} finally {
			loadingQuotation = false;
		}
	}

	async function loadProducts() {
		loading = true;

		// Cargar productos con variantes
		const { data: productsData } = await supabase
			.from('products')
			.select('id, sku, name, base_price, stock_quantity, short_description, description, product_variants(id, name, sku, price, stock_quantity), product_media(url, is_primary, display_order)')
			.eq('is_active', true)
			.order('name');

		products = productsData || [];
		
		// Crear items para búsqueda: si tiene variantes, mostrar solo variantes; si no, mostrar el producto
		productItems = [];
		for (const product of products) {
			const variants = product.product_variants || [];
			const imageUrl = getPrimaryProductImageUrl(product.product_media);
			const catalogDetail = buildCatalogDetail(product);
			
			if (variants.length > 0) {
				// Producto con variantes: agregar solo las variantes
				for (const variant of variants) {
					productItems.push({
						id: variant.id,
						productId: product.id,
						sku: variant.sku || product.sku,
						name: `${product.name} - ${variant.name}`,
						price: variant.price || product.base_price,
						stock_quantity: variant.stock_quantity || 0,
						isVariant: true,
						variantId: variant.id,
						imageUrl,
						catalogDetail
					});
				}
			} else {
				// Producto sin variantes: agregar el producto
				productItems.push({
					id: product.id,
					productId: product.id,
					sku: product.sku,
					name: product.name,
					price: product.base_price,
					stock_quantity: product.stock_quantity || 0,
					isVariant: false,
					variantId: null,
					imageUrl,
					catalogDetail
				});
			}
		}
		
		loading = false;
	}

	// --- Utilidades de cotización ---

	function filteredProductsForQuotation() {
		if (!productSearch.trim()) return productItems;
		const query = productSearch.toLowerCase();
		return productItems.filter((p) => {
			const name = (p.name || '').toLowerCase();
			const sku = (p.sku || '').toLowerCase();
			return name.includes(query) || sku.includes(query);
		});
	}

	function addProductToQuotation(product: any) {
		if (!product) return;
		
		// Usar id único (puede ser productId o variantId)
		const uniqueId = product.isVariant ? product.variantId : product.productId;
		const existing = quotationItems.find((item) => 
			item.productId === uniqueId && item.isVariant === product.isVariant
		);
		
		if (existing) {
			existing.quantity += 1;
			quotationItems = [...quotationItems];
			return;
		}

		const basePrice = product.price || 0;
		quotationItems = [
			...quotationItems,
			{
				productId: uniqueId,
				sku: product.sku || '',
				description: product.name || '',
				quantity: 1,
				price: basePrice,
				discount: 0,
				isVariant: product.isVariant,
				variantId: product.variantId,
				imageUrl: product.imageUrl || '',
				catalogDetail: product.catalogDetail || '',
				detailDescription: '',
				includeDetail: false
			}
		];
	}

	function fillDetailFromCatalog(index: number) {
		const item = quotationItems[index];
		if (!item.catalogDetail) return;
		item.detailDescription = item.catalogDetail;
		item.includeDetail = true;
		quotationItems = [...quotationItems];
	}

	function toggleIncludeAllDetails() {
		for (const item of quotationItems) {
			item.includeDetail = includeAllDetails;
			if (includeAllDetails && !item.detailDescription?.trim() && item.catalogDetail) {
				item.detailDescription = item.catalogDetail;
			}
		}
		quotationItems = [...quotationItems];
	}

	function toggleItemDetail(index: number, include: boolean) {
		quotationItems[index].includeDetail = include;
		if (include && !quotationItems[index].detailDescription?.trim() && quotationItems[index].catalogDetail) {
			quotationItems[index].detailDescription = quotationItems[index].catalogDetail;
		}
		quotationItems = [...quotationItems];
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
		const total = subtotal - generalDiscountAmount();
		return (
			total +
			extraCostBillableAmount(shippingMode, shippingCost) +
			extraCostBillableAmount(installationMode, installationCost)
		);
	}

	function displayItemUnitPrice(item: QuotationItem): number {
		return displayQuotationAmount(item.price, pricesExcludeIva);
	}

	function displayItemLineTotal(item: QuotationItem): number {
		return displayQuotationAmount(lineTotal(item), pricesExcludeIva);
	}

	function quotationSummary() {
		return calculateQuotationSummary({
			itemsSubtotalConIva: quotationSubtotal(),
			generalDiscountAmount: generalDiscountAmount(),
			shippingCost,
			installationCost,
			shippingMode,
			installationMode
		});
	}

	const summary = $derived.by(() => quotationSummary());
	const totalLines = $derived.by(() =>
		buildQuotationTotalLines(pricesExcludeIva, summary, {
			generalDiscountPercent: generalDiscount,
			generalDiscountAmount: generalDiscountAmount()
		})
	);

	function resetQuotation() {
		quotationItems = [];
		productSearch = '';
		generalDiscount = 0;
		includeAllDetails = false;
		customerName = '';
		customerCompany = '';
		customerRfc = '';
		customerEmail = '';
		customerPhone = '';
		customerAddress = '';
		quotationValidityDays = 15;
		paymentTerms = 'Contado';
		notes = '';
		shippingCost = 0;
		installationCost = 0;
		shippingMode = 'na';
		installationMode = 'na';
		pricesExcludeIva = false;
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
			const input = adminFormToQuotationInput({
				id: savedQuotationId,
				source: quotationSource,
				selectedCustomerId,
				customerName,
				customerCompany,
				customerRfc,
				customerEmail,
				customerPhone,
				customerAddress,
				generalDiscount,
				shippingCost,
				installationCost,
				shippingMode,
				installationMode,
				pricesExcludeIva,
				includeAllDetails,
				quotationValidityDays,
				paymentTerms,
				notes,
				items: quotationItems
			});

			const quotation = await saveQuotationInput(input);
			savedQuotationId = quotation.id;
			quotationNumber = quotation.quotation_number;
			alert(`✅ Cotización guardada exitosamente.\nNúmero: ${quotation.quotation_number}`);
		} catch (error) {
			console.error('Error guardando cotización:', error);
			alert(error instanceof Error ? error.message : 'Error guardando cotización');
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
		currentY = drawQuotationTableHeader(doc, currentY, pricesExcludeIva);

		const imageCache = new Map<string, { dataUrl: string; format: 'PNG' | 'JPEG' }>();
		await Promise.all(
			quotationItems
				.filter((item) => item.imageUrl)
				.map(async (item) => {
					if (!item.imageUrl || imageCache.has(item.imageUrl)) return;
					const loaded = await loadImageForPdf(item.imageUrl);
					if (loaded) imageCache.set(item.imageUrl, loaded);
				})
		);

		const IMAGE_SIZE = 16;
		const IMAGE_X = 11;
		const SKU_X = 30;
		const DESC_X = 48;
		const DESC_WIDTH = 58;
		const ROW_GAP = 3;

		function getLineHeightMm() {
			return (doc.getFontSize() * doc.getLineHeightFactor()) / doc.internal.scaleFactor;
		}

		function drawTableHeader() {
			currentY = drawQuotationTableHeader(doc, currentY, pricesExcludeIva);
		}

		function drawItemDetailBlock(detailText: string) {
			const detailLineHeight = getLineHeightMm();
			const detailLines = doc.splitTextToSize(detailText.trim(), 188);

			currentY += 2;
			doc.setFontSize(7);
			doc.setTextColor(70, 70, 70);

			for (const line of detailLines) {
				if (currentY + detailLineHeight > 270) {
					doc.addPage();
					currentY = 20;
					doc.setFontSize(7);
					doc.setTextColor(70, 70, 70);
				}
				doc.text(line, 11, currentY);
				currentY += detailLineHeight;
			}

			currentY += 2;
			doc.setFontSize(8);
			doc.setTextColor(0, 0, 0);
		}

		// Filas de productos con mejor manejo de texto
		for (const item of quotationItems) {
			const total = lineTotal(item);
			const displayUnitPrice = displayItemUnitPrice(item);
			const displayTotal = displayItemLineTotal(item);
			const lineHeight = getLineHeightMm();

			const skuLines = doc.splitTextToSize(item.sku || '-', 16);
			const descLines = doc.splitTextToSize(item.description || '', DESC_WIDTH);
			const textLineCount = Math.max(skuLines.length, descLines.length);
			const textBlockHeight = textLineCount * lineHeight;
			const hasImage = Boolean(item.imageUrl && imageCache.get(item.imageUrl));
			const imageBlockHeight = hasImage ? IMAGE_SIZE : 0;
			const contentHeight = Math.max(textBlockHeight, imageBlockHeight);
			const rowHeight = contentHeight + ROW_GAP;

			if (currentY + rowHeight + 2 > 270) {
				doc.addPage();
				currentY = 20;
				drawTableHeader();
			}

			const rowTop = currentY;

			if (hasImage) {
				const loadedImage = imageCache.get(item.imageUrl!);
				if (loadedImage) {
					doc.addImage(
						loadedImage.dataUrl,
						loadedImage.format,
						IMAGE_X,
						rowTop,
						IMAGE_SIZE,
						IMAGE_SIZE
					);
				}
			}

			const textY = rowTop + 1;
			doc.text(skuLines, SKU_X, textY);
			doc.text(descLines, DESC_X, textY);
			doc.text(String(item.quantity), QUOTATION_PDF_COL.cant, textY, { align: 'right' });
			doc.text(`$${displayUnitPrice.toFixed(2)}`, QUOTATION_PDF_COL.price, textY, { align: 'right' });
			doc.text(`${item.discount.toFixed(1)}%`, QUOTATION_PDF_COL.discount, textY, { align: 'right' });
			doc.text(`$${displayTotal.toFixed(2)}`, QUOTATION_PDF_COL.total, textY, { align: 'right' });

			currentY = rowTop + rowHeight;

			if (item.includeDetail && item.detailDescription?.trim()) {
				drawItemDetailBlock(item.detailDescription);
			}

			doc.setDrawColor(200, 210, 230);
			doc.setLineWidth(0.1);
			doc.line(10, currentY, 200, currentY);
			currentY += ROW_GAP;
		}

		// Totales
		currentY += 3;
		doc.setDrawColor(blueColor[0], blueColor[1], blueColor[2]);
		doc.setLineWidth(0.5);
		doc.line(120, currentY, 200, currentY);
		currentY += 6;
		
		const genDiscount = generalDiscountAmount();
		const summary = calculateQuotationSummary({
			itemsSubtotalConIva: quotationSubtotal(),
			generalDiscountAmount: genDiscount,
			shippingCost,
			installationCost,
			shippingMode,
			installationMode
		});
		const totalLines = buildQuotationTotalLines(pricesExcludeIva, summary, {
			generalDiscountPercent: generalDiscount,
			generalDiscountAmount: genDiscount
		});

		doc.setFontSize(9);

		for (const line of totalLines) {
			if (line.separatorBefore) {
				currentY += 2;
				doc.setDrawColor(200, 210, 230);
				doc.setLineWidth(0.1);
				doc.line(120, currentY, 200, currentY);
				currentY += 5;
			}

			if (line.section) {
				doc.setFont('helvetica', 'bold');
				doc.setFontSize(8);
				doc.setTextColor(80, 80, 80);
				doc.text(line.label, 120, currentY);
				doc.setTextColor(0, 0, 0);
				currentY += 5;
				continue;
			}

			if (line.red) {
				doc.setTextColor(redColor[0], redColor[1], redColor[2]);
			} else {
				doc.setTextColor(0, 0, 0);
			}

			if (line.bold) {
				doc.setFont('helvetica', 'bold');
				doc.setFontSize(11);
				doc.setTextColor(blueColor[0], blueColor[1], blueColor[2]);
			} else {
				doc.setFont('helvetica', 'normal');
				doc.setFontSize(9);
			}

			const pdfValue = line.value.startsWith('$') && !line.value.includes('MXN')
				? `${line.value} MXN`
				: line.value;

			doc.text(line.label, 155, currentY, { align: 'right' });
			doc.text(pdfValue, 195, currentY, { align: 'right' });
			currentY += line.bold ? 8 : 5;

			doc.setTextColor(0, 0, 0);
			doc.setFont('helvetica', 'normal');
		}

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
		if (currentY < 240) {
			currentY = 240;
		}
		doc.setDrawColor(redColor[0], redColor[1], redColor[2]);
		doc.line(10, currentY, 200, currentY);
		currentY += 6;
		
		// Datos bancarios
		doc.setFontSize(9);
		doc.setFont('helvetica', 'bold');
		doc.setTextColor(0, 0, 0);
		doc.text('DATOS BANCARIOS PARA DEPÓSITO O TRANSFERENCIA', 105, currentY, { align: 'center' });
		currentY += 5;
		
		doc.setFont('helvetica', 'normal');
		doc.setFontSize(8);
		doc.setTextColor(60, 60, 60);
		doc.text('Banco: BBVA Bancomer', 105, currentY, { align: 'center' });
		currentY += 4;
		doc.text('Nombre: Luis Enrique Guerra Zavala', 105, currentY, { align: 'center' });
		currentY += 4;
		doc.text('Cuenta: 0101373439', 105, currentY, { align: 'center' });
		currentY += 4;
		doc.text('Cuenta interbancaria: 012320001013734399', 105, currentY, { align: 'center' });
		currentY += 4;
		doc.text('Número de tarjeta: 4152 3132 0228 1320', 105, currentY, { align: 'center' });
		currentY += 6;
		
		doc.setFontSize(7);
		doc.setTextColor(100, 100, 100);
		doc.text('Esta cotización tiene una vigencia de ' + (quotationValidityDays || 15) + ' días naturales a partir de la fecha de emisión.', 105, currentY, { align: 'center' });
		doc.text('Gracias por su preferencia - Guerra Laser México', 105, currentY + 4, { align: 'center' });

		return doc;
	}
</script>

<svelte:head>
	<title>Cotizaciones - Admin</title>
</svelte:head>

<div class="min-h-screen bg-gray-50">
	<div class="container mx-auto px-4 py-6 max-w-7xl">
		<div class="mb-6 flex flex-wrap items-center justify-between gap-4">
			<div>
				<h1 class="text-3xl font-bold">
					{#if savedQuotationId}
						Editar Cotización {quotationNumber ? `#${quotationNumber}` : ''}
					{:else}
						Nueva Cotización
					{/if}
				</h1>
				<p class="text-gray-600 mt-1">
					{#if loadingQuotation}
						Cargando cotización...
					{:else if savedQuotationId}
						Modifica y guarda los cambios · Origen: {quotationSource === 'manual' ? 'Manual' : quotationSource === 'ai_assistant' ? 'Asistente IA' : 'Chat IA'}
					{:else}
						Crea cotizaciones profesionales para tus clientes
					{/if}
				</p>
			</div>
			<div class="flex flex-wrap gap-2">
				<a href="/admin/cotizaciones/historial" class="px-4 py-2 bg-white border border-gray-300 rounded-lg hover:bg-gray-50">
					📋 Ver guardadas
				</a>
				{#if savedQuotationId}
					<a href="/admin/cotizaciones" class="px-4 py-2 bg-purple-50 border border-purple-200 text-purple-700 rounded-lg hover:bg-purple-100">
						+ Nueva
					</a>
				{/if}
				<a href="/admin" class="px-4 py-2 border border-gray-300 rounded-lg hover:bg-gray-50">
					← Dashboard
				</a>
			</div>
		</div>

		<!-- Datos del cliente -->
		<div class="bg-white rounded-lg shadow-md p-6 mb-6">
			<div class="flex justify-between items-center mb-4">
				<h2 class="text-xl font-bold">Datos del Cliente</h2>
				{#if selectedCustomerId}
					<button
						onclick={clearCustomer}
						class="text-sm text-red-600 hover:text-red-700 font-medium"
					>
						🗑️ Limpiar cliente
					</button>
				{/if}
			</div>

			<!-- Búsqueda de cliente existente -->
			<div class="mb-4">
				<label class="block text-sm font-medium text-gray-700 mb-2">
					¿Cliente existente?
				</label>
				<CustomerSearch onSelect={handleCustomerSelect} />
				{#if selectedCustomerId}
					<p class="text-sm text-green-600 mt-2 flex items-center gap-2">
						✅ Cliente seleccionado - Los datos se han autocompletado
					</p>
				{/if}
			</div>

			<div class="border-t pt-4">
				<p class="text-sm text-gray-600 mb-3">
					{selectedCustomerId ? 'Puedes modificar los datos si es necesario' : 'O ingresa los datos manualmente'}
				</p>
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
		</div>

		<!-- Condiciones comerciales -->
		<div class="bg-white rounded-lg shadow-md p-6 mb-6">
			<h2 class="text-xl font-bold mb-4">Condiciones Comerciales</h2>
			<div class="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
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
				<ExtraCostField label="Envío" bind:mode={shippingMode} bind:amount={shippingCost} />
				<ExtraCostField label="Instalación" bind:mode={installationMode} bind:amount={installationCost} />
			</div>
			<div class="mt-4">
				<label class="block text-sm font-medium text-gray-700 mb-1">Notas adicionales</label>
				<textarea
					rows="2"
					class="w-full border rounded-md px-3 py-2"
					bind:value={notes}
					placeholder="Información adicional..."
				></textarea>
			</div>
			<div class="mt-4 pt-4 border-t">
				<label class="flex items-center gap-2 text-sm text-gray-700">
					<input
						type="checkbox"
						class="rounded border-gray-300"
						bind:checked={pricesExcludeIva}
					/>
					Mostrar precios de artículos sin IVA (precio ÷ 1.16)
				</label>
				<p class="text-xs text-gray-500 mt-1">
					Activa esta opción cuando el cliente pida ver el precio unitario y total de cada artículo antes de impuestos.
				</p>
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
					<div class="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 mb-4">
						<h3 class="text-lg font-semibold">Productos en la Cotización</h3>
						<div class="flex flex-wrap items-center gap-4">
							<label class="flex items-center gap-2 text-sm text-gray-700">
								<input
									type="checkbox"
									class="rounded border-gray-300"
									bind:checked={includeAllDetails}
									onchange={toggleIncludeAllDetails}
								/>
								Incluir descripciones detalladas en el PDF
							</label>
							<button
								onclick={resetQuotation}
								class="text-sm text-red-600 hover:text-red-700 underline"
							>
								Limpiar todo
							</button>
						</div>
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
										<th class="px-3 py-2 text-center border w-16">Foto</th>
										<th class="px-3 py-2 text-left border">SKU</th>
										<th class="px-3 py-2 text-left border">Descripción</th>
										<th class="px-3 py-2 text-right border w-20 whitespace-normal leading-tight align-bottom">Cant.</th>
										<th class="px-3 py-2 text-right border w-32 whitespace-normal leading-tight align-bottom">
											{#if pricesExcludeIva}
												Precio Unit.<br /><span class="text-xs font-normal">s/IVA</span>
											{:else}
												Precio Unit.
											{/if}
										</th>
										<th class="px-3 py-2 text-right border w-20 whitespace-normal leading-tight align-bottom">Desc. %</th>
										<th class="px-3 py-2 text-right border w-32 whitespace-normal leading-tight align-bottom">
											{#if pricesExcludeIva}
												Total<br /><span class="text-xs font-normal">s/IVA</span>
											{:else}
												Total
											{/if}
										</th>
										<th class="px-3 py-2 text-center border w-16">Quitar</th>
									</tr>
								</thead>
								<tbody>
									{#each quotationItems as item, index}
										<tr class="border-t">
											<td class="px-3 py-2 border align-middle text-center w-16">
												{#if item.imageUrl}
													<img
														src={item.imageUrl}
														alt=""
														class="h-12 w-12 object-contain mx-auto rounded border border-gray-200 bg-white"
													/>
												{/if}
											</td>
											<td class="px-3 py-2 border align-top">{item.sku}</td>
											<td class="px-3 py-2 border align-top">
												<textarea
													rows="2"
													class="w-full border rounded-md px-2 py-1 text-sm"
													bind:value={item.description}
													placeholder="Nombre del artículo"
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
												{#if pricesExcludeIva}
													<p class="text-xs text-gray-500 text-right mt-1">
														s/IVA: ${displayItemUnitPrice(item).toFixed(2)}
													</p>
												{/if}
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
												${displayItemLineTotal(item).toFixed(2)}
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
										<tr class="border-t bg-gray-50">
											<td colspan="8" class="px-3 py-3 border">
												<label class="flex items-center gap-2 text-sm text-gray-700 mb-2">
													<input
														type="checkbox"
														class="rounded border-gray-300"
														checked={item.includeDetail}
														onchange={(e) => toggleItemDetail(index, e.currentTarget.checked)}
													/>
													Incluir descripción detallada en el PDF
												</label>
												{#if item.includeDetail}
													<textarea
														rows="4"
														class="w-full border rounded-md px-3 py-2 text-sm"
														bind:value={item.detailDescription}
														placeholder="Características, especificaciones técnicas, accesorios incluidos..."
													></textarea>
													<div class="flex flex-wrap gap-2 mt-2">
														{#if item.catalogDetail}
															<button
																type="button"
																onclick={() => fillDetailFromCatalog(index)}
																class="text-xs px-3 py-1.5 bg-blue-100 text-blue-700 rounded-md hover:bg-blue-200"
															>
																Usar descripción del catálogo
															</button>
														{/if}
														{#if item.detailDescription?.trim()}
															<button
																type="button"
																onclick={() => {
																	item.detailDescription = '';
																	quotationItems = [...quotationItems];
																}}
																class="text-xs px-3 py-1.5 bg-gray-100 text-gray-600 rounded-md hover:bg-gray-200"
															>
																Limpiar descripción
															</button>
														{/if}
													</div>
												{/if}
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
										{#each totalLines as line}
											{#if line.separatorBefore}
												<div class="border-t border-gray-300 pt-2"></div>
											{/if}
											{#if line.section}
												<div class="text-xs font-semibold text-gray-500 pt-1">{line.label}</div>
											{:else}
												<div
													class="flex justify-between {line.bold ? 'text-lg font-bold border-t pt-2' : 'text-sm'} {line.red ? 'text-red-600' : ''}"
												>
													<span class={line.bold ? '' : 'font-medium'}>{line.label}</span>
													<span class={line.bold ? 'text-blue-600' : 'font-semibold'}>{line.value}</span>
												</div>
											{/if}
										{/each}
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
							💾 Actualizar Cotización
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
