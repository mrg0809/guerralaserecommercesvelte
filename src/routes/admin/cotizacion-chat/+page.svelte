<script lang="ts">
  let message = '';
  let chatHistory: { role: 'user' | 'assistant'; text: string }[] = [];
  let isLoading = false;

  async function sendMessage() {
    if (!message.trim()) return;

    // Add user message to chat
    chatHistory = [...chatHistory, { role: 'user', text: message }];
    const userMessage = message;
    message = '';
    isLoading = true;

    try {
      const response = await fetch('/api/generate-quotation-chat', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ message: userMessage }),
      });

      const result = await response.json();

      if (response.ok && result.success) {
        let assistantMessage = 'Se ha procesado tu solicitud.';
        if (result.downloadUrl) {
          // Crear un enlace de descarga para el PDF en base64
          const downloadLink = `<a href="${result.downloadUrl}" download="${result.pdfName}" class="link font-semibold text-blue-600 hover:text-blue-800">Descargar PDF: ${result.pdfName}</a>`;
          assistantMessage = `✅ Se ha generado tu cotización exitosamente.<br><br>${downloadLink}<br><br>La cotización incluye los productos solicitados con los costos de envío e instalación si fueron especificados.`;
        } else if (result.message) {
            assistantMessage = result.message;
        }
        chatHistory = [...chatHistory, { role: 'assistant', text: assistantMessage }];
      } else {
        chatHistory = [...chatHistory, { role: 'assistant', text: `Error: ${result.error || 'No se pudo procesar la solicitud.'}` }];
      }
    } catch (error) {
      chatHistory = [...chatHistory, { role: 'assistant', text: 'Hubo un error de conexión con el servidor.' }];
    } finally {
      isLoading = false;
    }
  }
</script>

<div class="p-4 md:p-8">
  <h1 class="text-2xl font-bold mb-4">Generar Cotización por Chat (IA)</h1>
  
  <div class="bg-base-100 p-4 rounded-lg shadow-xl">
    <div class="chat-container h-96 overflow-y-auto border rounded p-4 mb-4 bg-base-200">
      {#each chatHistory as chat}
        <div class="chat {chat.role === 'user' ? 'chat-end' : 'chat-start'}">
          <div class="chat-bubble {chat.role === 'user' ? 'chat-bubble-primary' : ''}">
            {@html chat.text}
          </div>
        </div>
      {:else}
        <div class="text-center text-base-content-secondary">
          <p>Comienza escribiendo lo que quieres cotizar.</p>
          <p class="text-sm">Ej: "Crea una cotización para Juan Perez con 2 llantas y 1 aceite".</p>
        </div>
      {/each}
      {#if isLoading}
        <div class="chat chat-start">
            <div class="chat-bubble">
                <span class="loading loading-dots loading-md"></span>
            </div>
        </div>
      {/if}
    </div>
    
    <form class="flex" on:submit|preventDefault={sendMessage}>
      <input 
        bind:value={message}
        type="text" 
        class="input input-bordered w-full" 
        placeholder="Escribe tu mensaje..."
        disabled={isLoading}
      />
      <button type="submit" class="btn btn-primary ml-2" disabled={isLoading}>
        {#if isLoading}
            <span class="loading loading-spinner"></span>
        {:else}
            Enviar
        {/if}
      </button>
    </form>
  </div>
</div>
