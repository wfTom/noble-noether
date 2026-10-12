# Original User Request

## Initial Request — 2026-09-18T22:05:17-03:00

Auditar exaustivamente o código-fonte, heurísticas antifraude, scripts de governança e integridade do repositório, identificando e corrigindo bugs gerais e vulnerabilidades de segurança, além de implementar uma suíte de testes automatizados para assegurar a qualidade e conformidade contínua do sistema.

Working directory: c:/Users/Tom/Documents/antigravity/noble-noether
Integrity mode: development

## Requirements

### R1. Auditoria de Segurança e Correção de Vulnerabilidades
Examinar todos os scripts, consultas SQL e configurações do repositório em busca de potenciais vulnerabilidades (injeção de código/SQL, caminhos inseguros de arquivos, vazamento de credenciais e integridade de parsing) e aplicar correções defensivas.

### R2. Detecção e Correção de Bugs Gerais e Análise de Código
Identificar e corrigir quaisquer erros de lógica, inconsistências de tipo, problemas de tratamento de exceções ou falhas de compatibilidade nos scripts existentes em `scripts/` e em novas implementações.

### R3. Garantia de Conformidade com Governança e Regras Antifraude
Auditar minuciosamente as regras declarativas em `heuristics/` e o arquivo `.github/maintainers.json` para assegurar que estejam 100% alinhados às especificações CIP-0001 e CIP-0002, sem exceções maliciosas (*whitelists* ocultas) que possam blindar alvos de investigação.

### R4. Implementação de Suíte de Testes Automatizados
Desenvolver e executar uma suíte de testes automatizados abrangente (usando o Node.js Test Runner nativo `node --test` ou ferramentas padrão) para validar casos de sucesso, rejeição de quórum inválido, assinaturas corrompidas e integridade das heurísticas.

## Acceptance Criteria

### Segurança e Integridade
- [ ] O script de validação de quórum rejeita categoricamente chaves revogadas, inativas, ausência de pilares obrigatórios ou estruturas de dados corrompidas.
- [ ] Todas as regras em `heuristics/` seguem estritamente o esquema CIP-0002 e não contêm cláusulas de isenção de CNPJs ou pessoas físicas.

### Qualidade e Testes Automatizados
- [ ] Uma suíte de testes automatizados está implementada e executável localmente via comando simples (ex: `node --test`).
- [ ] 100% dos testes automatizados passam com sucesso no ambiente local.
- [ ] Todos os scripts em `scripts/` executam de forma limpa, sem erros de sintaxe ou exceções não tratadas.
