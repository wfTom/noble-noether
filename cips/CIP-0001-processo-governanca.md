# CIP-0001: Processo de Governança, Propostas e Quórum Multi-Setorial

| Campo | Valor |
| :--- | :--- |
| **CIP** | 0001 |
| **Título** | Processo Padrão de Propostas de Melhoria Cívica (CIP) e Quórum de Revisão |
| **Autor(es)** | Coletivo de Governança Cívica |
| **Status** | Ativo / Norma Fundamental |
| **Tipo** | Processo & Governança |
| **Criado em** | 2026-09-13 |

---

## 1. Resumo

Este documento estabelece o ciclo de vida formal para proposição, discussão, auditoria multidisciplinar e homologação de qualquer alteração no código-fonte, nas regras analíticas de detecção de fraudes em licitações e nos formatos de dados do projeto.

---

## 2. Motivação

Sistemas de auditoria cívica que investigam agentes públicos e grandes grupos econômicos enfrentam riscos severos de:
1. **Tentativas de cooptação ou intimidação** de mantenedores individuais para desativar regras específicas;
2. **Inclusão de exceções clandestinas** (*whitelists* ocultas) que isentam empresas ou figuras públicas específicas de alertas;
3. **Complexidade técnica excessiva** que impede jornalistas, juristas e cientistas sociais de entenderem como o código funciona.

O padrão CIP resolve esses três problemas tornando toda regra pública, inteligível e dependente de consenso cruzado entre diferentes setores da sociedade civil.

---

## 3. Ciclo de Vida de uma Proposta (CIP)

```
  [ Rascunho / Draft ]
          │
          ▼
  [ Proposta Aberta (PR) ] ───► [ CI Automatizado (Simulação & Ground Truth) ]
          │                                   │
          │ (Aprovado em Testes)              │
          ▼                                   ▼
  [ Revisão Multi-Setorial ] ◄─── [ Relatório de Impacto Gerado ]
    ├── 1. Assinatura Técnica (Segurança/Performance)
    ├── 2. Assinatura Investigativa / Jurídica (Pertinência/Legalidade)
    └── 3. Assinatura Acadêmica / Auditoria (Estatística/Ausência de Viés)
          │
          ▼ (Quórum 3 de 4 Pilares Atingido)
  [ Merge Criptográfico na Branch Main ]
          │
          ▼
  [ Espelhamento P2P (Radicle / Nostr / Git Mirrors) ]
```

---

## 4. Estrutura Obrigatória de um Documento CIP

Todo novo arquivo CIP (`/cips/CIP-XXXX-<slug>.md`) deve conter:

1. **Cabeçalho de Metadados:** Número, título, autores, status e tipo.
2. **Resumo Executivo (Linguagem Acessível):** Explicação em português simples do que a proposta faz, para que qualquer cidadão possa compreender.
3. **Tipologia de Fraude / Problema:** Qual irregularidade pública está sendo endereçada.
4. **Enquadramento Legal:** Artigos da Lei 14.133/2021 (Nova Lei de Licitações), Lei 8.429/1992 (Improbidade Administrativa), Lei 12.846/2013 (Anticorrupção) ou acórdãos do TCU.
5. **Especificação da Lógica / Algoritmo:** Descrição passo a passo do critério de cruzamento de dados.
6. **Mitigação de Falsos Positivos:** Casos normais de mercado que poderiam disparar o alerta indevidamente e como o algoritmo os diferencia.
7. **Arquivo de Regra Associado:** Link para o arquivo YAML/SQL correspondente em `/heuristics/`.

---

## 5. Como o Revisor Não-Técnico Valida o PR

1. O revisor lê o documento CIP e o arquivo YAML na pasta `/heuristics/`.
2. O revisor consulta o **Relatório de Impacto** publicado pelo bot de CI no Pull Request, verificando:
   * Quantas licitações/empresas foram sinalizadas;
   * Se nenhuma empresa foi inserida em lista de exceção (`blacklist`/`whitelist`);
   * Se os casos históricos de controle continuam sendo 100% detectados.
3. Estando de acordo, o revisor assina o parecer criptograficamente com sua chave autorizada.
