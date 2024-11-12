const express = require('express');
const path = require('path');
const mysql = require('mysql2');
const bcrypt = require('bcryptjs');
const session = require('express-session');
const bodyParser = require('body-parser');
const axios = require('axios'); // Para requisições HTTP
const app = express();
const port = 3000;
require('dotenv').config();

// Configurações do body-parser
app.use(bodyParser.urlencoded({ extended: false }));
app.use(bodyParser.json());

// Configuração da sessão
app.use(session({
  secret: 'your-secret-key', // Altere para uma chave secreta forte
  resave: false,
  saveUninitialized: false
}));

// Configuração do banco de dados
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
  console.log('Conectado com sucesso! ID: ' + connection.threadId);
});

// Servir arquivos estáticos
app.use(express.static(path.join(__dirname, 'public')));

// Rota principal (exemplo de página de produtos ou login)
app.get('/', (req, res) => {
  res.sendFile(path.join(__dirname, 'public/produtos.html'));
});


// Função para validar CPF
function validarCPF(cpf) {
  cpf = cpf.replace(/[^\d]+/g, ''); // Remove caracteres não numéricos

  if (cpf.length !== 11 || /^(\d)\1{10}$/.test(cpf)) {
    return false; // CPF inválido ou com números repetidos
  }

  let soma = 0;
  let resto;

  // Primeiro dígito de verificação
  for (let i = 0; i < 9; i++) {
    soma += parseInt(cpf.charAt(i)) * (10 - i);
  }
  resto = soma % 11;
  if (resto < 2) {
    resto = 0;
  } else {
    resto = 11 - resto;
  }
  if (parseInt(cpf.charAt(9)) !== resto) {
    return false;
  }

  soma = 0;
  // Segundo dígito de verificação
  for (let i = 0; i < 10; i++) {
    soma += parseInt(cpf.charAt(i)) * (11 - i);
  }
  resto = soma % 11;
  if (resto < 2) {
    resto = 0;
  } else {
    resto = 11 - resto;
  }
  if (parseInt(cpf.charAt(10)) !== resto) {
    return false;
  }

  return true;
}

// Função para validar CNPJ
function validarCNPJ(cnpj) {
  cnpj = cnpj.replace(/[^\d]+/g, ''); // Remove caracteres não numéricos

  if (cnpj.length !== 14 || /^(\d)\1{13}$/.test(cnpj)) {
    return false; // CNPJ inválido ou com números repetidos
  }

  let soma = 0;
  let resto;

  // Validação do primeiro dígito
  for (let i = 0; i < 12; i++) {
    soma += parseInt(cnpj.charAt(i)) * (5 - (i % 8) + 1);
  }
  resto = soma % 11;
  if (resto < 2) {
    resto = 0;
  } else {
    resto = 11 - resto;
  }
  if (parseInt(cnpj.charAt(12)) !== resto) {
    return false;
  }

  soma = 0;
  // Validação do segundo dígito
  for (let i = 0; i < 13; i++) {
    soma += parseInt(cnpj.charAt(i)) * (6 - (i % 8) + 1);
  }
  resto = soma % 11;
  if (resto < 2) {
    resto = 0;
  } else {
    resto = 11 - resto;
  }
  if (parseInt(cnpj.charAt(13)) !== resto) {
    return false;
  }

  return true;
}


// Função para validar se o CEP pertence a Salvador
function isCepSalvador(cep) {
  const cepNumber = parseInt(cep);
  return cepNumber >= 40000000 && cepNumber <= 42599999;
}

// Rota para registrar os usuários com a validação do CEP

// Rota para inscrição

app.post('/subscription', (req, res) => {
  const { nome, sobrenome, email, telefone, cpf_cnpj, tipo_cliente, password, cep, rua, bairro, cidade, estado, numero } = req.body;

  // Verificar se 'tipo_cliente' foi enviado corretamente
  if (!tipo_cliente) {
    return res.status(400).send('Tipo de cliente não selecionado.');
  }

  // Validar CPF ou CNPJ
  if (!validarCPF(cpf_cnpj)) {
    return res.status(400).send('CPF inválido.');
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
        console.error('Erro ao registrar o usuário: ', error);  // Mostrar detalhes do erro
        return res.status(500).send(`Erro ao registrar o usuário: ${error.message}`);
      }else{
      console.log('Usuário registrado com sucesso:', results);  // Exibir resultados da inserção
      res.sendFile(path.join(__dirname, 'public', 'login.html'));
      }
    });
  });
});


// Rota para login de usuário
app.post('/login', (req, res) => {
  const { email, password } = req.body;

  // Consulta para buscar o usuário pelo email
  const query = 'SELECT id, password, tipo_cliente FROM users WHERE email = ?';
  connection.query(query, [email], (error, results) => {
    if (error) {
      console.error('Erro ao buscar o usuário:', error);
      return res.status(500).send('Erro ao buscar o usuário.');
    }

    // Verifica se o usuário foi encontrado
    if (results.length === 0) {
      return res.status(404).send('Usuário não encontrado.');
    }

    const user = results[0];

    // Compara a senha informada com a senha armazenada no banco de dados
    bcrypt.compare(password, user.password, (err, isMatch) => {
      if (err) {
        console.error('Erro ao comparar as senhas:', err);
        return res.status(500).send('Erro ao comparar as senhas.');
      }

      // Se a senha for válida, inicia a sessão
      if (isMatch) {
        req.session.userId = user.id; // Armazena o ID do usuário na sessão
        req.session.tipoCliente = user.tipo_cliente; // Armazena o tipo de cliente na sessão
        res.sendFile(path.join(__dirname, 'public', 'produtos.html')); // Redireciona para a página de produtos
      } else {
        res.status(401).send('Senha incorreta.');
      }
    });
  });
});

