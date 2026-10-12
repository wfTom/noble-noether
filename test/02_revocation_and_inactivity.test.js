const { describe, it } = require('node:test');
const assert = require('node:assert/strict');
const path = require('path');
const { validarQuorum, carregarMantenedores } = require('../scripts/verify_governance');
const { generateMockCouncil, createMemberSignature } = require('./helpers/test_crypto_helpers');

describe('Suíte 02: Rejeição Categórica de Chaves Revogadas e Inativas (Fail-Closed)', () => {
    const revokedFixturePath = path.resolve(__dirname, 'fixtures', 'maintainers_with_revoked.json');
    const revokedConfig = carregarMantenedores(revokedFixturePath);

    const keyTechActive = "ssh-ed25519 AAAAC3NzaC1lZDI1NTE5AAAAIGov3eEXAMPLEPUBLICKEYCIVICTECH01";
    const keyTechRevoked = "ssh-ed25519 AAAAC3NzaC1lZDI1NTE5AAAAIGov3eREVOKEDKEYCIVICTECH99";
    const keyPressActive = "ssh-ed25519 AAAAC3NzaC1lZDI1NTE5AAAAIGov3eEXAMPLEPUBLICKEYPRESS01";
    const keyPressInactive = "ssh-ed25519 AAAAC3NzaC1lZDI1NTE5AAAAIGov3eINACTIVEKEYPRESS88";
    const keyAcadActive = "ssh-ed25519 AAAAC3NzaC1lZDI1NTE5AAAAIGov3eEXAMPLEPUBLICKEYACAD01";
    const keyAuditActive = "ssh-ed25519 AAAAC3NzaC1lZDI1NTE5AAAAIGov3eEXAMPLEPUBLICKEYAUDIT01";

    it('Caso 2.1: Rejeição categórica de chave explicitamente revogada (status === revogado)', () => {
        const assinaturas = [keyTechRevoked];
        const resultado = validarQuorum(assinaturas, revokedConfig);

        assert.equal(resultado.aprovado, false, 'Chave revogada deve causar reprovação imediata');
        assert.equal(resultado.chavesRevogadasDetectadas.length, 1);
        assert.equal(resultado.chavesRevogadasDetectadas[0].id, 'tech-node-revoked');
        assert.match(resultado.motivoRejeicao, /chave\(s\) revogada\(s\) detectada\(s\)/i);
    });

    it('Caso 2.2: Rejeição categórica de chave inativa (status === inativo)', () => {
        const assinaturas = [keyPressInactive];
        const resultado = validarQuorum(assinaturas, revokedConfig);

        assert.equal(resultado.aprovado, false, 'Chave inativa deve causar reprovação imediata');
        assert.equal(resultado.chavesInativasDetectadas.length, 1);
        assert.equal(resultado.chavesInativasDetectadas[0].id, 'press-node-inactive');
        assert.match(resultado.motivoRejeicao, /chave\(s\) inativa\(s\) detectada\(s\)/i);
    });

    it('Caso 2.3: Rejeição FAIL-CLOSED quando chave revogada está presente em quórum de outra forma válido', () => {
        // 3 chaves perfeitamente válidas (Tech + Press + Audit) CONTAMINADAS por 1 chave revogada
        const assinaturas = [keyTechActive, keyPressActive, keyAuditActive, keyTechRevoked];
        const resultado = validarQuorum(assinaturas, revokedConfig);

        // FAIL CLOSED: Presença de chave revogada anula toda a homologação
        assert.equal(resultado.aprovado, false, 'Lote contaminado por chave revogada DEVE ser categoricamente rejeitado');
        assert.equal(resultado.chavesRevogadasDetectadas.length, 1);
        assert.equal(resultado.chavesRevogadasDetectadas[0].id, 'tech-node-revoked');
        assert.match(resultado.motivoRejeicao, /REJEIÇÃO DE SEGURANÇA/);
    });

    it('Caso 2.4: Tentativa de atingir quórum utilizando chave revogada como terceiro voto', () => {
        // 2 válidas (Tech + Press) + 1 revogada (Tech-revoked) -> Não deve atingir 3 válidas
        const assinaturas = [keyTechActive, keyPressActive, keyTechRevoked];
        const resultado = validarQuorum(assinaturas, revokedConfig);

        assert.equal(resultado.aprovado, false);
        assert.equal(resultado.chavesRevogadasDetectadas.length, 1);
    });

    it('Caso 2.5: Tentativa de atingir quórum utilizando chave inativa como terceiro voto', () => {
        // 2 válidas (Tech + Audit) + 1 inativa (Press-inactive)
        const assinaturas = [keyTechActive, keyAuditActive, keyPressInactive];
        const resultado = validarQuorum(assinaturas, revokedConfig);

        assert.equal(resultado.aprovado, false);
        assert.equal(resultado.chavesInativasDetectadas.length, 1);
        assert.match(resultado.motivoRejeicao, /inativa\(s\) detectada\(s\)/i);
    });

    it('Caso 2.6: Rejeição com assinaturas digitais criptográficas reais Ed25519 de membro revogado', () => {
        const { config, membersMap } = generateMockCouncil();
        // Marca um dos membros como revogado no conselho
        config.pillars.tecnologia_e_criptografia.membros[0].status = 'revogado';
        membersMap['tech-node-01'].status = 'revogado';

        const payload = 'merge-request-proposal-42';
        const sigTechRevoked = createMemberSignature(membersMap['tech-node-01'], payload);
        const sigPressValid = createMemberSignature(membersMap['press-node-01'], payload);
        const sigAuditValid = createMemberSignature(membersMap['audit-node-01'], payload);

        const resultado = validarQuorum([sigTechRevoked, sigPressValid, sigAuditValid], config);

        assert.equal(resultado.aprovado, false, 'Assinatura válida matematicamente de chave revogada deve ser rejeitada');
        assert.equal(resultado.chavesRevogadasDetectadas.length, 1);
        assert.equal(resultado.chavesRevogadasDetectadas[0].id, 'tech-node-01');
    });

    it('Caso 2.7: Detecção simultânea de chaves revogadas e inativas no mesmo lote', () => {
        const assinaturas = [keyTechRevoked, keyPressInactive];
        const resultado = validarQuorum(assinaturas, revokedConfig);

        assert.equal(resultado.aprovado, false);
        assert.equal(resultado.chavesRevogadasDetectadas.length, 1);
        assert.equal(resultado.chavesInativasDetectadas.length, 1);
    });
});
