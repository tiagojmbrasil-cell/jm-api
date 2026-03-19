import { createClient } from '@supabase/supabase-js';

const supabase = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_SERVICE_KEY
);

export default async function handler(req, res) {

  if (req.method === 'GET') {
    const { data, error } = await supabase
      .from('cotacoes')
      .select('*');

    if (error) return res.status(500).json({ error: error.message });

    return res.status(200).json(data);
  }

  if (req.method === 'POST') {
    const body = req.body;

    if (!body.cliente) {
      return res.status(400).json({ error: 'Cliente obrigatório' });
    }

    const { data, error } = await supabase
      .from('cotacoes')
      .insert([{
        cliente_nome: body.cliente,
        valor_cotado: body.valor || 0
      }]);

    if (error) return res.status(500).json({ error: error.message });

    return res.status(200).json(data);
  }

  return res.status(405).json({ error: 'Método não permitido' });
}
