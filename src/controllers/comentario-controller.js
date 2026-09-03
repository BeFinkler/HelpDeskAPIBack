export function createComentarioController(tickets) {
  return {
    /**
     * Lista comentários cronologicamente após conferir acesso ao chamado.
     * @async
     * @param {import('express').Request} req Identificador, paginação e usuário.
     * @param {import('express').Response} res Resposta HTTP.
     * @param {import('express').NextFunction} next Encaminhador de erros.
     * @returns {Promise<void>} Comentários com metadados de paginação.
     * @throws {Error} Chamado não encontrado e falhas são encaminhados a next.
     */
    async list(req, res, next) {
      try { res.json(await tickets.listComments(req.user, req.validated.id, req.validated)); } catch (error) { next(error); }
    },
    /**
     * Publica texto simples usando o autor autenticado, em chamado não concluído.
     * @async
     * @param {import('express').Request} req Mensagem validada, identificador e usuário.
     * @param {import('express').Response} res Resposta HTTP.
     * @param {import('express').NextFunction} next Encaminhador de erros.
     * @returns {Promise<void>} Resposta 201 com o comentário criado.
     * @throws {Error} Conflitos, proibições e falhas são encaminhados a next.
     */
    async create(req, res, next) {
      try { res.status(201).json({ data: await tickets.comment(req.user, req.validated.id, req.validated.mensagem) }); } catch (error) { next(error); }
    },
  };
}
