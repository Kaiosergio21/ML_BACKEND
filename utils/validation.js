// Funções de validação
function isCepSalvador(cep) {
    const cepNumber = parseInt(cep);
    return cepNumber >= 40000000 && cepNumber <= 42599999;
  }
  
  function validateCpfCnpj(cpf_cnpj, tipo_cliente) {
    if (tipo_cliente === 'pf') {
      return validateCPF(cpf_cnpj);
    } else if (tipo_cliente === 'pj') {
      return validarCNPJ(cpf_cnpj);
    }
    return false;
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
    let pesos = [5, 4, 3, 2, 9, 8, 7, 6, 5, 4, 3, 2];
    for (let i = 0; i < 12; i++) {
      soma += parseInt(cnpj.charAt(i)) * pesos[i];
    }
    resto = soma % 11;
    resto = resto < 2 ? 0 : 11 - resto;
  
    if (parseInt(cnpj.charAt(12)) !== resto) {
      return false;
    }
  
    soma = 0;
    pesos = [6, 5, 4, 3, 2, 9, 8, 7, 6, 5, 4, 3, 2];
    for (let i = 0; i < 13; i++) {
      soma += parseInt(cnpj.charAt(i)) * pesos[i];
    }
    resto = soma % 11;
    resto = resto < 2 ? 0 : 11 - resto;
  
    if (parseInt(cnpj.charAt(13)) !== resto) {
      return false;
    }
  
    return true;
  }
  
  
  
  
  // Rota para registrar os usuários com a validação do CEP
  
  
  // Rota para trocar a senha
  const validateCPF = (cpf) => {
    // Implemente a validação do CPF aqui (exemplo básico)
    cpf = cpf.replace(/[^\d]+/g, ''); // Remove caracteres não numéricos
    if (cpf.length !== 11) return false;
  
    // Verificação simplificada
    const repeated = cpf.split('').every((char) => char === cpf[0]);
    if (repeated) return false;
  
    // Adicione a lógica completa de validação do CPF aqui, se necessário.
    return true;
  };
  
  module.exports = { validateCpfCnpj, validarCNPJ, validateCPF, isCepSalvador };
  