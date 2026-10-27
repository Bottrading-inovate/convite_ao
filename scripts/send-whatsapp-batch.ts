/**
 * Automação de Envio de Convites por WhatsApp
 * Casamento de Júnior & Hermenegilda
 * 
 * Executar via terminal:
 * npx tsx scripts/send-whatsapp-batch.ts
 */

import { createClient } from "@supabase/supabase-js";
import fs from "node:fs";
import path from "node:path";

if (typeof process.loadEnvFile === "function" && fs.existsSync(".env")) {
  process.loadEnvFile(".env");
}

const url = process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL;
const key = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.SUPABASE_PUBLISHABLE_KEY || process.env.VITE_SUPABASE_PUBLISHABLE_KEY;
const baseUrl = process.env.SITE_URL || "https://nossocasamento.gt.tc";

if (!url || !key) {
  console.error("❌ Erro: Define as credenciais do Supabase no ficheiro .env");
  process.exit(1);
}

const supabase = createClient(url, key);

async function main() {
  console.log("💍 A carregar lista de convidados para automatização WhatsApp...\n");

  const { data: guests, error } = await supabase
    .from("wedding_guests")
    .select("id, name, phone, token, party_size, attending, active")
    .eq("active", true)
    .order("name", { ascending: true });

  if (error) {
    console.error("Erro ao consultar convidados no Supabase:", error.message);
    if (error.message.includes("row-level security")) {
      console.warn("💡 Dica: Adiciona SUPABASE_SERVICE_ROLE_KEY no ficheiro .env para acesso administrativo.");
    }
    return;
  }

  if (!guests || guests.length === 0) {
    console.log("Nenhum convidado encontrado na base de dados.");
    return;
  }

  const validGuests = guests.filter(g => g.phone && g.phone.replace(/\D/g, "").length >= 9);
  console.log(`📋 Total de convidados: ${guests.length}`);
  console.log(`📱 Convidados com telemóvel válido: ${validGuests.length}\n`);

  // Gera o ficheiro CSV formatado para ferramentas de envio massivo
  const csvLines = ["Telefone;Nome;Link;Mensagem"];

  for (const g of validGuests) {
    const rawDigits = (g.phone || "").replace(/\D/g, "");
    const phone = rawDigits.length === 9 ? `244${rawDigits}` : rawDigits;
    const inviteUrl = `${baseUrl.replace(/\/$/, "")}/convite/${g.token}`;
    
    const text = g.attending === true
      ? `Olá ${g.name}! Ficámos muito felizes com a vossa confirmação para o nosso casamento, a 12 de dezembro de 2026. O vosso convite digital com passe de entrada está aqui: ${inviteUrl}`
      : `Olá ${g.name}! Com a bênção de Jeová e de nossos pais, nós, Júnior & Hermenegilda, convidamo-vos com muita honra para o nosso casamento no dia 12 de dezembro de 2026. O vosso convite pessoal e exclusivo está aqui: ${inviteUrl}\n\nPedimos o favor de confirmarem no próprio link até ao final deste mês. Por favor, não levem crianças.`;

    const waLink = `https://wa.me/${phone}?text=${encodeURIComponent(text)}`;

    console.log(`👤 ${g.name} (${phone})`);
    console.log(`   🔗 Convite: ${inviteUrl}`);
    console.log(`   💬 Link WhatsApp: ${waLink}\n`);

    csvLines.push(`${phone};"${g.name.replace(/"/g, '""')}";"${inviteUrl}";"${text.replace(/"/g, '""')}"`);
  }

  const outputPath = path.resolve(process.cwd(), "convites_disparo_whatsapp.csv");
  fs.writeFileSync(outputPath, "\uFEFF" + csvLines.join("\n"), "utf-8");

  console.log(`\n✅ Ficheiro de disparo criado com sucesso:`);
  console.log(`   📂 ${outputPath}`);
  console.log(`\n💡 Como usar este ficheiro para automatizar 100% o envio:`);
  console.log(`   1. Podes importar este CSV para qualquer extensão do Chrome de envio massivo no WhatsApp (ex.: WA Web Plus, WPPConnect, WhatsPush).`);
  console.log(`   2. Podes usar a "Fila Rápida de WhatsApp" diretamente na Área dos Noivos (/painel) no teu navegador.`);
}

main().catch(console.error);
