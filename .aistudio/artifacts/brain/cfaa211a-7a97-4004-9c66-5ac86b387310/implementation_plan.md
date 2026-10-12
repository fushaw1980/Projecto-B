# Mozbiscates: Mapa de Apresentação Ponta a Ponta para Concurso de Inovação

> **Resumo Executivo**: Guia mestre e dossiê infográfico textual estruturado de ponta a ponta para defender o **Mozbiscates** perante a banca avaliadora de inovação, destacando o impacto socioeconômico em Moçambique, a inclusão de trabalhadores informais, a integração nativa com M-Pesa e a robustez tecnológica em tempo real.

---

## 1. Decisões Estratégicas Confirmadas

- **Formato**: Infográfico textual ponta a ponta detalhado com arquitetura de telas, jornadas e fluxos lógicos completos.
- **Diferencial Competitivo Principal**: Impacto social tangível, geração de renda na economia informal e inclusão financeira desbancarizada via carteiras móveis (M-Pesa / Emola / Conta Móvel) com taxa de saque reduzida para 3%.
- **Ambiente de Apresentação**: Apresentação direta estruturada no chat e no dossiê de inovação, mantendo o ecossistema pronto para demonstrações em tempo real.

---

## 2. Mapa do Pitch: Narrativa para a Banca de Avaliação

### 01. O Problema (A Dor Real em Moçambique)
- **Informalidade Elevada**: Mais de 80% da força de trabalho ativa em Moçambique atua no setor informal (pedreiros, canalizadores, eletricistas, diaristas, técnicos de frio).
- **Invisibilidade e Desconfiança**: Prestadores qualificados não possuem histórico profissional verificável, portfólio digital nem garantias para novos clientes.
- **Fricção de Pagamentos**: Dificuldade em receber adiantamentos seguros ou lidar com trocos físicos, além do risco constante de calote após a conclusão do serviço.

### 02. A Solução: Mozbiscates
- **Marketplace Hiperlocal com Geolocalização**: Clientes encontram prestadores num raio imediato usando mapa interativo (Leaflet/OpenStreetMap) com coordenadas reais.
- **Garantia Escrow & Carteira Digital**: O valor do serviço é retido com segurança e liberado ao prestador apenas após a confirmação mútua de conclusão.
- **Inclusão Financeira Acessível**: Retirada instantânea para M-Pesa cobrando uma das menores taxas do mercado (**3%**), maximizando a renda líquida do trabalhador.
- **Transparência e Governança**: Painel administrativo com métricas consolidadas e exportação de relatórios mensais em PDF com auditoria de comissões e biscates.

---

## 3. Arquitetura de Telas & Jornadas Ponta a Ponta

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                       FLUXO INTEGRADO MOZBISCATES                           │
└─────────────────────────────────────────────────────────────────────────────┘

    [ CLIENTE (CONTRATANTE) ]                   [ PRESTADOR (BISCATAS) ]
               │                                           │
  1. Descobre no Mapa / Categorias            1. Cadastra Perfil & Tarifas
               │                                           │
  2. Solicita Serviço / Orçamento             2. Recebe Notificação & Aceita
               │                                           │
  3. Pagamento Protegido (Escrow)             3. Executa o Trabalho no Local
               │                                           │
  4. Chat & Acompanhamento                    4. Marca como Concluído
               │                                           │
  5. Aprova Entrega & Avalia                  5. Saldo Liberado na Carteira
               │                                           │
               └───────────────┬───────────────────────────┘
                               │
               [ SISTEMA FINANCEIRO INTEGRADO ]
                               │
            - Taxa da Plataforma: 3% no Saque
            - Transferência M-Pesa Direta
            - Painel de Métricas & Exportação PDF (Admin)
```

### Jornada 1: O Cliente (Busca e Contratação)
1. **Onboarding & Descoberta**:
   - Visualização por categorias (Construção, Eletricidade, Limpeza, Mecânica, Tecnologia).
   - Modo Mapa Interativo com marcadores dos profissionais mais próximos e raio de deslocação.
2. **Avaliação do Profissional**:
   - Perfil detalhado com biografia, fotos de serviços anteriores, selo de verificação e avaliações por estrelas.
3. **Solicitação e Chat**:
   - Descrição da tarefa com valor proposto e agendamento.
   - Comunicação direta via chat interno em tempo real para alinhamento de detalhes.
4. **Finalização e Segurança**:
   - Confirmação de serviço executado com liberação de pagamento e avaliação mútua.

### Jornada 2: O Prestador de Serviço (Empoderamento & Renda)
1. **Perfil Profissional**:
   - Definição de especialidades, localização e taxa horária ou por serviço.
2. **Gestão de Oportunidades**:
   - Feed de solicitações pendentes e avisos de novos biscates na sua vizinhança.
3. **Carteira Digital & Retirada**:
   - Visualização em tempo real do saldo acumulado.
   - Modal de saque simplificado via M-Pesa com cálculo transparente da taxa de 3%.
   - Histórico completo de retiradas e extrato financeiro.

### Jornada 3: O Administrador (Governança e Escala)
1. **Monitoramento Operacional**:
   - Controlo de utilizadores ativos, biscates em andamento e disputas resolvidas.
2. **Inteligência Financeira**:
   - Volume bruto transacionado (GMV), receita líquida da plataforma e ticket médio.
3. **Exportação de Relatórios em PDF**:
   - Geração instantânea de relatório mensal profissional para contabilidade, investidores ou auditoria do concurso.

---

## 4. Diferenciais de Inovação para Defender na Banca

| Critério de Inovação | Como o Mozbiscates se Diferencia |
| :--- | :--- |
| **Inclusão Econômica** | Foco primário no mercado moçambicano informal, monetizando competências de base. |
| **Integração M-Pesa** | Não exige conta bancária tradicional; opera 100% sobre o ecossistema móvel dominante. |
| **Taxa Social (3%)** | Taxa amigável de apenas 3% no saque, combatendo a usura e fidelizando prestadores. |
| **Tecnologia Resiliente** | Suporte PWA offline-first, mapas leves sem dependências pesadas e tempo real com Firebase. |
| **Compliance & ESG** | Impacto direto nos ODS da ONU: ODS 1 (Erradicação da Pobreza) e ODS 8 (Trabalho Digno). |

---

## 5. Estrutura do Pitch Verbal (Roteiro de 3 Minutos)

- **Minuto 01 (O Gancho e o Propósito)**: Apresentar a realidade de milhões de prestadores em Moçambique que vivem do trabalho informal sem previsibilidade de renda.
- **Minuto 02 (A Demonstração Tecnológica)**: Explicar como o Mozbiscates une geolocalização exata, negociação no chat e segurança financeira via M-Pesa.
- **Minuto 03 (Impacto, Números e Futuro)**: Destacar o modelo de negócio sustentável com taxa de 3%, transparência com relatórios mensais e o potencial de expansão para outras províncias.
