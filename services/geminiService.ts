import { GoogleGenAI, GenerateContentResponse, Type, Part } from "@google/genai";
import { Persona, ParsedStory, ConversationTurn, InitialQuestions, ComplexityAnalysisResult, SplitStory, BddFeatureSuggestion, GherkinScenario } from '../types';

if (!process.env.API_KEY) {
    console.error("API_KEY environment variable not set.");
}

const ai = new GoogleGenAI({ apiKey: process.env.API_KEY! });

const model = 'gemini-2.5-flash';

export interface ScenarioOutlineResult {
  template: string;
  headers: string[];
}


export const extractTableColumnsFromQuestion = async (question: string): Promise<string[]> => {
    try {
        const prompt = `
        Analise a seguinte pergunta e extraia os nomes das colunas para uma tabela de dados que responderia a essa pergunta.
        Se a pergunta não parece solicitar dados tabulares, retorne um array vazio.
        A resposta deve ser um array de strings JSON. A resposta deve ser em português do Brasil.

        Pergunta: "${question}"

        Exemplo 1:
        Pergunta: "Poderia listar os usuários que devem existir, com seus nomes e e-mails?"
        Resposta: ["Nome", "E-mail"]

        Exemplo 2:
        Pergunta: "Quais são os campos necessários para o formulário de cadastro? Informe o nome do campo, tipo e se é obrigatório."
        Resposta: ["Nome do Campo", "Tipo", "Obrigatório"]
        
        Exemplo 3:
        Pergunta: "Qual é o fluxo principal do usuário?"
        Resposta: []
        `;

        const responseSchema = {
            type: Type.ARRAY,
            items: { type: Type.STRING }
        };

        const response = await ai.models.generateContent({
            model: model,
            contents: prompt,
            config: {
                responseMimeType: "application/json",
                responseSchema,
            },
        });
        
        const jsonString = response.text;
        return JSON.parse(jsonString) as string[];

    } catch (error) {
        console.error("Error extracting table columns:", error);
        return [];
    }
};


const personaToKey = (p: Persona): string => {
    switch(p) {
        case Persona.Dev: return 'developerQuestion';
        case Persona.QA: return 'qaQuestion';
        case Persona.Architect: return 'architectQuestion';
        case Persona.UX: return 'uxQuestion';
        case Persona.DevOps: return 'devopsQuestion';
        default: return 'genericQuestion';
    }
};

const personaGuidelines: Record<Persona, string> = {
    [Persona.Dev]: "**Desenvolvedor Sênior:** Sua pergunta deve focar na clareza dos requisitos, regras de negócio específicas, validações de dados e comportamentos esperados do sistema. Evite perguntar sobre bibliotecas, frameworks ou algoritmos.",
    [Persona.QA]: "**Engenheiro de QA Sênior:** Sua pergunta deve focar na testabilidade, critérios de aceitação ambíguos, casos de borda, cenários de falha e a experiência do usuário em situações inesperadas.",
    [Persona.Architect]: "**Arquiteto Sênior:** Sua pergunta deve focar em requisitos não-funcionais (performance, segurança), dependências de outros sistemas, APIs, e o impacto da funcionalidade no ecossistema do produto como um todo.",
    [Persona.UX]: "**Designer de UX/UI:** Sua pergunta deve focar na jornada do usuário, clareza da interface, mensagens de erro, acessibilidade e como a funcionalidade se alinha com o fluxo de trabalho existente do usuário.",
    [Persona.DevOps]: "**Engenheiro de DevOps:** Sua pergunta deve focar em monitoramento, logs, alertas, configuração de ambiente, feature flags e o processo de deploy. Pense em como a funcionalidade será operada e mantida em produção.",
    [Persona.PO]: "" // PO não faz perguntas iniciais
};


export const generateInitialQuestions = async (story: ParsedStory, personas: Persona[]): Promise<InitialQuestions> => {
    try {
        const properties: Record<string, { type: Type, description: string }> = {};
        const required: string[] = [];
        const personaPrompts: string[] = [];

        personas.forEach(p => {
            const key = personaToKey(p);
            properties[key] = { 
                type: Type.STRING, 
                description: `Uma pergunta crítica da perspectiva de um(a) ${p}.` 
            };
            required.push(key);
            if(personaGuidelines[p]) {
                personaPrompts.push(personaGuidelines[p]);
            }
        });

        const dynamicSchema = {
            type: Type.OBJECT,
            properties,
            required,
        };

        const prompt = `
        Você é um painel de especialistas em produto e engenharia.
        Sua tarefa é analisar a seguinte história de usuário e, para cada persona selecionada, gerar uma pergunta crítica que ajude o Product Owner a refinar e completar a história.

        **O objetivo principal é a qualidade da história, não a solução técnica.** Todas as perguntas devem ser focadas em esclarecer o "o quê" e o "porquê", e não o "como" da implementação.

        **Diretrizes para as Perguntas de cada Persona:**
        ${personaPrompts.join('\n')}

        História de Usuário a ser analisada:
        Título: "${story.title}"
        ---
        Descrição:
        ${story.description}
        ---

        Gere uma pergunta para cada persona, seguindo estritamente as diretrizes acima. Retorne um objeto JSON válido e responda em português do Brasil.
        `;

        const response: GenerateContentResponse = await ai.models.generateContent({
            model: model,
            contents: prompt,
            config: {
                responseMimeType: "application/json",
                responseSchema: dynamicSchema,
            },
        });

        const jsonString = response.text;
        return JSON.parse(jsonString) as InitialQuestions;

    } catch (error) {
        console.error("Error generating initial questions:", error);
        throw new Error("Falha ao gerar as perguntas iniciais das personas de IA.");
    }
};


