export type DeliveryStatus = 'draft' | 'in_progress' | 'signed' | 'emailed';

/** Valores almacenados; etiquetas ordenadas alfabéticamente en MACHINERY_TYPE_OPTIONS */
export type MachineryType =
	| 'canteadora'
	| 'centro_maquinado'
	| 'cnc'
	| 'co2'
	| 'fibra_optica'
	| 'plasma'
	| 'torno';

export const MACHINERY_TYPE_LABELS: Record<MachineryType, string> = {
	canteadora: 'Canteadora',
	centro_maquinado: 'Centro de maquinado',
	cnc: 'CNC',
	co2: 'CO2',
	fibra_optica: 'Fibra Óptica',
	plasma: 'Plasma',
	torno: 'Torno'
};

/** Opciones en orden alfabético por etiqueta */
export const MACHINERY_TYPE_OPTIONS: { value: MachineryType; label: string }[] = (
	Object.entries(MACHINERY_TYPE_LABELS) as [MachineryType, string][]
)
	.map(([value, label]) => ({ value, label }))
	.sort((a, b) => a.label.localeCompare(b.label, 'es'));

export type AccessoryType = 'chiller' | 'regulator' | 'rotary' | 'extractor' | 'other';

export const ACCESSORY_LABELS: Record<AccessoryType, string> = {
	chiller: 'Chiller',
	regulator: 'Regulador',
	rotary: 'Rotativo',
	extractor: 'Extractor',
	other: 'Otro'
};

export const DELIVERY_STATUS_LABELS: Record<DeliveryStatus, string> = {
	draft: 'Borrador',
	in_progress: 'En proceso',
	signed: 'Firmada',
	emailed: 'Enviada'
};

export interface MachineDeliveryAccessory {
	id?: string;
	accessory_type: AccessoryType;
	description?: string | null;
	serial_number?: string | null;
	notes?: string | null;
}

export interface MachineDeliveryPhoto {
	id: string;
	storage_path: string;
	caption?: string | null;
	sort_order?: number;
}

export interface MachineDelivery {
	id: string;
	delivery_number: string;
	customer_id: string;
	assigned_technician_id?: string | null;
	created_by?: string | null;
	machinery_type: MachineryType;
	machine_model: string;
	serial_number: string;
	delivery_address: string;
	delivery_date: string;
	installation_completed: boolean;
	left_operational: boolean;
	training_provided: boolean;
	training_notes?: string | null;
	technician_observations?: string | null;
	customer_observations?: string | null;
	customer_signature_path?: string | null;
	technician_signature_path?: string | null;
	pdf_storage_path?: string | null;
	status: DeliveryStatus;
	signed_at?: string | null;
	emailed_at?: string | null;
	created_at: string;
	updated_at: string;
	customers?: {
		id: string;
		contact_name: string;
		company_name?: string | null;
		email: string;
		phone?: string | null;
		mobile?: string | null;
		street?: string | null;
		neighborhood?: string | null;
		city?: string | null;
		state?: string | null;
		zip_code?: string | null;
		rfc?: string | null;
	};
	machine_delivery_accessories?: MachineDeliveryAccessory[];
	machine_delivery_photos?: MachineDeliveryPhoto[];
}

export interface CreateDeliveryPayload {
	customer_id: string;
	assigned_technician_id?: string;
	machinery_type: MachineryType;
	machine_model: string;
	serial_number: string;
	delivery_address: string;
	delivery_date?: string;
	installation_completed?: boolean;
	left_operational?: boolean;
	training_provided?: boolean;
	training_notes?: string;
	accessories?: MachineDeliveryAccessory[];
}
