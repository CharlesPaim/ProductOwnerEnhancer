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

### Ferramentas de Validação e Suporte

- **Geração de Cenários de Teste:** Gere cenários de teste (caminho feliz, casos de borda, negativos) para a versão atual da história a qualquer momento.
- **Prototipagem Visual com IA:** Crie um protótipo visual (HTML/Tailwind CSS) a partir da história de usuário ou de um arquivo .feature completo para acelerar o alinhamento. O protótipo é exibido em um modal com visualização ao vivo e opção de salvar como .html.
- **Checklist de Pré-Homologação (BDD):** Gere um roteiro de teste em linguagem natural para o PO validar a entrega a partir do arquivo .feature.
- **Definições de Steps (BDD):** Gere o código completo das Step Definitions (JS, Python, Java, PHP, C#) para acelerar a automação de testes.

### Utilidades

- **Acesso Rápido:** Visualize a história original, o cenário atual ou a feature BDD em um modal a qualquer momento.
- **Copiar para a Área de Transferência:** Copie facilmente a história original, perguntas, sugestões, testes e protótipos.
- **Navegação Inteligente:** Reinicie o processo ou volte para a seleção de histórias quebradas com um botão que se adapta ao contexto.
