#!/usr/bin/env node
/**
 * Verificador de Conformidade de Heurísticas Antifraude (CIP-0002)
 * 
 * Valida se todas as regras declarativas em YAML cumprem a especificação CIP-0002
 * e verifica ausência absoluta de cláusulas de exceção, whitelists ou hardcoded CNPJs/CPFs
 * em arquivos YAML e SQL.
 */

const fs = require('fs');
const path = require('path');

const REPO_ROOT = path.resolve(__dirname, '..');

/**
 * Parser de YAML para as estruturas declarativas do CIP-0002
 * (zero-dependency, garantindo execução nativa com Node.js puro).
 */
function parseSimpleYaml(content) {
    const lines = content.split(/\r?\n/);
    const root = {};
    let currentKey = null;
    let currentObj = null;
    let currentList = null;
    let inMultiline = false;
    let multilineKey = null;
    let multilineLines = [];
    let multilineIndent = 0;

    function cleanScalar(val) {
        if (val === undefined || val === null) return '';
        let s = val.trim();
        if ((s.startsWith('"') && s.endsWith('"')) || (s.startsWith("'") && s.endsWith("'"))) {
            return s.slice(1, -1);
        }
        if (s === 'true') return true;
        if (s === 'false') return false;
        if (s === 'null') return null;
        if (/^-?\d+$/.test(s)) return parseInt(s, 10);
        if (/^-?\d+\.\d+$/.test(s)) return parseFloat(s);
        // Inline array: ["item1", "item2"]
        if (s.startsWith('[') && s.endsWith(']')) {
            const inner = s.slice(1, -1).trim();
            if (!inner) return [];
            return inner.split(',').map(item => cleanScalar(item.trim()));
        }
        return s;
    }

    for (let i = 0; i < lines.length; i++) {
        const line = lines[i];
        const trimmed = line.trim();

        // Ignorar linhas vazias e comentários
        if (!trimmed || trimmed.startsWith('#')) {
            continue;
        }

        const indent = line.search(/\S/);

        // Bloco multilinha (> ou |)
        if (inMultiline) {
            if (indent > multilineIndent) {
                multilineLines.push(trimmed);
                continue;
            } else {
                const joined = multilineLines.join(' ');
                if (currentObj && multilineKey) {
                    currentObj[multilineKey] = joined;
                } else if (multilineKey) {
                    root[multilineKey] = joined;
                }
                inMultiline = false;
                multilineKey = null;
                multilineLines = [];
            }
        }

        // Elemento de lista "- item"
        if (trimmed.startsWith('- ')) {
            const itemValue = cleanScalar(trimmed.slice(2));
            if (currentList) {
                currentList.push(itemValue);
            }
            continue;
        }

        // Par Chave: Valor
        const colonIndex = trimmed.indexOf(':');
        if (colonIndex !== -1) {
            const key = trimmed.slice(0, colonIndex).trim();
            const rawVal = trimmed.slice(colonIndex + 1).trim();

            if (indent === 0) {
                currentKey = key;
                currentObj = null;
                currentList = null;

                if (rawVal === '>' || rawVal === '|') {
                    inMultiline = true;
                    multilineKey = key;
                    multilineIndent = 0;
                    multilineLines = [];
                } else if (rawVal === '') {
                    // Verificar se a próxima linha não-vazia é uma lista ou objeto
                    let isNextList = false;
                    for (let j = i + 1; j < lines.length; j++) {
                        const nl = lines[j].trim();
                        if (!nl || nl.startsWith('#')) continue;
                        if (nl.startsWith('- ')) isNextList = true;
                        break;
                    }
                    if (isNextList) {
                        currentList = [];
                        root[key] = currentList;
                    } else {
                        currentObj = {};
                        root[key] = currentObj;
                    }
                } else {
                    root[key] = cleanScalar(rawVal);
                }
            } else {
                // Subchave dentro de objeto
                if (rawVal === '>' || rawVal === '|') {
                    inMultiline = true;
                    multilineKey = key;
                    multilineIndent = indent;
                    multilineLines = [];
                } else if (rawVal === '') {
                    let isNextList = false;
                    for (let j = i + 1; j < lines.length; j++) {
                        const nl = lines[j].trim();
                        if (!nl || nl.startsWith('#')) continue;
                        if (nl.startsWith('- ')) isNextList = true;
                        break;
                    }
                    if (isNextList) {
                        currentList = [];
                        if (currentObj) currentObj[key] = currentList;
                    } else {
                        currentList = null;
                        const subObj = {};
                        if (currentObj) currentObj[key] = subObj;
                    }
                } else {
                    currentList = null;
                    if (currentObj) {
                        currentObj[key] = cleanScalar(rawVal);
                    }
                }
            }
        }
    }

    if (inMultiline && multilineKey) {
        const joined = multilineLines.join(' ');
        if (currentObj) {
            currentObj[multilineKey] = joined;
        } else {
            root[multilineKey] = joined;
        }
    }

    return root;
}

/**
 * Valida schema CIP-0002 de uma regra declarativa YAML
 */
