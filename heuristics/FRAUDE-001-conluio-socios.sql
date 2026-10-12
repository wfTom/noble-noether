-- ============================================================================
-- Regra: FRAUDE-001 - Conluio por Sócios em Comum
-- Dialeto: DuckDB SQL (Executa diretamente sobre arquivos Parquet locais)
-- ============================================================================

WITH LicitantesComSocios AS (
    SELECT 
        prop.id_licitacao,
        prop.numero_item,
        prop.orgao_comprador,
        prop.cnpj_participante,
        prop.razao_social_participante,
        prop.valor_proposta,
        soc.nome_socio,
        soc.cpf_socio_mascarado,
        soc.qualificacao_socio
    FROM read_parquet('dados/propostas_licitacao.parquet') AS prop
    INNER JOIN read_parquet('dados/receita_qsa.parquet') AS soc
        ON prop.cnpj_participante = soc.cnpj_empresa
)
SELECT 
    l1.id_licitacao,
    l1.numero_item,
    l1.orgao_comprador,
    l1.cnpj_participante AS cnpj_empresa_a,
    l1.razao_social_participante AS razao_social_a,
    l1.valor_proposta AS valor_proposta_a,
    l2.cnpj_participante AS cnpj_empresa_b,
    l2.razao_social_participante AS razao_social_b,
    l2.valor_proposta AS valor_proposta_b,
    l1.nome_socio AS socio_em_comum,
    l1.cpf_socio_mascarado,
    85 AS score_risco,
    'FRAUDE-001' AS id_regra,
    'Concorrência simulada entre empresas com mesmo sócio no QSA' AS justificativa_alerta
FROM LicitantesComSocios l1
INNER JOIN LicitantesComSocios l2
    ON l1.id_licitacao = l2.id_licitacao
    AND l1.numero_item = l2.numero_item
    AND l1.cnpj_participante < l2.cnpj_participante -- Evita pares duplicados (A-B e B-A)
    AND l1.cpf_socio_mascarado = l2.cpf_socio_mascarado
    AND l1.nome_socio = l2.nome_socio -- Previne colisão em CPFs mascarados
ORDER BY l1.id_licitacao, l1.numero_item;
