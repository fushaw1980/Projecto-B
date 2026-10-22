# Plano de Remediação de Segurança — Mozbiscates

> **Status:** Aguardando autorização explícita do utilizador para execução.  
> **Directiva:** Nenhuma alteração de código, migração de dados ou publicação foi efectuada nesta etapa.

---

## 1. Visão Geral e Arquitectura de Remediação

O relatório de auditoria identificou vulnerabilidades críticas no isolamento de dados pessoais (PII como BI, Selfie e NUIT), na validação de permissões administrativas, na manipulação de saldos pelo lado do cliente, em rotas de diagnóstico do servidor e no descasamento de regras para avaliações.

A remediação está dividida em 4 fases sequenciais interdependentes, assegurando que o design, os componentes visuais e o fluxo moçambicano (M-Pesa, SOS, USSD e Leaflet) permaneçam intactos.

---

## FASE 1 — Protecção dos Dados Pessoais (PII)

### 1.1 Locais Actuais de Armazenamento, Leitura e Escrita
- **Ficheiro `src/App.tsx`:**
  - `handleCreateProfile` (linhas 6149–6176): grava `biPhoto`, `biSelfie`, `nuit`, `emergencyContactName`, `emergencyContactPhone` directamente na raiz do documento `users/${currentUser.uid}`.
  - `handleCreateClientProfile` (linhas 6179–6200): grava `biPhoto`, `emergencyContactName`, `emergencyContactPhone` na raiz do documento `users/${currentUser.uid}`.
  - Snapshot de prestadores (linhas 5855–5872): faz consulta em massa `where('role', '==', 'worker')` descarregando todos os campos da raiz dos prestadores para o estado do cliente `rawProviders`.
  - Guarda de navegação (linha 6362): verifica `(!userData?.phone || !userData?.biPhoto)` na raiz.
  - Detalhes do prestador (linhas 7168–7172): lê `(selectedProvider as any).nuit` na interface.
- **Ficheiro `src/components/ClientSecurityProfileModal.tsx`:**
  - Manipula e comprime `biPhoto`, enviando-o no payload `onSave`.
- **Ficheiro `src/components/EmergencyModal.tsx`:**
  - Lê `userData?.emergencyContactPhone` e `userData?.emergencyContactName` para o alarme e WhatsApp SOS.
- **Ficheiro `firestore.rules`:**
  - Linhas 63–67 e 71–75: `allow get` e `allow list` autorizam qualquer utilizador autenticado a consultar perfis com `role == 'worker'`, expondo `biPhoto`, `biSelfie` e `nuit`.

### 1.2 Estratégia de Separação (Split-Collection / Subcolecção Privada)
- **Perfil Público (`/users/{userId}`):**
  - Mantém apenas dados necessários para descoberta e contratação:
    `uid`, `email`, `role`, `fullName`, `category`, `specialty`, `specialties`, `bairro`, `city`, `photo`, `verified`, `level`, `jobs`, `portfolio`, `rating`, `createdAt`, `updatedAt`.
  - **Eliminação:** `biPhoto`, `biSelfie`, `nuit`, `emergencyContactName`, `emergencyContactPhone` deixam de constar no documento público.
- **Documento de Segurança Privado (`/users/{userId}/private_profile/security`):**
  - Armazena exclusivamente:
    `biPhoto`, `biSelfie`, `nuit`, `emergencyContactName`, `emergencyContactPhone`, `identityAuditStatus`, `updatedAt`.
  - **Regra Firestore:** Leitura e escrita estritamente restritas a `isOwner(userId) || isAdmin()`.

### 1.3 Adaptação de Componentes e Consultas
- Criar listener/fetch específico para `/users/{currentUser.uid}/private_profile/security` na inicialização do utilizador autenticado.
- Modificar `handleCreateProfile` e `handleCreateClientProfile`:
  - 1º: Grava dados seguros na subcolecção `private_profile/security`.
  - 2º: Grava dados públicos em `users/{userId}`.
- Adaptar `EmergencyModal.tsx`: passa a receber `userSecurityData` (obtido da subcolecção privada) mantendo fallback se ainda estiver no documento principal.
- Adaptar a guarda de verificação do cliente (linha 6362): verifica a existência da verificação através de `userData.verified` ou da subcolecção privada.

### 1.4 Plano de Migração sem Perda de Dados nem Exposição
- **Leitura Híbrida com Fallback (Zero Downtime):**
  - A aplicação lê a subcolecção privada; caso esteja vazia e existam dados no documento raiz, utiliza os dados existentes e executa um script transparente de auto-migração (`lazy migration` no primeiro login do utilizador).
  - Após a migração individual, os campos sensíveis são removidos do documento raiz via `deleteField()`.