export const generateFollowUpQuestion = async (story: ParsedStory, conversationHistory: ConversationTurn[], nextPersona: Persona): Promise<string> => {
    try {
        const history = conversationHistory.map(turn => 
            `Pergunta de ${turn.persona}: ${turn.question}\nResposta do Usuário: ${turn.answer || 'Pulado'}`
        ).join('\n\n');

        const prompt = `
        Você está em uma sessão de planejamento para refinar uma história de usuário. Você está atuando como um(a) **${nextPersona}**.
        O objetivo principal é ajudar o Product Owner a melhorar a história, focando em aspectos funcionais e de negócio, não em detalhes de implementação técnica.

        **Sua Diretriz como ${nextPersona}:**
        ${personaGuidelines[nextPersona]}

        **História Original:** 
        Título: "${story.title}"
        Descrição:
        ${story.description}

        **Conversa até agora:**
        ---
        ${history}
        ---
        
        Com base na sua diretriz, na história e na conversa, formule sua próxima pergunta de acompanhamento. A pergunta deve ser concisa, relevante e evitar tópicos já discutidos.
        Retorne apenas a pergunta como uma única string, em português do Brasil, sem nenhum preâmbulo.
        `;

        const response = await ai.models.generateContent({
            model: model,
            contents: prompt,
        });

        return response.text.trim();

    } catch (error) {
        console.error("Error generating follow-up question:", error);
        throw new Error("Falha ao gerar uma pergunta de acompanhamento.");
    }
};

export const suggestNewStoryVersion = async (originalStory: ParsedStory, conversationHistory: ConversationTurn[]): Promise<string> => {
    try {
        const history = conversationHistory
            .filter(turn => turn.answer && turn.answer.trim() !== 'Pulado')
            .map(turn => `Pergunta de ${turn.persona}: ${turn.question}\nResposta do Usuário: ${turn.answer}`)
            .join('\n\n');

        if (!history) {
            return "Nenhum feedback fornecido ainda. Por favor, responda a algumas perguntas para obter uma sugestão.";
        }

        const prompt = `
        Você é um Product Owner Sênior com habilidades excepcionais em escrever histórias de usuário claras e concisas.
        Sua tarefa é reescrever a descrição da seguinte história de usuário com base nos esclarecimentos fornecidos no registro da conversa.

        História de Usuário Original:
        ---
        Título: ${originalStory.title}
        Descrição:
        ${originalStory.description}
        ---

        Registro da Conversa (Perguntas e Respostas):
        ---
        ${history}
        ---

        Reescreva a descrição da história, incorporando as respostas e abordando as preocupações levantadas na conversa.
        A nova história deve ser mais clara, completa e menos ambígua.
        Preserve as convenções de formatação originais da história de usuário (ex: usando "+**...**+", "**Como**", "**Eu quero**", "**Para que**", "**Dado**", "**Quando**", "**Então**").
        Produza apenas a descrição da história reescrita, em português do Brasil. Não inclua o título ou qualquer comentário extra, preâmbulo ou despedida.
        `;

        const response = await ai.models.generateContent({
            model: model,
            contents: prompt,
        });

        return response.text.trim();
    } catch (error) {
        console.error("Error suggesting new story version:", error);
        throw new Error("Falha ao gerar uma nova versão da história.");
    }
};

export const generateNewStory = async (requirements: string, modelStory?: string): Promise<ParsedStory> => {
    try {
        const modelStoryPrompt = modelStory 
            ? `Use a seguinte história como modelo para a estrutura e formatação (ex: +**...**+, **Como**...): \n---\n${modelStory}\n---`
            : "Use o formato padrão de história de usuário: Título, seguido por 'Como [persona], Eu quero [objetivo], Para que [benefício]', e critérios de aceitação no formato 'Dado... Quando... Então...'.";

        const prompt = `
        Você é um Product Owner experiente, especialista em criar histórias de usuário claras e eficazes.
        Sua tarefa é criar uma nova história de usuário com base nos requisitos fornecidos.

        **Requisitos:**
        ---
        ${requirements}
        ---

        **Diretrizes de Estrutura:**
        ${modelStoryPrompt}

        Gere um título conciso e uma descrição detalhada para a história de usuário.
        A resposta deve ser um objeto JSON válido, em português do Brasil.
        `;
        
        const response: GenerateContentResponse = await ai.models.generateContent({
            model: model,
            contents: prompt,
            config: {
                responseMimeType: "application/json",
                responseSchema: {
                    type: Type.OBJECT,
                    properties: {
                        title: { type: Type.STRING, description: "O título da história de usuário." },
                        description: { type: Type.STRING, description: "A descrição completa da história, incluindo critérios de aceitação." }
                    },
                    required: ["title", "description"],
                },
            },
        });

        const jsonString = response.text;
        return JSON.parse(jsonString) as ParsedStory;

    } catch (error) {
        console.error("Error generating new story:", error);
        throw new Error("Falha ao gerar a nova história de usuário.");
    }
};

export const refineSuggestedStory = async (currentStory: string, refinementPrompt: string): Promise<string> => {
    try {
        const prompt = `
        Você é um Product Owner Sênior. Sua tarefa é refinar uma história de usuário com base nas instruções do usuário.

        **História de Usuário Atual:**
        ---
        ${currentStory}
        ---

        **Instruções para Refinamento:**
        ---
        ${refinementPrompt}
        ---

        Reescreva a descrição da história, incorporando as mudanças solicitadas. Mantenha a clareza, a completude e o formato original.
        Produza apenas a descrição da história reescrita, em português do Brasil. Não inclua o título ou qualquer comentário extra.
        `;

        const response = await ai.models.generateContent({
            model: model,
            contents: prompt,
        });

        return response.text.trim();
    } catch (error) {
        console.error("Error refining suggested story:", error);
        throw new Error("Falha ao refinar a história sugerida.");
    }
};

