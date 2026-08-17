import { ProdutoItem } from '../context/AppContext';

export const exportToExcel = (
  isDashboard: boolean,
  produtos: ProdutoItem[],
  receitaEstimada: number,
  custoFixoTotal: number,
  custosVariaveisTotais: number,
  despesasVariaveisTotal: number,
  margemContribuicaoTotal: number,
  lucroLiquidoTotal: number,
  pontoEquilibrioFaturamento: number,
  mcUnitMap: Record<string, number>
) => {
  import('xlsx').then((XLSX) => {
    const wb = XLSX.utils.book_new();
    
    if (isDashboard) {
      const wsResumo = XLSX.utils.json_to_sheet([
        { Metrica: "Faturamento Projetado", Valor: receitaEstimada },
        { Metrica: "Custo Fixo Total", Valor: custoFixoTotal },
        { Metrica: "Custo Variável Total", Valor: custosVariaveisTotais },
        { Metrica: "Despesas Variáveis", Valor: despesasVariaveisTotal },
        { Metrica: "Margem de Contribuição Total", Valor: margemContribuicaoTotal },
        { Metrica: "Lucro Líquido Estimado", Valor: lucroLiquidoTotal },
        { Metrica: "Ponto de Equilíbrio", Valor: pontoEquilibrioFaturamento }
      ]);
      XLSX.utils.book_append_sheet(wb, wsResumo, "Resumo");
    }

    const prodData = produtos.map(p => ({
      "Produto": p.nome,
      "CMV": p.cmv,
      "Vendas Proj.": p.vendasProjetadas,
      "Rateio (%)": p.percentualRateio,
      "Margem Contrib. (Un)": mcUnitMap[p.id] || 0
    }));
    const wsProd = XLSX.utils.json_to_sheet(prodData);
    XLSX.utils.book_append_sheet(wb, wsProd, "Produtos");

    XLSX.writeFile(wb, "relatorio_precificacao.xlsx");
  });
};
