export function createComentarioModel(pool) {
  return {
    async list(ticketId, { pagina, limite }) {
      const [[{ total }]] = await pool.execute(
        'SELECT COUNT(*) AS total FROM comentarios_chamado WHERE chamado_id = ?',
        [ticketId],
      );
      const [data] = await pool.execute(
        `SELECT cc.*, u.nome AS usuario_nome, u.perfil AS usuario_perfil
        FROM comentarios_chamado cc JOIN usuarios u ON u.id = cc.usuario_id
        WHERE cc.chamado_id = ? ORDER BY cc.criado_em ASC, cc.id ASC LIMIT ? OFFSET ?`,
        [ticketId, String(limite), String((pagina - 1) * limite)],
      );
      return { data, meta: { pagina, limite, total, totalPaginas: Math.ceil(total / limite) } };
    },
    async create(ticketId, userId, message, connection) {
      const [result] = await connection.execute(
        'INSERT INTO comentarios_chamado (chamado_id, usuario_id, mensagem) VALUES (?, ?, ?)',
        [ticketId, userId, message],
      );
      const [[comment]] = await connection.execute(
        `SELECT cc.*, u.nome AS usuario_nome, u.perfil AS usuario_perfil
        FROM comentarios_chamado cc JOIN usuarios u ON u.id = cc.usuario_id WHERE cc.id = ?`,
        [result.insertId],
      );
      return comment;
    },
  };
}
