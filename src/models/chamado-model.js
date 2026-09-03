const selectDetails = `SELECT c.*, u.nome AS cliente_nome, t.nome AS tecnico_nome
  FROM chamados c JOIN usuarios u ON u.id = c.cliente_id
  LEFT JOIN usuarios t ON t.id = c.tecnico_id`;

function filters(user, query) {
  const parts = [],
    values = [];
  if (user.perfil === 'cliente') {
    parts.push('c.cliente_id = ?');
    values.push(user.id);
  }
  if (query.meus === 'true' && user.perfil === 'tecnico') {
    parts.push('c.tecnico_id = ?');
    values.push(user.id);
  }
  for (const field of ['status', 'categoria', 'prioridade']) {
    if (query[field]) {
      parts.push(`c.${field} = ?`);
      values.push(query[field]);
    }
  }
  if (query.busca) {
    const protocol = query.busca.match(/^(?:HD-)?0*(\d+)$/i);
    if (protocol && Number.isSafeInteger(Number(protocol[1]))) {
      parts.push('c.id = ?');
      values.push(Number(protocol[1]));
    } else {
      parts.push("c.titulo LIKE ? ESCAPE '!'");
      values.push(`%${query.busca.replace(/[!%_]/g, '!$&')}%`);
    }
  }
  return { where: parts.length ? ` WHERE ${parts.join(' AND ')}` : '', values };
}

export function createChamadoModel(pool) {
  return {
    async transaction(work) {
      const connection = await pool.getConnection();
      try {
        await connection.beginTransaction();
        const result = await work(connection);
        await connection.commit();
        return result;
      } catch (error) {
        await connection.rollback();
        throw error;
      } finally {
        connection.release();
      }
    },
    async lock(id, connection) {
      const [[ticket]] = await connection.execute(
        'SELECT * FROM chamados WHERE id = ? FOR UPDATE',
        [id],
      );
      return ticket;
    },
    async findById(id, connection = pool) {
      const [[ticket]] = await connection.execute(`${selectDetails} WHERE c.id = ?`, [id]);
      return ticket;
    },
    async list(user, query) {
      const { where, values } = filters(user, query);
      const [[{ total }]] = await pool.execute(
        `SELECT COUNT(*) AS total FROM chamados c${where}`,
        values,
      );
      const [data] = await pool.execute(
        `${selectDetails}${where} ORDER BY c.criado_em DESC, c.id DESC LIMIT ? OFFSET ?`,
        [...values, String(query.limite), String((query.pagina - 1) * query.limite)],
      );
      return {
        data,
        meta: {
          pagina: query.pagina,
          limite: query.limite,
          total,
          totalPaginas: Math.ceil(total / query.limite),
        },
      };
    },
    async summary(user) {
      const { where, values } = filters(user, {});
      const [rows] = await pool.execute(
        `SELECT c.status, COUNT(*) AS total FROM chamados c${where} GROUP BY c.status`,
        values,
      );
      const data = { ABERTO: 0, EM_ATENDIMENTO: 0, CONCLUIDO: 0, total: 0 };
      for (const row of rows) {
        data[row.status] = row.total;
        data.total += row.total;
      }
      return data;
    },
    async create(userId, input) {
      const [result] = await pool.execute(
        'INSERT INTO chamados (titulo, descricao, categoria, prioridade, cliente_id) VALUES (?, ?, ?, ?, ?)',
        [input.titulo, input.descricao, input.categoria, input.prioridade, userId],
      );
      return this.findById(result.insertId);
    },
    async edit(id, input, connection) {
      await connection.execute(
        `UPDATE chamados SET titulo = ?, descricao = ?, categoria = ?, prioridade = ?, versao = versao + 1 WHERE id = ?`,
        [input.titulo, input.descricao, input.categoria, input.prioridade, id],
      );
      return this.findById(id, connection);
    },
    async assign(id, technicianId, connection) {
      await connection.execute(
        "UPDATE chamados SET tecnico_id = ?, status = 'EM_ATENDIMENTO', iniciado_em = CURRENT_TIMESTAMP(3), versao = versao + 1 WHERE id = ?",
        [technicianId, id],
      );
      return this.findById(id, connection);
    },
    async conclude(id, resolution, connection) {
      await connection.execute(
        "UPDATE chamados SET status = 'CONCLUIDO', resolucao = ?, concluido_em = CURRENT_TIMESTAMP(3), versao = versao + 1 WHERE id = ?",
        [resolution, id],
      );
      return this.findById(id, connection);
    },
  };
}
