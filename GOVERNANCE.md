# Governança e Modelo de Quórum Criptográfico (Anti-Censura)

Este documento define o modelo de governança descentralizada, o processo de revisão por quórum multi-setorial e os mecanismos criptográficos de proteção contra adulteração inidônea de código, dados e regras analíticas.

---

## 1. Princípios Fundamentais

1. **Resistência à Coação e Censura:** Nenhuma entidade única (indivíduo, empresa, órgão estatal ou tribunal) possui poder unilateral para alterar, excluir, suavizar ou silenciar regras de detecção de fraude.
2. **Auditabilidade Integral:** Todo commit, regra heurística e snapshot de dados deve ser criptograficamente assinado com chaves públicas reconhecidas.
3. **Revisão Multidisciplinar (Dual-Track Review):** As regras do sistema são auditadas tanto por especialistas técnicos em software/segurança quanto por especialistas investigativos, jurídicos e acadêmicos.
4. **Legibilidade Aberta:** Nenhuma heurística de fraude pode ser encapsulada em código procedural opaco; todas devem ser expressas em formatos declarativos (YAML/SQL legível).

---

## 2. Composição do Conselho de Mantenedores (*Maintainers Council*)

O conselho de revisão é dividido em quatro pilares institucionais independentes:

```
┌──────────────────────────────────────────────────────────────────┐
│                   CONSELHO DE MANTENEDORES                       │
├─────────────────┬──────────────────┬─────────────────┬───────────┤
│  1. TECNOLOGIA  │  2. JORNALISMO   │  3. ACADEMIA    │ 4. AUDITOR│
│  Software Livre │  Investigativo   │  Ciência Dados  │ Jurídico/ │
│  & Criptografia │  & Mídia Cívica  │  & Estatística  │ Controle  │
└─────────────────┴──────────────────┴─────────────────┴───────────┘
```

* **Pilar 1: Coletivos de Tecnologia Cívica / Software Livre (2 Chaves)**  
  * Foco: Segurança da informação, ausência de backdoors, performance e integridade de compilação (*reproducible builds*).
* **Pilar 2: Jornalismo Investigativo & Mídia Cívica (2 Chaves)**  
  * Foco: Pertinência pública da investigação, ausência de blindagem de alvos e clareza das evidências.
* **Pilar 3: Pesquisadores Acadêmicos / Cientistas de Dados (2 Chaves)**  
  * Foco: Rigor metodológico, minimização de viés amostral e validação estatística de preços.
* **Pilar 4: Auditores de Controle Social & Juristas (2 Chaves)**  
  * Foco: Fundamentação legal (Lei 14.133/21, jurisprudência do TCU/TCEs) e higidez da cadeia de custódia das provas.

---

## 3. Regra de Quórum de Aprovação ($M$ de $N$)

Para que qualquer alteração seja integrada à branch principal (`main`):

* **Quórum Mínimo Geral:** Pelo menos **3 assinaturas válidas de pilares distintos**.
* **Alterações em Heurísticas / Regras Antifraude:**
  * Exige obrigatoriamente:
    * Pelo menos 1 assinatura do **Pilar de Tecnologia** (garantia técnica);
    * Pelo menos 1 assinatura do **Pilar de Jornalismo OU Auditoria** (garantia substantiva);
    * Pelo menos 1 assinatura de um terceiro pilar independente.
* **Testes Automatizados de Regressão Histórica (*Ground-Truth CI*):**
  * O pipeline de testes automatizados deve passar com 100% de sucesso contra a base de escândalos reais de controle antes que as assinaturas tenham validade.

---

## 4. Processo de Proposta de Melhoria Cívica (CIP)

Qualquer pessoa da comunidade pode propor novas regras de fraude ou melhorias técnicas seguindo o fluxo:

1. **Abertura de CIP:** Criação de um documento markdown em `/cips/` detalhando o tipo de fraude, embasamento legal e metodologia.
2. **Implementação Declarativa:** Submissão do arquivo YAML/SQL correspondente em `/heuristics/`.
3. **Geração do Relatório de Impacto:** O CI simula a nova regra contra a base pública histórica e anexa o relatório ao Pull Request.
4. **Revisão e Assinatura Digital:** Os mantenedores revisam o relatório de impacto e assinam o parecer usando chaves Ed25519/GPG ou chaves físicas (FIDO2/YubiKey).
5. **Merge Multi-Assinado:** O merge commit é consolidado com as assinaturas anexadas e espelhado na rede P2P (Radicle / Nostr / Git mirrors).

---

## 5. Rotação de Chaves e Resiliência a Ameaças

* Se uma chave for comprometida ou seu titular sofrer coação comprovada, qualquer conjunto de 3 pilares pode assinar uma transação de revogação de chave (`REVOCATION_CERT`), registrando a nova chave pública no arquivo `.github/maintainers.json`.
* Nenhuma chave individual tem poder de veto absoluto ou capacidade de paralisar o sistema.
