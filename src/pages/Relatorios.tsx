import React from 'react';
import { Download } from 'lucide-react';

export default function Relatorios() {
  return (
    <div className="space-y-6 pb-12">
      <div>
        <h1 className="text-3xl font-serif text-primary">Relatórios</h1>
        <p className="text-muted-foreground mt-1 text-sm">Baixe os dados do seu sistema.</p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mt-6">
        <div className="bg-card border border-border p-6 rounded-xl shadow-sm text-center">
          <h3 className="text-lg font-medium text-foreground mb-4">Relatório em PDF</h3>
          <p className="text-sm text-muted-foreground mb-6">Visão formatada para impressão com todos os indicadores.</p>
          <button 
            className="w-full flex items-center justify-center gap-2 bg-primary text-primary-foreground py-2 px-4 rounded-md font-medium hover:bg-primary/90 transition-colors"
            onClick={() => alert('Funcionalidade de download de PDF em desenvolvimento.')}
          >
            <Download className="w-5 h-5" />
            Baixar PDF
          </button>
        </div>
        <div className="bg-card border border-border p-6 rounded-xl shadow-sm text-center">
          <h3 className="text-lg font-medium text-foreground mb-4">Planilha Excel (XLSX)</h3>
          <p className="text-sm text-muted-foreground mb-6">Todos os dados estruturados para você manipular como quiser.</p>
          <button 
            className="w-full flex items-center justify-center gap-2 bg-emerald-600 text-white py-2 px-4 rounded-md font-medium hover:bg-emerald-700 transition-colors"
            onClick={() => alert('Funcionalidade de download de Planilha em desenvolvimento.')}
          >
            <Download className="w-5 h-5" />
            Baixar Planilha
          </button>
        </div>
      </div>
    </div>
  );
}
