const express = require('express');
const path = require('path');
const mysql = require('mysql2');
const bcrypt = require('bcryptjs');
const session = require('express-session');
const bodyParser = require('body-parser');
const axios = require('axios'); // Para requisições HTTP
const app = express();
const connection = require('./config/dbConfig'); // Importa a configuração do banco de dados
const sessionConfig = require('./config/sessionConfig'); // Importa a configuração de sessão
const userRoutes = require('./routes/userRoutes'); // Importando o arquivo de rotas

const port = 3000;
require('dotenv').config();

// Configurações do body-parser
app.use(bodyParser.urlencoded({ extended: false }));
app.use(bodyParser.json());

// Configuração de sessão
app.use(sessionConfig);

// Servir arquivos estáticos
app.use(express.static(path.join(__dirname, 'public')));

// Rota principal (exemplo de página de produtos ou login)
app.get('/', (req, res) => {
  res.sendFile(path.join(__dirname, 'public/produtos.html'));
});

app.use('/user', userRoutes);  // Rota base para as operações do usuário



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