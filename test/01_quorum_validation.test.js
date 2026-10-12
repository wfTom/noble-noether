const { describe, it } = require('node:test');
const assert = require('node:assert/strict');
const path = require('path');
const { validarQuorum, carregarMantenedores } = require('../scripts/verify_governance');

describe('Suíte 01: Validação de Quórum e Pilares de Governança', () => {
    const validConfigPath = path.resolve(__dirname, 'fixtures', 'maintainers_valid.json');
    const validConfig = carregarMantenedores(validConfigPath);

    // Chaves válidas de cada pilar conforme fixtures/maintainers_valid.json
    const keyTech01 = "ssh-ed25519 AAAAC3NzaC1lZDI1NTE5AAAAIGov3eEXAMPLEPUBLICKEYCIVICTECH01";
    const keyTech02 = "ssh-ed25519 AAAAC3NzaC1lZDI1NTE5AAAAIGov3eEXAMPLEPUBLICKEYCIVICTECH02";
    const keyPress01 = "ssh-ed25519 AAAAC3NzaC1lZDI1NTE5AAAAIGov3eEXAMPLEPUBLICKEYPRESS01";
    const keyPress02 = "ssh-ed25519 AAAAC3NzaC1lZDI1NTE5AAAAIGov3eEXAMPLEPUBLICKEYPRESS02";
    const keyAcad01 = "ssh-ed25519 AAAAC3NzaC1lZDI1NTE5AAAAIGov3eEXAMPLEPUBLICKEYACAD01";
    const keyAudit01 = "ssh-ed25519 AAAAC3NzaC1lZDI1NTE5AAAAIGov3eEXAMPLEPUBLICKEYAUDIT01";
    const keyRogue = "ssh-ed25519 AAAAC3NzaC1lZDI1NTE5AAAAIGov3eROGUEKEYNOTREGISTERED0000";

    it('Caso 1.1: Quórum exato válido de 3 pilares (Tech + Press + Audit)', () => {
        const assinaturas = [keyTech01, keyPress01, keyAudit01];
        const resultado = validarQuorum(assinaturas, validConfig);

        assert.equal(resultado.aprovado, true, 'Quórum mínimo de 3 pilares deve ser aprovado');
        assert.equal(resultado.totalAssinaturasValidas, 3);
        assert.equal(resultado.totalPilaresDistintos, 3);
        assert.equal(resultado.requisitoTecnicoAtendido, true);
        assert.equal(resultado.requisitoSubstantivoAtendido, true);
        assert.ok(resultado.pilaresPresentes.includes('tecnologia_e_criptografia'));
        assert.ok(resultado.pilaresPresentes.includes('jornalismo_investigativo'));
        assert.ok(resultado.pilaresPresentes.includes('auditoria_e_controle_social'));
    });

    it('Caso 1.2: Quórum válido de 4 pilares (Consenso Pleno: Tech + Press + Acad + Audit)', () => {
        const assinaturas = [keyTech01, keyPress01, keyAcad01, keyAudit01];
        const resultado = validarQuorum(assinaturas, validConfig);

        assert.equal(resultado.aprovado, true, 'Quórum de 4 pilares deve ser aprovado com louvor');
        assert.equal(resultado.totalAssinaturasValidas, 4);
        assert.equal(resultado.totalPilaresDistintos, 4);
        assert.equal(resultado.requisitoTecnicoAtendido, true);
        assert.equal(resultado.requisitoSubstantivoAtendido, true);
    });

    it('Caso 1.3: Rejeição por total de assinaturas insuficiente (2 assinaturas de 2 pilares)', () => {
        const assinaturas = [keyTech01, keyPress01];
        const resultado = validarQuorum(assinaturas, validConfig);

        assert.equal(resultado.aprovado, false, 'Deve rejeitar com menos de 3 assinaturas');
        assert.equal(resultado.totalAssinaturasValidas, 2);
        assert.match(resultado.motivoRejeicao, /total de assinaturas/i);
    });

    it('Caso 1.4: Rejeição por diversidade de pilares insuficiente (3 assinaturas de apenas 2 pilares)', () => {
        // 2 membros de Tecnologia + 1 de Imprensa (3 votos válidos, mas apenas 2 pilares)
        const assinaturas = [keyTech01, keyTech02, keyPress01];
        const resultado = validarQuorum(assinaturas, validConfig);

        assert.equal(resultado.aprovado, false, 'Deve rejeitar com menos de 3 pilares distintos');
        assert.equal(resultado.totalAssinaturasValidas, 3);
        assert.equal(resultado.totalPilaresDistintos, 2);
        assert.match(resultado.motivoRejeicao, /diversidade de pilares/i);
    });

    it('Caso 1.5: Rejeição por ausência do pilar obrigatório de Tecnologia e Criptografia', () => {
        // 1 Press, 1 Acad, 1 Audit (3 assinaturas de 3 pilares, porém sem Tecnologia)
        const assinaturas = [keyPress01, keyAcad01, keyAudit01];
        const resultado = validarQuorum(assinaturas, validConfig);

        assert.equal(resultado.aprovado, false, 'Deve rejeitar ausência do pilar técnico');
        assert.equal(resultado.totalAssinaturasValidas, 3);
        assert.equal(resultado.totalPilaresDistintos, 3);
        assert.equal(resultado.requisitoTecnicoAtendido, false);
        assert.match(resultado.motivoRejeicao, /tecnologia_e_criptografia/i);
    });

    it('Caso 1.6: Rejeição por ausência de pilar substantivo obrigatório (Imprensa ou Auditoria)', () => {
        // 2 Tecnologia + 1 Academia (3 assinaturas de 2 pilares, sem Press e sem Audit)
        const customPolicy = JSON.parse(JSON.stringify(validConfig));
        customPolicy.quorum_policy.min_distinct_pillars = 2; // flexibiliza pilares para isolar teste de substantivo

        const assinaturas = [keyTech01, keyTech02, keyAcad01];
        const resultado = validarQuorum(assinaturas, customPolicy);

        assert.equal(resultado.aprovado, false, 'Deve rejeitar ausência de pilar substantivo');
        assert.equal(resultado.requisitoSubstantivoAtendido, false);
        assert.match(resultado.motivoRejeicao, /pilar substantivo/i);
    });

    it('Caso 1.7: Rejeição de assinaturas duplicadas do mesmo membro (Sybil / Replay dentro do lote)', () => {
        // Mesmo membro tech-01 assinando 3 vezes
        const assinaturas = [keyTech01, keyTech01, keyTech01];
        const resultado = validarQuorum(assinaturas, validConfig);

        assert.equal(resultado.aprovado, false, 'Assinaturas duplicadas do mesmo membro devem ser desconsideradas');
        assert.equal(resultado.totalAssinaturasValidas, 1, 'Apenas 1 voto deve ser computado para o mesmo membro');
        assert.equal(resultado.totalPilaresDistintos, 1);
    });

    it('Caso 1.8: Rejeição para lote de assinaturas vazio', () => {
        const resultado = validarQuorum([], validConfig);

        assert.equal(resultado.aprovado, false);
        assert.equal(resultado.totalAssinaturasValidas, 0);
        assert.equal(resultado.totalPilaresDistintos, 0);
    });

    it('Caso 1.9: Rejeição para chaves públicas desconhecidas / não-cadastradas no conselho', () => {
        const assinaturas = [keyRogue, "ssh-ed25519 AAAAC3NzaC1lZDI1NTE5AAAAIGov3eANOTHERROGUEKEY1111"];
        const resultado = validarQuorum(assinaturas, validConfig);

        assert.equal(resultado.aprovado, false);
        assert.equal(resultado.totalAssinaturasValidas, 0);
        assert.equal(resultado.membrosAssinantes.length, 0);
    });
});
