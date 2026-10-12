# CIP-0002: Padrão Declarativo para Heurísticas e Regras Antifraude

| Campo | Valor |
| :--- | :--- |
| **CIP** | 0002 |
| **Título** | Formato Padrão de Regras Antifraude (YAML + SQL Declarativo) |
| **Autor(es)** | Coletivo de Governança Cívica |
| **Status** | Ativo / Padrão Técnico |
| **Tipo** | Padrão de Arquitetura |
| **Criado em** | 2026-09-13 |

---

## 1. Resumo

Define o formato obrigatório para especificação de regras de detecção de fraudes. Toda heurística deve ser dividida em dois componentes complementares:
1. **Arquivo YAML de Metadados e Parâmetros:** Legível por jornalistas, auditores e cidadãos comuns.
2. **Arquivo SQL Analítico Comentado (DuckDB/ANSI):** Consulta declarativa executada diretamente sobre os dados públicos colunares (Parquet).

---

## 2. Estrutura do Arquivo YAML (`/heuristics/<slug>.yaml`)

```yaml
id_regra: "FRAUDE-001"
versao: "1.0.0"
cip_referencia: "CIP-0002"
nome: "Conluio por Sócios em Comum no Quadro Societário"
categoria: "Cartelização e Bidding Rings"
criticidade: "ALTA" # BAIXA | MEDIA | ALTA | CRITICA
pontuacao_risco: 85 # 0 a 100

fundamento_legal:
  lei: "Lei Federal nº 14.133/2021"
  artigos: ["Art. 14, Inciso IV", "Art. 9º, § 1º"]
  jurisprudencia: "Acórdão TCU nº 2.143/2017 - Plenário"

descricao_resumida: >
  Identifica empresas concorrentes que disputaram o mesmo item/lote em uma licitação
  e que possuem sócios, administradores ou procuradores com o mesmo CPF cadastrado no QSA.

parametros_ajustaveis:
  ignorar_licitantes_desclassificados_previamente: false
  considerar_apenas_socios_administradores: false

instrucoes_investigativas_para_dossie:
  - "Verificar se as empresas apresentaram lances muito próximos."
  - "Conferir se os e-mails e telefones de cadastro no Compras.gov.br são idênticos."
  - "Inspecionar se houve rodízio de vitórias em outros lotes do mesmo órgão."
```

---

## 3. Estrutura do Arquivo SQL (`/heuristics/<slug>.sql`)

As consultas SQL devem seguir o dialeto padrão do **DuckDB**, priorizando clareza, uso de Common Table Expressions (`WITH`) e comentários explicativos em cada etapa:

```sql
-- Regra: FRAUDE-001 - Conluio por Sócios em Comum
-- Objetivo: Cruzar participantes do mesmo item de licitação com o QSA da Receita Federal

WITH ParticipantesComSocios AS (
    SELECT 
        p.id_licitacao,
        p.numero_item,
        p.orgao_comprador,
        p.cnpj_participante,
        p.razao_social_participante,
        q.nome_socio,
        q.cpf_socio_mascarado,
        q.qualificacao_socio
    FROM propostas_licitacao p
    INNER JOIN receita_qsa q 
        ON p.cnpj_participante = q.cnpj_empresa
)
SELECT 
    l1.id_licitacao,
    l1.numero_item,
    l1.orgao_comprador,
    l1.cnpj_participante AS cnpj_empresa_a,
    l1.razao_social_participante AS razao_social_a,
    l2.cnpj_participante AS cnpj_empresa_b,
    l2.razao_social_participante AS razao_social_b,
    l1.nome_socio AS socio_em_comum,
    l1.cpf_socio_mascarado,
    85 AS score_risco,
    'FRAUDE-001' AS id_regra
FROM ParticipantesComSocios l1
INNER JOIN ParticipantesComSocios l2 
    ON l1.id_licitacao = l2.id_licitacao 
    AND l1.numero_item = l2.numero_item
    AND l1.cnpj_participante < l2.cnpj_participante -- Evita espelhamento duplicado
    AND l1.cpf_socio_mascarado = l2.cpf_socio_mascarado -- Vínculo de sociedade identificado
ORDER BY l1.id_licitacao, l1.numero_item;
```
