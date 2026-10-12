const { describe, it } = require('node:test');
const assert = require('node:assert/strict');
const { spawnSync } = require('child_process');
const path = require('path');

describe('Suíte 06: Execução de Scripts CLI e Códigos de Saída', () => {
    const repoRoot = path.resolve(__dirname, '..');
    const govScript = path.join(repoRoot, 'scripts', 'verify_governance.js');
    const heurScript = path.join(repoRoot, 'scripts', 'verify_heuristics.js');

    it('Caso 6.1: Execução CLI de scripts/verify_governance.js resulta em código 0 (APROVADO)', () => {
        const proc = spawnSync(process.execPath, [govScript], {
            cwd: repoRoot,
            encoding: 'utf-8'
        });

        assert.equal(proc.status, 0, `CLI deve retornar exit code 0. Stderr: ${proc.stderr}`);
        assert.match(proc.stdout, /APROVADO PARA MERGE/i);
        assert.match(proc.stdout, /Total de Assinaturas Válidas:\s*3/);
        assert.match(proc.stdout, /Pilares Distintos Representados:\s*3/);
    });

    it('Caso 6.2: Execução CLI de scripts/verify_heuristics.js resulta em código 0 (CONFORMIDADE)', () => {
        const proc = spawnSync(process.execPath, [heurScript], {
            cwd: repoRoot,
            encoding: 'utf-8'
        });

        assert.equal(proc.status, 0, `CLI deve retornar exit code 0. Stderr: ${proc.stderr}`);
        assert.match(proc.stdout, /TODAS AS HEURÍSTICAS VÁLIDAS E EM CONFORMIDADE \(CIP-0002\)/);
        assert.match(proc.stdout, /Total de Regras Auditadas:\s*1/);
    });

    it('Caso 6.3: CLI retorna código 1 ao detectar quórum insuficiente ou reprovado', () => {
        const codeSnippet = `
            const { validarQuorum } = require('./scripts/verify_governance');
            const res = validarQuorum([]);
            if (!res.aprovado) {
                console.error("Rejeitado: " + res.motivoRejeicao);
                process.exit(1);
            }
        `;

        const proc = spawnSync(process.execPath, ['-e', codeSnippet], {
            cwd: repoRoot,
            encoding: 'utf-8'
        });

        assert.equal(proc.status, 1, 'Quórum vazio deve retornar código de saída 1');
        assert.match(proc.stderr, /Rejeitado/);
    });

    it('Caso 6.4: CLI retorna código 1 ao detectar violação de integridade ou whitelist em heurísticas', () => {
        const fixturesDir = path.join(repoRoot, 'test', 'fixtures');
        const codeSnippet = `
            const { validarHeuristicas } = require('./scripts/verify_heuristics');
            const res = validarHeuristicas(${JSON.stringify(fixturesDir)});
            if (!res.valido) {
                console.error("Violações detectadas: " + res.erros.length);
                process.exit(1);
            }
        `;

        const proc = spawnSync(process.execPath, ['-e', codeSnippet], {
            cwd: repoRoot,
            encoding: 'utf-8'
        });

        assert.equal(proc.status, 1, 'Diretório com fixtures maliciosas deve falhar com código 1');
        assert.match(proc.stderr, /Violações detectadas/);
    });
});
