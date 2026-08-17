import React from 'react';
import { renderToString } from 'react-dom/server';

function App() {
  return <input type="number" value={NaN} onChange={() => {}} />;
}

console.log(renderToString(<App />));
