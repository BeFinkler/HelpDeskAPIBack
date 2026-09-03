export function createAuthController(auth) {
  return {
    /**
     * Cadastra exclusivamente um cliente com senha protegida por hash.
     * @async
     * @param {import('express').Request} req Requisição validada pelo middleware.
     * @param {import('express').Response} res Resposta HTTP.
     * @param {import('express').NextFunction} next Encaminhador de erros.
     * @returns {Promise<void>} Resposta 201 com os dados públicos do usuário.
     * @throws {Error} Falhas de persistência são capturadas e encaminhadas a next.
     */
    async register(req, res, next) {
      try {
        res.status(201).json({ data: await auth.register(req.validated) });
      } catch (error) {
        next(error);
      }
    },
    /**
     * Autentica as credenciais e emite um JWT de validade limitada.
     * @async
     * @param {import('express').Request} req Credenciais validadas.
     * @param {import('express').Response} res Resposta HTTP.
     * @param {import('express').NextFunction} next Encaminhador de erros.
     * @returns {Promise<void>} Token, duração e usuário público.
     * @throws {Error} Credenciais inválidas e falhas internas são encaminhadas a next.
     */
    async login(req, res, next) {
      try {
        res.json({ data: await auth.login(req.validated) });
      } catch (error) {
        next(error);
      }
    },
    /**
     * Retorna o usuário carregado pela autenticação Bearer.
     * @async
     * @param {import('express').Request} req Requisição autenticada.
     * @param {import('express').Response} res Resposta HTTP.
     * @returns {Promise<void>} Dados públicos do usuário atual.
     * @throws {Error} A autenticação rejeita previamente usuários inválidos.
     */
    async me(req, res) {
      res.json({ data: req.user });
    },
  };
}
