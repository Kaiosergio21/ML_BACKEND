<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>Carrinho de Compras</title>
    <link rel="stylesheet" href="style.css">
</head>
<body>
    <div class="container">
        <h1>Carrinho de Compras</h1>
        <div id="carrinho-list" class="carrinho-list"></div>
        <a href="produtos.html">Voltar para Produtos</a>
    </div>

    <script>
        async function carregarCarrinho() {
            try {
                const response = await fetch('/carrinho');
                const produtos = await response.json();

                const carrinhoList = document.getElementById('carrinho-list');
                carrinhoList.innerHTML = '';

                produtos.forEach(produto => {
                    carrinhoList.innerHTML += `
                        <div class="carrinho-item" data-id="${produto.produto_id}">
                            <h3>${produto.nome}</h3>
                            <p>Quantidade: <input type="number" value="${produto.quantidade}" min="1" id="quantidade-${produto.produto_id}"></p>
                            <button onclick="atualizarQuantidade(${produto.produto_id})">Atualizar</button>
                            <button onclick="removerItem(${produto.produto_id})">Remover</button>
                            <button onclick="redirecionarParaCalendario(${produto.produto_id})">Registrar Aluguel</button>
                        </div>
                    `;
                });
            } catch (error) {
                console.error('Erro ao carregar o carrinho:', error);
            }
        }

        async function atualizarQuantidade(produtoId) {
            const quantidadeInput = document.getElementById(`quantidade-${produtoId}`);
            const quantidade = parseInt(quantidadeInput.value);

            if (quantidade < 1) {
                alert('A quantidade deve ser pelo menos 1.');
                return;
            }

            try {
                const response = await fetch('/atualizar-carrinho', {
                    method: 'POST',
                    headers: {
                        'Content-Type': 'application/json'
                    },
                    body: JSON.stringify({ produtoId, quantidade })
                });

                const result = await response.json();
                alert(result.message); // Mensagem de sucesso ou erro
                carregarCarrinho(); // Atualiza o carrinho para refletir as mudanças
            } catch (error) {
                console.error('Erro ao atualizar a quantidade:', error);
            }
        }

        async function removerItem(produtoId) {
            try {
                const response = await fetch('/remover-carrinho', {
                    method: 'DELETE',
                    headers: {
                        'Content-Type': 'application/json'
                    },
                    body: JSON.stringify({ produtoId })
                });

                const result = await response.json();
                alert(result.message); // Mensagem de sucesso ou erro
                carregarCarrinho(); // Atualiza o carrinho para refletir as mudanças
            } catch (error) {
                console.error('Erro ao remover item do carrinho:', error);
            }
        }

        async function redirecionarParaCalendario(produtoId) {
            const quantidadeInput = document.getElementById(`quantidade-${produtoId}`);
            const quantidade = parseInt(quantidadeInput.value);
        
            // Validação da quantidade
            if (isNaN(quantidade) || quantidade < 1) {
                alert('A quantidade deve ser pelo menos 1 e um número válido.');
                return;
            }
        
            // Verificação do produtoId, que deve ser um número válido e maior que 0
            if (produtoId < 1) {
                alert('ID do produto inválido.');
                return;
            }
        
            // Armazena produtoId e quantidade no localStorage
            localStorage.setItem('produtoId', produtoId);
            localStorage.setItem('quantidade', quantidade);
        
            // Redireciona para a página de calendário, passando os parâmetros via URL
            window.location.href = `calendar.html?produtoId=${produtoId}&quantidade=${quantidade}`;
        }
        
        

        // Carrega os itens do carrinho ao abrir a página
        carregarCarrinho();
    </script>

    <style>
        body {
            font-family: Arial, sans-serif;
            background-color: #f4f4f4;
            margin: 0;
            padding: 20px;
        }

        .container {
            max-width: 800px;
            margin: auto;
            background: #fff;
            padding: 20px;
            border-radius: 5px;
            box-shadow: 0 0 10px rgba(0, 0, 0, 0.1);
        }

        .carrinho-list {
            margin-top: 20px;
        }

        .carrinho-item {
            border: 1px solid #ddd;
            border-radius: 5px;
            margin: 10px 0;
            padding: 10px;
            display: flex;
            justify-content: space-between;
            align-items: center;
        }

        .carrinho-item h3 {
            margin: 0;
        }

        button {
            background: #28a745;
            color: #fff;
            border: none;
            padding: 10px;
            cursor: pointer;
        }

        button:hover {
            background: #218838;
        }
    </style>

    
</body>
</html>