- **Regras Firestore em Duas Fases:**
  - Fase 1.1: Criar regras para `/users/{userId}/private_profile/security` (apenas dono/admin).
  - Fase 1.2: Restringir a leitura e listagem de `users/{userId}` removendo permissões de campos sensíveis e bloquear updates nos campos de PII na raiz.

---

## FASE 2 — Administração e Saldos

### 2.1 Protecção dos Privilégios Administrativos
- **Problema Actual:** `firestore.rules` (linhas 36–42) verifica apenas `request.auth.token.email in [...]` sem exigir `email_verified == true`. Um utilizador com fornecedor de login não verificado com o mesmo endereço poderia forjar o papel.
- **Solução Imediata:**
  - Adicionar `request.auth.token.email_verified == true` em `isAdmin()`.
  - Adicionar verificação estruturada em colecção protegida `/system_admins/{uid}` (ou claims do Firebase Auth), garantindo revogação sem necessidade de deploy de regras.

### 2.2 Migração de Operações de Saldo para Backend Confiável
- **Problema Actual:** `firestore.rules` (linhas 108–116) possui o "Case 2", permitindo que qualquer utilizador autenticado incremente o saldo de outro utilizador em até 500.000 MT desde que o contador de `jobs` aumente 1 unidade.
- **Solução Arquitectural:**
  - Criar endpoint transaccional no backend: `POST /api/jobs/complete`.
  - O endpoint:
    1. Verifica o token Firebase Auth do cliente chamador (`Bearer <idToken>`).
    2. Lê o documento do job na Firestore garantindo que:
       - O estado actual é `FINALIZADO` (prestador já realizou check-out com foto).
       - O `clientId` do job corresponde exactamente ao UID do utilizador que está a chamar a rota.
       - O job ainda não foi pago/creditado (`status != 'CONCLUIDO'`).
    3. Executa uma Firestore Transaction atómica:
       - Actualiza o job para `status = 'CONCLUIDO'` e `paidAt = serverTimestamp()`.
       - Credita o valor líquido (`payoutAmount = amount * 0.90`) no saldo do prestador.
       - Regista a movimentação na subcolecção imutável `/users/{providerId}/transactions/{txId}`.
  - Eliminar o "Case 2" permissivo do `firestore.rules`, permitindo incrementos de saldo apenas a operações de administração e backend de confiança.

### 2.3 Prevenção de Pagamentos Duplicados e Histórico Consistente
- Identificador de idempotência baseado no `jobId`: a transacção só é executada se `job.status === 'FINALIZADO'`. Se já estiver `CONCLUIDO`, retorna erro 409 (Conflict).
- Criação do histórico de transacções com carimbo de tempo, `jobId`, valor bruto, comissão da plataforma (10%) e valor líquido creditado.

---

## FASE 3 — Protecção do Servidor

### 3.1 Remoção e Restrição de Rotas de Diagnóstico
- **`/api/debug`:**
  - Remover completamente o endpoint de produção em `server.ts` (linhas 33–43), que expõe directórios internos do servidor, ficheiros do sistema de ficheiros e variáveis de ambiente.
  - Manter `/api/health` estritamente minimalista (retornando apenas `{ status: "ok" }`).

### 3.2 Protecção de `/api/verify-identity`
- **Problema Actual:** Qualquer pessoa na internet pode enviar imagens arbitrárias para o endpoint sem autenticação, esgotando a quota da API Gemini e incorrendo em custos.
- **Solução:**
  - Middleware de Autenticação Firebase: exigir cabeçalho `Authorization: Bearer <idToken>`.
  - Validação de Entradas:
    - Verificar formato Base64 ou MIME type real (JPEG/PNG).
    - Limitar tamanho máximo de upload para 4MB por imagem.
  - Rate Limiting em memória / IP / UID:
    - Limitar a 3 tentativas de verificação por UID a cada 1 hora.

### 3.3 Desactivação de Endpoints de Demonstração em Memória
- Os seguintes endpoints em `server.ts` operam sobre arrays em memória sem persistência e sem regras de autorização:
  - `/api/jobs` (GET e POST)
  - `/api/jobs/:id/action` (POST)
  - `/api/providers` (GET e POST)
  - `/api/jobs/:id/chat` (GET e POST)
- Desactivar com segurança estes endpoints obsoletos, mantendo intacto o endpoint `/api/payments/stk-push` (necessário para a simulação M-Pesa).

