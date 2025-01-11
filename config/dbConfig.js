// config/dbConfig.js
const mysql = require('mysql2');
require('dotenv').config();

const connection = mysql.createConnection({
  host: process.env.DB_HOST,
  user: process.env.DB_USER,
  password: process.env.DB_PASSWORD,
  database: process.env.DB_NAME
});

connection.connect((err) => {
  if (err) {
    console.log('Erro ao conectar com o banco de dados: ' + err.stack);
    return;
  }
  console.log('Conectado com sucesso ao banco de dados! ID: ' + connection.threadId);
});

module.exports = connection;
