import { test } from 'node:test';
import assert from 'node:assert/strict';
import { openapi } from '../../src/docs/openapi.js';

test('contrato usa Bearer e mantém públicas somente autenticação e saúde', () => {
  assert.deepEqual(openapi.security, [{ bearerAuth: [] }]);
  assert.equal(openapi.components.securitySchemes.bearerAuth.scheme, 'bearer');
  for (const [path, methods] of Object.entries(openapi.paths)) {
    for (const operation of Object.values(methods)) {
      assert.ok(operation.operationId);
      if (path.includes('cadastro') || path.includes('login') || path.startsWith('/health'))
        assert.deepEqual(operation.security, []);
      else assert.equal(operation.security, undefined);
    }
  }
});

test('referências dos schemas OpenAPI apontam para definições existentes', () => {
  function visit(value) {
    if (!value || typeof value !== 'object') return;
    if (value.$ref) {
      const parts = value.$ref.split('/').slice(1);
      assert.ok(
        parts.reduce((node, key) => node?.[key], openapi),
        `Referência inválida: ${value.$ref}`,
      );
    }
    Object.values(value).forEach(visit);
  }
  visit(openapi);
});

test('schemas públicos nunca expõem hash e criadores não aceitam perfil ou autor', () => {
  assert.equal(openapi.components.schemas.Usuario.properties.senha_hash, undefined);
  assert.equal(openapi.components.schemas.Cadastro.additionalProperties, false);
  assert.equal(openapi.components.schemas.Cadastro.properties.perfil, undefined);
  assert.equal(openapi.components.schemas.NovoChamado.properties.cliente_id, undefined);
  assert.equal(openapi.components.schemas.NovoComentario.properties.usuario_id, undefined);
});
