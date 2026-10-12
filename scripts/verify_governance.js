#!/usr/bin/env node
/**
 * Script de Verificação de Governança e Quórum Multi-Setorial (Estilo Bitcoin Core)
 * 
 * Execução CLI: node scripts/verify_governance.js
 * Módulo: require('./scripts/verify_governance')
 */

const fs = require('fs');
const path = require('path');
const crypto = require('crypto');

const REPO_ROOT = path.resolve(__dirname, '..');
const DEFAULT_MAINTAINERS_FILE = path.join(REPO_ROOT, '.github', 'maintainers.json');

/**
 * Validação defensiva da estrutura da configuração de mantenedores
 * @param {object} config 
 */
function validarEstruturaConfig(config) {
    if (!config || typeof config !== 'object') {
        throw new Error('Estrutura de mantenedores inválida: esperado objeto JSON.');
    }
    if (!config.quorum_policy || typeof config.quorum_policy !== 'object') {
        throw new Error('Política de quórum ausente ou inválida.');
    }
    if (!config.pillars || typeof config.pillars !== 'object') {
        throw new Error('Pilares ausentes ou inválidos na configuração.');
    }

    const { min_total_signatures, min_distinct_pillars } = config.quorum_policy;
    if (typeof min_total_signatures !== 'number' || min_total_signatures < 1) {
        throw new Error('min_total_signatures inválido na política de quórum.');
    }
    if (typeof min_distinct_pillars !== 'number' || min_distinct_pillars < 1) {
        throw new Error('min_distinct_pillars inválido na política de quórum.');
    }
}

/**
 * Carrega e valida o arquivo de mantenedores com contenção estrita dentro do repositório
 * @param {string} [caminhoArquivo] 
 * @returns {object}
 */
function carregarMantenedores(caminhoArquivo = DEFAULT_MAINTAINERS_FILE) {
    const caminhoResolvido = path.resolve(caminhoArquivo);
    const caminhoNorm = path.normalize(caminhoResolvido).toLowerCase();
    const repoRootNorm = path.normalize(REPO_ROOT).toLowerCase();

    // Verificação estrita de contenção de caminho contra Path Traversal
    const repoRootWithSep = repoRootNorm.endsWith(path.sep) ? repoRootNorm : repoRootNorm + path.sep;
    const rel = path.relative(repoRootNorm, caminhoNorm);
    if ((caminhoNorm !== repoRootNorm && !caminhoNorm.startsWith(repoRootWithSep)) || rel.startsWith('..') || path.isAbsolute(rel)) {
        throw new Error(`[SEGURANÇA] Caminho fora da raiz do repositório: ${caminhoArquivo}`);
    }

    if (!fs.existsSync(caminhoResolvido)) {
        throw new Error(`Arquivo de mantenedores não encontrado: ${caminhoResolvido}`);
    }

    let config;
    try {
        const conteudo = fs.readFileSync(caminhoResolvido, 'utf-8');
        config = JSON.parse(conteudo);
    } catch (err) {
        throw new Error(`Erro ao carregar ou parsear mantenedores: ${err.message}`);
    }

    validarEstruturaConfig(config);
    return config;
}

/**
 * Verificação de assinatura digital Ed25519 usando node:crypto
 * @param {crypto.KeyObject|string|Buffer} chavePublica 
 * @param {string|Buffer} assinatura 
 * @param {string|Buffer} dados 
 * @returns {boolean}
 */
