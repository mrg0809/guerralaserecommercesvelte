import { json } from '@sveltejs/kit';
import type { RequestHandler } from './$types';
import { requireAiAccess } from '$lib/server/aiAuth';
import {
	buildRagPrompt,
	retrieveLocalContext,
	shouldSuggestWebFallback
} from '$lib/server/ai/hybridSearch';
import { generateText } from '$lib/server/ai/geminiClient';
import type { AiKnowledgeChannel, AiSessionType } from '$lib/types/assistant';

export const POST: RequestHandler = async ({ request }) => {
	const authResult = await requireAiAccess(request);
	if (!authResult.ok) return json({ error: authResult.error }, { status: authResult.status });

	const { auth, admin } = authResult;
	const body = await request.json();
	const {
		message,
		channel = 'general',
		sessionId,
		sessionType = 'knowledge',
		attachmentIds = []
	} = body as {
		message: string;
		channel?: AiKnowledgeChannel;
		sessionId?: string;
		sessionType?: AiSessionType;
		attachmentIds?: string[];
	};

	if (!message?.trim()) return json({ error: 'Mensaje requerido' }, { status: 400 });

	let session_id = sessionId;
	if (!session_id) {
		const { data: session, error } = await admin
			.from('ai_chat_sessions')
			.insert({
				user_id: auth.userId,
				team_member_id: auth.teamMemberId,
				channel,
				session_type: sessionType,
				title: message.slice(0, 80)
			})
			.select('id')
			.single();
		if (error) return json({ error: error.message }, { status: 500 });
		session_id = session.id;
	}

	await admin.from('ai_chat_messages').insert({
		session_id,
		role: 'user',
		content: message
	});

	let attachmentTexts: string[] = [];
	if (attachmentIds.length) {
		const { data: attachments } = await admin
			.from('ai_chat_attachments')
			.select('extracted_text, original_filename, mime_type')
			.in('id', attachmentIds);
		attachmentTexts =
			attachments?.map(
				(a) => `[Archivo: ${a.original_filename ?? 'adjunto'} (${a.mime_type})]\n${a.extracted_text ?? '(sin texto extraído)'}`
			) ?? [];
	}

	const { sources, contextText, bestScore } = await retrieveLocalContext(admin, message, channel);
	const useWebHint = shouldSuggestWebFallback(bestScore, contextText.length > 0);

	let webNote = '';
	if (useWebHint) {
		webNote =
			'\n\nNota: No se encontró información suficiente en la base local. Responde con tu mejor conocimiento técnico general sobre equipos láser y refacciones, e indica claramente que conviene verificar con proveedor o guardar la respuesta en la base del equipo si resulta correcta.';
	}

	const systemPrompt = buildRagPrompt(channel, contextText, attachmentTexts) + webNote;
	const assistantText = await generateText(systemPrompt, message);

	const metadata = {
		sources,
		canSave: useWebHint,
		suggestedTitle: message.slice(0, 120),
		suggestedContent: assistantText,
		suggestedChannel: channel
	};

	const { data: assistantMsg } = await admin
		.from('ai_chat_messages')
		.insert({
			session_id,
			role: 'assistant',
			content: assistantText,
			metadata
		})
		.select('id, content, metadata, created_at')
		.single();

	await admin
		.from('ai_chat_sessions')
		.update({ updated_at: new Date().toISOString(), title: message.slice(0, 80) })
		.eq('id', session_id);

	return json({
		success: true,
		sessionId: session_id,
		message: assistantMsg
	});
};

export const GET: RequestHandler = async ({ request, url }) => {
	const authResult = await requireAiAccess(request);
	if (!authResult.ok) return json({ error: authResult.error }, { status: authResult.status });

	const sessionId = url.searchParams.get('sessionId');
	if (!sessionId) return json({ error: 'sessionId requerido' }, { status: 400 });

	const { data: messages } = await authResult.admin
		.from('ai_chat_messages')
		.select('id, role, content, metadata, created_at')
		.eq('session_id', sessionId)
		.order('created_at', { ascending: true });

	return json({ messages: messages ?? [] });
};
