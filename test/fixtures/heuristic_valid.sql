-- Regra analítica válida para testes automatizados
SELECT 
    p.id_licitacao,
    p.numero_item,
    p.cnpj_participante,
    p.valor_proposta,
    90 AS score_risco,
    'FRAUDE-TEST-001' AS id_regra
FROM read_parquet('dados/propostas.parquet') AS p
WHERE p.valor_proposta > 100000;
