const express = require('express');
const path = require('path');
const mysql = require('mysql2');
const bcrypt = require('bcryptjs');
const session = require('express-session');
const bodyParser = require('body-parser');
const axios = require('axios'); // Adicionar axios para fazer requisições HTTP
const app = express();
const port = 3000;
require('dotenv').config();

// Configurar o body-parser
app.use(bodyParser.urlencoded({ extended: false }));
app.use(bodyParser.json());

// Configurar o express-session
app.use(session({
  secret: 'your-secret-key', // Substitua por uma chave secreta segura
  resave: false,
  saveUninitialized: false
}));


const connection = mysql.createConnection({
  host: process.env.DB_HOST,
  user: process.env.DB_USER,
  password: process.env.DB_PASSWORD,
  database: process.env.DB_NAME
});


connection.connect((err) => {
  if (err) {
    console.log('Erro: ' + err.stack);
    return;
  }
  console.log('Conectado com sucesso! ID: ' + connection.threadId);
});

// Serve arquivos estáticos da pasta 'public'
app.use(express.static(path.join(__dirname, 'public')));

// Rota para servir a página de login
app.get('/', (req, res) => {
  res.sendFile(path.join(__dirname, 'public/login.html'));
});

// Rota para registrar os usuários
app.post('/subscription', (req, res) => {
  const { nome, sobrenome, email, telefone, cpf, password } = req.body;

  bcrypt.hash(password, 10, (err, hash) => {
    if (err) throw err;

    const query = `INSERT INTO users (nome, sobrenome, email, telefone, cpf, password)
                   VALUES (?, ?, ?, ?, ?, ?)`;

    connection.query(query, [nome, sobrenome, email, telefone, cpf, hash], (error, results) => {
      if (error) {
        if (error.code === 'ER_DUP_ENTRY') {
          res.send('Email ou CPF já cadastrado.');
        } else {
          throw error;
        }
      } else {
        res.redirect('/login'); // Certifique-se que essa página existe
      }
    });
  });
});

// Rota para autenticar os usuários (Login)
app.post('/login', (req, res) => {
  const { email, password } = req.body;

  const query = 'SELECT id, email, password FROM users WHERE email = ?';
  connection.query(query, [email], (error, results) => {
    if (error) {
      console.error('Erro ao buscar o usuário: ', error);
      return res.status(500).send('Erro ao buscar o usuário.');
    }

    if (results.length === 0) {
      return res.status(404).send('Usuário não encontrado.');
    }

    const user = results[0];

    bcrypt.compare(password, user.password, (err, isMatch) => {
      if (err) {
        console.error('Erro ao comparar as senhas: ', err);
        return res.status(500).send('Erro ao comparar as senhas.');
      }

      if (isMatch) {
        req.session.userId = user.id;
        req.session.userEmail = user.email;
        // Redireciona para a página de produtos
        return res.redirect('/produtos.html');
      } else {
        res.status(401).send('Senha incorreta.');
      }
    });
  });
});


// Função para validar se o CEP pertence a Salvador
function isCepSalvador(cep) {
  const cepNumber = parseInt(cep.replace('-', '')); // Remove o hífen do CEP e converte para número
  return cepNumber >= 40000000 && cepNumber <= 42599999;
}

// Rota para buscar o endereço pelo CEP
app.get('/buscar-endereco/:cep', async (req, res) => {
  const { cep } = req.params;

  if (!isCepSalvador(cep)) {
    return res.status(400).json({ error: 'CEP não pertence a Salvador.' });
  }

  try {
    // Usando a API ViaCEP para buscar o endereço
    const response = await axios.get(`https://viacep.com.br/ws/${cep}/json/`);
    const data = response.data;

    if (data.erro) {
      return res.status(404).json({ error: 'CEP não encontrado.' });
    }

    res.json(data); // Retorna os dados do endereço
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: 'Erro ao buscar o endereço.' });
  }
});

// Rota para trocar a senha
app.post('/change-password', (req, res) => {
  const { email, currentPassword, newPassword } = req.body;

  const query = 'SELECT id, password FROM users WHERE email = ?';
  connection.query(query, [email], (error, results) => {
    if (error) {
      console.error('Erro ao buscar o usuário: ', error);
      return res.status(500).send('Erro ao buscar o usuário.');
    }

    if (results.length === 0) {
      return res.status(404).send('Usuário não encontrado.');
    }

    const user = results[0];

    bcrypt.compare(currentPassword, user.password, (err, isMatch) => {
      if (err) {
        console.error('Erro ao comparar as senhas: ', err);
        return res.status(500).send('Erro ao comparar as senhas.');
      }

      if (!isMatch) {
        return res.status(401).send('Senha atual incorreta.');
      }

      bcrypt.hash(newPassword, 10, (err, hash) => {
        if (err) {
          console.error('Erro ao criptografar a nova senha: ', err);
          return res.status(500).send('Erro ao criptografar a nova senha.');
        }

        const updateQuery = 'UPDATE users SET password = ? WHERE id = ?';
        connection.query(updateQuery, [hash, user.id], (error, results) => {
          if (error) {
            console.error('Erro ao atualizar a senha: ', error);
            return res.status(500).send('Erro ao atualizar a senha.');
          }

          res.send('Senha atualizada com sucesso.');
        });
      });
    });
  });
});

// Adicione isso ao seu código existente do Node.js

// Rota para adicionar um item ao carrinho
// Rota para obter os itens do carrinho
app.get('/carrinho', (req, res) => {
  const userId = req.session.userId; // Assumindo que você está usando sessões

  const query = 'SELECT c.quantidade, p.nome, p.id AS produto_id FROM carrinho c JOIN produtos p ON c.produto_id = p.id WHERE c.user_id = ?';
  connection.query(query, [userId], (error, results) => {
      if (error) {
          console.error('Erro ao buscar o carrinho:', error);
          return res.status(500).json({ message: 'Erro ao buscar o carrinho.' });
      }

      res.json(results);
  });
});

// Rota para atualizar a quantidade do item no carrinho
app.post('/atualizar-carrinho', (req, res) => {
  const { produtoId, quantidade } = req.body;
  const userId = req.session.userId;

  const query = 'UPDATE carrinho SET quantidade = ? WHERE user_id = ? AND produto_id = ?';
  connection.query(query, [quantidade, userId, produtoId], (error) => {
      if (error) {
          console.error('Erro ao atualizar a quantidade:', error);
          return res.status(500).json({ message: 'Erro ao atualizar a quantidade.' });
      }

      res.json({ message: 'Quantidade atualizada com sucesso!' });
  });
});

// Rota para remover um item do carrinho
app.delete('/remover-carrinho', (req, res) => {
  const { produtoId } = req.body;
  const userId = req.session.userId;

  const query = 'DELETE FROM carrinho WHERE user_id = ? AND produto_id = ?';
  connection.query(query, [userId, produtoId], (error) => {
      if (error) {
          console.error('Erro ao remover item do carrinho:', error);
          return res.status(500).json({ message: 'Erro ao remover item do carrinho.' });
      }

      res.json({ message: 'Item removido com sucesso!' });
  });
});






// Inicializar o servidor
app.listen(port, () => {
  console.log(`Server running at http://localhost:${port}/`);
});
