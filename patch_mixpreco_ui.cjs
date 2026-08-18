const fs = require('fs');
let code = fs.readFileSync('src/pages/MixPrecoLote.tsx', 'utf8');

// Replace Table Headers
const oldHeaders = `<th className="px-4 py-3 sticky left-0 z-30 bg-muted/95 backdrop-blur border-r border-border w-[36%] min-w-[160px]">Produto</th>
                <th className="px-3 py-3 text-center">Qtd. Vendas</th>
                <th className="px-3 py-3 text-center">Rateio CF %</th>
                <th className="px-3 py-3 text-center bg-primary text-primary-foreground">
                  <span className="inline-flex items-center gap-1.5">
                    <Tag className="w-3.5 h-3.5" /> PREÇO (R$)
                  </span>
                </th>
                <th className="px-3 py-3 text-center bg-primary/5 text-primary">Lucro Liq.</th>
                <th className="px-3 py-3 text-center">Detalhes</th>`;

const newHeaders = `<th className="px-3 py-3 sticky left-0 z-30 bg-muted/95 backdrop-blur border-r border-border w-[30%] min-w-[140px] text-xs">Produto</th>
                <th className="px-2 py-3 text-center text-xs">Vendas</th>
                <th className="px-2 py-3 text-center text-xs">Rateio%</th>
                <th className="px-2 py-3 text-center bg-muted/50 text-muted-foreground text-xs">Preço Sugerido</th>
                <th className="px-2 py-3 text-center bg-primary text-primary-foreground text-xs">
                  <span className="inline-flex items-center gap-1.5">
                    <Tag className="w-3 h-3" /> PREÇO APLICADO
                  </span>
                </th>
                <th className="px-2 py-3 text-center text-xs">Ações</th>`;

code = code.replace(oldHeaders, newHeaders);

// Replace Table Cells
const oldCells = `<td className="px-3 py-3 text-center bg-primary/5" onClick={(e) => e.stopPropagation()}>
                        <div className="flex flex-col items-center">
                          <PriceInput p={p} onUpdate={handleUpdateProduto} />
                          {p.modoPrecificacao === 'preco' && (
                            <span className="text-[9px] text-amber-600 font-bold mt-0.5 uppercase tracking-wider">Manual</span>
                          )}
                        </div>
                      </td>
                      <td className={\`px-3 py-3 text-center bg-primary/5 font-medium \${p.valorMargem >= 0 ? 'text-primary' : 'text-red-600'}\`}>
                        <div className="flex flex-col items-center justify-center">
                          <span>{formatCurrency(p.valorMargem)}</span>
                          <span className="text-[10px] opacity-80">{p.margemReal.toFixed(1)}%</span>
                        </div>
                      </td>
                      <td className="px-3 py-3 text-center" onClick={(e) => e.stopPropagation()}>`;

const newCells = `<td className="px-2 py-2 text-center bg-muted/30" onClick={(e) => e.stopPropagation()}>
                        <div className="flex flex-col items-center justify-center">
                          <span className="text-sm font-medium text-muted-foreground">{formatCurrency(p.precoSugerido)}</span>
                          <span className="text-[10px] text-muted-foreground opacity-80 mt-0.5">L.L: {formatCurrency(p.valorMargemSugerido)} ({(p.margem || 0).toFixed(1)}%)</span>
                        </div>
                      </td>
                      <td className="px-2 py-2 text-center bg-primary/5" onClick={(e) => e.stopPropagation()}>
                        <div className="flex flex-col items-center justify-center">
                          <div className="flex items-center gap-1">
                            <PriceInput p={p} onUpdate={handleUpdateProduto} />
                            {p.modoPrecificacao === 'preco' && (
                              <button
                                type="button"
                                onClick={(e) => {
                                  e.stopPropagation();
                                  handleUpdateProduto(p.id, { modoPrecificacao: 'margem' });
                                }}
                                className="inline-flex items-center justify-center w-6 h-6 rounded border border-amber-300 bg-amber-50 text-amber-600 hover:bg-amber-100 transition-colors shrink-0"
                                title="Restaurar preço sugerido pela margem"
                              >
                                <Undo2 className="w-3 h-3" />
                              </button>
                            )}
                          </div>
                          <span className={\`text-[10px] font-medium mt-1 \${p.valorMargem >= 0 ? 'text-primary' : 'text-red-600'}\`}>
                            L.L: {formatCurrency(p.valorMargem)} ({p.margemReal.toFixed(1)}%)
                          </span>
                        </div>
                      </td>
                      <td className="px-2 py-2 text-center" onClick={(e) => e.stopPropagation()}>`;

code = code.replace(oldCells, newCells);

// We need to remove the Undo2 button from the Detalhes column, as we moved it near the PriceInput
const oldActions = `<div className="flex items-center justify-center gap-2">
                          {p.modoPrecificacao === 'preco' && (
                            <button
                              type="button"
                              onClick={(e) => {
                                e.stopPropagation();
                                handleUpdateProduto(p.id, { modoPrecificacao: 'margem' });
                              }}
                              className="inline-flex items-center justify-center w-7 h-7 rounded-md border border-amber-300 bg-amber-50 text-amber-600 hover:bg-amber-100 transition-colors"
                              title="Restaurar preço sugerido pela margem"
                            >
                              <Undo2 className="w-3.5 h-3.5" />
                            </button>
                          )}
                          <button
                            type="button"
                            onClick={() => toggleExpand(p.id)}
                            className={\`inline-flex items-center justify-center w-7 h-7 rounded-md border transition-colors \${isExpanded ? 'bg-primary text-primary-foreground border-primary' : 'border-border hover:bg-muted/50'}\`}
                            title="Ver e editar todos os detalhes deste produto"
                          >
                            {isExpanded ? <ChevronDown className="w-4 h-4" /> : <ChevronRight className="w-4 h-4" />}
                          </button>
                        </div>`;

const newActions = `<div className="flex items-center justify-center gap-1.5">
                          <button
                            type="button"
                            onClick={() => toggleExpand(p.id)}
                            className={\`inline-flex items-center justify-center w-7 h-7 rounded-md border transition-colors \${isExpanded ? 'bg-primary text-primary-foreground border-primary' : 'border-border hover:bg-muted/50'}\`}
                            title="Ver e editar todos os detalhes deste produto"
                          >
                            {isExpanded ? <ChevronDown className="w-4 h-4" /> : <ChevronRight className="w-4 h-4" />}
                          </button>
                        </div>`;

code = code.replace(oldActions, newActions);

// Also need to adjust the PriceInput itself to be a bit smaller (e.g. w-20 instead of w-24) to fit
code = code.replace(
  "className={`w-24 mx-auto block px-2 py-1 border rounded text-sm font-bold text-center",
  "className={`w-20 mx-auto block px-1.5 py-1 border rounded text-sm font-bold text-center"
);

// We need to add Undo2 import if it's missing (it's already there)
fs.writeFileSync('src/pages/MixPrecoLote.tsx', code);
