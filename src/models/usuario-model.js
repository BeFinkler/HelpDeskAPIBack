const publicColumns = 'id, nome, email, perfil, criado_em, atualizado_em';

export function createUsuarioModel(pool) {
  return {
    async findByEmail(email) {
      const [[user]] = await pool.execute(
        `SELECT ${publicColumns}, senha_hash FROM usuarios WHERE email = ?`,
        [email],
      );
      return user;
    },
    async findById(id) {
      const [[user]] = await pool.execute(`SELECT ${publicColumns} FROM usuarios WHERE id = ?`, [
        id,
      ]);
      return user;
    },
    async create({ nome, email, senha_hash, perfil = 'cliente' }) {
      const [result] = await pool.execute(
        'INSERT INTO usuarios (nome, email, senha_hash, perfil) VALUES (?, ?, ?, ?)',
        [nome, email, senha_hash, perfil],
      );
      return this.findById(result.insertId);
    },
  };
}
