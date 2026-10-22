# Regras de Desenvolvimento do Projeto

- Manter a data do casamento, hiperligações e a lógica de calendário/contagem decrescente no módulo partilhado seguro para o cliente (`src/lib/wedding.ts`), garantindo a consistência em todas as variantes do convite.
- A identidade do convidado é protegida por um token criptográfico aleatório (capability link compacto de 12 a 64 caracteres hexadecimais); a consulta pública retorna unicamente o nome e o estado correspondente do convidado ativo, nunca uma lista de convidados.
- Armazenar os convites no Supabase com restrições de unicidade para `guest_key` e `token`; a emissão e gestão de convidados é feita pelos noivos/administração, sem expor métodos de criação arbitrária ao público.
- Utilizar uma vista reutilizável (`WeddingInvitation`) para o convite geral e para a rota personalizada com token, com todos os estilos e papéis visuais definidos no CSS global.
- Manter o idioma e expressões em português de Angola (pt-AO).
