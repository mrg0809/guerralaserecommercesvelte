import type { RequestHandler } from './$types';
import { json } from '@sveltejs/kit';
import { supabaseServer } from '$lib/supabaseServer';

export const POST: RequestHandler = async ({ request }) => {
  // Validate bearer token sent from client
  const authHeader = request.headers.get('authorization');
  const token = authHeader?.startsWith('Bearer ') ? authHeader.slice(7) : undefined;
  if (!token) {
    return json({ ok: false, error: 'No autenticado' }, { status: 401 });
  }
  const { data: userData, error: userErr } = await supabaseServer.auth.getUser(token);
  if (userErr || !userData?.user) {
    return json({ ok: false, error: 'Token inválido' }, { status: 401 });
  }
  const body = await request.json();
  const { op, payload, id } = body as {
    op: 'create' | 'update' | 'delete' | 'toggle';
    payload?: Record<string, unknown>;
    id?: string;
  };

  try {
    if (op === 'create' && payload) {
      const { error } = await supabaseServer.from('categories').insert([payload]);
      if (error) throw error;
      return json({ ok: true });
    }

    if (op === 'update' && id && payload) {
      const { error } = await supabaseServer.from('categories').update(payload).eq('id', id);
      if (error) throw error;
      return json({ ok: true });
    }

    if (op === 'delete' && id) {
      const { error } = await supabaseServer.from('categories').delete().eq('id', id);
      if (error) throw error;
      return json({ ok: true });
    }

    if (op === 'toggle' && id && typeof payload?.is_active === 'boolean') {
      const { error } = await supabaseServer
        .from('categories')
        .update({ is_active: payload.is_active as boolean })
        .eq('id', id);
      if (error) throw error;
      return json({ ok: true });
    }

    return json({ ok: false, error: 'Invalid request' }, { status: 400 });
  } catch (err: any) {
    return json({ ok: false, error: err.message }, { status: 500 });
  }
};
