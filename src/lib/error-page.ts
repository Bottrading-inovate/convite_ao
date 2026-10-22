export function renderErrorPage(): string {
  return `<!doctype html>
<html lang="pt-AO">
  <head>
    <meta charset="utf-8" />
    <title>Esta página não pôde ser carregada</title>
    <meta name="viewport" content="width=device-width, initial-scale=1" />
    <style>
      body { font: 15px/1.5 system-ui, -apple-system, sans-serif; background: #fafbf9; color: #1e3d2f; display: grid; place-items: center; min-height: 100vh; margin: 0; padding: 1.5rem; }
      .card { max-width: 28rem; width: 100%; text-align: center; padding: 2rem; background: #ffffff; border: 1px solid #e0e7e2; border-radius: 0.75rem; box-shadow: 0 10px 25px rgba(30,61,47,0.08); }
      h1 { font-size: 1.25rem; margin: 0 0 0.5rem; color: #1e3d2f; }
      p { color: #516d5e; margin: 0 0 1.5rem; }
      .actions { display: flex; gap: 0.5rem; justify-content: center; flex-wrap: wrap; }
      a, button { padding: 0.6rem 1.2rem; border-radius: 0.375rem; font: inherit; cursor: pointer; text-decoration: none; border: 1px solid transparent; font-weight: 500; }
      .primary { background: #2d5a45; color: #fff; }
      .primary:hover { background: #234737; }
      .secondary { background: #fff; color: #2d5a45; border-color: #c9d6ce; }
      .secondary:hover { background: #f5f8f6; }
    </style>
  </head>
  <body>
    <div class="card">
      <h1>Esta página não pôde ser carregada</h1>
      <p>Ocorreu um problema ao processar o pedido. Tenta recarregar ou regressar à página principal.</p>
      <div class="actions">
        <button class="primary" onclick="location.reload()">Tentar novamente</button>
        <a class="secondary" href="/">Voltar ao início</a>
      </div>
    </div>
  </body>
</html>`;
}
