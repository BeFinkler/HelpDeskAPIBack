import mysql from 'mysql2/promise';

export function createPool(config) {
  const pool = mysql.createPool({
    ...config,
    waitForConnections: true,
    queueLimit: 100,
    connectTimeout: 10000,
    charset: 'utf8mb4',
    timezone: 'Z',
    multipleStatements: false,
    enableKeepAlive: true,
    decimalNumbers: true,
  });
  // DATETIME e CURRENT_TIMESTAMP usam UTC em toda conexão, inclusive na nuvem.
  pool.on('connection', (connection) => {
    connection.query("SET time_zone = '+00:00'");
  });
  return pool;
}
