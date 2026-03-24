import { createClient } from '@supabase/supabase-js'

const supabaseUrl = process.env.SUPABASE_URL
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY

if (!supabaseUrl || !supabaseServiceKey) {
  throw new Error('SUPABASE_URL et SUPABASE_SERVICE_ROLE_KEY sont requis')
}

// Client admin — utilisé pour vérifier les tokens et les opérations d'auth
// Ne jamais exposer côté frontend
export const supabaseAdmin = createClient(supabaseUrl, supabaseServiceKey, {
  auth: {
    autoRefreshToken: false,
    persistSession: false,
  },
})

// ── Realtime broadcast ────────────────────────────────────────────────────────

type ChannelEvent = 'message:new' | 'message:delete' | 'reaction:toggle'

/**
 * Diffuse un événement sur le canal Supabase Realtime d'un channel.
 * Appelé côté API après chaque mutation de message ou réaction.
 * Non-critique : une erreur ici ne fait pas échouer la requête.
 */
export async function broadcastToChannel(
  channelId: string,
  event: ChannelEvent,
  payload: unknown
): Promise<void> {
  try {
    await supabaseAdmin.channel(`channel:${channelId}`).send({
      type: 'broadcast',
      event,
      payload,
    })
  } catch {
    // Realtime down ou erreur réseau — ne pas bloquer la réponse API
  }
}
