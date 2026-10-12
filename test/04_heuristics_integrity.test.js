const { describe, it } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('fs');
const path = require('path');
const { 
    validarHeuristicas, 
    parseSimpleYaml, 
    validarSchemaCIP0002, 
    verificarClausulasProibidas 
} = require('../scripts/verify_heuristics');

describe('Suíte 04: Integridade de Heurísticas Antifraude e Conformidade CIP-0002', () => {
    const heuristicsDir = path.resolve(__dirname, '..', 'heuristics');
    const fixturesDir = path.resolve(__dirname, 'fixtures');

    it('Caso 4.1: Validação global de todas as heurísticas do repositório em heuristics/ (CIP-0002)', () => {
        const resultado = validarHeuristicas(heuristicsDir);

        assert.equal(resultado.valido, true, `Heurísticas do repositório devem ser 100% válidas. Erros: ${resultado.erros.join('; ')}`);
        assert.equal(resultado.erros.length, 0);
        assert.ok(resultado.totalRegras >= 1, 'Deve haver ao menos 1 regra auditada');
    });

    it('Caso 4.2: Conformidade rigorosa de esquema CIP-0002 em FRAUDE-001-conluio-socios.yaml', () => {
        const yamlPath = path.join(heuristicsDir, 'FRAUDE-001-conluio-socios.yaml');
        const yamlContent = fs.readFileSync(yamlPath, 'utf-8');
        const data = parseSimpleYaml(yamlContent);

        // Validação via validador de schema oficial
        const errosSchema = validarSchemaCIP0002(data, 'FRAUDE-001-conluio-socios.yaml');
        assert.equal(errosSchema.length, 0, `Schema deve ser válido: ${errosSchema.join(', ')}`);

        // Verificações específicas de campos mandatórios
        assert.equal(data.id_regra, 'FRAUDE-001');
        assert.equal(data.cip_referencia, 'CIP-0002');
        assert.equal(data.versao, '1.0.0');
        assert.equal(data.categoria, 'Cartelização e Bidding Rings');
        assert.equal(data.criticidade, 'ALTA');
        assert.equal(data.pontuacao_risco, 85);
        assert.ok(Number.isInteger(data.pontuacao_risco));
        assert.ok(data.pontuacao_risco >= 0 && data.pontuacao_risco <= 100);

        // Fundamento legal
        assert.ok(data.fundamento_legal, 'Fundamento legal é obrigatório');
        assert.match(data.fundamento_legal.lei, /14\.133/);
        assert.ok(Array.isArray(data.fundamento_legal.artigos) && data.fundamento_legal.artigos.length > 0);
        assert.ok(data.fundamento_legal.jurisprudencia);

        // Instruções para dossiê
        assert.ok(Array.isArray(data.instrucoes_investigativas_para_dossie));
        assert.ok(data.instrucoes_investigativas_para_dossie.length >= 2);
    });

    it('Caso 4.3: Ausência absoluta de termos proibidos (whitelist, blacklist, isencao) em heuristics/', () => {
        const files = fs.readdirSync(heuristicsDir);
        for (const file of files) {
            const content = fs.readFileSync(path.join(heuristicsDir, file), 'utf-8');
            const erros = verificarClausulasProibidas(content, file, file.endsWith('.sql') ? 'sql' : 'yaml');
            assert.equal(erros.length, 0, `Arquivo ${file} violou proibições: ${erros.join(', ')}`);
        }
    });

    it('Caso 4.4: Ausência de cláusulas de bypass em SQL (NOT IN, != cnpj, <> cnpj)', () => {
        const sqlPath = path.join(heuristicsDir, 'FRAUDE-001-conluio-socios.sql');
        const sqlContent = fs.readFileSync(sqlPath, 'utf-8');

        assert.equal(/\bNOT\s+IN\b/i.test(sqlContent), false, 'Proibido uso de NOT IN em consultas antifraude');
        assert.equal(/!=\s*['"]?\d{2}\.\d{3}\.\d{3}\/\d{4}-\d{2}['"]?/.test(sqlContent), false);
        assert.equal(/<>\s*['"]?\d{2}\.\d{3}\.\d{3}\/\d{4}-\d{2}['"]?/.test(sqlContent), false);
        assert.equal(/\bcnpj\w*\s*(?:!=|<>)/i.test(sqlContent), false);
    });

    it('Caso 4.5: Ausência de CNPJs ou CPFs hardcoded nas regras de produção', () => {
        const files = fs.readdirSync(heuristicsDir);
        for (const file of files) {
            const content = fs.readFileSync(path.join(heuristicsDir, file), 'utf-8');
            // Formatos de CNPJ e CPF
            const formattedCnpj = content.match(/\b\d{2}\.\d{3}\.\d{3}\/\d{4}-\d{2}\b/g);
            const unformattedCnpj = content.match(/\b\d{14}\b/g);
            const fullCpf = content.match(/\b\d{3}\.\d{3}\.\d{3}-\d{2}\b/g);

            assert.equal(formattedCnpj, null, `CNPJ formatado hardcoded em ${file}`);
            assert.equal(unformattedCnpj, null, `CNPJ 14 dígitos não-formatado hardcoded em ${file}`);
            assert.equal(fullCpf, null, `CPF completo hardcoded em ${file}`);
        }
    });

    it('Caso 4.6: Prevenção de falso-positivo por colisão de CPFs mascarados (l1.nome_socio = l2.nome_socio)', () => {
        const sqlPath = path.join(heuristicsDir, 'FRAUDE-001-conluio-socios.sql');
        const sqlContent = fs.readFileSync(sqlPath, 'utf-8');

        // Garante que a condição de junção contém a verificação do nome do sócio
        assert.match(
            sqlContent, 
            /l1\.nome_socio\s*=\s*l2\.nome_socio/, 
            'A query DEVE comparar nome_socio junto com cpf_socio_mascarado para evitar falsos positivos'
        );
        assert.match(sqlContent, /l1\.cpf_socio_mascarado\s*=\s*l2\.cpf_socio_mascarado/);
    });

    it('Caso 4.7: Teste Negativo — Detecção de violações no fixture heuristic_with_whitelist.yaml', () => {
        const malYamlPath = path.join(fixturesDir, 'heuristic_with_whitelist.yaml');
        const content = fs.readFileSync(malYamlPath, 'utf-8');
        const erros = verificarClausulasProibidas(content, 'heuristic_with_whitelist.yaml', 'yaml');

        assert.ok(erros.length >= 1, 'Deve acusar presença de whitelist/CNPJs');
        assert.ok(erros.some(e => /whitelist/i.test(e)), 'Deve identificar o termo whitelist');
        assert.ok(erros.some(e => /CNPJ hardcoded/i.test(e)), 'Deve identificar os CNPJs hardcoded');
    });

    it('Caso 4.8: Teste Negativo — Detecção de bypasses no fixture heuristic_with_injection.sql', () => {
        const malSqlPath = path.join(fixturesDir, 'heuristic_with_injection.sql');
        const content = fs.readFileSync(malSqlPath, 'utf-8');
        const erros = verificarClausulasProibidas(content, 'heuristic_with_injection.sql', 'sql');

        assert.ok(erros.length >= 3, 'Deve identificar múltiplas violações no SQL malicioso');
        assert.ok(erros.some(e => /NOT IN/i.test(e)), 'Deve identificar cláusula NOT IN');
        assert.ok(erros.some(e => /desigualdade/i.test(e)), 'Deve identificar operador de desigualdade com CNPJ');
        assert.ok(erros.some(e => /14 dígitos/i.test(e)), 'Deve identificar CNPJ de 14 dígitos não-formatado');
        assert.ok(erros.some(e => /colisão/i.test(e)), 'Deve identificar cpf_socio_mascarado sem nome_socio');
    });
});