export const generateTestScenarios = async (storyDescription: string): Promise<string> => {
    try {
        const prompt = `
        Você é um Engenheiro de QA Sênior, especialista em criar cenários de teste abrangentes.
        Sua tarefa é analisar a seguinte história de usuário e, para cada critério de aceitação, gerar uma lista de cenários de teste.

        **História de Usuário para Análise:**
        ---
        ${storyDescription}
        ---

        **Instruções:**
        1. Para cada critério de aceitação, identifique os principais cenários de teste.
        2. Inclua cenários de "caminho feliz" (happy path) para validar a funcionalidade principal.
        3. Inclua cenários de "casos de borda" (edge cases) para testar os limites do sistema.
        4. Inclua cenários "negativos" para validar como o sistema lida com entradas inválidas ou erros.
        5. Formate a saída de forma clara, agrupando os cenários por critério de aceitação.

        Produza apenas a lista de cenários de teste, em português do Brasil. Não inclua comentários extras, preâmbulo ou despedida.
        `;

        const response = await ai.models.generateContent({
            model: model,
            contents: prompt,
        });

        return response.text.trim();
    } catch (error) {
        console.error("Error generating test scenarios:", error);
        throw new Error("Falha ao gerar os cenários de teste.");
    }
};

export const analyzeStoryComplexity = async (story: ParsedStory): Promise<ComplexityAnalysisResult> => {
    try {
        const prompt = `
        Você é um Agile Coach Sênior, especialista em facilitar sessões de planning e garantir que as histórias de usuário sejam bem fatiadas (INVEST).
        Sua tarefa é analisar a complexidade da seguinte história de usuário.

        **História de Usuário para Análise:**
        ---
        Título: ${story.title}
        Descrição:
        ${story.description}
        ---

        **Instruções:**
        1.  Avalie a complexidade da história com base em seu escopo, número de critérios de aceitação e regras de negócio. Classifique-a como 'Baixa', 'Média' ou 'Alta'.
        2.  Forneça uma justificativa concisa para sua classificação.
        3.  **Se e somente se a complexidade for 'Alta'**, sugira como a história pode ser quebrada em 2 ou 3 histórias menores e mais focadas. Para cada história sugerida, forneça um título e uma descrição completa, mantendo o formato original.

        Retorne um objeto JSON válido, em português do Brasil.
        `;

        const responseSchema = {
            type: Type.OBJECT,
            properties: {
                complexity: { type: Type.STRING, enum: ['Baixa', 'Média', 'Alta'] },
                justification: { type: Type.STRING },
                suggestedStories: {
                    type: Type.ARRAY,
                    items: {
                        type: Type.OBJECT,
                        properties: {
                            title: { type: Type.STRING },
                            description: { type: Type.STRING }
                        },
                        required: ["title", "description"]
                    }
                }
            },
            required: ["complexity", "justification"]
        };

        const response = await ai.models.generateContent({
            model: model,
            contents: prompt,
            config: {
                responseMimeType: "application/json",
                responseSchema,
            },
        });

        const jsonString = response.text;
        return JSON.parse(jsonString) as ComplexityAnalysisResult;

    } catch (error) {
        console.error("Error analyzing story complexity:", error);
        throw new Error("Falha ao analisar a complexidade da história.");
    }
};

export const generateStoriesFromTranscript = async (transcript: string, modelStory?: string): Promise<SplitStory[]> => {
    try {
        const modelStoryPrompt = modelStory
            ? `Use a seguinte história como modelo para a estrutura e formatação de CADA história gerada (ex: +**...**+, **Como**...): \n---\n${modelStory}\n---`
            : "Para cada história, use o formato padrão: Título, seguido por 'Como [persona], Eu quero [objetivo], Para que [benefício]', e critérios de aceitação 'Dado... Quando... Então...'.";

        const prompt = `
        Você é um Product Owner Sênior, especialista em transformar discussões de reuniões em artefatos de backlog acionáveis.
        Sua tarefa é analisar a transcrição de uma reunião, identificar os principais temas e requisitos, e gerar uma lista de histórias de usuário.

        **Transcrição da Reunião:**
        ---
        ${transcript}
        ---

        **Diretrizes de Estrutura:**
        ${modelStoryPrompt}

        **Instruções:**
        1.  Leia atentamente a transcrição para compreender os problemas, necessidades e decisões discutidas.
        2.  Agrupe os pontos relacionados em temas coesos.
        3.  Para cada tema, crie uma história de usuário bem estruturada, seguindo estritamente as diretrizes de estrutura. Cada história deve ter um título claro e uma descrição completa.
        4.  Se a transcrição for muito vaga para um tema, crie uma história de "Spike" (pesquisa) para investigar mais a fundo.
        5.  Foque em gerar de 2 a 5 histórias de usuário principais que capturem a essência da discussão.

        Retorne um array de objetos JSON, em português do Brasil, onde cada objeto representa uma história e contém as chaves "title" e "description".
        `;
        
        const responseSchema = {
            type: Type.ARRAY,
            items: {
                type: Type.OBJECT,
                properties: {
                    title: { type: Type.STRING },
                    description: { type: Type.STRING }
                },
                required: ["title", "description"]
            }
        };

        const response = await ai.models.generateContent({
            model: model,
            contents: prompt,
            config: {
                responseMimeType: "application/json",
                responseSchema,
            },
        });

        const jsonString = response.text;
        return JSON.parse(jsonString) as SplitStory[];

    } catch (error) {
        console.error("Error generating stories from transcript:", error);
        throw new Error("Falha ao analisar a transcrição e gerar histórias.");
    }
};