---

## FASE 4 — Funcionalidades e Testes

### 4.1 Correcção do Envio e Leitura de Avaliações (Reviews)
- **Problema Actual:**
  - `ReviewModal` em `src/App.tsx` (linha 2322) tenta gravar em `collection(db, 'reviews')` na raiz sem passar `authorId`. O `firestore.rules` rejeita porque não existe regra para a raiz.
  - `fetchReviews` em `src/App.tsx` (linha 5776) tenta carregar de `/api/providers/${pid}/reviews` (array em memória no Node.js).
- **Solução:**
  - No `ReviewModal`: gravar em `collection(db, 'users', providerId, 'reviews')`, preenchendo `authorId: currentUser.uid`, `rating`, `comment`, `createdAt: serverTimestamp()`.
  - No `fetchReviews`: consultar directamente a subcolecção da Firestore `collection(db, 'users', pid, 'reviews')` ordenada por `createdAt desc`.
  - Preservar o design visual das estrelas e listagem.

### 4.2 Revisão da Utilização da TinyURL no Fluxo SOS e Partilha
- **Problema Actual:** `src/App.tsx` (linhas 143–153 e 7147) envia links de perfis para `tinyurl.com/api-create.php`. Em situações de emergência ou instabilidade de rede internacional em Moçambique, a requisição externa a terceiros pode falhar ou expor padrões de navegação.
- **Solução:**
  - Na partilha de perfis: gerar o link directo da aplicação (`window.location.origin + ...`) com encurtamento local ou cópia nativa via `navigator.share` / `navigator.clipboard`.
  - No SOS: certificar que os links de GPS continuam a ser links nativos do Google Maps Moçambique (`https://www.google.com/maps?q=lat,lng`), sem intermediários.

### 4.3 Especificação de Testes
- **Matriz de Testes Firestore Rules:**
  1. Utilizador comum tentando ler `private_profile/security` de outro utilizador -> **NEGADO (403)**.
  2. Dono do perfil lendo o seu próprio `private_profile/security` -> **PERMITIDO (200)**.
  3. Administrador autenticado com e-mail verificado lendo `private_profile/security` -> **PERMITIDO (200)**.
  4. Utilizador tentando alterar directamente `balance` do prestador via cliente -> **NEGADO (403)**.
  5. Cliente enviando avaliação para prestador na subcolecção correcta -> **PERMITIDO (200)**.
  6. Prestador avaliando-se a si mesmo -> **NEGADO (403)**.
  7. Cliente chamando `POST /api/verify-identity` sem Bearer token -> **NEGADO (401)**.
  8. Acesso a `/api/debug` -> **404 Not Found**.

---

## 2. Mapa de Ficheiros Afectados e Justificação

| Ficheiro | Motivo da Alteração | Fase |
| :--- | :--- | :--- |
| `firestore.rules` | Bloquear vazamento de PII em `users`, isolar subcolecção `private_profile`, remover Case 2 de saldo e adicionar `email_verified` ao admin. | 1, 2, 4 |
| `server.ts` | Remover `/api/debug`, proteger `/api/verify-identity` com auth e rate-limit, aposentar rotas mock de jobs/providers e implementar endpoint seguro `/api/jobs/complete`. | 2, 3 |
| `src/App.tsx` | Adaptar criação/leitura de perfil para subcolecção privada, corrigir envio/leitura de reviews na Firestore, ajustar confirmação de job para o backend e substituir TinyURL. | 1, 2, 4 |
| `src/components/ClientSecurityProfileModal.tsx` | Adaptar payload para gravar dados privados de forma transparente. | 1 |
| `src/components/EmergencyModal.tsx` | Obter contacto de emergência da colecção segura mantendo compatibilidade. | 1, 4 |
| `src/lib/emergencyService.ts` | Garantir que URLs de emergência usam coordenadas directas sem serviços externos não confiáveis. | 4 |

---

## 3. Plano de Reversão (Rollback)

- Antes de qualquer alteração, os ficheiros originais serão preservados em ponto de restauro lógico no repositório.
- A migração foi desenhada com tolerância dupla:
  - Se um utilizador ainda não tiver o documento `private_profile/security`, a aplicação continua a ler os dados do perfil principal até à migração automática.
  - Se o backend falhar durante a transacção de saldo, o job permanece no estado `FINALIZADO` e o saldo não é corrompido nem duplicado.
- Reversão de regras do Firestore: basta reimplantar a versão estável do `firestore.rules` via ferramenta de deploy caso ocorra bloqueio imprevisto em produção.
