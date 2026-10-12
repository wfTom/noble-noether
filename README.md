# 🛡️ Sistema de Auditoria Cívica & Detecção Descentralizada de Fraudes em Licitações

Sistema *local-first*, descentralizado e resistente à censura para cruzamento de dados públicos de compras governamentais (PNCP, Receita Federal, TCEs, TCU, TSE) e detecção de irregularidades em licitações e contratos públicos no Brasil.

Inspirado no modelo de segurança, governança e consenso criptográfico do **Bitcoin Core**.

---

## 🏛️ 1. Como Funciona a Governança e Revisão Multidisciplinar

Para evitar que pressões políticas, ordens judiciais de remoção ou ataques de coação corrompam o sistema, o projeto é governado por um **quórum multi-setorial de 4 pilares independentes**:

1. **Tecnologia Cívica & Criptografia:** Garante segurança contra invasões, ausência de backdoors e compilação reproduzível (*reproducible builds*).
2. **Jornalismo Investigativo:** Garante a relevância pública da apuração, clareza das evidências e ausência de blindagem de alvos.
3. **Pesquisa Acadêmica & Ciência de Dados:** Garante solidez estatística (preços de referência, medianas e desvios padrão sem viés).
4. **Auditoria & Controle Social / Juristas:** Garante enquadramento na Lei 14.133/2021, jurisprudência do TCU e validade probatória dos dossiês.

### ❓ Como um Jornalista ou Auditor Revisa o Código?

Especialistas não técnicos **não precisam inspecionar código de baixo nível**. O sistema utiliza:
* **CIPs (Civic Improvement Proposals):** Documentos em português claro descrevendo o que a regra faz ([veja CIP-0001](cips/CIP-0001-processo-governanca.md)).
* **Regras Declarativas em YAML e SQL:** Parâmetros abertos e legíveis ([veja CIP-0002](cips/CIP-0002-padrao-regras-declarativas.md) e [heurística de exemplo](heuristics/FRAUDE-001-conluio-socios.yaml)).
* **Relatórios Automáticos de Impacto (CI):** O pipeline simula o efeito da regra e gera um sumário visual mostrando se houve novos casos detectados e se alguma empresa foi indevidamente isenta.
* **Assinatura Digital Descomplicada:** O revisor aprova o parecer com 1 clique utilizando uma chave física de segurança (YubiKey / FIDO2 / Touch ID) ou chave PGP/SSH.

---

## 🧱 2. Estrutura do Repositório

```text
├── .github/
│   ├── maintainers.json                 # Registro público de chaves e pilares de quórum
│   └── workflows/
│       ├── verify-signatures.yml        # CI que checa quórum de assinaturas
│       └── ground-truth-test.yml        # CI que testa contra escândalos históricos reais
├── cips/                                # Civic Improvement Proposals (Propostas de Melhoria)
│   ├── CIP-0001-processo-governanca.md  # Estatuto de propostas e quórum
│   └── CIP-0002-padrao-regras-declarativas.md # Formato padrão de regras YAML/SQL
├── heuristics/                          # Regras de detecção de fraude declarativas
│   ├── FRAUDE-001-conluio-socios.yaml   # Metadados e fundamentação legal
│   └── FRAUDE-001-conluio-socios.sql    # Consulta analítica DuckDB
├── scripts/
│   ├── verify_governance.js             # Validador de quórum multi-setorial (Node.js)
│   └── verify_governance.py             # Validador de quórum multi-setorial (Python)
├── GOVERNANCE.md                        # Documento mestre de governança
└── README.md
```

---

## 🔍 3. Matriz de Heurísticas Antifraude

O sistema opera com um motor local (DuckDB) que cruza arquivos Parquet distribuídos:

* **FRAUDE-001:** Conluio por sócios em comum no QSA disputando o mesmo item.
* **FRAUDE-002:** Conluio por compartilhamento de endereço físico, telefone ou e-mail.
* **FRAUDE-003:** Fracionamento de despesa em contratações diretas para burlar o limite de dispensa (Art. 75 da Lei 14.133/21).
* **FRAUDE-004:** Empresas recém-criadas com sócios beneficiários de programas sociais vencendo contratos vultosos.
* **FRAUDE-005:** Vínculo direto de doação eleitoral no TSE com contratos do órgão beneficiado.

---

## 🚀 4. Executando o Validador de Governança Localmente

Para testar a validação de quórum criptográfico:

```bash
# Execução via Node.js
node scripts/verify_governance.js

# Ou via Python (em ambientes configurados)
python scripts/verify_governance.py
```
