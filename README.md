# Aprimorador de Histórias de Usuário com IA

Uma aplicação com IA para ajudar Product Owners a melhorar a qualidade das histórias de usuário através de uma sessão de planejamento simulada com personas de IA.

## Funcionalidades da Aplicação

### Modos de Início

- **Refinar História Existente:** Cole o JSON do Redmine ou o texto bruto de uma história para análise.
- **Gerar Nova História:** Descreva requisitos para que a IA crie uma história do zero.
- **Analisar Transcrição (Contextual):** Analise transcrições com objetivos específicos.
  - **Levantamento de Requisitos:** Gera novas histórias a partir da discussão.
  - **Reunião de Planejamento:** Valida uma história existente contra o que foi discutido.
  - **Sessão de Homologação:** Extrai feedback e pontos de ação.
- **Criar Feature BDD:** A partir de uma descrição, a IA sugere cenários. Você pode então revisar, editar, adicionar, remover e detalhar cada cenário (incluindo a criação de 'Scenario Outlines' com tabelas de exemplos) para gerar um arquivo .feature completo.
- **Converter Documento para BDD:** Cole um documento de requisitos tradicional para que a IA o analise, sugira uma quebra em features menores e o transforme em um arquivo .feature.

### Configuração Global (na Tela Inicial)

- **Modelo de História:** Defina um modelo de formatação que a IA usará para todas as histórias geradas na sessão.
- **Modelo de Protótipo:** Defina um código de exemplo para que a IA siga o seu design system.

### Sessão de Planejamento Simulada

- **Configuração Flexível:** Selecione as personas (Dev, QA, Arquiteto, UX, DevOps) e arraste para definir a ordem das perguntas.
- **Perguntas Contextuais:** A IA faz perguntas sequenciais com base nas personas e na conversa.
- **Inserção de Tabelas:** Quando a IA pede dados tabulares, um botão aparece para abrir um modal de edição de tabelas, inserindo os dados formatados na sua resposta.
- **Análise de Complexidade (Anti-Épico):** Identifique histórias muito grandes e receba sugestões para quebrá-las. Refine cada nova história individualmente.
- **Planejamento BDD em Grupo:** Selecione múltiplos cenários para discuti-los em uma única sessão de planejamento, otimizando o tempo.

### Refinamento Iterativo

- **Sugestão do PO Sênior:** Peça uma nova versão da história com base nas suas respostas.
- **Modificações Contínuas:** Dê instruções para a IA refinar a sugestão quantas vezes forem necessárias.
- **Comparação Visual (Diff):** Visualize as diferenças exatas entre a versão atual e a sugestão da IA para tomar decisões mais informadas.

### Ferramentas de Validação e Suporte

- **Geração de Cenários de Teste:** Gere cenários de teste (caminho feliz, casos de borda, negativos) para a versão atual da história a qualquer momento.
- **Prototipagem Visual com IA:** Crie um protótipo visual (HTML/Tailwind CSS) a partir da história de usuário ou de um arquivo .feature completo para acelerar o alinhamento. O protótipo é exibido em um modal com visualização ao vivo e opção de salvar como .html.
- **Checklist de Pré-Homologação (BDD):** Gere um roteiro de teste em linguagem natural para o PO validar a entrega a partir do arquivo .feature.
- **Definições de Steps (BDD):** Gere o código completo das Step Definitions (JS, Python, Java, PHP, C#) para acelerar a automação de testes.

### Utilidades

- **Acesso Rápido:** Visualize a história original, o cenário atual ou a feature BDD em um modal a qualquer momento.
- **Exportação de Artefatos:** Copie facilmente qualquer texto gerado ou faça o download de artefatos como protótipos (`.html`), checklists (`.txt`) e definições de steps (código-fonte).
- **Navegação Inteligente:** Reinicie o processo ou volte para a seleção de histórias quebradas com um botão que se adapta ao contexto.

## Informações Técnicas

Esta seção detalha a stack tecnológica, a arquitetura e outras decisões técnicas relevantes do projeto.

### Stack Tecnológica

*   **Linguagem Principal:** TypeScript
*   **Framework de UI:** React
*   **API de IA:** Google Gemini API (`@google/genai`)
*   **Estilização:** Tailwind CSS (utilizado via CDN)
*   **Ambiente:** A aplicação é um Single-Page Application (SPA) moderno, executado diretamente no navegador com suporte a módulos ES6, utilizando `importmap` para gerenciamento de dependências.

### Arquitetura

A aplicação segue uma arquitetura de SPA baseada em componentes, com uma estrutura clara e modular.

*   **Componente Principal (`App.tsx`):** Atua como o orquestrador central, gerenciando o estado global da aplicação, a lógica de navegação e a renderização dos diferentes módulos (telas).
*   **Máquina de Estados Simples:** A navegação e o controle de fluxo são gerenciados por uma máquina de estados (`appState`), que determina qual tela ou componente é exibido ao usuário. Isso permite a criação de múltiplos fluxos de trabalho complexos (refinamento de história, criação de BDD, análise de transcrição) de forma organizada.
*   **Separação de Serviços (`geminiService.ts`):** Toda a comunicação com a API do Google Gemini é abstraída em um único serviço. Isso centraliza a lógica de IA, facilita a manutenção e desacopla a camada de visão da lógica de negócios. O serviço faz uso extensivo do modo JSON da API Gemini, utilizando `responseSchema` para garantir respostas estruturadas e previsíveis.
*   **Componentização:** A UI é construída com componentes reutilizáveis (ícones, modais, etc.), localizados no diretório `components`, promovendo consistência visual e reaproveitamento de código.
*   **Gerenciamento de Estado:** O estado é gerenciado localmente no componente `App.tsx` através dos hooks do React (`useState`, `useCallback`). Para esta aplicação, essa abordagem centralizada é suficiente e evita a complexidade de bibliotecas de gerenciamento de estado externas.

### Destaques da Implementação

*   **Cache em Memória:** Para otimizar o desempenho e reduzir custos de API, a aplicação implementa um mecanismo simples de cache em memória para operações que podem ser repetidas com os mesmos dados de entrada dentro de uma sessão (ex: análise de complexidade, geração de cenários de teste).
*   **Fluxos de Trabalho Modulares:** A arquitetura baseada em estados permite que cada funcionalidade principal (Refinar, Gerar, BDD, etc.) opere como um módulo semi-independente, facilitando a adição de novos fluxos no futuro.
*   **Tipagem Forte:** O uso de TypeScript e a centralização de tipos no arquivo `types.ts` garantem a segurança e a clareza dos dados que transitam pela aplicação, desde a UI até o serviço da API.
