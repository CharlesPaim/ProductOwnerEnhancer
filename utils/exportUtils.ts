
import { ParsedStory, BddScenario } from '../types';

interface ExportData {
    story: ParsedStory | null;
    featureDescription: string;
    bddScenarios: { id: number; title: string; gherkin: string | null; completed: boolean; type: 'scenario' | 'outline' }[];
    poChecklist: string | null;
    technicalNotes: string | null; // Derived from step definitions or insights
    prototypeCode: string | null;
    diagramCode: string | null;
}

const formatGherkinBlock = (scenarios: ExportData['bddScenarios'], featureDescription: string) => {
    const scenarioText = scenarios
        .filter(s => s.gherkin)
        .map(s => s.gherkin)
        .join('\n\n');
    
    return `Funcionalidade: ${featureDescription}\n\n${scenarioText}`;
};

export const generateMarkdownExport = (data: ExportData): string => {
    const { story, featureDescription, bddScenarios, poChecklist, technicalNotes, diagramCode } = data;
    const title = story?.title || "História de Usuário";
    const description = story?.description || featureDescription || "Sem descrição.";
    const gherkin = formatGherkinBlock(bddScenarios, featureDescription);

    return `
# ${title}

## Descrição
${description}

${diagramCode ? `
## Fluxo do Usuário (Mermaid)
\`\`\`mermaid
${diagramCode}
\`\`\`
` : ''}

## Critérios de Aceite (BDD)
\`\`\`gherkin
${gherkin}
\`\`\`

${poChecklist ? `
## Checklist de Validação (PO)
${poChecklist}
` : ''}

${technicalNotes ? `
## Notas Técnicas / Step Definitions
\`\`\`
${technicalNotes}
\`\`\`
` : ''}
`.trim();
};

export const generateJiraExport = (data: ExportData): string => {
    const { story, featureDescription, bddScenarios, poChecklist, diagramCode } = data;
    const title = story?.title || "História de Usuário";
    const description = story?.description || featureDescription || "Sem descrição.";
    const gherkin = formatGherkinBlock(bddScenarios, featureDescription);

    return `
h1. ${title}

h2. Descrição
{panel:title=História de Usuário}
${description}
{panel}

${diagramCode ? `
h2. Fluxo Visual
{code}
${diagramCode}
{code}
_(Use um plugin Mermaid para visualizar ou copie para um visualizador externo)_
` : ''}

h2. Critérios de Aceite (BDD)
{code:language=gherkin}
${gherkin}
{code}

${poChecklist ? `
h2. Checklist de Validação
{panel:bgColor=#f4f5f7}
${poChecklist}
{panel}
` : ''}
`.trim();
};

export const generateHtmlReport = (data: ExportData): string => {
    const { story, featureDescription, bddScenarios, poChecklist, technicalNotes, prototypeCode, diagramCode } = data;
    const title = story?.title || "Relatório de Especificação";
    const description = story?.description || featureDescription || "";
    const gherkin = formatGherkinBlock(bddScenarios, featureDescription);

    return `
<!DOCTYPE html>
<html lang="pt-BR">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>${title}</title>
    <script src="https://cdn.tailwindcss.com"></script>
    <script type="module">
        import mermaid from 'https://cdn.jsdelivr.net/npm/mermaid@10/dist/mermaid.esm.min.mjs';
        mermaid.initialize({ startOnLoad: true, theme: 'default' });
    </script>
    <style>
        body { font-family: 'Inter', sans-serif; background-color: #f3f4f6; padding: 2rem; }
        .container { max-width: 1024px; margin: 0 auto; background: white; padding: 2rem; border-radius: 0.5rem; box-shadow: 0 4px 6px rgba(0,0,0,0.1); }
        h1 { font-size: 2rem; font-weight: bold; color: #1f2937; margin-bottom: 1rem; }
        h2 { font-size: 1.5rem; font-weight: 600; color: #4b5563; margin-top: 2rem; margin-bottom: 1rem; border-bottom: 2px solid #e5e7eb; padding-bottom: 0.5rem; }
        pre { background: #1f2937; color: #e5e7eb; padding: 1rem; border-radius: 0.5rem; overflow-x: auto; }
        .panel { background: #eff6ff; border-left: 4px solid #3b82f6; padding: 1rem; margin-bottom: 1rem; border-radius: 0.25rem; }
        .prototype-frame { border: 1px solid #e5e7eb; border-radius: 0.5rem; padding: 1rem; background: #fff; }
    </style>
</head>
<body>
    <div class="container">
        <h1>${title}</h1>
        
        <div class="panel">
            <p style="white-space: pre-wrap;">${description}</p>
        </div>

        ${diagramCode ? `
        <h2>Fluxo do Usuário</h2>
        <div class="mermaid">
            ${diagramCode}
        </div>
        ` : ''}

        <h2>Cenários BDD</h2>
        <pre><code>${gherkin}</code></pre>

        ${poChecklist ? `
        <h2>Checklist de Validação (PO)</h2>
        <div style="white-space: pre-wrap; background: #f9fafb; padding: 1rem; border-radius: 0.5rem;">${poChecklist}</div>
        ` : ''}

        ${prototypeCode ? `
        <h2>Protótipo Visual</h2>
        <div class="prototype-frame">
            ${prototypeCode}
        </div>
        ` : ''}

        ${technicalNotes ? `
        <h2>Notas Técnicas / Step Definitions</h2>
        <pre><code>${technicalNotes}</code></pre>
        ` : ''}
    </div>
</body>
</html>
    `;
};