function verificarAssinaturaEd25519(chavePublica, assinatura, dados) {
    if (!chavePublica || !assinatura || dados === undefined || dados === null) {
        return false;
    }

    try {
        let pubKey = chavePublica;

        if (typeof pubKey === 'object' && pubKey !== null && typeof pubKey.export === 'function') {
            // KeyObject nativo
        } else if (typeof pubKey === 'string') {
            if (pubKey.startsWith('-----BEGIN')) {
                pubKey = crypto.createPublicKey(pubKey);
            } else if (pubKey.startsWith('ssh-ed25519')) {
                try {
                    pubKey = crypto.createPublicKey({ key: pubKey, format: 'openssh' });
                } catch (e) {
                    try {
                        const parts = pubKey.trim().split(/\s+/);
                        if (parts.length >= 2) {
                            const wireBuf = Buffer.from(parts[1], 'base64');
                            if (wireBuf.length >= 51) {
                                const rawBuf = wireBuf.subarray(19, 51);
                                const spkiHeader = Buffer.from('302a300506032b6570032100', 'hex');
                                pubKey = crypto.createPublicKey({
                                    key: Buffer.concat([spkiHeader, rawBuf]),
                                    format: 'der',
                                    type: 'spki'
                                });
                            } else {
                                return false;
                            }
                        } else {
                            return false;
                        }
                    } catch (err2) {
                        return false;
                    }
                }
            } else if (/^[0-9a-fA-F]{64}$/.test(pubKey)) {
                // Raw 32-byte hex public key
                const rawBuf = Buffer.from(pubKey, 'hex');
                const spkiHeader = Buffer.from('302a300506032b6570032100', 'hex');
                pubKey = crypto.createPublicKey({
                    key: Buffer.concat([spkiHeader, rawBuf]),
                    format: 'der',
                    type: 'spki'
                });
            } else {
                try {
                    const rawBuf = Buffer.from(pubKey, 'base64');
                    if (rawBuf.length === 32) {
                        const spkiHeader = Buffer.from('302a300506032b6570032100', 'hex');
                        pubKey = crypto.createPublicKey({
                            key: Buffer.concat([spkiHeader, rawBuf]),
                            format: 'der',
                            type: 'spki'
                        });
                    } else {
                        pubKey = crypto.createPublicKey(pubKey);
                    }
                } catch (e) {
                    return false;
                }
            }
        } else if (Buffer.isBuffer(pubKey) && pubKey.length === 32) {
            const spkiHeader = Buffer.from('302a300506032b6570032100', 'hex');
            pubKey = crypto.createPublicKey({
                key: Buffer.concat([spkiHeader, pubKey]),
                format: 'der',
                type: 'spki'
            });
        }

        const dataBuf = Buffer.isBuffer(dados) ? dados : Buffer.from(String(dados), 'utf-8');
        let sigBuf = assinatura;
        if (typeof sigBuf === 'string') {
            if (/^[0-9a-fA-F]{128}$/.test(sigBuf)) {
                sigBuf = Buffer.from(sigBuf, 'hex');
            } else {
                sigBuf = Buffer.from(sigBuf, 'base64');
            }
        }

        if (!Buffer.isBuffer(sigBuf) || sigBuf.length !== 64) {
            return false;
        }

        return crypto.verify(null, dataBuf, pubKey, sigBuf);
    } catch (err) {
        return false;
    }
}

/**
 * Compara duas chaves públicas em formatos heterogêneos (string, KeyObject, PEM, DER, OpenSSH)
 * @param {any} k1 
 * @param {any} k2 
 * @returns {boolean}
 */
function chavesSaoIguais(k1, k2) {
    if (!k1 || !k2) return false;
    if (k1 === k2) return true;
    if (typeof k1 === 'string' && typeof k2 === 'string') {
        if (k1.trim() === k2.trim()) return true;
    }
    try {
        const extrairDer = (k) => {
            if (typeof k === 'object' && k !== null && typeof k.export === 'function') {
                return k.export({ type: 'spki', format: 'der' });
            }
            if (typeof k === 'string') {
                const s = k.trim();
                if (s.startsWith('-----BEGIN')) {
                    return crypto.createPublicKey(s).export({ type: 'spki', format: 'der' });
                }
                if (s.startsWith('ssh-ed25519')) {
                    const parts = s.split(/\s+/);
                    if (parts.length >= 2) {
                        const wireBuf = Buffer.from(parts[1], 'base64');
                        if (wireBuf.length >= 51) {
                            const rawBuf = wireBuf.subarray(19, 51);
                            const spkiHeader = Buffer.from('302a300506032b6570032100', 'hex');
                            return Buffer.concat([spkiHeader, rawBuf]);
                        }
                    }
                }
                if (/^[0-9a-fA-F]{64}$/.test(s)) {
                    const rawBuf = Buffer.from(s, 'hex');
                    const spkiHeader = Buffer.from('302a300506032b6570032100', 'hex');
                    return Buffer.concat([spkiHeader, rawBuf]);
                }
                const rawBuf = Buffer.from(s, 'base64');
                if (rawBuf.length === 32) {
                    const spkiHeader = Buffer.from('302a300506032b6570032100', 'hex');
                    return Buffer.concat([spkiHeader, rawBuf]);
                }
            }
            if (Buffer.isBuffer(k) && k.length === 32) {
                const spkiHeader = Buffer.from('302a300506032b6570032100', 'hex');
                return Buffer.concat([spkiHeader, k]);
            }
            return null;
        };

        const der1 = extrairDer(k1);
        const der2 = extrairDer(k2);
        if (der1 && der2) {
            return der1.equals(der2);
        }
    } catch (e) {}
    return false;
}

