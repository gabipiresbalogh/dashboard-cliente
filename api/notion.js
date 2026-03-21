export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET');

  const NOTION_TOKEN = process.env.NOTION_TOKEN;
  if (!NOTION_TOKEN) return res.status(500).json({ error: 'NOTION_TOKEN nao configurado' });

  const headers = {
    'Authorization': `Bearer ${NOTION_TOKEN}`,
    'Notion-Version': '2022-06-28',
    'Content-Type': 'application/json',
  };

  const { tipo } = req.query;

  async function queryDB(dbId, filter) {
    let all = [], hasMore = true, cursor;
    while (hasMore) {
      const body = { page_size: 100 };
      if (filter) body.filter = filter;
      if (cursor) body.start_cursor = cursor;
      const r = await fetch(`https://api.notion.com/v1/databases/${dbId}/query`, {
        method: 'POST', headers, body: JSON.stringify(body)
      });
      const d = await r.json();
      if (!r.ok) { console.error('Notion error:', JSON.stringify(d)); break; }
      all = all.concat(d.results || []);
      hasMore = d.has_more;
      cursor = d.next_cursor;
    }
    return all;
  }

  function getProp(props, name) {
    const p = props[name];
    if (!p) return null;
    switch (p.type) {
      case 'title':        return p.title?.map(t => t.plain_text).join('') || null;
      case 'rich_text':    return p.rich_text?.map(t => t.plain_text).join('') || null;
      case 'number':       return p.number ?? null;
      case 'select':       return p.select?.name || null;
      case 'multi_select': return p.multi_select?.map(s => s.name) || [];
      case 'checkbox':     return p.checkbox ?? false;
      case 'date':         return p.date?.start || null;
      case 'url':          return p.url || null;
      case 'status':       return p.status?.name || null;
      case 'formula':
        if (p.formula?.type === 'number') return p.formula.number;
        if (p.formula?.type === 'string') return p.formula.string;
        return null;
      default: return null;
    }
  }

  const MESES = {
    '01':'Janeiro','02':'Fevereiro','03':'Marco','04':'Abril',
    '05':'Maio','06':'Junho','07':'Julho','08':'Agosto',
    '09':'Setembro','10':'Outubro','11':'Novembro','12':'Dezembro'
  };

  const DS_POSTS    = '1b4cfb56-0096-8100-b56b-000b9dd3ca89';
  const DS_METRICAS = '6b6b907b-069b-4254-b7b3-e05f916298ac';
  const DS_INSIGHTS = '93c90a67c5004abaa1604c1b76ab83f4';
  const DS_TOPPOSTS = '4b1fdfe2-53cd-4514-a0b4-bc6fed9153de';
  const DS_FUNIL    = 'e50aca39-bc5e-4157-bd68-682a895716ca';

  try {
    if (tipo === 'posts') {
      // Busca TODOS os posts com data preenchida — filtra status no JS
      const filter = {
        property: 'Data da publicação',
        date: { is_not_empty: true }
      };
      const pages = await queryDB(DS_POSTS, filter);
      const posts = pages
        .filter(page => {
          const status = page.properties?.Status?.status?.name;
          return status === 'Aprovado e agendado';
        })
        .map(page => {
          const p = page.properties;
          const data = getProp(p, 'Data da publicação');
          const mes = data ? (MESES[data.slice(5,7)] || null) : null;
          return {
            id: page.id, mes,
            impulsionado: getProp(p, 'Impulsionado') === true,
            post: getProp(p, 'Post'),
            data, mes,
            midia: getProp(p, 'Mídia'),
            categoria: getProp(p, 'Categoria'),
            faseJornada: getProp(p, 'Fase da jornada'),
            visualizacoes: getProp(p, 'Visualizações'),
            curtidas: getProp(p, 'Curtidas'),
            comentarios: getProp(p, 'Comentários'),
            compartilhamentos: getProp(p, 'Compartilhamentos'),
            salvamentos: getProp(p, 'Salvamentos'),
            alcanceOrganico: getProp(p, 'Alcance Orgânico'),
            novosSeguidores: getProp(p, 'Novos seguidores'),
            retencao: getProp(p, 'Retenção'),
            taxa3s: getProp(p, 'Taxa de 3s'),
            taxaEngajamento: getProp(p, 'Taxa de engajamento'),
            taxaCurtidas: getProp(p, 'Taxa de curtidas'),
            taxaCompartilhamento: getProp(p, 'Taxa de compartilhamento'),
            linkPost: getProp(p, 'Link do post'),
          };
        }).filter(p => p.mes);
      return res.status(200).json({ posts });
    }

    if (tipo === 'metricas') {
      const pages = await queryDB(DS_METRICAS);
      const metricas = pages.map(page => {
        const p = page.properties;
        return {
          mes: getProp(p, 'Mês de referência'),
          ano: getProp(p, 'Ano'),
          alcanceOrganico: getProp(p, '📣 Alcance Orgânico'),
          alcancePago: getProp(p, '💰 Alcance Pago'),
          seguidoresGanhos: getProp(p, '👤 Seguidores Ganhos'),
          seguidoresPerdidos: getProp(p, '👤 Seguidores Perdidos'),
          totalSeguidores: getProp(p, '👥 Total de Seguidores'),
          cliquesLink: getProp(p, '🔗 Cliques no Link'),
          visitasPerfil: getProp(p, '👁 Visitas ao Perfil'),
          leads: getProp(p, '🏆 Leads'),
          pacientes: getProp(p, '🏥 Pacientes'),
          cirurgias: getProp(p, '⚕️ Cirurgias'),
          engajamentoPerfil: getProp(p, '📊 Engajamento do Perfil'),
          taxaCrescimento: getProp(p, '📈 Taxa de Crescimento'),
        };
      });
      return res.status(200).json({ metricas });
    }

    if (tipo === 'insights') {
      const pages = await queryDB(DS_INSIGHTS);
      const insights = pages
        .filter(page => page.properties['Visível para o cliente']?.checkbox === true)
        .map(page => {
          const p = page.properties;
          return {
            titulo: getProp(p, 'Insight'),
            tipo: getProp(p, 'Tipo'),
            mes: getProp(p, 'Mês de referência'),
          };
        });
      return res.status(200).json({ insights });
    }

    if (tipo === 'topposts') {
      const pages = await queryDB(DS_TOPPOSTS);
      const topPosts = pages.map(page => {
        const p = page.properties;
        return {
          post: getProp(p, 'Post'),
          mes: getProp(p, 'Mês de referência'),
          midia: getProp(p, 'Mídia'),
          linkPost: getProp(p, 'Link do post'),
          capa: getProp(p, 'Capa'),
          retencao: getProp(p, 'Retenção'),
          taxaCurtidas: getProp(p, 'Taxa de curtidas'),
          taxaCompartilhamento: getProp(p, 'Taxa de compartilhamento'),
          visualizacoes: getProp(p, 'Visualizações'),
        };
      });
      return res.status(200).json({ topPosts });
    }

    if (tipo === 'funil') {
      const pages = await queryDB(DS_FUNIL);
      const etapas = pages
        .filter(page => page.properties['Ativo']?.checkbox === true)
        .map(page => {
          const p = page.properties;
          return {
            etapa: getProp(p, 'Etapa'),
            ordem: getProp(p, 'Ordem'),
            campoNotion: getProp(p, 'Campo no Notion'),
          };
        })
        .sort((a, b) => (a.ordem || 0) - (b.ordem || 0));
      return res.status(200).json({ etapas });
    }

    return res.status(400).json({ error: 'Tipo invalido' });

  } catch (err) {
    console.error(err);
    return res.status(500).json({ error: err.message });
  }
}
