/**
 * Script de Apoio: Emissão de Convites em Lote para o Casamento de Júnior & Hermenegilda
 * 
 * Como executar:
 * npx tsx scripts/generate-invitations.ts
 */

import { createClient } from "@supabase/supabase-js";
import crypto from "node:crypto";
import fs from "node:fs";

if (typeof process.loadEnvFile === "function" && fs.existsSync(".env")) {
  process.loadEnvFile(".env");
}

const url = process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL;
const key = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.SUPABASE_PUBLISHABLE_KEY || process.env.VITE_SUPABASE_PUBLISHABLE_KEY;
const baseUrl = process.env.SITE_URL || "https://junior-hermenegilda.ao";

if (!url || !key) {
  console.error("Erro: Define as variáveis SUPABASE_URL e SUPABASE_PUBLISHABLE_KEY (ou SERVICE_ROLE_KEY) no ficheiro .env");
  process.exit(1);
}

const supabase = createClient(url, key);

// Lista de exemplo para emissão de convites. Pode adicionar mais nomes aqui.
const listaConvidados = [
  { name: "Família Silva", phone: "+244923111222", partySize: 2 },
  { name: "Jorge & Marta", phone: "+244924333444", partySize: 2 },
  { name: "Tio António", phone: "+244935555666", partySize: 1 },
];

async function emitirConvites() {
  console.log("A emitir convites para o casamento...\n");

  for (const c of listaConvidados) {
    const cleanPhone = c.phone.replace(/\D/g, "");
    const guestKey = cleanPhone ? `tel:${cleanPhone}` : `guest:${crypto.randomBytes(8).toString("hex")}`;
    const token = crypto.randomBytes(32).toString("hex");

    const { data, error } = await supabase
      .from("wedding_guests")
      .upsert(
        {
          guest_key: guestKey,
          name: c.name.trim(),
          phone: c.phone.trim(),
          party_size: c.partySize,
          token: token,
          active: true,
        },
        { onConflict: "guest_key" }
      )
      .select("name, token")
      .single();

    if (error) {
      console.error(`Erro ao emitir convite para ${c.name}:`, error.message);
      if (error.message.includes("row-level security")) {
        console.warn("💡 Dica: A tabela wedding_guests tem RLS (Row Level Security) activo por segurança.");
        console.warn("   Para executar este script no terminal, adiciona SUPABASE_SERVICE_ROLE_KEY no teu ficheiro .env.");
        console.warn("   Em alternativa, podes emitir convites diretamente na interface web dos noivos em: /painel\n");
      }
    } else {
      const link = `${baseUrl}/convite/${data.token}`;
      console.log(`✅ Convidado: ${data.name}`);
      console.log(`   Ligação do Convite: ${link}\n`);
    }
  }

  console.log("Processo concluído.");
}

emitirConvites().catch(console.error);