/**
 * Localiza membro na estrutura de pilares
 */
function encontrarMembro(item, pilares) {
    let chaveAlvo = null;
    let idAlvo = null;

    if (typeof item === 'string') {
        chaveAlvo = item.trim();
        idAlvo = item.trim();
    } else if (item && typeof item === 'object') {
        chaveAlvo = item.chave_publica || item.publicKey || item.chave;
        idAlvo = item.id || item.membro_id || item.membro;
    }

    for (const [pilarNome, pilarInfo] of Object.entries(pilares)) {
        if (!pilarInfo || !Array.isArray(pilarInfo.membros)) continue;
        for (const membro of pilarInfo.membros) {
            if (idAlvo && membro.id === idAlvo) {
                return { membro, pilarNome };
            }
            if (chaveAlvo && chavesSaoIguais(chaveAlvo, membro.chave_publica)) {
                return { membro, pilarNome };
            }
        }
    }
    return null;
}

/**
 * Valida quórum multi-setorial com rejeição categórica de chaves revogadas/inativas
 * e suporte a verificação de assinaturas Ed25519
 * 
 * @param {Array<string|object>} chavesAssinadas 
 * @param {object} [configCustom] 
 * @returns {object}
 */
function validarQuorum(chavesAssinadas, configCustom = null) {
    if (!Array.isArray(chavesAssinadas)) {
        return {
            aprovado: false,
            motivoRejeicao: 'Entrada inválida: chavesAssinadas deve ser um array.',
            totalAssinaturasValidas: 0,
            totalPilaresDistintos: 0,
            pilaresPresentes: [],
            membrosAssinantes: [],
            chavesRevogadasDetectadas: [],
            chavesInativasDetectadas: [],
            assinaturasCorrompidasDetectadas: [],
            requisitoTecnicoAtendido: false,
            requisitoSubstantivoAtendido: false
        };
    }

    let config;
    try {
        config = configCustom || carregarMantenedores();
        validarEstruturaConfig(config);
    } catch (err) {
        return {
            aprovado: false,
            motivoRejeicao: `Falha na configuração de governança: ${err.message}`,
            totalAssinaturasValidas: 0,
            totalPilaresDistintos: 0,
            pilaresPresentes: [],
            membrosAssinantes: [],
            chavesRevogadasDetectadas: [],
            chavesInativasDetectadas: [],
            assinaturasCorrompidasDetectadas: [],
            requisitoTecnicoAtendido: false,
            requisitoSubstantivoAtendido: false
        };
    }

    const pilares = config.pillars || {};
    const politica = config.quorum_policy || {};

    const chavesRevogadasDetectadas = [];
    const chavesInativasDetectadas = [];
    const assinaturasCorrompidasDetectadas = [];
    const chavesValidas = [];
    const pilaresAtingidos = new Set();
    const membrosProcessados = new Set();

    for (const item of chavesAssinadas) {
        const temAssinaturaDigital = (
            typeof item === 'object' && 
            item !== null && 
            (item.assinatura !== undefined || item.signature !== undefined)
        );

        const match = encontrarMembro(item, pilares);

        let assinaturaValida = true;
        if (temAssinaturaDigital) {
            const chaveInformada = item.chave_publica || item.publicKey || item.chave;
            const sig = item.assinatura !== undefined ? item.assinatura : item.signature;
            const dados = item.dados !== undefined ? item.dados : (item.data !== undefined ? item.data : item.payload);

            // Prevenção contra Key Substitution Attack:
            // Se o membro foi identificado (por id), mas foi fornecida uma chave pública divergente da registrada:
            if (match && chaveInformada && !chavesSaoIguais(chaveInformada, match.membro.chave_publica)) {
                assinaturaValida = false;
                assinaturasCorrompidasDetectadas.push({
                    id: match.membro.id,
                    chave: chaveInformada,
                    motivo: 'Tentativa de substituição indevida de chave pública detectada (key substitution attack).'
                });
            } else {
                // A chave verificada DEVE SEMPRE ser a chave registrada do membro no conselho
                const pubKey = match ? match.membro.chave_publica : chaveInformada;
                assinaturaValida = verificarAssinaturaEd25519(pubKey, sig, dados);
                if (!assinaturaValida) {
                    assinaturasCorrompidasDetectadas.push({
                        id: match ? match.membro.id : (item.id || 'desconhecido'),
                        chave: pubKey,
                        motivo: 'Assinatura inválida, corrompida ou dados adulterados'
                    });
                }
            }
        }

        if (match) {
            const { membro, pilarNome } = match;
            if (membro.status === 'revogado') {
                chavesRevogadasDetectadas.push({
                    id: membro.id,
                    pilar: pilarNome,
                    chave: membro.chave_publica
                });
            } else if (membro.status !== 'ativo') {
                chavesInativasDetectadas.push({
                    id: membro.id,
                    pilar: pilarNome,
                    chave: membro.chave_publica,
                    status: membro.status
                });
            } else if (membro.status === 'ativo' && assinaturaValida) {
                if (!membrosProcessados.has(membro.id)) {
                    membrosProcessados.add(membro.id);
                    pilaresAtingidos.add(pilarNome);
                    chavesValidas.push({
                        id: membro.id,
                        pilar: pilarNome,
                        org: membro.organizacao,
                        chave: membro.chave_publica
                    });
                }
            }
        }
    }

    // Regra Fail-Closed: Rejeição categórica de chaves revogadas
    if (chavesRevogadasDetectadas.length > 0) {
        return {
            aprovado: false,
            motivoRejeicao: `REJEIÇÃO DE SEGURANÇA: ${chavesRevogadasDetectadas.length} chave(s) revogada(s) detectada(s).`,
            totalAssinaturasValidas: chavesValidas.length,
            totalPilaresDistintos: pilaresAtingidos.size,
            pilaresPresentes: Array.from(pilaresAtingidos),
            membrosAssinantes: chavesValidas,
            chavesRevogadasDetectadas,
            chavesInativasDetectadas,
            assinaturasCorrompidasDetectadas,
            requisitoTecnicoAtendido: pilaresAtingidos.has('tecnologia_e_criptografia'),
            requisitoSubstantivoAtendido: pilaresAtingidos.has('jornalismo_investigativo') || pilaresAtingidos.has('auditoria_e_controle_social')
        };
    }

    // Regra Fail-Closed: Rejeição categórica de chaves inativas
    if (chavesInativasDetectadas.length > 0) {
        return {
            aprovado: false,
            motivoRejeicao: `REJEIÇÃO DE SEGURANÇA: ${chavesInativasDetectadas.length} chave(s) inativa(s) detectada(s).`,
            totalAssinaturasValidas: chavesValidas.length,
            totalPilaresDistintos: pilaresAtingidos.size,
            pilaresPresentes: Array.from(pilaresAtingidos),
            membrosAssinantes: chavesValidas,
            chavesRevogadasDetectadas,
            chavesInativasDetectadas,
            assinaturasCorrompidasDetectadas,
            requisitoTecnicoAtendido: pilaresAtingidos.has('tecnologia_e_criptografia'),
            requisitoSubstantivoAtendido: pilaresAtingidos.has('jornalismo_investigativo') || pilaresAtingidos.has('auditoria_e_controle_social')
        };
    }

    // Regra Fail-Closed: Rejeição categórica de assinaturas corrompidas
    if (assinaturasCorrompidasDetectadas.length > 0) {
        return {
            aprovado: false,
            motivoRejeicao: `REJEIÇÃO DE SEGURANÇA: ${assinaturasCorrompidasDetectadas.length} assinatura(s) corrompida(s) ou inválida(s) detectada(s).`,
            totalAssinaturasValidas: chavesValidas.length,
            totalPilaresDistintos: pilaresAtingidos.size,
            pilaresPresentes: Array.from(pilaresAtingidos),
            membrosAssinantes: chavesValidas,
            chavesRevogadasDetectadas,
            chavesInativasDetectadas,
            assinaturasCorrompidasDetectadas,
            requisitoTecnicoAtendido: pilaresAtingidos.has('tecnologia_e_criptografia'),
            requisitoSubstantivoAtendido: pilaresAtingidos.has('jornalismo_investigativo') || pilaresAtingidos.has('auditoria_e_controle_social')
        };
    }

    const totalAssinaturas = chavesValidas.length;
    const totalPilares = pilaresAtingidos.size;

    const temTech = pilaresAtingidos.has('tecnologia_e_criptografia');
    const substantivePillars = Array.isArray(politica.substantive_pillars) 
        ? politica.substantive_pillars 
        : ['jornalismo_investigativo', 'auditoria_e_controle_social'];
    const temSubstantivo = substantivePillars.some(p => pilaresAtingidos.has(p));

    const minSignatures = typeof politica.min_total_signatures === 'number' ? politica.min_total_signatures : 3;
    const minPillars = typeof politica.min_distinct_pillars === 'number' ? politica.min_distinct_pillars : 3;
    const requireTech = politica.require_tech_pillar !== false;
    const requireSubstantive = politica.require_substantive_pillar !== false;

    let aprovado = true;
    let motivoRejeicao;

    if (totalAssinaturas < minSignatures) {
        aprovado = false;
        motivoRejeicao = 'Quórum insuficiente: total de assinaturas válidas abaixo do mínimo exigido.';
    } else if (totalPilares < minPillars) {
        aprovado = false;
        motivoRejeicao = 'Quórum insuficiente: diversidade de pilares abaixo do mínimo exigido.';
    } else if (requireTech && !temTech) {
        aprovado = false;
        motivoRejeicao = 'Quórum insuficiente: pilar obrigatório de tecnologia_e_criptografia ausente.';
    } else if (requireSubstantive && !temSubstantivo) {
        aprovado = false;
        motivoRejeicao = 'Quórum insuficiente: pilar substantivo obrigatório ausente.';
    }

    return {
        aprovado,
        motivoRejeicao,
        totalAssinaturasValidas: totalAssinaturas,
        totalPilaresDistintos: totalPilares,
        pilaresPresentes: Array.from(pilaresAtingidos),
        membrosAssinantes: chavesValidas,
        chavesRevogadasDetectadas,
        chavesInativasDetectadas,
        assinaturasCorrompidasDetectadas,
        requisitoTecnicoAtendido: temTech,
        requisitoSubstantivoAtendido: temSubstantivo
    };
}

