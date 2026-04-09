// v10 — JWT verification reativado
import { createClient } from '@supabase/supabase-js';

// Cliente SERVICE KEY — usado apenas para validar tokens e operações admin
const supabaseAdmin = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_SERVICE_KEY
);

// ─── Extrai e valida o JWT enviado pelo frontend ───────────────────────────
async function autenticarRequisicao(req) {
  const authHeader = req.headers['authorization'] || '';
  const token = authHeader.startsWith('Bearer ') ? authHeader.slice(7) : null;

  if (!token) return { erro: 'Token JWT ausente', status: 401 };

  // Valida o token com o Supabase — retorna o usuário autenticado
  const { data, error } = await supabaseAdmin.auth.getUser(token);
  if (error || !data?.user) return { erro: 'Token inválido ou expirado', status: 401 };

  return { usuario: data.user };
}

// ─── Verifica se o usuário é admin no perfil ───────────────────────────────
async function verificarAdmin(userId) {
  const { data } = await supabaseAdmin
    .from('usuarios_perfil')
    .select('setor')
    .eq('id', userId)
    .single();
  return data?.setor === 'admin';
}

export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, PATCH, DELETE, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');
  if (req.method === 'OPTIONS') return res.status(200).end();

  // ── AUTENTICAÇÃO OBRIGATÓRIA em todas as rotas ────────────────────────────
  const auth = await autenticarRequisicao(req);
  if (auth.erro) return res.status(auth.status).json({ error: auth.erro });
  const usuarioAutenticado = auth.usuario;

  // ── CRIAR USUÁRIO — apenas admins ─────────────────────────────────────────
  if (req.query.acao === 'criar_usuario') {
    if (req.method !== 'POST') return res.status(405).json({ error: 'Método não permitido' });

    const isAdmin = await verificarAdmin(usuarioAutenticado.id);
    if (!isAdmin) return res.status(403).json({ error: 'Permissão negada — apenas administradores' });

    const { email, senha, nome, setor } = req.body;
    if (!email || !senha) return res.status(400).json({ error: 'Email e senha obrigatórios' });
    try {
      const { data, error } = await supabaseAdmin.auth.admin.createUser({
        email, password: senha, email_confirm: true
      });
      if (error) return res.status(500).json({ error: error.message });
      const userId = data.user?.id;
      if (userId) {
        await supabaseAdmin.from('usuarios_perfil').insert([{
          id: userId, nome, setor: setor || 'comercial', ativo: true
        }]);
      }
      return res.status(200).json({ success: true, userId });
    } catch (e) { return res.status(500).json({ error: e.message }); }
  }

  // ── DELETAR USUÁRIO — apenas admins ──────────────────────────────────────
  if (req.query.acao === 'deletar_usuario') {
    if (req.method !== 'POST') return res.status(405).json({ error: 'Método não permitido' });

    const isAdmin = await verificarAdmin(usuarioAutenticado.id);
    if (!isAdmin) return res.status(403).json({ error: 'Permissão negada — apenas administradores' });

    const { userId } = req.body;
    if (!userId) return res.status(400).json({ error: 'userId obrigatório' });
    try {
      const { error: authError } = await supabaseAdmin.auth.admin.deleteUser(userId);
      if (authError) return res.status(500).json({ error: authError.message });
      await supabaseAdmin.from('usuarios_perfil').delete().eq('id', userId);
      return res.status(200).json({ success: true });
    } catch (e) { return res.status(500).json({ error: e.message }); }
  }

  // ── CRUD GERAL ────────────────────────────────────────────────────────────
  const { tabela, id, filtros } = req.query;
  if (!tabela) return res.status(400).json({ error: 'Tabela não informada' });

  const tabelasPermitidas = [
    'cotacoes', 'cotacoes_view', 'clientes', 'vendedores',
    'lotes', 'lote_motoristas', 'clientes_cadastro', 'usuarios_perfil',
    'motoristas', 'log_atividades'
  ];
  if (!tabelasPermitidas.includes(tabela)) return res.status(403).json({ error: 'Tabela não permitida' });

  function castVal(val) {
    if (val === null || val === undefined) return val;
    const n = Number(val);
    return (!isNaN(n) && val !== '') ? n : val;
  }

  // Usa cliente com o TOKEN DO USUÁRIO — o RLS do Supabase entra em ação automaticamente
  const supabaseUser = createClient(
    process.env.SUPABASE_URL,
    process.env.SUPABASE_ANON_KEY,
    { global: { headers: { Authorization: req.headers['authorization'] } } }
  );

  try {
    if (req.method === 'GET') {
      let query = supabaseUser.from(tabela).select('*');
      if (id) query = query.eq('id', castVal(id));
      if (filtros) {
        const f = JSON.parse(filtros);
        Object.entries(f).forEach(([key, val]) => { query = query.eq(key, castVal(val)); });
      }
      query = query.order('criado_em', { ascending: false });
      const { data, error } = await query;
      if (error) return res.status(500).json({ error: error.message });
      return res.status(200).json(data);
    }
    if (req.method === 'POST') {
      const { data, error } = await supabaseUser.from(tabela).insert([req.body]).select();
      if (error) return res.status(500).json({ error: error.message });
      return res.status(200).json(data);
    }
    if (req.method === 'PATCH') {
      if (!id) return res.status(400).json({ error: 'ID obrigatório para atualização' });
      const { data, error } = await supabaseUser.from(tabela).update(req.body).eq('id', castVal(id)).select();
      if (error) return res.status(500).json({ error: error.message });
      return res.status(200).json(data);
    }
    if (req.method === 'DELETE') {
      if (!id) return res.status(400).json({ error: 'ID obrigatório para exclusão' });
      const { error } = await supabaseUser.from(tabela).delete().eq('id', castVal(id));
      if (error) return res.status(500).json({ error: error.message });
      return res.status(200).json({ success: true });
    }
    return res.status(405).json({ error: 'Método não permitido' });
  } catch (e) { return res.status(500).json({ error: e.message }); }
}