export const generatePrototype = async (storyDescription: string, modelPrototype?: string): Promise<string> => {
    try {
        const modelPrototypePrompt = modelPrototype
            ? `Use o seguinte código como um modelo forte para a estrutura de componentes, estilo e classes Tailwind CSS: \n---\n${modelPrototype}\n---`
            : "Gere um código limpo e semântico usando HTML e classes do Tailwind CSS.";

        const prompt = `
        Você é um Desenvolvedor Front-end Sênior, especialista em criar interfaces de usuário acessíveis e bem estruturadas com HTML e Tailwind CSS.
        Sua tarefa é ler a seguinte história de usuário e gerar um código de protótipo visual para ela.

        **História de Usuário para Prototipagem:**
        ---
        ${storyDescription}
        ---

        **Diretrizes de Estilo e Estrutura:**
        ${modelPrototypePrompt}

        **Instruções:**
        1. Analise os critérios de aceitação para entender os elementos da interface (botões, formulários, textos, etc.).
        2. Crie um protótipo visual usando apenas HTML e classes do Tailwind CSS.
        3. O código deve ser contido em um único bloco, sem dependências externas de JS ou CSS além do Tailwind.
        4. Foque em representar visualmente a funcionalidade descrita. O protótipo não precisa ser funcional.
        5. Se a história descreve um formulário, inclua labels, inputs apropriados e um botão de submissão.
        6. **IMPORTANTE:** Adicione seletores estáveis a todos os elementos interativos (inputs, botões, selects, etc.) para facilitar os testes automatizados. Use atributos como 'id', 'name', ou 'data-cy' de forma lógica (ex: <input type="text" name="username" id="username">).

        Produza apenas o bloco de código HTML/CSS, sem nenhuma explicação, comentário extra ou a tag \`\`\`html.
        `;

        const response = await ai.models.generateContent({
            model: model,
            contents: prompt,
        });

        return response.text.trim();
    } catch (error) {
        console.error("Error generating prototype:", error);
        throw new Error("Falha ao gerar o protótipo visual.");
    }
};

export const generatePrototypeFromFeature = async (featureFileContent: string, modelPrototype?: string): Promise<string> => {
    try {
        const modelPrototypePrompt = modelPrototype
            ? `Use o seguinte código como um modelo forte para a estrutura de componentes, estilo e classes Tailwind CSS: \n---\n${modelPrototype}\n---`
            : "Gere um código limpo e semântico usando HTML e classes do Tailwind CSS.";

        const prompt = `
        Você é um Desenvolvedor Front-end Sênior, especialista em criar interfaces de usuário acessíveis e bem estruturadas com HTML e Tailwind CSS.
        Sua tarefa é ler o seguinte arquivo .feature de BDD e gerar um código de protótipo visual para a funcionalidade descrita.

        **Arquivo .feature para Prototipagem:**
        ---
        ${featureFileContent}
        ---

        **Diretrizes de Estilo e Estrutura:**
        ${modelPrototypePrompt}

        **Instruções:**
        1. Analise a declaração da 'Funcionalidade', 'Background' e cada 'Cenário' para entender os elementos da interface e as interações.
        2. Crie um protótipo visual que represente a tela principal da funcionalidade.
        3. Use apenas HTML e classes do Tailwind CSS. O código deve ser contido em um único bloco.
        4. O protótipo não precisa ser funcional.
        5. Se os cenários descrevem um formulário, inclua labels, inputs e botões.
        6. **IMPORTANTE:** Adicione seletores estáveis a todos os elementos interativos (inputs, botões, etc.) para facilitar os testes automatizados. Use atributos como 'id', 'name', ou 'data-cy'.
        7. Se houver uma seção 'Background', use-a para definir o contexto geral ou os elementos estáticos da tela do protótipo.
        8. Se houver um 'Scenario Outline' com uma tabela 'Examples', use os dados da **PRIMEIRA LINHA** de dados da tabela para pré-popular os campos de formulário no protótipo. Por exemplo, se a primeira linha tiver <email> como 'teste@exemplo.com', o campo de email no protótipo deve ter 'value="teste@exemplo.com"'.

        Produza apenas o bloco de código HTML/CSS, sem nenhuma explicação, comentário extra ou a tag \`\`\`html.
        `;

        const response = await ai.models.generateContent({
            model: model,
            contents: prompt,
        });

        return response.text.trim();
    } catch (error) {
        console.error("Error generating prototype from feature:", error);
        throw new Error("Falha ao gerar o protótipo visual a partir da feature.");
    }
};

export const generateBddScenarios = async (featureDescription: string): Promise<string[]> => {
    try {
        const prompt = `
        Você é um especialista em Behavior-Driven Development (BDD).
        Sua tarefa é analisar a descrição de uma funcionalidade e sugerir uma lista de títulos de cenários de teste.
        Foque em cenários de sucesso, de falha e de casos de borda.
        Se você identificar vários cenários que testam a mesma lógica com dados de entrada diferentes (por exemplo, login com credenciais válidas, inválidas, em branco), sugira um único 'Scenario Outline: [Título do Cenário]' em vez de múltiplos cenários individuais.

        **Descrição da Funcionalidade:**
        ---
        ${featureDescription}
        ---

        Gere uma lista de títulos de cenários concisos e descritivos.
        Retorne um array de strings JSON, em português do Brasil.
        `;

        const responseSchema = {
            type: Type.ARRAY,
            items: { type: Type.STRING }
        };

        const response = await ai.models.generateContent({
            model: model,
            contents: prompt,
            config: {
                responseMimeType: "application/json",
                responseSchema,
            },
        });

        const jsonString = response.text;
        return JSON.parse(jsonString) as string[];

    } catch (error) {
        console.error("Error generating BDD scenarios:", error);
        throw new Error("Falha ao gerar os cenários BDD.");
    }
};

export const generateInitialScenarioOutline = async (featureDescription: string, outlineTitle: string): Promise<ScenarioOutlineResult> => {
    try {
        const prompt = `
        Você é um especialista em BDD e Gherkin.
        Sua tarefa é gerar um template de "Scenario Outline" e os cabeçalhos da tabela "Examples" com base no título do cenário e na descrição da funcionalidade.

        **Funcionalidade Principal:**
        ---
        ${featureDescription}
        ---

        **Título do Scenario Outline:**
        ---
        ${outlineTitle}
        ---

        **Instruções:**
        1.  Escreva o template do cenário usando a sintaxe Gherkin, começando com 'Scenario Outline: ...'.
        2.  Use placeholders entre <> (ex: <email>, <senha>) para as partes variáveis do cenário.
        3.  Identifique os placeholders que você usou e retorne-os como um array de strings. A ordem dos cabeçalhos deve corresponder à ordem em que aparecem no template.
        4.  Use os keywords do Gherkin em **inglês** ('Scenario Outline', 'Given', 'When', 'Then', 'And'). O texto dos passos deve permanecer em português.

        Retorne um objeto JSON válido com as chaves "template" e "headers".
        `;
        
        const responseSchema = {
            type: Type.OBJECT,
            properties: {
                template: { type: Type.STRING },
                headers: { 
                    type: Type.ARRAY,
                    items: { type: Type.STRING }
                }
            },
            required: ["template", "headers"]
        };

        const response = await ai.models.generateContent({
            model: model,
            contents: prompt,
            config: {
                responseMimeType: "application/json",
                responseSchema,
            },
        });

        const jsonString = response.text;
        return JSON.parse(jsonString) as ScenarioOutlineResult;

    } catch (error) {
        console.error("Error generating initial scenario outline:", error);
        throw new Error("Falha ao gerar o template do Scenario Outline.");
    }
};

