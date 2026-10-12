const crypto = require('crypto');

/**
 * Gera um par de chaves Ed25519 nativo em memória
 */
function generateEd25519Keypair() {
    const { publicKey, privateKey } = crypto.generateKeyPairSync('ed25519');
    const publicKeyPem = publicKey.export({ type: 'spki', format: 'pem' });
    const privateKeyPem = privateKey.export({ type: 'pkcs8', format: 'pem' });
    const publicKeyDer = publicKey.export({ type: 'spki', format: 'der' });
    
    // Extrai os 32 bytes crus da chave pública SPKI DER (header SPKI Ed25519 possui 12 bytes: 302a300506032b6570032100)
    const rawPublicKeyBuffer = publicKeyDer.subarray(12);
    const publicKeyHex = rawPublicKeyBuffer.toString('hex');

    return {
        publicKey,
        privateKey,
        publicKeyPem,
        privateKeyPem,
        publicKeyDer,
        publicKeyHex,
        rawPublicKeyBuffer
    };
}

/**
 * Assina dados arbitrarios com a chave privada Ed25519
 * @param {crypto.KeyObject|string} privateKey 
 * @param {string|Buffer} data 
 * @returns {Buffer} Assinatura de 64 bytes
 */
function signData(privateKey, data) {
    const dataBuf = Buffer.isBuffer(data) ? data : Buffer.from(String(data), 'utf-8');
    let priv = privateKey;
    if (typeof priv === 'string') {
        priv = crypto.createPrivateKey(priv);
    }
    return crypto.sign(null, dataBuf, priv);
}

/**
 * Corrompe bytes de uma assinatura digital válida
 * @param {Buffer|string} signature 
 * @param {number} [byteIndex=0] 
 * @returns {Buffer}
 */
function corruptSignature(signature, byteIndex = 0) {
    const buf = Buffer.isBuffer(signature) 
        ? Buffer.from(signature) 
        : Buffer.from(signature, typeof signature === 'string' && /^[0-9a-fA-F]+$/.test(signature) ? 'hex' : 'base64');
    
    const targetIdx = Math.min(Math.max(0, byteIndex), buf.length - 1);
    buf[targetIdx] = buf[targetIdx] ^ 0xff; // Inverte todos os bits do byte
    return buf;
}

/**
 * Constrói um conselho simulado com 4 pilares e 2 membros cada,
 * gerando chaves criptográficas Ed25519 reais para cada membro.
 */
function generateMockCouncil() {
    const pillarsDef = {
        tecnologia_e_criptografia: [
            { id: 'tech-node-01', nome: 'Dev Civic 01', org: 'OpenTech', status: 'ativo' },
            { id: 'tech-node-02', nome: 'Dev Civic 02', org: 'SecGov', status: 'ativo' }
        ],
        jornalismo_investigativo: [
            { id: 'press-node-01', nome: 'Repórter 01', org: 'Jornal Livre', status: 'ativo' },
            { id: 'press-node-02', nome: 'Repórter 02', org: 'Agência Dados', status: 'ativo' }
        ],
        pesquisa_academica: [
            { id: 'acad-node-01', nome: 'Pesquisador 01', org: 'Lab Dados Públicos', status: 'ativo' },
            { id: 'acad-node-02', nome: 'Pesquisador 02', org: 'Instituto IA Ética', status: 'ativo' }
        ],
        auditoria_e_controle_social: [
            { id: 'audit-node-01', nome: 'Auditor 01', org: 'Transparência Cidadã', status: 'ativo' },
            { id: 'audit-node-02', nome: 'Auditor 02', org: 'Observatório Social', status: 'ativo' }
        ]
    };

    const membersMap = {};
    const config = {
        governance_model: "Multi-Sector Cryptographic Quorum",
        version: "1.0.0",
        quorum_policy: {
            min_total_signatures: 3,
            min_distinct_pillars: 3,
            require_tech_pillar: true,
            require_substantive_pillar: true,
            substantive_pillars: [
                "jornalismo_investigativo",
                "auditoria_e_controle_social"
            ]
        },
        pillars: {}
    };

    for (const [pilarId, membrosList] of Object.entries(pillarsDef)) {
        config.pillars[pilarId] = {
            descricao: `Pilar ${pilarId}`,
            membros: []
        };

        for (const m of membrosList) {
            const keys = generateEd25519Keypair();
            const memberObj = {
                id: m.id,
                nome: m.nome,
                organizacao: m.org,
                chave_publica: keys.publicKeyPem,
                status: m.status
            };

            config.pillars[pilarId].membros.push(memberObj);

            membersMap[m.id] = {
                ...memberObj,
                pilar: pilarId,
                keys
            };
        }
    }

    return { config, membersMap };
}

/**
 * Cria um objeto de assinatura válido assinado por um membro do conselho mock
 */
function createMemberSignature(member, payload) {
    const sigBuf = signData(member.keys.privateKey, payload);
    return {
        id: member.id,
        chave_publica: member.chave_publica,
        assinatura: sigBuf,
        dados: payload
    };
}

module.exports = {
    generateEd25519Keypair,
    signData,
    corruptSignature,
    generateMockCouncil,
    createMemberSignature
};
