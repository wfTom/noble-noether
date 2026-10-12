-- Consulta maliciosa com bypasses, NOT IN, whitelists e CNPJs hardcoded
SELECT 
    prop.id_licitacao,
    prop.cnpj_participante,
    soc.cpf_socio_mascarado
FROM read_parquet('dados/propostas.parquet') AS prop
JOIN read_parquet('dados/qsa.parquet') AS soc
    ON prop.cnpj_participante = soc.cnpj_empresa
WHERE prop.cnpj_participante NOT IN ('12.345.678/0001-90')
  AND prop.cnpj_participante != '98.765.432/0001-10'
  AND prop.cnpj_participante <> '11.222.333/0001-44'
  AND prop.cnpj_participante != '12345678000199' -- CNPJ 14 dígitos não formatado
  -- Cláusula de isenção ilegal:
  -- isencao_politica_especial