export const generateBddFollowUpQuestion = async (featureDescription: string, scenarioTitle: string, conversationHistory: ConversationTurn[], nextPersona: Persona): Promise<string> => {
    try {
        const history = conversationHistory.map(turn =>
            `Pergunta de ${turn.persona}: ${turn.question}\nResposta do Usuário: ${turn.answer || 'Pulado'}`
        ).join('\n\n');

        const prompt = `
        Você está em uma sessão de BDD para detalhar um cenário de teste. Você está atuando como um(a) **${nextPersona}**.
        O objetivo é extrair os detalhes para construir um cenário Gherkin completo (Dado, Quando, Então).

        **Sua Diretriz como ${nextPersona}:**
        ${personaGuidelines[nextPersona]}
        Lembre-se de focar em perguntas que ajudem a definir o contexto inicial (Dado), a ação do usuário (Quando) e o resultado esperado (Então).

        **Funcionalidade:** ${featureDescription}
        **Cenário em Discussão:** ${scenarioTitle}

        **Conversa até agora:**
        ---
        ${history}
        ---

        Com base na sua diretriz, na funcionalidade, no cenário e na conversa, formule sua próxima pergunta.
        A pergunta deve ser concisa e focada em esclarecer um aspecto do comportamento esperado.
        Retorne apenas a pergunta como uma única string, em português do Brasil, sem nenhum preâmbulo.
        `;

        const response = await ai.models.generateContent({
            model: model,
            contents: prompt,
        });

        return response.text.trim();

    } catch (error) {
        console.error("Error generating BDD follow-up question:", error);
        throw new Error("Falha ao gerar uma pergunta de acompanhamento para BDD.");
    }
};

export const generateBddFollowUpQuestionForGroup = async (featureDescription: string, scenarioTitles: string[], conversationHistory: ConversationTurn[], nextPersona: Persona): Promise<string> => {
    try {
        const history = conversationHistory.map(turn =>
            `Pergunta de ${turn.persona}: ${turn.question}\nResposta do Usuário: ${turn.answer || 'Pulado'}`
        ).join('\n\n');

        const prompt = `
        Você está em uma sessão de BDD para detalhar um grupo de cenários de teste. Você está atuando como um(a) **${nextPersona}**.
        O objetivo é extrair os detalhes para construir cenários Gherkin completos (Dado, Quando, Então) para TODOS os cenários listados.

        **Sua Diretriz como ${nextPersona}:**
        ${personaGuidelines[nextPersona]}
        Lembre-se de focar em perguntas que ajudem a definir o contexto inicial comum (Dado), e depois explore as diferentes ações (Quando) e resultados (Então) de cada cenário.

        **Funcionalidade:** ${featureDescription}
        
        **Cenários em Discussão:**
        - ${scenarioTitles.join('\n- ')}

        **Conversa até agora:**
        ---
        ${history}
        ---

        Com base na sua diretriz, na funcionalidade, nos cenários e na conversa:
        1. Identifique se ainda há pontos em comum a serem esclarecidos. Se houver, faça uma pergunta sobre isso.
        2. Se os pontos em comum estiverem claros, faça uma pergunta focada nas *diferenças* entre os cenários.
        
        A pergunta deve ser concisa e focada. Retorne apenas a pergunta como uma única string, em português do Brasil, sem nenhum preâmbulo.
        `;

        const response = await ai.models.generateContent({
            model: model,
            contents: prompt,
        });

        return response.text.trim();

    } catch (error) {
        console.error("Error generating BDD group follow-up question:", error);
        throw new Error("Falha ao gerar uma pergunta de acompanhamento para o grupo de cenários BDD.");
    }
};

export const generateGherkinFromConversation = async (featureDescription: string, scenarioTitle: string, conversation: ConversationTurn[]): Promise<string> => {
    try {
        const history = conversation
            .filter(turn => turn.answer && turn.answer.trim() !== 'Pulado')
            .map(turn => `Pergunta de ${turn.persona}: ${turn.question}\nResposta do Usuário: ${turn.answer}`)
            .join('\n\n');

        if (!history) {
            throw new Error("Nenhum feedback fornecido. Responda a algumas perguntas para gerar o cenário.");
        }

        const prompt = `
        Você é um especialista em BDD e Gherkin.
        Sua tarefa é escrever um cenário Gherkin completo e bem formatado com base em uma discussão.

        **Funcionalidade Principal:**
        ---
        ${featureDescription}
        ---

        **Título do Cenário:**
        ---
        ${scenarioTitle}
        ---

        **Registro da Discussão (Perguntas e Respostas):**
        ---
        ${history}
        ---

        Com base nas informações, escreva um cenário Gherkin:
        - **Regra Principal:** Use os keywords do Gherkin em **inglês** ('Scenario', 'Given', 'When', 'Then', 'And'). O texto dos passos deve permanecer em português.
        - **Doc Strings:** Se a resposta do usuário for um texto de múltiplas linhas que precise ser verificado na íntegra (como o corpo de um e-mail ou um payload JSON), é mandatório que você formate esse texto como um argumento de Doc String, usando três aspas duplas (""").
        - **Data Tables:** Se a resposta do usuário contiver uma tabela formatada com pipes (|), formate-a como uma Data Table do Gherkin, alinhada sob o step correspondente.

        Produza apenas o bloco de texto Gherkin completo para este cenário, começando com 'Scenario: ...'. Não inclua a 'Feature:' nem comentários extras.
        `;

        const response = await ai.models.generateContent({
            model: model,
            contents: prompt,
        });

        return response.text.trim();
    } catch (error) {
        console.error("Error generating Gherkin scenario:", error);
        if (error instanceof Error && error.message.startsWith("Nenhum feedback")) {
            throw error;
        }
        throw new Error("Falha ao gerar o cenário Gherkin.");
    }
};

