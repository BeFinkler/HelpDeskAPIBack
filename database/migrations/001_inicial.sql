CREATE TABLE IF NOT EXISTS usuarios (
  id INT UNSIGNED NOT NULL AUTO_INCREMENT PRIMARY KEY,
  nome VARCHAR(100) NOT NULL,
  email VARCHAR(254) NOT NULL,
  senha_hash VARCHAR(255) NOT NULL,
  perfil ENUM('cliente','tecnico') NOT NULL DEFAULT 'cliente',
  criado_em DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  atualizado_em DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3) ON UPDATE CURRENT_TIMESTAMP(3),
  UNIQUE KEY uq_usuario_email (email)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS chamados (
  id INT UNSIGNED NOT NULL AUTO_INCREMENT PRIMARY KEY,
  titulo VARCHAR(160) NOT NULL,
  descricao TEXT NOT NULL,
  categoria ENUM('acesso','hardware','software','rede','outros') NOT NULL,
  prioridade ENUM('baixa','media','alta') NOT NULL DEFAULT 'media',
  status ENUM('ABERTO','EM_ATENDIMENTO','CONCLUIDO') NOT NULL DEFAULT 'ABERTO',
  cliente_id INT UNSIGNED NOT NULL,
  tecnico_id INT UNSIGNED NULL,
  resolucao TEXT NULL,
  versao INT UNSIGNED NOT NULL DEFAULT 1,
  criado_em DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  atualizado_em DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3) ON UPDATE CURRENT_TIMESTAMP(3),
  iniciado_em DATETIME(3) NULL,
  concluido_em DATETIME(3) NULL,
  CONSTRAINT fk_chamado_cliente FOREIGN KEY (cliente_id) REFERENCES usuarios(id) ON DELETE RESTRICT,
  CONSTRAINT fk_chamado_tecnico FOREIGN KEY (tecnico_id) REFERENCES usuarios(id) ON DELETE RESTRICT,
  CONSTRAINT ck_chamado_estado CHECK (
    (status = 'ABERTO' AND tecnico_id IS NULL AND iniciado_em IS NULL AND concluido_em IS NULL AND resolucao IS NULL)
    OR (status = 'EM_ATENDIMENTO' AND tecnico_id IS NOT NULL AND iniciado_em IS NOT NULL AND concluido_em IS NULL AND resolucao IS NULL)
    OR (status = 'CONCLUIDO' AND tecnico_id IS NOT NULL AND iniciado_em IS NOT NULL AND concluido_em IS NOT NULL AND resolucao IS NOT NULL)
  ),
  KEY idx_chamado_cliente (cliente_id, status, criado_em, id),
  KEY idx_chamado_tecnico (tecnico_id, status, criado_em, id),
  KEY idx_chamado_fila (status, criado_em, id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS comentarios_chamado (
  id INT UNSIGNED NOT NULL AUTO_INCREMENT PRIMARY KEY,
  chamado_id INT UNSIGNED NOT NULL,
  usuario_id INT UNSIGNED NOT NULL,
  mensagem TEXT NOT NULL,
  criado_em DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  CONSTRAINT fk_comentario_chamado FOREIGN KEY (chamado_id) REFERENCES chamados(id) ON DELETE RESTRICT,
  CONSTRAINT fk_comentario_usuario FOREIGN KEY (usuario_id) REFERENCES usuarios(id) ON DELETE RESTRICT,
  KEY idx_comentario_chamado (chamado_id, criado_em, id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