// Rota para logout de usuário
app.post('/logout', (req, res) => {
  req.session.destroy((err) => {
    if (err) {
      return res.status(500).send('Erro ao encerrar a sessão.');
    }
    res.redirect('/login'); // Redireciona para a página de login após logout
  });
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
        connection.query(updateQuery, [hash, user.id], (error) => {
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

// Rota para adicionar um item ao carrinho
app.post('/adicionar-carrinho', (req, res) => {
  const { produtoId, quantidade } = req.body;
  const userId = req.session.userId;

  if (!userId) {
    return res.status(401).json({ message: 'Usuário não autenticado.' });
  }

  const query = 'INSERT INTO carrinho (user_id, produto_id, quantidade) VALUES (?, ?, ?) ON DUPLICATE KEY UPDATE quantidade = quantidade + ?';
  connection.query(query, [userId, produtoId, quantidade, quantidade], (error) => {
    if (error) {
      console.error('Erro ao adicionar ao carrinho:', error);
      return res.status(500).json({ message: 'Erro ao adicionar ao carrinho.' });
    }

    res.json({ message: 'Item adicionado ao carrinho com sucesso!' });
  });

});

// Rota para visualizar os itens no carrinho
app.get('/carrinho', (req, res) => {
  const userId = req.session.userId;
  if (!userId) {
    return res.status(401).json({ message: 'Usuário não autenticado.' });
  }

  const query = `
    SELECT c.produto_id, p.nome, c.quantidade, p.preco 
    FROM carrinho c
    JOIN produtos p ON c.produto_id = p.id
    WHERE c.user_id = ?
  `;
  connection.query(query, [userId], (error, results) => {
    if (error) {
      console.error('Erro ao buscar itens do carrinho:', error);
      return res.status(500).json({ message: 'Erro ao buscar o carrinho.' });
    }
    res.json(results);
  });
});

// Rota para atualizar a quantidade de um item no carrinho
app.post('/atualizar-carrinho', (req, res) => {
  const { produtoId, quantidade } = req.body;
  const userId = req.session.userId;

  if (!userId) {
    return res.status(401).json({ message: 'Usuário não autenticado.' });
  }

  const query = 'UPDATE carrinho SET quantidade = ? WHERE user_id = ? AND produto_id = ?';
  connection.query(query, [quantidade, userId, produtoId], (error) => {
    if (error) {
      console.error('Erro ao atualizar quantidade no carrinho:', error);
      return res.status(500).json({ message: 'Erro ao atualizar quantidade.' });
    }
    res.json({ message: 'Quantidade atualizada com sucesso!' });
  });
});

// Rota para remover um item do carrinho
app.delete('/remover-carrinho', (req, res) => {
  const { produtoId } = req.body;
  const userId = req.session.userId;

  if (!userId) {
    return res.status(401).json({ message: 'Usuário não autenticado.' });
  }

  const query = 'DELETE FROM carrinho WHERE user_id = ? AND produto_id = ?';
  connection.query(query, [userId, produtoId], (error) => {
    if (error) {
      console.error('Erro ao remover item do carrinho:', error);
      return res.status(500).json({ message: 'Erro ao remover item.' });
    }
    res.json({ message: 'Item removido com sucesso!' });
  });
});

// Rota para reservar um item
app.post('/reservar', (req, res) => {
  const userId = req.session.userId;
  const { produtoId, dataEvento } = req.body;

  if (!userId) {
    return res.status(401).json({ message: 'Usuário não autenticado.' });
  }

  const dataEventoObj = new Date(dataEvento);
  const dataRetirada = new Date(dataEventoObj);
  dataRetirada.setDate(dataRetirada.getDate() - 1);
  const dataDevolucao = new Date(dataEventoObj);
  dataDevolucao.setDate(dataDevolucao.getDate() + 1);

  const query = `
    INSERT INTO reservas (user_id, produto_id, data_retirada, data_evento, data_devolucao)
    VALUES (?, ?, ?, ?, ?)
  `;
  connection.query(query, [userId, produtoId, dataRetirada, dataEvento, dataDevolucao], (error) => {
    if (error) {
      console.error('Erro ao salvar a reserva:', error);
      return res.status(500).json({ message: 'Erro ao salvar a reserva.' });
    }

    // Enviar email de confirmação (exemplo com Nodemailer)
    sendConfirmationEmail(userId, produtoId, dataRetirada, dataEvento, dataDevolucao);

    res.json({ message: 'Reserva realizada com sucesso!' });
  });
});

app.get('/calendario', (req, res) => {
  const produtoId = req.query.produtoId; // Captura o parâmetro produtoId
  console.log('Produto ID:', produtoId);  // Exemplo de como capturar e usar o valor
  res.sendFile(path.join(__dirname, 'public', 'calendar.html'));
});



// Inicialização do servidor
app.listen(port, () => {
  console.log(`Server running at http://localhost:${port}/`);
});
