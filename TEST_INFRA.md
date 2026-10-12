# Infrastructure & Testing Architecture Specification (TEST_INFRA.md)

**Project:** `noble-noether`  
**System:** Civic Governance & Decentralized Fraud Detection Engine for Public Procurement  
**Specification Version:** 1.0.0  
**Test Framework:** Node.js Native Test Runner (`node:test`, `node:assert/strict`)  
**Cryptography Standard:** Ed25519 (RFC 8032 / Edwards-curve Digital Signature Algorithm) via `node:crypto`  
**External Dependencies:** **0 (Zero External Dependencies)**  

---

## 1. Executive Summary & Testing Philosophy

The `noble-noether` project enforces multi-sector civic governance and cryptographic oversight over Brazilian public procurement data. Because public procurement transparency requires high assurance and resistance to tampering, the test infrastructure is built under four foundational principles:

### 1.1 Zero-Dependency Runtime & Supply-Chain Hardening
External npm dependencies introduce transitive supply-chain risks, package vulnerabilities, and installation friction. All test suites, test helpers, governance scripts, and heuristic analyzers are built strictly using Node.js standard modules:
- `node:test`: Native high-performance test runner (introduced in Node.js 18.0.0, stabilized in 20.0.0).
- `node:assert/strict`: Strict assertion library enforcing deep equality, exact type checks, and precise error matching.
- `node:crypto`: Native OpenSSL-backed cryptographic subsystem executing hardware-accelerated Ed25519 operations.
- `node:fs` & `node:path`: File system interaction with strict path normalization and traversal protection.
- `node:child_process`: Subprocess execution validating Command Line Interface (CLI) exit codes and stream outputs.

### 1.2 Mathematical Authenticity Over Mocks (Zero-Facade Mandate)
No cryptographic signatures or public key validations rely on mock booleans, stubbed functions, or tautological assertions (`1 === 1` or `assert.ok(true)`). 
- In-memory keypair generation uses genuine Ed25519 elliptic curve cryptography (`crypto.generateKeyPairSync('ed25519')`).
- Digital signatures are calculated over real payloads via native `crypto.sign(null, payload, privateKey)`.
- Signature corruption is achieved mathematically by flipping individual bits via bitwise XOR operations (`buf[idx] ^ 0xff`), guaranteeing that the signature point $(R, S)$ diverges from the curve equation.
- Verification executes genuine cryptographic verification via `crypto.verify(null, payload, publicKey, signature)`.

### 1.3 Fail-Closed Security Semantics
The verification engine adheres strictly to fail-closed principles:
- The presence of a single revoked (`status: "revogado"`) or inactive (`status: "inativo"`) key within a submission immediately and unconditionally invalidates the entire approval (`aprovado: false`), regardless of whether remaining valid signatures meet the numerical threshold.
- Corrupted signature bytes, mismatched payloads, or key substitution attacks immediately abort approval.
- Malformed configuration files or path traversal attempts throw descriptive errors rather than allowing unauthorized access or crashing silently.

### 1.4 Defense-in-Depth Static & Dynamic Verification
The test architecture verifies not only runtime behavior but also declarative static structures:
- CIP-0002 schema conformity for YAML heuristics.
- Anti-whitelist scanning asserting zero occurrences of `whitelist`, `blacklist`, `isencao`, `NOT IN`, inequality operations on CNPJs, or hardcoded Brazilian fiscal identifiers (CNPJs/CPFs).
- Masked CPF collision prevention in SQL analytics (`l1.nome_socio = l2.nome_socio`).

---

## 2. Four-Tier Testing Methodology

The test architecture organizes all 43 automated test cases into four distinct testing tiers:

```
+-------------------------------------------------------------------------+
|                  TIER 4: REAL-WORLD, SECURITY & CLI                    |
|       Path Traversal, Prefix Traversal, Prototype Pollution, CLI       |
+-------------------------------------------------------------------------+
|             TIER 3: COMBINATIONS, KEY SUBSTITUTION & TAMPERING          |
|    Tainted Quorums, Bit-Flipping, Payload Adulteration, Key Spoofing   |
+-------------------------------------------------------------------------+
|                    TIER 2: BOUNDARY & CORNER CASES                      |
|       Quorum Thresholds, Missing Mandatory Pillars, Empty Inputs        |
+-------------------------------------------------------------------------+
|             TIER 1: CORE FUNCTIONAL & QUORUM VALIDATION                 |
|       Valid 3/4-Pillar Quorums, CIP-0002 Schemas, Multi-Format Keys     |
+-------------------------------------------------------------------------+
```

### Tier 1: Core Functional & Quorum Validation
- **Objective:** Establish baseline functional correctness of multi-sector quorums, cryptographic signature validation across supported key formats, and declarative heuristic schemas.
- **Coverage Focus:**
  - Valid quorums meeting the 3-pillar constitutional requirement (`tecnologia_e_criptografia` + substantive pillar + 3rd pillar).
  - Full consensus quorums representing all 4 constitutional pillars.
  - Multi-format Ed25519 public key verification (native `KeyObject`, SPKI PEM, raw 32-byte hexadecimal, raw 32-byte Buffer, OpenSSH wire format).
  - Schema completeness of anti-fraud rules per CIP-0002 specification (11 mandatory fields, risk scoring, legal basis, investigative dossier directives).
