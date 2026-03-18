<script lang="ts">
	import { supabase } from '$lib/supabaseClient';

	const supabaseAny: any = supabase;

	let reportDate = $state<string>(new Date().toISOString().slice(0, 10));
	let paymentMethod = $state<'all' | 'cash' | 'card' | 'transfer'>('all');
	let includeCancelled = $state(false);
	let mode = $state<'transactions' | 'detailed'>('transactions');

	let loading = $state(false);

	type TxRow = {
		id: string;
		sale_number: string;
		created_at: string | null;
		payment_method: string | null;
		customer_name: string | null;
		total_amount: number | null;
		subtotal_amount: number | null;
		status: string | null;
		pos_sale_items?: Array<{
			product_name: string;
			variant_name: string | null;
			sku: string | null;
			quantity: number;
			unit_price: number;
			line_total: number;
		}>;
	};

	let sales = $state<TxRow[]>([]);

	type DailyTotals = {
		cash: number;
		card: number;
		transfer: number;
		grandTotal: number;
		cashCount: number;
		cardCount: number;
		transferCount: number;
		totalCount: number;
	};

	let totals = $state<DailyTotals>({
		cash: 0,
		card: 0,
		transfer: 0,
		grandTotal: 0,
		cashCount: 0,
		cardCount: 0,
		transferCount: 0,
		totalCount: 0
	});

	function toLocalDayRangeISO(dayStr: string) {
		// Usa la zona horaria del navegador para definir el rango de “ese día”.
		const startLocal = new Date(`${dayStr}T00:00:00`);
		const endLocal = new Date(startLocal.getTime() + 24 * 60 * 60 * 1000);
		return { startISO: startLocal.toISOString(), endISO: endLocal.toISOString() };
	}

	function resetReport() {
		sales = [];
		totals = {
			cash: 0,
			card: 0,
			transfer: 0,
			grandTotal: 0,
			cashCount: 0,
			cardCount: 0,
			transferCount: 0,
			totalCount: 0
		};
	}

	function computeTotals(list: TxRow[]) {
		const next: DailyTotals = {
			cash: 0,
			card: 0,
			transfer: 0,
			grandTotal: 0,
			cashCount: 0,
			cardCount: 0,
			transferCount: 0,
			totalCount: 0
		};

		for (const tx of list) {
			if (!includeCancelled && tx.status === 'cancelled') continue;
			const method = tx.payment_method ?? 'cash';
			const total = tx.total_amount ?? tx.subtotal_amount ?? 0;

			next.totalCount += 1;
			next.grandTotal += Number(total || 0);

			if (method === 'cash') {
				next.cash += Number(total || 0);
				next.cashCount += 1;
			} else if (method === 'card') {
				next.card += Number(total || 0);
				next.cardCount += 1;
			} else if (method === 'transfer') {
				next.transfer += Number(total || 0);
				next.transferCount += 1;
			}
		}

		return next;
	}

	async function generateDailySalesReport() {
		loading = true;
		try {
			resetReport();

			const { startISO, endISO } = toLocalDayRangeISO(reportDate);

			let query = supabaseAny
				.from('pos_sales')
				.select(
					mode === 'detailed'
						? 'id, sale_number, created_at, payment_method, customer_name, total_amount, subtotal_amount, status, pos_sale_items(product_name, variant_name, sku, quantity, unit_price, line_total)'
						: 'id, sale_number, created_at, payment_method, customer_name, total_amount, subtotal_amount, status'
				)
				.gte('created_at', startISO)
				.lt('created_at', endISO)
				.order('created_at', { ascending: false });

			if (!includeCancelled) {
				query = query.eq('status', 'paid');
			}

			if (paymentMethod !== 'all') {
				query = query.eq('payment_method', paymentMethod);
			}

			const { data, error } = await query;
			if (error) throw error;

			sales = (data ?? []) as TxRow[];
			totals = computeTotals(sales);
		} catch (e: any) {
			console.error('Error generando reporte POS:', e);
			alert(e?.message || 'Error generando el reporte');
			sales = [];
		} finally {
			loading = false;
		}
	}

	function formatMoney(n: number) {
		return new Intl.NumberFormat('es-MX', { style: 'currency', currency: 'MXN' }).format(n || 0);
	}

	function txTime(tx: TxRow) {
		if (!tx.created_at) return '-';
		return new Date(tx.created_at).toLocaleTimeString('es-MX', { hour: '2-digit', minute: '2-digit' });
	}
