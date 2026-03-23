// v7
import { createClient } from '@supabase/supabase-js';

const supabase = createClient(
  process.env.URL_SUPABASE, // 🔥 corrigido aqui
  process.env.SUPABASE_SERVICE_KEY
);

export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, PATCH, DELETE, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
  if (req.method === 'OPTIONS') return res.status(200).end();

  if (req.query.acao === 'criar_usuario') {
    if (req.method !== 'POST') return res.status(405).json({ error: 'Método não permitido' });
    const { email, senha, nome, setor } = req.body;
    if (!email || !senha) return res.status(400).json({ error: 'Email e senha obrigatórios' });

    try {
      const { data, error } = await supabase.auth.admin.createUser({
        email,
        password: senha,
        email_confirm: true
      });

      if (error) return res.status(500).json({ error: error.message });

      const userId = data.user?.id;

      if (userId) {
        await supabase.from('usuarios_perfil').insert([
          {
            id: userId,
            nome,
            setor: setor || 'comercial',
            ativo: true
          }
        ]);
      }

      return res.status(200).json({ success: true, userId });

    } catch (e) {
      return res.status(500).json({ error: e.message });
    }
  }

  if (req.query.acao === 'deletar_usuario') {
    if (req.method !== 'POST') return res.status(405).json({ error: 'Método não permitido' });

    const { userId } = req.body;
    if (!userId) return res.status(400).json({ error: 'userId obrigatório' });

    try {
      const { error: authError } = await supabase.auth.admin.deleteUser(userId);
      if (authError) return res.status(500).json({ error: authError.message });

      await supabase.from('usuarios_perfil').delete().eq('id', userId);

      return res.status(200).json({ success: true });

    } catch (e) {
      return res.status(500).json({ error: e.message });
    }
  }

  const { tabela, id, filtros } = req.query;

  if (!tabela) return res.status(400).json({ error: 'Tabela não informada' });

  const tabelasPermitidas = [
    'cotacoes', 'cotacoes_view', 'clientes', 'vendedores',
    'lotes', 'lote_motoristas', 'clientes_cadastro',
    'usuarios_perfil', 'motoristas', 'log_atividades'
  ];

  if (!tabelasPermitidas.includes(tabela)) {
    return res.status(403).json({ error: 'Tabela não permitida' });
  }

  function castVal(val) {
    if (val === null || val === undefined) return val;
    const n = Number(val);
    return (!isNaN(n) && val !== '') ? n : val;
  }

  try {
    if (req.method === 'GET') {
      let query = supabase.from(tabela).select('*');

      if (id) query = query.eq('id', castVal(id));

      if (filtros) {
        const f = JSON.parse(filtros);
        Object.entries(f).forEach(([key, val]) => {
          query = query.eq(key, castVal(val));
        });
      }

      query = query.order('criado_em', { ascending: false });

      const { data, error } = await query;

      if (error) return res.status(500).json({ error: error.message });

      return res.status(200).json(data);
    }

    if (req.method === 'POST') {
      const { data, error } = await supabase
        .from(tabela)
        .insert([req.body])
        .select();

      if (error) return res.status(500).json({ error: error.message });

      return res.status(200).json(data);
    }

    if (req.method === 'PATCH') {
      if (!id) return res.status(400).json({ error: 'ID obrigatório para atualização' });

      const { data, error } = await supabase
        .from(tabela)
        .update(req.body)
        .eq('id', castVal(id))
        .select();

      if (error) return res.status(500).json({ error: error.message });

      return res.status(200).json(data);
    }

    if (req.method === 'DELETE') {
      if (!id) return res.status(400).json({ error: 'ID obrigatório para exclusão' });

      const { error } = await supabase
        .from(tabela)
        .delete()
        .eq('id', castVal(id));

      if (error) return res.status(500).json({ error: error.message });

      return res.status(200).json({ success: true });
    }

    return res.status(405).json({ error: 'Método não permitido' });

  } catch (e) {
    return res.status(500).json({ error: e.message });
  }
}
