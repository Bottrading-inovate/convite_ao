<?php
/**
 * Máscara Oficial para InfinityFree — Casamento de Júnior & Hermenegilda
 * Domínio: https://nossocasamento.gt.tc
 * Destino Cloudflare Worker: https://convite-ao.botcatrading.workers.dev
 */

$workerBase = 'https://convite-ao.botcatrading.workers.dev';
$requestUri = $_SERVER['REQUEST_URI'] ?? '/';

// Limpa possíveis duplicações de barras
$targetUrl = rtrim($workerBase, '/') . '/' . ltrim($requestUri, '/');

// Modo Redirecionamento Direto (caso queira redirecionar em vez de mascarar)
if (isset($_GET['direct'])) {
    header("Location: " . $targetUrl, true, 302);
    exit();
}

// Modo Máscara Completa (Iframe responsivo de ecrã total)
// Mantém https://nossocasamento.gt.tc visível na barra de navegação!
?>
<!DOCTYPE html>
<html lang="pt-AO">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0, maximum-scale=1.0, user-scalable=no">
  <title>Casamento de Júnior & Hermenegilda</title>
  <meta name="description" content="Celebração do casamento de Júnior e Hermenegilda em 12 de dezembro de 2026.">
  <meta property="og:title" content="Casamento Júnior & Hermenegilda">
  <meta property="og:description" content="Contamos contigo para celebrar o nosso amor.">
  <meta property="og:type" content="website">
  <meta name="robots" content="noindex, nofollow">
  <style>
    html, body {
      margin: 0;
      padding: 0;
      width: 100%;
      height: 100%;
      overflow: hidden;
      background-color: #faf8f5;
    }
    iframe {
      width: 100%;
      height: 100%;
      border: 0;
      outline: 0;
      display: block;
    }
  </style>
</head>
<body>
  <iframe
    src="<?= htmlspecialchars($targetUrl, ENT_QUOTES, 'UTF-8') ?>"
    title="Convite de Casamento Júnior e Hermenegilda"
    allow="clipboard-write; fullscreen"
  ></iframe>
</body>
</html>