export const generateGherkinFromGroupConversation = async (featureDescription: string, scenarioTitles: string[], conversation: ConversationTurn[]): Promise<GherkinScenario[]> => {
    try {
        const history = conversation
            .filter(turn => turn.answer && turn.answer.trim() !== 'Pulado')
            .map(turn => `Pergunta de ${turn.persona}: ${turn.question}\nResposta do Usuário: ${turn.answer}`)
            .join('\n\n');

        if (!history) {
            throw new Error("Nenhum feedback fornecido. Responda a algumas perguntas para gerar os cenários.");
        }

        const prompt = `
        Você é um especialista em BDD e Gherkin.
        Sua tarefa é escrever um cenário Gherkin completo e bem formatado para CADA UM dos cenários listados, com base na discussão.

        **Funcionalidade Principal:**
        ---
        ${featureDescription}
        ---

        **Títulos dos Cenários a serem Gerados:**
        - ${scenarioTitles.join('\n- ')}
        ---

        **Registro da Discussão (Perguntas e Respostas):**
        ---
        ${history}
        ---

        Com base em TODA a discussão, gere o Gherkin para CADA um dos cenários solicitados, seguindo estas regras:
        - **Regra Principal:** Use os keywords do Gherkin em **inglês** ('Scenario', 'Given', 'When', 'Then', 'And'). O texto dos passos deve permanecer em português.
        - **Doc Strings:** Se a resposta do usuário for um texto de múltiplas linhas que precise ser verificado na íntegra (como o corpo de um e-mail ou um payload JSON), é mandatório que você formate esse texto como um argumento de Doc String, usando três aspas duplas (""").
        - **Data Tables:** Se a resposta do usuário contiver uma tabela formatada com pipes (|), formate-a como uma Data Table do Gherkin, alinhada sob o step correspondente.
        - Reutilize steps quando fizer sentido entre os cenários.

        Retorne um array de objetos JSON, onde cada objeto representa um cenário e contém as chaves "title" e "gherkin". O valor de "gherkin" deve ser o bloco de texto completo, começando com 'Scenario: ...'.
        `;

        const responseSchema = {
            type: Type.ARRAY,
            items: {
                type: Type.OBJECT,
                properties: {
                    title: { type: Type.STRING, description: "O título exato de um dos cenários solicitados." },
                    gherkin: { type: Type.STRING, description: "O bloco de texto Gherkin completo para esse cenário." }
                },
                required: ["title", "gherkin"]
            }
        };

        const response = await ai.models.generateContent({
            model: model,
            contents: prompt,
            config: {
                responseMimeType: "application/json",
                responseSchema,
            },
        });

        const jsonString = response.text;
        return JSON.parse(jsonString) as GherkinScenario[];

    } catch (error) {
        console.error("Error generating Gherkin scenarios for group:", error);
        if (error instanceof Error && error.message.startsWith("Nenhum feedback")) {
            throw error;
        }
        throw new Error("Falha ao gerar os cenários Gherkin para o grupo.");
    }
};

export const generatePoChecklist = async (featureFileContent: string): Promise<string> => {
    try {
        const prompt = `
        Você é um Product Owner experiente.
        Sua tarefa é ler o seguinte arquivo .feature e traduzir cada cenário em um roteiro de teste em linguagem natural, claro e passo a passo.
        Este roteiro será usado por um PO para realizar a validação funcional (pré-homologação) da entrega.

        **Arquivo .feature para Análise:**
        ---
        ${featureFileContent}
        ---

        **Instruções:**
        1. Para cada 'Cenário', crie um item de checklist com um título claro.
        2. Descreva os passos de forma imperativa e simples (ex: "Acesse a tela de login", "Preencha o campo 'email' com 'teste@teste.com'", "Clique no botão 'Entrar'").
        3. Converta os passos 'Dado', 'Quando' e 'Então' em ações e verificações concretas e observáveis.
        4. O resultado deve ser um checklist formatado, fácil de ler e seguir por alguém sem conhecimento técnico.
        5. **IMPORTANTE:** Se encontrar um 'Scenario Outline', você deve criar um item de checklist separado para CADA LINHA da tabela 'Examples'. O título do checklist deve indicar qual conjunto de dados está sendo usado (ex: "Cenário: Login - Exemplo 1 (usuário válido)"). Personalize os passos do roteiro de teste com os dados específicos de cada linha.

        Produza apenas o checklist em português do Brasil. Não inclua comentários extras, preâmbulo ou despedida.
        `;

        const response = await ai.models.generateContent({
            model: model,
            contents: prompt,
        });

        return response.text.trim();
    } catch (error) {
        console.error("Error generating PO checklist:", error);
        throw new Error("Falha ao gerar o checklist de pré-homologação.");
    }
};

