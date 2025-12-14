<script lang="ts">
  import { supabase } from '$lib/supabaseClient';
  let email = '';
  let password = '';
  let errorMsg = '';

  async function login(e: Event) {
    e.preventDefault();
    errorMsg = '';
    const { error } = await supabase.auth.signInWithPassword({ email, password });
    if (error) {
      errorMsg = error.message;
      return;
    }
    // Redirect to admin after login
    window.location.href = '/admin';
  }
</script>

<div class="min-h-screen flex items-center justify-center bg-gray-50">
  <form on:submit={login} class="bg-white p-6 rounded shadow w-full max-w-sm space-y-4">
    <h1 class="text-2xl font-bold">Iniciar sesión</h1>
    {#if errorMsg}
      <p class="text-red-600 text-sm">{errorMsg}</p>
    {/if}
    <label class="block">
      <span class="text-sm font-semibold">Email</span>
      <input type="email" bind:value={email} required class="w-full px-3 py-2 border rounded" />
    </label>
    <label class="block">
      <span class="text-sm font-semibold">Contraseña</span>
      <input type="password" bind:value={password} required class="w-full px-3 py-2 border rounded" />
    </label>
    <button type="submit" class="w-full bg-blue-600 text-white py-2 rounded">Entrar</button>
  </form>
  </div>
