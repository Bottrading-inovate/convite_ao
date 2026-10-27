<?php
/**
 * Máscara Oficial para InfinityFree — Casamento de Júnior & Hermenegilda
 * Domínio: https://nossocasamento.gt.tc
 * Destino Cloudflare Worker: https://convite-ao.botcatrading.workers.dev
 */

// Força status 200 OK caso tenha sido acionado pelo ErrorDocument 404 do InfinityFree
http_response_code(200);
header("HTTP/1.1 200 OK");

$workerBase = 'https://convite-ao.botcatrading.workers.dev';

// Obtém o caminho da rota original (ex: /convite/b3f024e66706 ou /passe/...)
$requestUri = $_SERVER['REDIRECT_URL'] ?? $_SERVER['REQUEST_URI'] ?? '/';

// Limpa duplicações de barras iniciais e finais
$cleanPath = ltrim($requestUri, '/');
$targetUrl = rtrim($workerBase, '/') . '/' . $cleanPath;

if (!empty($_SERVER['QUERY_STRING']) && strpos($targetUrl, '?') === false) {
    $targetUrl .= '?' . $_SERVER['QUERY_STRING'];
}

// Se o utilizador passar ?direct=1, faz redirecionamento directo
if (isset($_GET['direct'])) {
    header("Location: " . $targetUrl, true, 302);
    exit();
}

// Máscara com iframe responsivo de ecrã total:
// Mantém https://nossocasamento.gt.tc/ na barra do navegador do convidado!
?>
<!DOCTYPE html>
<html lang="pt-AO">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0, maximum-scale=1.0, user-scalable=no">
  <title>Casamento de Júnior & Hermenegilda</title>
  <meta name="description" content="Convite oficial para o casamento de Júnior e Hermenegilda em 12 de Dezembro de 2026.">
  <meta property="og:title" content="Casamento Júnior & Hermenegilda">
  <meta property="og:description" content="Contamos contigo para celebrar o nosso amor.">
  <meta property="og:type" content="website">
  <meta name="robots" content="noindex, nofollow">
  <style>
    * {
      box-sizing: border-box;
      margin: 0;
      padding: 0;
    }
    html, body {
      width: 100%;
      height: 100%;
      overflow: hidden;
      background-color: #274533;
    }
    iframe {
      position: absolute;
      top: 0;
      left: 0;
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
    title="Convite de Casamento Júnior & Hermenegilda"
    allow="clipboard-write; fullscreen"
  ></iframe>
</body>
</html>