export const generateStepDefinitions = async (featureFileContent: string, technology: string): Promise<string> => {
    try {
        let frameworkDetails = '';
        switch (technology) {
            case 'Python - Behave':
                frameworkDetails = `
                - Use a biblioteca 'behave' para a estrutura e 'selenium' para a interação com o navegador.
                - Inclua importações como 'from behave import *', 'from selenium.webdriver.common.by import By', 'from selenium.webdriver.support.ui import WebDriverWait', e 'from selenium.webdriver.support import expected_conditions as EC'.
                - Use 'context.browser' para acessar a instância do navegador.
                - Para esperas, use 'WebDriverWait' e 'expected_conditions' para tornar os testes mais estáveis.
                - Faça suposições lógicas para seletores de elementos (ex: By.NAME, "username", By.ID, "password").
                - Para Data Tables, use 'context.table' para acessar os dados.
                - Para Doc Strings, o argumento correspondente será 'context.text'.`;
                break;
            case 'JavaScript - Cypress':
                frameworkDetails = `
                - Use a sintaxe do Cypress com 'Given', 'When', 'Then' do 'cypress-cucumber-preprocessor'.
                - Use comandos do Cypress como 'cy.visit()', 'cy.get()', '.type()', '.click()'.
                - Para asserções, use '.should()'.
                - Faça suposições lógicas para seletores de elementos (ex: '[data-cy=username]', 'input[name="username"]').
                - Para Data Tables, o método receberá um objeto 'dataTable'. Use 'dataTable.hashes()' para obter os dados.
                - Para Doc Strings, o método receberá a string como um argumento.`;
                break;
            case 'Java - Cucumber':
                 frameworkDetails = `
                - Use a sintaxe do Cucumber-JVM com anotações (@Given, @When, @Then).
                - Use 'Selenium WebDriver' para a interação com o navegador.
                - Inclua importações necessárias (io.cucumber.java.en.*, io.cucumber.datatable.DataTable, org.openqa.selenium.*).
                - Faça suposições lógicas para seletores de elementos (ex: By.name("username")).
                - Use asserções do JUnit ou TestNG (ex: Assert.assertTrue()).
                - Para Data Tables, o método receberá um objeto 'DataTable'.
                - Para Doc Strings, o método receberá a 'String' como um argumento.`;
                break;
            case 'PHP':
                frameworkDetails = `
                - Gere uma classe de contexto que implementa 'Behat\\Behat\\Context\\Context'.
                - Use a biblioteca 'Behat' com 'Mink' para a interação com o navegador.
                - Inclua as importações necessárias como 'use Behat\\Behat\\Context\\Context;', 'use Behat\\Gherkin\\Node\\PyStringNode;' e 'use Behat\\Gherkin\\Node\\TableNode;'.
                - A classe de contexto deve ter um método para acessar a sessão do Mink (ex: 'getSession()').
                - Use os métodos do Mink para interagir com a página.
                - Faça suposições lógicas para seletores de elementos.
                - Para Data Tables, use a type-hint 'TableNode' para o argumento.
                - Para Doc Strings, use a type-hint 'PyStringNode' para o argumento.`;
                break;
            case 'C#':
                frameworkDetails = `
                - Gere uma classe com o atributo '[Binding]' do SpecFlow.
                - Use 'Selenium WebDriver' para a interação com o navegador.
                - Inclua as importações necessárias ('using TechTalk.SpecFlow;', 'using OpenQA.Selenium;', 'using NUnit.Framework;').
                - A classe de contexto deve receber uma instância de 'IWebDriver' via injeção de dependência.
                - Use atributos como '[Given]', '[When]', '[Then]' nos métodos.
                - Faça suposições lógicas para seletores de elementos (ex: By.Name, By.Id).
                - Para Data Tables, o método receberá um objeto 'Table'.
                - Para Doc Strings, o método receberá 'string' como um argumento.`;
                break;
            default:
                frameworkDetails = `Siga as melhores práticas para a tecnologia ${technology}.`
        }

        const prompt = `
        Você é um Desenvolvedor Sênior especialista em automação de testes e BDD.
        Sua tarefa é ler o seguinte arquivo .feature e gerar o código **completo e funcional** das Step Definitions para a tecnologia especificada.

        **Tecnologia Alvo:** ${technology}

        **Arquivo .feature para Análise:**
        ---
        ${featureFileContent}
        ---

        **Instruções:**
        1.  Analise o arquivo .feature e identifique todos os passos únicos (Dado, Quando, Então, E).
        2.  Para cada passo, gere a função/método correspondente com uma **implementação completa**, não apenas um esqueleto.
        3.  Use expressões regulares apropriadas para capturar parâmetros nos passos (ex: valores entre aspas).
        4.  **Faça suposições inteligentes sobre os seletores de elementos da página**. Por exemplo, para um campo de "username", você pode tentar um seletor como \`[name="username"]\`, \`#username\`, ou similar.
        5.  **Inclua todas as importações necessárias** no início do arquivo para que o código seja o mais próximo possível de "copiar e colar".
        6.  Use **esperas explícitas** (como WebDriverWait do Selenium) para tornar o teste mais robusto.
        7.  Se houver um 'Scenario Outline', os parâmetros dos placeholders (ex: <email>) devem ser recebidos como argumentos nos métodos/funções das steps.
        8.  Se um step tiver um 'Doc String' (texto entre """), o método/função correspondente deve receber esse texto como um argumento.
        9.  Se um step tiver uma 'Data Table' (tabela com |), o método/função correspondente deve receber essa tabela como um objeto ou estrutura de dados apropriada (ex: um objeto Table, DataTable, etc.).

        **Diretrizes Específicas para a Tecnologia:**
        ${frameworkDetails}

        Produza apenas o bloco de código com as Step Definitions, em português do Brasil. Não inclua explicações, comentários extras ou as tags de formatação de código (como \`\`\`python).
        `;

        const response = await ai.models.generateContent({
            model: model,
            contents: prompt,
        });

        return response.text.trim();
    } catch (error) {
        console.error("Error generating step definitions:", error);
        throw new Error("Falha ao gerar as definições de steps.");
    }
};

