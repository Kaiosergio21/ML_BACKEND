// config/sessionConfig.js
const session = require('express-session');

const sessionConfig = session({
  secret: 'your-secret-key', // Altere para uma chave secreta forte
  resave: false,
  saveUninitialized: false,
});

module.exports = sessionConfig