function validarSchemaCIP0002(yamlData, arquivoNome) {
    const erros = [];
    const camposObrigatorios = [
        'id_regra',
        'versao',
        'cip_referencia',
        'nome',
        'categoria',
        'criticidade',
        'pontuacao_risco',
        'fundamento_legal',
        'descricao_resumida',
        'parametros_ajustaveis',
        'instrucoes_investigativas_para_dossie'
    ];

    for (const campo of camposObrigatorios) {
        if (yamlData[campo] === undefined || yamlData[campo] === null) {
            erros.push(`[${arquivoNome}] Campo obrigatório ausente: '${campo}'.`);
        }
    }

    if (yamlData.id_regra && typeof yamlData.id_regra !== 'string') {
        erros.push(`[${arquivoNome}] 'id_regra' deve ser string.`);
    }

    if (yamlData.criticidade) {
        const criticidadesValidas = ['BAIXA', 'MEDIA', 'ALTA', 'CRITICA'];
        if (!criticidadesValidas.includes(yamlData.criticidade)) {
            erros.push(`[${arquivoNome}] 'criticidade' inválida: '${yamlData.criticidade}'. Esperado: ${criticidadesValidas.join(', ')}.`);
        }
    }

    if (yamlData.pontuacao_risco !== undefined) {
        const score = yamlData.pontuacao_risco;
        if (typeof score !== 'number' || score < 0 || score > 100 || !Number.isInteger(score)) {
            erros.push(`[${arquivoNome}] 'pontuacao_risco' deve ser inteiro entre 0 e 100.`);
        }
    }

    if (yamlData.fundamento_legal) {
        if (typeof yamlData.fundamento_legal !== 'object') {
            erros.push(`[${arquivoNome}] 'fundamento_legal' deve ser um objeto.`);
        } else {
            const { lei, artigos, jurisprudencia } = yamlData.fundamento_legal;
            if (!lei) erros.push(`[${arquivoNome}] 'fundamento_legal.lei' é obrigatório.`);
            if (!artigos || (Array.isArray(artigos) && artigos.length === 0)) {
                erros.push(`[${arquivoNome}] 'fundamento_legal.artigos' é obrigatório.`);
            }
            if (!jurisprudencia) erros.push(`[${arquivoNome}] 'fundamento_legal.jurisprudencia' é obrigatório.`);
        }
    }

    if (yamlData.instrucoes_investigativas_para_dossie) {
        if (!Array.isArray(yamlData.instrucoes_investigativas_para_dossie) || yamlData.instrucoes_investigativas_para_dossie.length === 0) {
            erros.push(`[${arquivoNome}] 'instrucoes_investigativas_para_dossie' deve ser uma lista não-vazia.`);
        }
    }

    return erros;
}

/**
 * Escaneia por termos de whitelist, blacklist, isenções ou CNPJ/CPF hardcoded
 */