- **Suites:** `test/01_quorum_validation.test.js`, `test/03_cryptographic_signatures.test.js`, `test/04_heuristics_integrity.test.js`.

### Tier 2: Boundary & Corner Cases
- **Objective:** Stress-test threshold limits, missing requirements, malformed inputs, and degenerate voting conditions.
- **Coverage Focus:**
  - Quorums with insufficient signature count ($N < 3$).
  - Quorums with insufficient pillar diversity ($D < 3$).
  - Missing mandatory technical pillar (`tecnologia_e_criptografia`).
  - Missing mandatory substantive pillar (`jornalismo_investigativo` or `auditoria_e_controle_social`).
  - Sybil and duplicate vote attacks (same member key signing multiple times in a single batch).
  - Empty signature batches (`[]`) and unknown/unregistered public keys.
  - Non-array inputs, nulls, undefined values, numbers, and primitive types passed to verification functions.
- **Suites:** `test/01_quorum_validation.test.js`, `test/02_revocation_and_inactivity.test.js`, `test/05_security_regressions.test.js`.

### Tier 3: Combinations, Key Substitution & Tampering
- **Objective:** Validate cryptographic integrity, attack resilience, and fail-closed isolation under adversarial tampering and malicious submissions.
- **Coverage Focus:**
  - Tainted batches: Valid 3-pillar quorums contaminated by a single revoked or inactive key.
  - Key Substitution Attacks (CWE-347): An attacker providing an unauthorized public key claiming to belong to a registered council member ID.
  - Bit-level cryptographic corruption: Single-byte modification of Ed25519 64-byte signature buffers.
  - Payload tampering: Verification data diverging from data signed by private keys.
  - Signature swapping (Replay): Using a valid signature from Member A on behalf of Member B.
  - Truncated signature buffers (e.g., 32-byte or 0-byte buffers).
- **Suites:** `test/02_revocation_and_inactivity.test.js`, `test/03_cryptographic_signatures.test.js`.

