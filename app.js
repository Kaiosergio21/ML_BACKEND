const express = require('express');
const path = require('path');
const mysql = require('mysql2');
const bcrypt = require('bcryptjs');
const session = require('express-session');
const bodyParser = require('body-parser');
const axios = require('axios'); // Para requisições HTTP
const app = express();
const QRCode = require('qrcode')
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

  const query = 'SELECT id, password, tipo_cliente FROM users WHERE email = ?';
  connection.query(query, [email], (error, results) => {
    if (error) {
      console.error('Erro ao buscar o usuário:', error);
      return res.status(500).send('Erro ao buscar o usuário.');
    }

    if (results.length === 0) {
      return res.status(404).send('Usuário não encontrado.');
    }

    const user = results[0];

    bcrypt.compare(password, user.password, (err, isMatch) => {
      if (err) {
        console.error('Erro ao comparar as senhas:', err);
        return res.status(500).send('Erro ao comparar as senhas.');
      }

      if (isMatch) {
        req.session.userId = user.id; // Armazena o ID do usuário na sessão
        req.session.tipoCliente = user.tipo_cliente; // Opcional: tipo de cliente
        res.sendFile(path.join(__dirname, 'public', 'produtos.html'));
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


// Route to get items from cart
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

// Route to update item quantity in cart
app.post('/atualizar-carrinho', (req, res) => {
  const { produtoId, quantidade } = req.body;
  const userId = req.session.userId;

  if (!userId) {
    return res.status(401).json({ message: 'Usuário não autenticado.' });
  }

  // Validate inputs
  if (!produtoId || !quantidade || isNaN(quantidade) || quantidade <= 0) {
    return res.status(400).json({ message: 'Dados inválidos.' });
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

// Route to remove item from cart
app.delete('/remover-carrinho', (req, res) => {
  const { produtoId } = req.body;
  const userId = req.session.userId;

  if (!userId) {
    return res.status(401).json({ message: 'Usuário não autenticado.' });
  }

  if (!produtoId) {
    return res.status(400).json({ message: 'Produto ID inválido.' });
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


// Rota para adicionar um item ao carrinho
app.post('/adicionar-carrinho', (req, res) => {
  const { produtoId, quantidade } = req.body;
  const userId = req.session.userId;

  if (!userId) {
    return res.status(401).json({ message: 'Usuário não autenticado.' });
  }

  // Validate inputs
  if (!produtoId || !quantidade || isNaN(quantidade) || quantidade <= 0) {
    return res.status(400).json({ message: 'Dados inválidos.' });
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

// Serve calendar page
app.get('/calendario', (req, res) => {
  const produtoId = req.query.produtoId; // Get product ID from query parameters
 // Example of how to capture and use the value
  res.sendFile(path.join(__dirname, 'public', 'calendar.html'));
});

app.get('/termos-conditions', (req, res) => {
  const produtoId = req.query.produtoId;
  res.sendFile(path.join(__dirname, 'public', 'termos-conditions.html'));
});


// Rota para confirmar reserva
app.post('/confirmar-reserva', (req, res) => {
  const { produtoId, data_evento, data_retirada, data_devolucao, quantidade } = req.body;

  // Função para formatar a data no formato YYYY-MM-DD
  const formatDate = (date) => {
    const [dia, mes, ano] = date.split('/'); // Dividir a data no formato DD/MM/YYYY
    return `${ano}-${mes}-${dia}`; // Retornar no formato YYYY-MM-DD
  };

  // Exibir dados recebidos no terminal
  console.log('Dados recebidos na requisição:', { produtoId, data_evento, data_retirada, data_devolucao, quantidade });

  // Validar inputs
  if (!produtoId || !data_evento || !data_retirada || !data_devolucao || !quantidade) {
    // Exibir quais dados estão faltando
    const missingFields = [];
    if (!produtoId) missingFields.push('produtoId');
    if (!data_evento) missingFields.push('data_evento');
    if (!data_retirada) missingFields.push('data_retirada');
    if (!data_devolucao) missingFields.push('data_devolucao');
    if (!quantidade) missingFields.push('quantidade');

    console.error('Erro: Faltando dados importantes para a reserva:', missingFields.join(', '));
    return res.status(400).json({ message: 'Produto ID, datas e/ou quantidade inválidas.' });
  }

  const dataEventoFormatada = formatDate(data_evento);
  const dataRetiradaFormatada = formatDate(data_retirada);
  const dataDevolucaoFormatada = formatDate(data_devolucao);

  const userId = req.session.userId; // Certifique-se de que o usuário está autenticado
  if (!userId) {
    console.error('Erro: Usuário não autenticado.');
    return res.status(401).json({ success: false, message: 'Usuário não autenticado.' });
  }

  console.log('Dados após validação e formatação de datas:', { userId, dataEventoFormatada, dataRetiradaFormatada, dataDevolucaoFormatada });

  // Verificar se o produto existe
  const checkProdutoQuery = 'SELECT * FROM produtos WHERE id = ?';
  connection.query(checkProdutoQuery, [produtoId], (err, produtoResults) => {
    if (err) {
      console.error('Erro ao verificar produto:', err.message);
      return res.status(500).json({ success: false, message: 'Erro ao verificar produto.' });
    }
    if (produtoResults.length === 0) {
      console.error(`Erro: Produto com ID ${produtoId} não encontrado.`);
      return res.status(404).json({ success: false, message: `Produto com ID ${produtoId} não encontrado.` });
    }
    
   
  const produto = produtoResults[0]; // Pega o primeiro resultado do produto
  console.log('Produto encontrado:', produto);
   

    // Verificar conflitos de reserva nas datas fornecidas
    const checkConflitoQuery = `
      SELECT * FROM reservas
      WHERE produto_id = ? 
      AND (
        (data_retirada <= ? AND data_devolucao >= ?) OR
        (data_retirada <= ? AND data_devolucao >= ?)
      )
    `;

    connection.query(checkConflitoQuery, [produtoId, dataRetiradaFormatada, dataRetiradaFormatada, dataDevolucaoFormatada, dataDevolucaoFormatada], (err, reservaResults) => {
      if (err) {
        console.error('Erro ao verificar conflitos de reserva:', err.message);
        return res.status(500).json({ success: false, message: 'Erro ao verificar conflitos de reserva.' });
      }

      if (reservaResults.length > 0) {
        console.error('Erro: Já existe uma reserva para essas datas.');
        return res.status(400).json({ success: false, message: 'Já existe uma reserva para essas datas.' });
      }

      // Preparar dados para inserção
      const nomeProduto = produto.nome; // Nome do produto
      const precoProduto = produto.preco; // Preço do produto

      console.log('Dados para inserção na tabela de reservas:', { userId, produtoId, nomeProduto, quantidade, precoProduto, dataEventoFormatada, dataRetiradaFormatada, dataDevolucaoFormatada });

      // Inserir dados na tabela de reservas
      const query = `
        INSERT INTO reservas (user_id, produto_id, nome, quantidade, preco, data_evento, data_retirada, data_devolucao) 
        VALUES (?, ?, ?, ?, ?, ?, ?, ?)
      `;

      connection.query(query, [userId, produtoId, nomeProduto, quantidade, precoProduto, dataEventoFormatada, dataRetiradaFormatada, dataDevolucaoFormatada], (err, result) => {
        if (err) {
          console.error('Erro ao processar a reserva:', err.message, 'Dados:', {
            userId, produtoId, nomeProduto, quantidade, precoProduto, dataEventoFormatada, dataRetiradaFormatada, dataDevolucaoFormatada
          });
          return res.status(500).json({ success: false, message: 'Erro ao processar a reserva.' });
        }

        console.log('Reserva confirmada com sucesso:', { userId, produtoId, nomeProduto, quantidade, precoProduto, dataEventoFormatada, dataRetiradaFormatada, dataDevolucaoFormatada });
        res.json({ success: true, message: 'Reserva confirmada com sucesso.' });
      });
    });
  });
});





// Inicialização do servidor
app.listen(port, () => {
  console.log(`Server running at http://localhost:${port}/`);
});
