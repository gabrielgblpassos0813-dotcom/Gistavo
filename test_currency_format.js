// Test the formatCurrency function
const formatCurrency = (value) => {
  return new Intl.NumberFormat('pt-BR', {
    style: 'currency',
    currency: 'BRL'
  }).format(value);
};

// Test cases
console.log('Testing formatCurrency function:');
console.log('formatCurrency(12.0):', formatCurrency(12.0));
console.log('formatCurrency(51.0):', formatCurrency(51.0));
console.log('formatCurrency(8.0):', formatCurrency(8.0));
console.log('formatCurrency(71.0):', formatCurrency(71.0));
console.log('formatCurrency(25.5):', formatCurrency(25.5));
console.log('formatCurrency(0):', formatCurrency(0));