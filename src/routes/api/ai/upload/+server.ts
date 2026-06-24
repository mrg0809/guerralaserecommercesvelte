import { json } from '@sveltejs/kit';
import type { RequestHandler } from './$types';
import { requireAiAccess } from '$lib/server/aiAuth';

const MAX_SIZE = 10 * 1024 * 1024;
const ALLOWED = ['image/jpeg', 'image/png', 'image/webp', 'application/pdf'];

export const POST: RequestHandler = async ({ request }) => {
	const authResult = await requireAiAccess(request);
	if (!authResult.ok) return json({ error: authResult.error }, { status: authResult.status });

	const formData = await request.formData();
	const file = formData.get('file') as File | null;
	const sessionId = formData.get('sessionId') as string | null;

	if (!file) return json({ error: 'Archivo requerido' }, { status: 400 });
	if (!ALLOWED.includes(file.type)) return json({ error: 'Tipo no permitido' }, { status: 400 });
	if (file.size > MAX_SIZE) return json({ error: 'Archivo demasiado grande (máx 10MB)' }, { status: 400 });

	const buffer = Buffer.from(await file.arrayBuffer());
	const ext = file.name.split('.').pop() ?? 'bin';
	const path = `uploads/${Date.now()}-${crypto.randomUUID().slice(0, 8)}.${ext}`;

	const { error: uploadError } = await authResult.admin.storage
		.from('ai-chat-attachments')
		.upload(path, buffer, { contentType: file.type, upsert: false });

	if (uploadError) {
		return json(
			{ error: `Error al subir: ${uploadError.message}. ¿Creaste el bucket ai-chat-attachments?` },
			{ status: 500 }
		);
	}

	let extracted_text: string | null = null;
	if (file.type === 'application/pdf') {
		extracted_text = `[PDF: ${file.name}, ${Math.round(file.size / 1024)}KB — extracción de texto pendiente de indexar]`;
	} else if (file.type.startsWith('image/')) {
		extracted_text = `[Imagen: ${file.name} — se enviará a Gemini como contexto visual en el chat]`;
	}

	const { data, error } = await authResult.admin
		.from('ai_chat_attachments')
		.insert({
			session_id: sessionId,
			storage_path: path,
			original_filename: file.name,
			mime_type: file.type,
			file_size_bytes: file.size,
			extracted_text
		})
		.select('id, original_filename, mime_type')
		.single();

	if (error) return json({ error: error.message }, { status: 500 });
	return json({ success: true, attachment: data });
};