export const analyzeAndBreakdownDocument = async (document: string): Promise<BddFeatureSuggestion[]> => {
    try {
        const prompt = `
        Você é um Arquiteto de Produto Sênior, especialista em BDD e em fatiar épicos complexos em features gerenciáveis.
        Sua tarefa é analisar um documento de requisitos tradicional e propor uma quebra em features menores e coesas.

        **Documento de Requisitos para Análise:**
        ---
        ${document}
        ---

        **Instruções:**
        1.  Leia o documento para identificar as principais funcionalidades ou épicos contidos nele.
        2.  Para cada funcionalidade identificada, crie um título claro e um resumo conciso (1-2 frases) descrevendo seu escopo.
        3.  Evite criar features muito granulares. Agrupe requisitos relacionados. O objetivo é ter de 2 a 5 features principais.
        4.  Se o documento for sobre uma única funcionalidade pequena, retorne apenas um item na lista.

        Retorne um array de objetos JSON, em português do Brasil. Cada objeto deve ter as chaves "title" e "summary".
        `;

        const responseSchema = {
            type: Type.ARRAY,
            items: {
                type: Type.OBJECT,
                properties: {
                    title: { type: Type.STRING },
                    summary: { type: Type.STRING }
                },
                required: ["title", "summary"]
            }
        };

        const response = await ai.models.generateContent({
            model: model,
            contents: prompt,
            config: {
                responseMimeType: "application/json",
                responseSchema,
            },
        });

        const jsonString = response.text;
        return JSON.parse(jsonString) as BddFeatureSuggestion[];

    } catch (error) {
        console.error("Error analyzing and breaking down document:", error);
        throw new Error("Falha ao analisar e quebrar o documento em features.");
    }
};


export const convertDocumentToBdd = async (document: string, featureTitle: string): Promise<string> => {
    try {
        const prompt = `
        Você é um Analista de Negócios Sênior, especialista em BDD.
        Sua tarefa é analisar o documento de requisitos fornecido, mas focar **especificamente** nos detalhes pertencentes à funcionalidade "${featureTitle}" para convertê-la em um arquivo .feature.

        **Documento Completo de Requisitos (para contexto):**
        ---
        ${document}
        ---

        **Funcionalidade Focada para Conversão:** "${featureTitle}"

        **Instruções:**
        1.  Escreva uma declaração 'Funcionalidade:' clara e concisa para a feature focada.
        2.  Extraia as regras de negócio e os requisitos chave **apenas** da funcionalidade "${featureTitle}".
        3.  Crie múltiplos cenários de teste em Gherkin ('Cenário:', 'Dado', 'Quando', 'Então') que cubram os principais fluxos, casos de borda e cenários de erro para esta funcionalidade específica.
        4.  O resultado deve ser um único bloco de texto contendo o arquivo .feature completo e bem formatado.

        Produza apenas o conteúdo do arquivo .feature, em português do Brasil. Não inclua comentários extras ou explicações.
        `;

        const response = await ai.models.generateContent({
            model: model,
            contents: prompt,
        });

        return response.text.trim();
    } catch (error) {
        console.error("Error converting document to BDD:", error);
        throw new Error("Falha ao converter o documento para BDD.");
    }
};

export const analyzePlanningTranscript = async (transcript: string, userStory: string): Promise<string> => {
    try {
        const prompt = `
        Você é um Agile Coach Sênior, especialista em facilitar sessões de planning e garantir o alinhamento entre o PO e a equipe.
        Sua tarefa é analisar a transcrição de uma reunião de planejamento e compará-la com a história de usuário fornecida.

        **Transcrição da Reunião de Planejamento:**
        ---
        ${transcript}
        ---

        **História de Usuário para Validação:**
        ---
        ${userStory}
        ---

        **Instruções:**
        1. Compare os dois textos e identifique discrepâncias e omissões.
        2. Retorne uma análise textual clara e objetiva, formatada com os seguintes títulos:
           - **Pontos da discussão não cobertos na história:** Liste aqui os requisitos, regras ou detalhes mencionados na reunião que parecem estar ausentes da história.
           - **Possíveis contradições:** Destaque quaisquer pontos onde a história de usuário parece contradizer o que foi discutido na reunião.
           - **Outros pontos de atenção relevantes:** Inclua quaisquer outras observações, como ambiguidades, dependências mencionadas ou riscos levantados, que o PO deveria considerar.

        Se não encontrar pontos para uma categoria, indique "Nenhum ponto encontrado.".
        Produza apenas a análise em português do Brasil, sem preâmbulo ou comentários extras.
        `;

        const response = await ai.models.generateContent({
            model: model,
            contents: prompt,
        });

        return response.text.trim();
    } catch (error) {
        console.error("Error analyzing planning transcript:", error);
        throw new Error("Falha ao analisar a transcrição de planejamento.");
    }
};

export const analyzeHomologationTranscript = async (transcript: string): Promise<string> => {
    try {
        const prompt = `
        Você é um Analista de QA Sênior, especialista em interpretar feedback de usuários e identificar problemas.
        Sua tarefa é analisar a transcrição de uma sessão de homologação/validação de uma funcionalidade.

        **Transcrição da Sessão de Homologação:**
        ---
        ${transcript}
        ---

        **Instruções:**
        1. Leia atentamente o feedback fornecido na transcrição.
        2. Categorize cada ponto de feedback em uma das três listas a seguir:
           - **Itens de Melhoria:** Sugestões para evoluir ou aprimorar a funcionalidade em iterações futuras. Não são bugs, mas oportunidades.
           - **Defeitos Potenciais:** Feedbacks que indicam um comportamento inesperado, erro ou não aderência aos requisitos/critérios de aceitação.
           - **Outros Pontos Relevantes:** Dúvidas gerais, comentários sobre usabilidade que não são defeitos, ou outros pontos que merecem atenção.
        3. Formate a saída de forma clara usando as três categorias como títulos.

        Se não encontrar pontos para uma categoria, indique "Nenhum ponto encontrado.".
        Produza apenas a análise em português do Brasil, sem preâmbulo ou comentários extras.
        `;

        const response = await ai.models.generateContent({
            model: model,
            contents: prompt,
        });

        return response.text.trim();
    } catch (error) {
        console.error("Error analyzing homologation transcript:", error);
        throw new Error("Falha ao analisar a transcrição de homologação.");
    }
};