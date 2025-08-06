const exportPortfolioTablesToExcel = require('./utils/exportToExcel');
const { tokensTable, positionsTable } = convertPortfolioToExcelTables(portfolio); // from your earlier function

exportPortfolioTablesToExcel(tokensTable, positionsTable, 'my_portfolio.xlsx');

const XLSX = require('xlsx');

function exportPortfolioTablesToExcel(tokensTable, positionsTable, filename = 'portfolio.xlsx') {
  // Create a new workbook
  const wb = XLSX.utils.book_new();

  // Convert arrays to worksheet
  const wsTokens = XLSX.utils.aoa_to_sheet(tokensTable);
  const wsPositions = XLSX.utils.aoa_to_sheet(positionsTable);

  // Append sheets
  XLSX.utils.book_append_sheet(wb, wsTokens, 'Tokens');
  XLSX.utils.book_append_sheet(wb, wsPositions, 'Positions');

  // Write to file
  XLSX.writeFile(wb, filename);
}

module.exports = exportPortfolioTablesToExcel;