module.exports = {
    carregarMantenedores,
    validarQuorum,
    validarEstruturaConfig,
    verificarAssinaturaEd25519,
    chavesSaoIguais
};

if (require.main === module) {
    console.log('='.repeat(65));
    console.log('  VERIFICADOR DE QUÓRUM CRIPTOGRÁFICO MULTI-SETORIAL');
    console.log('='.repeat(65));

    // Exemplo de verificação com 3 chaves de 3 pilares diferentes:
    const chavesExemplo = [
        "ssh-ed25519 AAAAC3NzaC1lZDI1NTE5AAAAIGov3eEXAMPLEPUBLICKEYCIVICTECH01",
        "ssh-ed25519 AAAAC3NzaC1lZDI1NTE5AAAAIGov3eEXAMPLEPUBLICKEYPRESS01",
        "ssh-ed25519 AAAAC3NzaC1lZDI1NTE5AAAAIGov3eEXAMPLEPUBLICKEYAUDIT01"
    ];

    const resultado = validarQuorum(chavesExemplo);

    console.log(`\nStatus de Homologação: ${resultado.aprovado ? '✅ APROVADO PARA MERGE' : '❌ REJEITADO'}`);
    if (resultado.motivoRejeicao) {
        console.log(`Motivo: ${resultado.motivoRejeicao}`);
    }
    console.log(`Total de Assinaturas Válidas: ${resultado.totalAssinaturasValidas}`);
    console.log(`Pilares Distintos Representados: ${resultado.totalPilaresDistintos}`);
    console.log('\nDetalhamento dos Votos Registrados:');
    for (const m of (resultado.membrosAssinantes || [])) {
        console.log(`  • [${m.pilar.toUpperCase()}] ${m.id} (${m.org})`);
    }

    if (!resultado.aprovado) {
        process.exit(1);
    }
}