function verificarClausulasProibidas(conteudo, arquivoNome, tipo) {
    const erros = [];

    // 1. Termos proibidos: whitelist, blacklist, isenção, etc.
    const termosProibidos = [
        /\bwhite[-_]?list\b/i,
        /\bblack[-_]?list\b/i,
        /\blista[-_]branca\b/i,
        /\blista[-_]negra\b/i,
        /\bisencao\b/i,
        /\bisenção\b/i,
        /\bisenta[ndo]*\b/i,
        /\bisento[s]?\b/i,
        /\bexcecao[-_]cnpj\b/i
    ];

    for (const regex of termosProibidos) {
        if (regex.test(conteudo)) {
            erros.push(`[${arquivoNome}] Cláusula proibida detectada (${regex}): proibido uso de whitelists ou isenções.`);
        }
    }

    // 2. Cláusulas SQL específicas de blindagem / bypass
    if (tipo === 'sql') {
        // NOT IN proibido em consultas antifraude
        if (/\bNOT\s+IN\b/i.test(conteudo)) {
            erros.push(`[${arquivoNome}] Cláusula SQL proibida 'NOT IN': risco de bypass ou whitelist oculta.`);
        }

        // Comparações de desigualdade aplicadas a identificadores de empresas (ex: cnpj != ... ou <> cnpj)
        if (/(?:!=|<>)\s*['"]?\d{2}\.\d{3}\.\d{3}\/\d{4}-\d{2}['"]?/.test(conteudo) ||
            /\bcnpj\w*\s*(?:!=|<>)/i.test(conteudo) ||
            /(?:!=|<>)\s*['"]?cnpj/i.test(conteudo)) {
            erros.push(`[${arquivoNome}] Operador de desigualdade (!= ou <>) associado a CNPJ detectado (possível isenção seletiva).`);
        }

        // Se a query envolve cpf_socio_mascarado, deve validar nome_socio para prevenir colisão
        if (conteudo.includes('cpf_socio_mascarado')) {
            if (!conteudo.includes('nome_socio')) {
                erros.push(`[${arquivoNome}] Uso de 'cpf_socio_mascarado' sem validação de 'nome_socio' gera falsos positivos por colisão de dígitos.`);
            }
        }
    }

    // 3. CNPJ formatado hardcoded: 00.000.000/0000-00
    const cnpjRegex = /\b\d{2}\.\d{3}\.\d{3}\/\d{4}-\d{2}\b/g;
    const cnpjsEncontrados = conteudo.match(cnpjRegex);
    if (cnpjsEncontrados) {
        erros.push(`[${arquivoNome}] CNPJ hardcoded detectado: ${cnpjsEncontrados.join(', ')}.`);
    }

    // 3b. CNPJ não-formatado hardcoded: 14 dígitos numéricos consecutivos
    const cnpj14Regex = /\b\d{14}\b/g;
    const cnpjs14Encontrados = conteudo.match(cnpj14Regex);
    if (cnpjs14Encontrados) {
        erros.push(`[${arquivoNome}] CNPJ não-formatado (14 dígitos) hardcoded detectado: ${cnpjs14Encontrados.join(', ')}.`);
    }

    // 4. CPF não-mascarado completo hardcoded: 000.000.000-00
    const cpfCompletoRegex = /\b\d{3}\.\d{3}\.\d{3}-\d{2}\b/g;
    const cpfsEncontrados = conteudo.match(cpfCompletoRegex);
    if (cpfsEncontrados) {
        erros.push(`[${arquivoNome}] CPF não-mascarado completo hardcoded detectado: ${cpfsEncontrados.join(', ')}.`);
    }

    return erros;
}

/**
 * Validador principal de Heurísticas
 * 
 * @param {string} [diretorioHeuristics] Diretório contendo regras YAML e SQL
 * @returns {{ valido: boolean, erros: string[], totalRegras: number }}
 */
function validarHeuristicas(diretorioHeuristics) {
    const dir = diretorioHeuristics 
        ? path.resolve(diretorioHeuristics) 
        : path.join(REPO_ROOT, 'heuristics');

    if (!fs.existsSync(dir)) {
        return {
            valido: false,
            erros: [`Diretório de heurísticas não encontrado: ${dir}`],
            totalRegras: 0
        };
    }

    const arquivos = fs.readdirSync(dir);
    const arquivosYaml = arquivos.filter(f => f.endsWith('.yaml') || f.endsWith('.yml'));
    const arquivosSql = arquivos.filter(f => f.endsWith('.sql'));

    const todosErros = [];
    let totalRegras = 0;

    // 1. Validar cada arquivo YAML
    for (const arquivo of arquivosYaml) {
        totalRegras++;
        const caminhoCompleto = path.join(dir, arquivo);
        const conteudo = fs.readFileSync(caminhoCompleto, 'utf-8');

        // Verificar termos proibidos no YAML
        const errosProibidos = verificarClausulasProibidas(conteudo, arquivo, 'yaml');
        todosErros.push(...errosProibidos);

        // Parse e validação de schema
        try {
            const yamlData = parseSimpleYaml(conteudo);
            const errosSchema = validarSchemaCIP0002(yamlData, arquivo);
            todosErros.push(...errosSchema);
        } catch (err) {
            todosErros.push(`[${arquivo}] Erro ao processar YAML: ${err.message}`);
        }

        // Verificar se existe o SQL correspondente
        const sqlCorrespondente = arquivo.replace(/\.ya?ml$/, '.sql');
        const caminhoSql = path.join(dir, sqlCorrespondente);
        if (!fs.existsSync(caminhoSql)) {
            todosErros.push(`[${arquivo}] Arquivo SQL analítico correspondente não encontrado: '${sqlCorrespondente}'.`);
        }
    }

    // 2. Validar cada arquivo SQL
    for (const arquivo of arquivosSql) {
        const caminhoCompleto = path.join(dir, arquivo);
        const conteudo = fs.readFileSync(caminhoCompleto, 'utf-8');

        // Verificar termos e cláusulas proibidas no SQL
        const errosProibidos = verificarClausulasProibidas(conteudo, arquivo, 'sql');
        todosErros.push(...errosProibidos);
    }

    return {
        valido: todosErros.length === 0,
        erros: todosErros,
        totalRegras
    };
}

module.exports = {
    validarHeuristicas,
    parseSimpleYaml,
    validarSchemaCIP0002,
    verificarClausulasProibidas
};

if (require.main === module) {
    console.log('='.repeat(65));
    console.log('  VERIFICADOR DE HEURÍSTICAS E CONFORMIDADE CIP-0002');
    console.log('='.repeat(65));

    const resultado = validarHeuristicas();
    console.log(`\nTotal de Regras Auditadas: ${resultado.totalRegras}`);

    if (resultado.valido) {
        console.log('Status: ✅ TODAS AS HEURÍSTICAS VÁLIDAS E EM CONFORMIDADE (CIP-0002)');
        process.exit(0);
    } else {
        console.error('Status: ❌ VIOLAÇÃO DE INTEGRIDADE OU ESQUEMA DETECTADA:');
        for (const e of resultado.erros) {
            console.error(`  • ${e}`);
        }
        process.exit(1);
    }
}
