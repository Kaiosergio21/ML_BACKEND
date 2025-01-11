const express = require('express');
const bcrypt = require('bcryptjs');
const path = require('path');  // Certifique-se de importar 'path'
const connection = require('../config/dbConfig');
const { validateCPF, validarCNPJ, isCepSalvador } = require('../utils/validation');
const router = express.Router();

// Rota para inscrição
router.post('/subscription', (req, res) => {
  const { nome, sobrenome, email, telefone, cpf_cnpj, tipo_cliente, password, cep, rua, bairro, cidade, estado, numero } = req.body;

  // Verificar se 'tipo_cliente' foi enviado corretamente
  if (!tipo_cliente) {
    return res.status(400).send('Tipo de cliente não selecionado.');
  }

  // Validação do CPF ou CNPJ
  if (!validateCpfCnpj(cpf_cnpj, tipo_cliente)) {
    return res.status(400).send(tipo_cliente === 'pf' ? 'CPF inválido.' : 'CNPJ inválido.');
  }

  if (!isCepSalvador(cep)) {
    return res.status(400).send('O CEP informado não pertence ao estado permitido.');
  }

  bcrypt.hash(password, 10, (err, hash) => {
    if (err) return res.status(500).send('Erro ao criptografar a senha.');

    const query = `
      INSERT INTO users (nome, sobrenome, email, telefone, cpf_cnpj, tipo_cliente, password, cep, rua, bairro, cidade, estado, numero)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `;

    connection.query(query, [nome, sobrenome, email, telefone, cpf_cnpj, tipo_cliente, hash, cep, rua, bairro, cidade, estado, numero], (error, results) => {
      if (error) {
        console.error('Erro ao registrar o usuário: ', error);
        return res.status(500).send(`Erro ao registrar o usuário: ${error.message}`);
      } else {
        console.log('Usuário registrado com sucesso:', results);
        res.sendFile(path.join(__dirname, '../public', 'login.html')); // Corrigir o caminho para o 'login.html'
      }
    });
  });
});


// Rota para logout de usuário
router.post('/logout', (req, res) => {
  req.session.destroy((err) => {
    if (err) {
      return res.status(500).send('Erro ao encerrar a sessão.');
    }
    res.redirect('/login');
  });
});

// Rota para trocar a senha
router.post('/change-password', (req, res) => {
  const { email, identificacao, newPassword } = req.body; // `identificacao` pode ser CPF ou CNPJ

  if (!email || !identificacao || !newPassword) {
    return res.status(400).send('Todos os campos são obrigatórios.');
  }

  // Validação de CPF ou CNPJ
  const isCPF = identificacao.length === 11 && validateCPF(identificacao);
  const isCNPJ = identificacao.length === 14 && validarCNPJ(identificacao);

  if (!isCPF && !isCNPJ) {
    return res.status(400).send('CPF ou CNPJ inválido.');
  }

  // Validação da nova senha (exemplo de regra: no mínimo 8 caracteres, com pelo menos 1 número e 1 letra)
  if (newPassword.length < 8 || !/\d/.test(newPassword) || !/[a-zA-Z]/.test(newPassword)) {
    return res.status(400).send('A nova senha deve ter pelo menos 8 caracteres, com números e letras.');
  }

  const query = 'SELECT id FROM users WHERE email = ? AND cpf_cnpj = ?';
  connection.query(query, [email, identificacao], (error, results) => {
    if (error) {
      console.error('Erro ao buscar o usuário: ', error);
      return res.status(500).send('Erro interno no servidor.');
    }

    if (results.length === 0) {
      return res.status(404).send('Usuário não encontrado.');
    }

    bcrypt.hash(newPassword, 10, (err, hash) => {
      if (err) {
        console.error('Erro ao criptografar a nova senha: ', err);
        return res.status(500).send('Erro interno no servidor.');
      }

      const updateQuery = 'UPDATE users SET password = ? WHERE id = ?';
      connection.query(updateQuery, [hash, results[0].id], (error) => {
        if (error) {
          console.error('Erro ao atualizar a senha: ', error);
          return res.status(500).send('Erro interno no servidor.');
        }

        res.send('Senha atualizada com sucesso.');
      });
    });
  });
});

module.exports = router;
