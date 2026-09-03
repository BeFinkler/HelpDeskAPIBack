export function createChamadoController(tickets) {
  return {
    /**
     * Lista chamados visíveis ao usuário, com filtros e paginação.
     * @async
     * @param {import('express').Request} req Usuário e filtros validados.
     * @param {import('express').Response} res Resposta HTTP.
     * @param {import('express').NextFunction} next Encaminhador de erros.
     * @returns {Promise<void>} Dados e metadados de paginação.
     * @throws {Error} Falhas são capturadas e encaminhadas a next.
     */
    async list(req, res, next) {
      try { res.json(await tickets.list(req.user, req.validated)); } catch (error) { next(error); }
    },
    /**
     * Retorna indicadores respeitando o alcance do perfil.
     * @async
     * @param {import('express').Request} req Usuário autenticado.
     * @param {import('express').Response} res Resposta HTTP.
     * @param {import('express').NextFunction} next Encaminhador de erros.
     * @returns {Promise<void>} Totais por status e total geral.
     * @throws {Error} Falhas são capturadas e encaminhadas a next.
     */
    async summary(req, res, next) {
      try { res.json({ data: await tickets.summary(req.user) }); } catch (error) { next(error); }
    },
    /**
     * Exibe um chamado, impedindo acesso ao chamado de outro cliente.
     * @async
     * @param {import('express').Request} req Usuário e identificador validado.
     * @param {import('express').Response} res Resposta HTTP.
     * @param {import('express').NextFunction} next Encaminhador de erros.
     * @returns {Promise<void>} Detalhes do chamado.
     * @throws {Error} Não encontrado e falhas internas são encaminhados a next.
     */
    async get(req, res, next) {
      try { res.json({ data: await tickets.get(req.user, req.validated.id) }); } catch (error) { next(error); }
    },
    /**
     * Abre um chamado associado exclusivamente ao cliente autenticado.
     * @async
     * @param {import('express').Request} req Dados validados e usuário.
     * @param {import('express').Response} res Resposta HTTP.
     * @param {import('express').NextFunction} next Encaminhador de erros.
     * @returns {Promise<void>} Resposta 201 e Location do chamado criado.
     * @throws {Error} Proibições e falhas são encaminhadas a next.
     */
    async create(req, res, next) {
      try {
        const ticket = await tickets.create(req.user, req.validated);
        res.location(`/api/v1/chamados/${ticket.id}`).status(201).json({ data: ticket });
      } catch (error) { next(error); }
    },
    /**
     * Edita campos permitidos de um chamado aberto, validando a versão.
     * @async
     * @param {import('express').Request} req Identificador, versão e campos validados.
     * @param {import('express').Response} res Resposta HTTP.
     * @param {import('express').NextFunction} next Encaminhador de erros.
     * @returns {Promise<void>} Chamado atualizado.
     * @throws {Error} Conflitos, proibições e falhas são encaminhados a next.
     */
    async edit(req, res, next) {
      try { res.json({ data: await tickets.edit(req.user, req.validated.id, req.validated) }); } catch (error) { next(error); }
    },
    /**
     * Assume ou conclui atendimento com autorização e transação no banco.
     * @async
     * @param {import('express').Request} req Técnico, status, versão e solução validada.
     * @param {import('express').Response} res Resposta HTTP.
     * @param {import('express').NextFunction} next Encaminhador de erros.
     * @returns {Promise<void>} Chamado com o novo estado.
     * @throws {Error} Conflitos e proibições são capturados e encaminhados a next.
     */
    async transition(req, res, next) {
      try { res.json({ data: await tickets.transition(req.user, req.validated.id, req.validated) }); } catch (error) { next(error); }
    },
  };
}
