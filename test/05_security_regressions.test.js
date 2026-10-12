const { describe, it } = require('node:test');
const assert = require('node:assert/strict');
const path = require('path');
const { 
    carregarMantenedores, 
    validarQuorum, 
    validarEstruturaConfig 
} = require('../scripts/verify_governance');

describe('Suíte 05: Regressões de Segurança, Parsing Defensivo e Resiliência', () => {
    const fixturesDir = path.resolve(__dirname, 'fixtures');

    it('Caso 5.1: Bloqueio estrito de Path Traversal ao tentar carregar arquivos fora do repositório', () => {
        // Tentativas com ../ e ..\
        const caminhosMaliciosos = [
            '../../../../etc/passwd',
            '..\\..\\..\\Windows\\System32\\drivers\\etc\\hosts',
            path.resolve(__dirname, '..', '..', 'shadow_repo', 'maintainers.json')
        ];

        for (const malPath of caminhosMaliciosos) {
            assert.throws(
                () => carregarMantenedores(malPath),
                /Caminho fora da raiz do repositório/,
                `Deve lançar erro de segurança ao tentar acessar caminho externo: ${malPath}`
            );
        }
    });

    it('Caso 5.2: Bloqueio de prefix traversal em diretórios irmãos (ex: repo vs repo-evil)', () => {
        const repoRoot = path.resolve(__dirname, '..');
        const evilSiblingPath = repoRoot + '-malicious' + path.sep + 'maintainers.json';

        assert.throws(
            () => carregarMantenedores(evilSiblingPath),
            /Caminho fora da raiz do repositório/,
            'Deve bloquear caminho em diretório irmão com prefixo semelhante'
        );
    });

    it('Caso 5.3: Tratamento limpo e seguro de JSON corrompido em maintainers.json', () => {
        const corruptPath = path.join(fixturesDir, 'maintainers_corrupted.json');

        // Não deve estourar uncaught exception fatal, mas sim lançar Error descritivo
        assert.throws(
            () => carregarMantenedores(corruptPath),
            /Erro ao carregar ou parsear mantenedores/,
            'Deve capturar erro de sintaxe JSON e relatar de forma controlada'
        );
    });

    it('Caso 5.4: Rejeição graciosa para arquivo inexistente dentro do repositório', () => {
        const nonExistentPath = path.resolve(__dirname, 'fixtures', 'non_existent_file.json');

        assert.throws(
            () => carregarMantenedores(nonExistentPath),
            /não encontrado/,
            'Deve relatar arquivo não encontrado sem terminar o processo'
        );
    });

    it('Caso 5.5: Validação defensiva de estruturas de configuração ausentes ou malformadas', () => {
        // Null / undefined config
        assert.throws(() => validarEstruturaConfig(null), /Estrutura de mantenedores inválida/);
        assert.throws(() => validarEstruturaConfig('string'), /Estrutura de mantenedores inválida/);

        // Missing quorum_policy
        assert.throws(() => validarEstruturaConfig({ pillars: {} }), /Política de quórum ausente/);

        // Missing pillars
        assert.throws(() => validarEstruturaConfig({ quorum_policy: { min_total_signatures: 3, min_distinct_pillars: 3 } }), /Pilares ausentes/);

        // Invalid min_total_signatures
        assert.throws(() => validarEstruturaConfig({
            quorum_policy: { min_total_signatures: -1, min_distinct_pillars: 3 },
            pillars: {}
        }), /min_total_signatures inválido/);

        // Invalid min_distinct_pillars
        assert.throws(() => validarEstruturaConfig({
            quorum_policy: { min_total_signatures: 3, min_distinct_pillars: 0 },
            pillars: {}
        }), /min_distinct_pillars inválido/);
    });

    it('Caso 5.6: Resiliência contra Prototype Pollution', () => {
        const payloadMalicioso = JSON.parse('{"__proto__": {"admin": true, "bypassed": true}}');
        
        // Valida que o protótipo global não foi poluído
        assert.equal(({}).admin, undefined, 'Object.prototype não deve conter propriedades injetadas');
        assert.equal(({}).bypassed, undefined);

        // Passa configuração com tentativa de poluição para validarQuorum
        const resultado = validarQuorum([], payloadMalicioso);
        assert.equal(resultado.aprovado, false);
        assert.equal(({}).admin, undefined);
    });

    it('Caso 5.7: Resiliência contra entradas não-array, nulas ou de tipos inconsistentes em validarQuorum', () => {
        // Cenários que anteriormente causavam TypeError não tratado
        const entradasInvalidas = [
            null,
            undefined,
            "chave_string_avulsa",
            123456789,
            { key: "value" },
            true,
            false,
            Symbol('invalid')
        ];

        for (const input of entradasInvalidas) {
            const resultado = validarQuorum(input);
            assert.equal(typeof resultado, 'object');
            assert.equal(resultado.aprovado, false, `Entrada inválida ${String(input)} deve retornar aprovado=false`);
            assert.match(resultado.motivoRejeicao, /deve ser um array/i);
            assert.equal(resultado.totalAssinaturasValidas, 0);
        }
    });

    it('Caso 5.8: Resiliência ao fornecer configCustom corrompida em validarQuorum', () => {
        // configCustom inválida não deve quebrar a execução
        const resultado = validarQuorum(['key1', 'key2'], { invalid: true });
        assert.equal(resultado.aprovado, false);
        assert.match(resultado.motivoRejeicao, /Falha na configuração de governança/);
    });
});