</script>

<svelte:head>
	<title>POS - Reportes</title>
</svelte:head>

<div class="min-h-screen bg-gray-50">
	<div class="container mx-auto px-4 py-6 max-w-7xl">
		<div class="mb-6">
			<h1 class="text-3xl font-bold text-gray-900">Reportes POS</h1>
			<p class="text-gray-600 mt-1">Genera un reporte de ventas por día, agrupado por forma de pago.</p>
		</div>

		<div class="bg-white rounded-lg shadow p-4">
			<div class="grid grid-cols-1 md:grid-cols-4 gap-3 items-end">
				<div>
					<div class="text-sm font-medium text-gray-800 mb-1">Día</div>
					<input type="date" class="w-full border rounded-md px-3 py-2" bind:value={reportDate} />
				</div>

				<div>
					<div class="text-sm font-medium text-gray-800 mb-1">Forma de pago</div>
					<select
						class="w-full border rounded-md px-3 py-2"
						bind:value={paymentMethod}
					>
						<option value="all">Todas</option>
						<option value="cash">Efectivo</option>
						<option value="card">Tarjeta</option>
						<option value="transfer">Transferencia</option>
					</select>
				</div>

				<div>
					<div class="text-sm font-medium text-gray-800 mb-1">Modo</div>
					<select class="w-full border rounded-md px-3 py-2" bind:value={mode}>
						<option value="transactions">Resumen (solo transacciones)</option>
						<option value="detailed">Detallado (con artículos)</option>
					</select>
				</div>

				<div class="flex gap-2 md:justify-end">
					<div class="flex items-center gap-2 mb-1">
						<input id="includeCancelled" type="checkbox" class="h-4 w-4" bind:checked={includeCancelled} />
						<label for="includeCancelled" class="text-sm text-gray-700">Incluir canceladas</label>
					</div>
				</div>
			</div>

			<div class="mt-4 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
				<button
					type="button"
					class="px-5 py-2.5 rounded-lg bg-purple-600 text-white hover:bg-purple-700 font-medium disabled:opacity-50"
					onclick={() => void generateDailySalesReport()}
					disabled={loading}
				>
					{#if loading}Generando...{:else}Generar reporte{/if}
				</button>

				<div class="text-sm text-gray-600">
					Fecha: <span class="font-semibold text-gray-800">{reportDate}</span>
				</div>
			</div>

			{#if sales.length > 0}
				<div class="mt-5 border-t pt-4">
					<div class="grid grid-cols-1 md:grid-cols-4 gap-3">
						<div class="bg-gray-50 rounded-lg p-3">
							<div class="text-xs text-gray-600">Efectivo</div>
							<div class="text-lg font-bold text-gray-900">{formatMoney(totals.cash)}</div>
							<div class="text-xs text-gray-500">{totals.cashCount} ventas</div>
						</div>
						<div class="bg-gray-50 rounded-lg p-3">
							<div class="text-xs text-gray-600">Tarjeta</div>
							<div class="text-lg font-bold text-gray-900">{formatMoney(totals.card)}</div>
							<div class="text-xs text-gray-500">{totals.cardCount} ventas</div>
						</div>
						<div class="bg-gray-50 rounded-lg p-3">
							<div class="text-xs text-gray-600">Transferencia</div>
							<div class="text-lg font-bold text-gray-900">{formatMoney(totals.transfer)}</div>
							<div class="text-xs text-gray-500">{totals.transferCount} ventas</div>
						</div>
						<div class="bg-gray-50 rounded-lg p-3">
							<div class="text-xs text-gray-600">Total del día</div>
							<div class="text-lg font-bold text-gray-900">{formatMoney(totals.grandTotal)}</div>
							<div class="text-xs text-gray-500">{totals.totalCount} ventas</div>
						</div>
					</div>
				</div>
			{/if}
		</div>

		{#if !loading && sales.length === 0}
			<div class="mt-4 bg-white rounded-lg shadow p-6 text-center text-gray-500">
				Genera el reporte para ver resultados.
			</div>
		{/if}

		{#if !loading && sales.length > 0}
			<div class="mt-4 bg-white rounded-lg shadow overflow-hidden">
				<div class="p-4 border-b">
					<div class="text-lg font-semibold text-gray-900">
						{mode === 'detailed' ? 'Detalle por transacción' : 'Transacciones'}
					</div>
					<div class="text-sm text-gray-600 mt-1">
						{paymentMethod === 'all' ? 'Todas las formas de pago' : 'Filtrado por forma de pago'}.
					</div>
				</div>

				{#if mode === 'transactions'}
					<div class="overflow-auto">
						<table class="w-full text-sm">
							<thead class="bg-gray-50">
								<tr>
									<th class="text-left px-3 py-2 w-36">Folio</th>
									<th class="text-left px-3 py-2">Cliente</th>
									<th class="text-left px-3 py-2 w-28">Hora</th>
									<th class="text-left px-3 py-2 w-36">Pago</th>
									<th class="text-right px-3 py-2 w-32">Total</th>
									<th class="text-left px-3 py-2 w-28">Estado</th>
								</tr>
							</thead>
							<tbody>
								{#each sales as tx (tx.id)}
									<tr class="border-t">
										<td class="px-3 py-2 font-medium">{tx.sale_number}</td>
										<td class="px-3 py-2">{tx.customer_name || 'Público General'}</td>
										<td class="px-3 py-2">{txTime(tx)}</td>
										<td class="px-3 py-2">
											{tx.payment_method === 'cash'
												? 'Efectivo'
												: tx.payment_method === 'card'
													? 'Tarjeta'
													: tx.payment_method === 'transfer'
														? 'Transferencia'
														: tx.payment_method || '-'}
										</td>
										<td class="px-3 py-2 text-right font-medium">
											{formatMoney(tx.total_amount ?? tx.subtotal_amount ?? 0)}
										</td>
										<td class="px-3 py-2">
											<span
												class={`text-xs font-medium ${
													tx.status === 'cancelled' ? 'text-red-700' : 'text-green-700'
												}`}
											>
												{tx.status === 'cancelled' ? 'Cancelada' : 'Pagada'}
											</span>
										</td>
									</tr>
								{/each}
							</tbody>
						</table>
					</div>
				{:else}
					<div class="p-4 overflow-auto">
						{#each sales as tx (tx.id)}
							<div class="mb-4 border rounded-lg overflow-hidden">
								<div class="bg-gray-50 p-3 flex items-center justify-between gap-3">
									<div>
										<div class="font-semibold text-gray-900">{tx.sale_number}</div>
										<div class="text-xs text-gray-600 mt-1">
											{tx.customer_name || 'Público General'} | {txTime(tx)} |{' '}
											{tx.payment_method === 'cash'
												? 'Efectivo'
												: tx.payment_method === 'card'
													? 'Tarjeta'
													: tx.payment_method === 'transfer'
														? 'Transferencia'
														: tx.payment_method || '-'}
										</div>
									</div>
									<div class="text-right">
										<div class="font-bold text-gray-900">
											{formatMoney(tx.total_amount ?? tx.subtotal_amount ?? 0)}
										</div>
										<div class="text-xs text-gray-500 mt-1">
											{tx.status === 'cancelled' ? 'Cancelada' : 'Pagada'}
										</div>
									</div>
								</div>

								<div class="p-3">
									{#if tx.pos_sale_items && tx.pos_sale_items.length > 0}
										<table class="w-full text-sm">
											<thead>
												<tr>
													<th class="text-left px-2 py-2 w-[40%]">Artículo</th>
													<th class="text-right px-2 py-2 w-20">Cant</th>
													<th class="text-right px-2 py-2 w-28">Precio</th>
													<th class="text-right px-2 py-2 w-28">Importe</th>
												</tr>
											</thead>
											<tbody>
												{#each tx.pos_sale_items as line, idx (idx)}
													<tr class="border-t">
														<td class="px-2 py-2 align-top">
															<div class="font-medium text-gray-900">
																{line.variant_name ? `${line.product_name} - ${line.variant_name}` : line.product_name}
															</div>
															{#if line.sku}
																<div class="text-xs text-gray-500 mt-1">SKU: {line.sku}</div>
															{/if}
														</td>
														<td class="px-2 py-2 text-right">{line.quantity}</td>
														<td class="px-2 py-2 text-right">{formatMoney(line.unit_price)}</td>
														<td class="px-2 py-2 text-right font-medium">
															{formatMoney(line.line_total)}
														</td>
													</tr>
												{/each}
											</tbody>
										</table>
									{:else}
										<div class="text-sm text-gray-500">Sin artículos.</div>
									{/if}
								</div>
							</div>
						{/each}
					</div>
				{/if}
			</div>
		{/if}
	</div>
</div>

