const { describe, it } = require('node:test');
const assert = require('node:assert/strict');
const crypto = require('crypto');
const { validarQuorum, verificarAssinaturaEd25519 } = require('../scripts/verify_governance');
const { 
    generateEd25519Keypair, 
    signData, 
    corruptSignature, 
    generateMockCouncil, 
    createMemberSignature 
} = require('./helpers/test_crypto_helpers');

describe('Suíte 03: Verificação Criptográfica de Assinaturas Ed25519', () => {
    it('Caso 3.1: Quórum aprovado com assinaturas digitais Ed25519 válidas em 3 pilares', () => {
        const { config, membersMap } = generateMockCouncil();
        const payload = 'git-commit-hash-789abcde-approve-cip-0002';

        const sigTech = createMemberSignature(membersMap['tech-node-01'], payload);
        const sigPress = createMemberSignature(membersMap['press-node-01'], payload);
        const sigAudit = createMemberSignature(membersMap['audit-node-01'], payload);

        const resultado = validarQuorum([sigTech, sigPress, sigAudit], config);

        assert.equal(resultado.aprovado, true, 'Quórum com assinaturas válidas deve ser aprovado');
        assert.equal(resultado.totalAssinaturasValidas, 3);
        assert.equal(resultado.assinaturasCorrompidasDetectadas.length, 0);
    });

    it('Caso 3.2: Rejeição de assinatura com bytes corrompidos / alterados', () => {
        const { config, membersMap } = generateMockCouncil();
        const payload = 'release-v1.0.0-signoff';

        const sigTech = createMemberSignature(membersMap['tech-node-01'], payload);
        const sigPress = createMemberSignature(membersMap['press-node-01'], payload);
        const sigAudit = createMemberSignature(membersMap['audit-node-01'], payload);

        // Corrompe 1 byte da assinatura do auditor
        sigAudit.assinatura = corruptSignature(sigAudit.assinatura, 5);

        const resultado = validarQuorum([sigTech, sigPress, sigAudit], config);

        assert.equal(resultado.aprovado, false, 'Assinatura com byte corrompido deve reprovar');
        assert.equal(resultado.assinaturasCorrompidasDetectadas.length, 1);
        assert.equal(resultado.assinaturasCorrompidasDetectadas[0].id, 'audit-node-01');
    });

    it('Caso 3.3: Rejeição por adulteração no payload (dados assinados divergem dos dados verificados)', () => {
        const { config, membersMap } = generateMockCouncil();
        const originalPayload = 'transacao-original-correta';
        const tamperedPayload = 'transacao-adulterada-maliciosa';

        const sigTech = createMemberSignature(membersMap['tech-node-01'], originalPayload);
        // O payload verificado é alterado para o adulterado
        sigTech.dados = tamperedPayload;

        const sigPress = createMemberSignature(membersMap['press-node-01'], originalPayload);
        const sigAudit = createMemberSignature(membersMap['audit-node-01'], originalPayload);

        const resultado = validarQuorum([sigTech, sigPress, sigAudit], config);

        assert.equal(resultado.aprovado, false, 'Payload adulterado deve falhar na verificação criptográfica');
        assert.equal(resultado.assinaturasCorrompidasDetectadas.length, 1);
        assert.equal(resultado.assinaturasCorrompidasDetectadas[0].id, 'tech-node-01');
    });

    it('Caso 3.4: Rejeição de troca de assinatura (Signature Swapping entre membros)', () => {
        const { config, membersMap } = generateMockCouncil();
        const payload = 'proposal-ballot-2026';

        const sigTech = createMemberSignature(membersMap['tech-node-01'], payload);
        const sigPress = createMemberSignature(membersMap['press-node-01'], payload);
        const sigAudit = createMemberSignature(membersMap['audit-node-01'], payload);

        // Troca a assinatura de Press para a chave de Audit
        sigAudit.assinatura = sigPress.assinatura;

        const resultado = validarQuorum([sigTech, sigPress, sigAudit], config);

        assert.equal(resultado.aprovado, false, 'Assinatura trocada entre membros deve falhar na verificação');
        assert.equal(resultado.assinaturasCorrompidasDetectadas.length, 1);
        assert.equal(resultado.assinaturasCorrompidasDetectadas[0].id, 'audit-node-01');
    });

    it('Caso 3.5: Rejeição de buffers de assinatura truncados ou com comprimento inválido', () => {
        const { config, membersMap } = generateMockCouncil();
        const payload = 'test-payload';

        // Assinatura truncada (32 bytes em vez de 64 bytes)
        const sigTruncada = {
            id: 'tech-node-01',
            chave_publica: membersMap['tech-node-01'].chave_publica,
            assinatura: Buffer.alloc(32, 0xaa),
            dados: payload
        };
        const sigVazia = {
            id: 'press-node-01',
            chave_publica: membersMap['press-node-01'].chave_publica,
            assinatura: Buffer.alloc(0),
            dados: payload
        };

        const resultado = validarQuorum([sigTruncada, sigVazia], config);

        assert.equal(resultado.aprovado, false);
        assert.equal(resultado.assinaturasCorrompidasDetectadas.length, 2);
    });

    it('Caso 3.6: Prevenção contra Ataque de Substituição de Chave (Key Substitution Attack)', () => {
        const { config, membersMap } = generateMockCouncil();
        const payload = 'approve-critical-bypasses';

        // Atacante gera um par de chaves próprio não cadastrado
        const attackerKeys = generateEd25519Keypair();
        const attackerSig = signData(attackerKeys.privateKey, payload);

        // Atacante envia objeto alegando ser tech-node-01, fornecendo sua própria chave pública no payload
        const spoofedSignature = {
            id: 'tech-node-01',
            chave_publica: attackerKeys.publicKeyPem,
            assinatura: attackerSig,
            dados: payload
        };

        const sigPress = createMemberSignature(membersMap['press-node-01'], payload);
        const sigAudit = createMemberSignature(membersMap['audit-node-01'], payload);

        const resultado = validarQuorum([spoofedSignature, sigPress, sigAudit], config);

        // O validador deve detectar a substituição indevida de chave e rejeitar categoricamente
        assert.equal(resultado.aprovado, false, 'Tentativa de substituição de chave deve falhar');
        assert.equal(resultado.assinaturasCorrompidasDetectadas.length, 1);
        assert.match(resultado.assinaturasCorrompidasDetectadas[0].motivo, /substituição/i);
    });

    it('Caso 3.7: Verificação direta com múltiplos formatos de chave pública em verificarAssinaturaEd25519', () => {
        const keypair = generateEd25519Keypair();
        const payload = 'crypto-test-direct';
        const signature = signData(keypair.privateKey, payload);

        // 1. KeyObject nativo
        assert.equal(verificarAssinaturaEd25519(keypair.publicKey, signature, payload), true);

        // 2. PEM string
        assert.equal(verificarAssinaturaEd25519(keypair.publicKeyPem, signature, payload), true);

        // 3. Raw 32-byte hex string
        assert.equal(verificarAssinaturaEd25519(keypair.publicKeyHex, signature, payload), true);

        // 4. Raw 32-byte Buffer
        assert.equal(verificarAssinaturaEd25519(keypair.rawPublicKeyBuffer, signature, payload), true);

        // 5. Assinatura em formato Hex string de 128 caracteres
        const sigHex = signature.toString('hex');
        assert.equal(verificarAssinaturaEd25519(keypair.publicKey, sigHex, payload), true);

        // 6. Assinatura em formato Base64 string
        const sigBase64 = signature.toString('base64');
        assert.equal(verificarAssinaturaEd25519(keypair.publicKey, sigBase64, payload), true);

        // 7. Entradas nulas ou indefinidas retornam false sem crash
        assert.equal(verificarAssinaturaEd25519(null, signature, payload), false);
        assert.equal(verificarAssinaturaEd25519(keypair.publicKey, null, payload), false);
        assert.equal(verificarAssinaturaEd25519(keypair.publicKey, signature, null), false);
    });
});
