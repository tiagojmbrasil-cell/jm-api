import { createClient } from '@supabase/supabase-js';
const supabase = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_SERVICE_KEY
);
export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, PATCH, DELETE, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
  if (req.method === 'OPTIONS') return res.status(200).end();
  const { tabela, id, filtros } = req.query;
  if (!tabela) return res.status(400).json({ error: 'Tabela não informada' });
  const tabelasPermitidas = [
    'cotacoes', 'cotacoes_view', 'clientes', 'vendedores',
    'lotes', 'lote_motoristas', 'clientes_cadastro'
  ];
  if (!tabelasPermitidas.includes(tabela)) {
    return res.status(403).json({ error: 'Tabela não permitida' });
  }
  try {
    if (req.method === 'GET') {
      let query = supabase.from(tabela).select('*');
      if (id) query = query.eq('id', id);
      if (filtros) {
        const f = JSON.parse(filtros);
        Object.entries(f).forEach(([key, val]) => { query = query.eq(key, val); });
      }
      query = query.order('criado_em', { ascending: false });
      const { data, error } = await query;
      if (error) return res.status(500).json({ error: error.message });
      return res.status(200).json(data);
    }
    if (req.method === 'POST') {
      const { data, error } = await supabase.from(tabela).insert([req.body]).select();
      if (error) return res.status(500).json({ error: error.message });
      return res.status(200).json(data);
    }
    if (req.method === 'PATCH') {
      if (!id) return res.status(400).json({ error: 'ID obrigatório para atualização' });
      const { data, error } = await supabase.from(tabela).update(req.body).eq('id', id).select();
      if (error) return res.status(500).json({ error: error.message });
      return res.status(200).json(data);
    }
    if (req.method === 'DELETE') {
      if (!id) return res.status(400).json({ error: 'ID obrigatório para exclusão' });
      const { error } = await supabase.from(tabela).delete().eq('id', id);
      if (error) return res.status(500).json({ error: error.message });
      return res.status(200).json({ success: true });
    }
    return res.status(405).json({ error: 'Método não permitido' });
  } catch(e) {
    return res.status(500).json({ error: e.message });
  }
}
