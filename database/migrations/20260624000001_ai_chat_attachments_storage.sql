-- Políticas Storage para adjuntos del asistente IA
-- Bucket: ai-chat-attachments (privado)

CREATE POLICY "Service role full access ai attachments"
ON storage.objects FOR ALL
TO service_role
USING (bucket_id = 'ai-chat-attachments')
WITH CHECK (bucket_id = 'ai-chat-attachments');