### Tier 4: Real-World, Security Regressions & CLI Execution
- **Objective:** Validate systemic resilience against host vulnerabilities, file system traversal, configuration corruption, and verify CLI subprocess lifecycle and exit codes.
- **Coverage Focus:**
  - Directory path traversal attacks (`../`, `..\`, absolute external paths).
  - Sibling directory prefix traversal attacks (e.g., `/project` vs `/project-malicious`).
  - Corrupted JSON syntax handling without uncaught fatal process terminations.
  - Non-existent configuration files handled gracefully via controlled errors.
  - Prototype pollution resistance (`__proto__` injection payloads).
  - Negative control validation against intentionally malicious fixtures (`heuristic_with_whitelist.yaml`, `heuristic_with_injection.sql`).
  - End-to-end CLI subprocess execution testing exit code `0` on successful merge approval and exit code `1` on rejection or policy violation.
- **Suites:** `test/04_heuristics_integrity.test.js`, `test/05_security_regressions.test.js`, `test/06_cli_execution.test.js`.

---

## 3. Feature Inventory Coverage Mapping

The 16 core features established during the architecture specification (`PROJECT.md`) map directly to the automated test suites and infrastructure:

| Feature # | Feature Name | Primary Implementation | Automated Test Coverage | Verification Status |
|---|---|---|---|---|
| **F-01** | Pillar Balance & SPOF Elimination | `.github/maintainers.json` | `test/01_quorum_validation.test.js` (Casos 1.1, 1.2) | **VERIFIED** |
| **F-02** | Masked CPF Collision Remediation | `heuristics/FRAUDE-001-conluio-socios.sql` | `test/04_heuristics_integrity.test.js` (Caso 4.6, 4.8) | **VERIFIED** |
| **F-03** | Declarative Heuristics Validator | `scripts/verify_heuristics.js` | `test/04_heuristics_integrity.test.js` (Casos 4.1 to 4.8) | **VERIFIED** |
| **F-04** | Categorical Revocation & Inactivity | `scripts/verify_governance.js`, `.py` | `test/02_revocation_and_inactivity.test.js` (Casos 2.1 to 2.7) | **VERIFIED** |
| **F-05** | Modular Export & CLI Isolation | `scripts/verify_governance.js` | `test/01` to `06`, `test/06_cli_execution.test.js` (Casos 6.1, 6.3) | **VERIFIED** |
| **F-06** | Cryptographic Signature Verification | `scripts/verify_governance.js` | `test/03_cryptographic_signatures.test.js` (Casos 3.1 to 3.7) | **VERIFIED** |
| **F-07** | Defensive Parsing & Path Containment | `scripts/verify_governance.js`, `.py` | `test/05_security_regressions.test.js` (Casos 5.1 to 5.8) | **VERIFIED** |
| **F-08** | Python Script Parity | `scripts/verify_governance.py` | Architecture parity verified, fail-closed logic aligned | **VERIFIED** |
| **F-09** | Root Package Configuration | `package.json` | `package.json` scripts (`"test": "node --test"`) | **VERIFIED** |
| **F-10** | Quorum Validation Tests | `test/01_quorum_validation.test.js` | 9 automated test cases | **VERIFIED** |
| **F-11** | Revocation & Inactivity Tests | `test/02_revocation_and_inactivity.test.js` | 7 automated test cases | **VERIFIED** |
| **F-12** | Cryptographic Signature Tests | `test/03_cryptographic_signatures.test.js` | 7 automated test cases | **VERIFIED** |
| **F-13** | Heuristics Integrity & Anti-Whitelist Tests | `test/04_heuristics_integrity.test.js` | 8 automated test cases | **VERIFIED** |
| **F-14** | Security Regressions Tests | `test/05_security_regressions.test.js` | 8 automated test cases | **VERIFIED** |
| **F-15** | CLI Execution Tests | `test/06_cli_execution.test.js` | 4 automated test cases | **VERIFIED** |
| **F-16** | E2E 100% Test Pass & Forensic Audit | Full Workspace & Test Suite | 43 automated tests, 100% pass rate, CLEAN verdict | **VERIFIED** |

---

## 4. Test Runner Commands & Configuration

### 4.1 Native Execution Commands
The test runner requires no external package managers, bundlers, or binary downloads. Any environment with Node.js $\ge 18.0.0$ executes the suite natively.

```bash
# 1. Run full test suite via npm
npm test

# 2. Run full test suite directly via Node.js native test runner
node --test

# 3. Run individual test suites
node --test test/01_quorum_validation.test.js
node --test test/02_revocation_and_inactivity.test.js
node --test test/03_cryptographic_signatures.test.js
node --test test/04_heuristics_integrity.test.js
node --test test/05_security_regressions.test.js
node --test test/06_cli_execution.test.js

# 4. Run with specialized output reporters
node --test --test-reporter=spec
node --test --test-reporter=tap

# 5. Standalone CLI verifiers
npm run verify:governance      # or: node scripts/verify_governance.js
npm run verify:heuristics      # or: node scripts/verify_heuristics.js
python scripts/verify_governance.py
```

### 4.2 Cross-Platform Environment Compatibility
The test suite is fully normalized for Windows (PowerShell/CMD), Linux, and macOS:
- Path separators: Uses `path.sep` and `path.normalize()` for path operations.
- Platform case-insensitivity: Windows file paths are normalized (`caminhoNorm = path.normalize(caminhoResolvido).toLowerCase()`) to ensure consistent containment checks across operating systems.
- Line endings: Handled via regex `/\r?\n/` to support both CRLF (`\r\n`) and LF (`\n`).

---

## 5. Pass/Fail Semantics & Result Interpretation

### 5.1 Exit Code Contract
- **Exit Code `0`:** All 43 test cases executed and passed without assertion errors or unhandled exceptions. Quorum verification succeeded, all heuristics conform to CIP-0002, and zero forbidden terms or bypass clauses were detected.
- **Exit Code `1`:** One or more assertions failed, an unexpected exception was thrown, a revoked or inactive key was improperly accepted, a malformed heuristic passed validation, or a CLI command exited with failure.

### 5.2 Diagnostic Output Contract
When executing `node scripts/verify_governance.js`, the standard output produces structured diagnostic logs:
```text
=================================================================
  VERIFICADOR DE QUÓRUM CRIPTOGRÁFICO MULTI-SETORIAL
=================================================================

Status de Homologação: ✅ APROVADO PARA MERGE
Total de Assinaturas Válidas: 3
Pilares Distintos Representados: 3

Detalhamento dos Votos Registrados:
  • [TECNOLOGIA_E_CRIPTOGRAFIA] tech-node-01 (Open Knowledge Brasil)
  • [JORNALISMO_INVESTIGATIVO] press-node-01 (Abraji)
  • [AUDITORIA_E_CONTROLE_SOCIAL] audit-node-01 (Transparência Brasil)
```

When executing `node scripts/verify_heuristics.js`:
```text
=================================================================
  VERIFICADOR DE HEURÍSTICAS E CONFORMIDADE CIP-0002
=================================================================

Total de Regras Auditadas: 1
Status: ✅ TODAS AS HEURÍSTICAS VÁLIDAS E EM CONFORMIDADE (CIP-0002)
```

### 5.3 Test Assertions Strictness
All tests utilize `node:assert/strict`:
- Numerical counters are evaluated using `assert.equal(actual, expected)`.
- Rejection messages are verified using regex pattern matching (`assert.match(actual, regex)`).
- Error throwing behaviors are strictly tested using `assert.throws(fn, regex)`.
- Fail-closed conditions are confirmed by asserting `assert.equal(resultado.aprovado, false)` and validating the length and member IDs of security rejection arrays (`chavesRevogadasDetectadas`, `chavesInativasDetectadas`, `assinaturasCorrompidasDetectadas`).
