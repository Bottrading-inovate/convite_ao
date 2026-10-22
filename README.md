# Joyful Uniques — Convite de Casamento Júnior & Hermenegilda

Plataforma digital para o convite de casamento de **Júnior & Hermenegilda**, a celebrar-se a 12 de Dezembro de 2026 em Luanda, Angola.

## Funcionalidades
- **Abertura Interativa:** Envelope animado com selo nominal e fotografia do casal.
- **Contagem Decrescente & Calendário:** Cronómetro em tempo real e calendário de Dezembro de 2026 com o dia 12 destacado.
- **Exportação para Calendário:** Descarregamento de ficheiro `.ics` para adicionar ao telemóvel/agenda.
- **Cronograma & Localizações:** Horários das cerimónias civil, religiosa e copo-d’água com ligações directas para o Google Maps.
- **Convites Únicos com Tokens (QR Code):** Cada convidado dispõe de uma hiperligação exclusiva com token seguro (`/convite/:token`) e descarregamento de QR Code pessoal.
- **Confirmação de Presença (RSVP):** Submissão integrada ligada ao Supabase com validação de número de pessoas e mensagem aos noivos.
- **Apoio & Presentes:** Cópia facilitada dos IBANs (noivo e noiva) e número Express com um simples toque.

## Desenvolvimento Local

Certifique-se de que tem o Node.js (v20+) e npm ou Bun instalados:

```sh
# Instalação das dependências
npm install
# ou com bun:
bun install

# Iniciar o servidor de desenvolvimento
npm run dev

# Compilar para produção
npm run build
```

## Configuração do Supabase
Preencha as variáveis de ambiente no ficheiro `.env`:

```env
SUPABASE_URL="https://seu-projeto.supabase.co"
SUPABASE_PUBLISHABLE_KEY="sua-chave-publica"
VITE_SUPABASE_URL="https://seu-projeto.supabase.co"
VITE_SUPABASE_PUBLISHABLE_KEY="sua-chave-publica"
```
Execute o script disponível em `supabase/schema.sql` no Editor SQL do seu painel Supabase para criar as tabelas e funções necessárias.
