#!/usr/bin/env python3
"""
Script de Verificação de Governança e Quórum Multi-Setorial (Estilo Bitcoin Core)

Verifica se um conjunto de aprovações/assinaturas em um Pull Request ou Commit
atende ao quórum obrigatório dos 4 pilares:
1. Tecnologia / Software Livre
2. Jornalismo Investigativo
3. Pesquisa Acadêmica
4. Auditoria / Controle Social
"""

import json
import os
import sys
from pathlib import Path
from typing import Any, Dict, List, Optional, Union

REPO_ROOT = Path(__file__).resolve().parent.parent
DEFAULT_MAINTAINERS_FILE = REPO_ROOT / ".github" / "maintainers.json"


def validar_estrutura_config(config: Any) -> None:
    """Valida a estrutura do arquivo de mantenedores."""
    if not isinstance(config, dict):
        raise ValueError("Estrutura de mantenedores inválida: esperado objeto JSON.")
    if "quorum_policy" not in config or not isinstance(config["quorum_policy"], dict):
        raise ValueError("Política de quórum ausente ou inválida.")
    if "pillars" not in config or not isinstance(config["pillars"], dict):
        raise ValueError("Pilares ausentes ou inválidos na configuração.")

    politica = config["quorum_policy"]
    if not isinstance(politica.get("min_total_signatures"), int) or politica["min_total_signatures"] < 1:
        raise ValueError("min_total_signatures inválido na política de quórum.")
    if not isinstance(politica.get("min_distinct_pillars"), int) or politica["min_distinct_pillars"] < 1:
        raise ValueError("min_distinct_pillars inválido na política de quórum.")


def carregar_mantenedores(caminho_arquivo: Optional[Union[str, Path]] = None) -> Dict[str, Any]:
    """
    Carrega o arquivo de mantenedores garantindo contenção dentro da raiz do repositório.
    Lança exceções defensivas sem encerrar o processo abruptamente.
    """
    caminho = Path(caminho_arquivo).resolve() if caminho_arquivo else DEFAULT_MAINTAINERS_FILE.resolve()

    # Verificação estrita de contenção de caminho contra Path Traversal
    try:
        caminho.relative_to(REPO_ROOT)
    except ValueError:
        raise PermissionError(f"[SEGURANÇA] Caminho fora da raiz do repositório: {caminho}")

    if not caminho.exists():
        raise FileNotFoundError(f"Arquivo de mantenedores não encontrado: {caminho}")

    try:
        with open(caminho, "r", encoding="utf-8") as f:
            config = json.load(f)
    except json.JSONDecodeError as err:
        raise ValueError(f"Erro ao parsear mantenedores JSON: {err}")

    validar_estrutura_config(config)
    return config


def validar_quorum(chaves_assinadas: Any, config_custom: Optional[Dict[str, Any]] = None) -> Dict[str, Any]:
    """
    Valida o quórum de aprovação com rejeição categórica de chaves revogadas ou inativas (fail closed).
    """
    if not isinstance(chaves_assinadas, list):
        return {
            "aprovado": False,
            "motivo_rejeicao": "Entrada inválida: chaves_assinadas deve ser uma lista.",
            "total_assinaturas_validas": 0,
            "total_pilares_distintos": 0,
            "pilares_presentes": [],
            "membros_assinantes": [],
            "chaves_revogadas_detectadas": [],
            "chaves_inativas_detectadas": [],
            "requisito_tecnico_atendido": False,
            "requisito_substantivo_atendido": False,
        }

    try:
        config = config_custom if config_custom is not None else carregar_mantenedores()
        validar_estrutura_config(config)
    except Exception as err:
        return {
            "aprovado": False,
            "motivo_rejeicao": f"Falha na configuração de governança: {err}",
            "total_assinaturas_validas": 0,
            "total_pilares_distintos": 0,
            "pilares_presentes": [],
            "membros_assinantes": [],
            "chaves_revogadas_detectadas": [],
            "chaves_inativas_detectadas": [],
            "requisito_tecnico_atendido": False,
            "requisito_substantivo_atendido": False,
        }

    pilares = config.get("pillars", {})
    politica = config.get("quorum_policy", {})

    chaves_revogadas = []
    chaves_inativas = []
    chaves_validas = []
    pilares_atingidos = set()
    membros_processados = set()

    for item in chaves_assinadas:
        chave_str = None
        id_str = None
        if isinstance(item, str):
            chave_str = item.strip()
            id_str = item.strip()
        elif isinstance(item, dict):
            chave_str = item.get("chave_publica") or item.get("publicKey") or item.get("chave")
            id_str = item.get("id") or item.get("membro_id")

        if not chave_str and not id_str:
            continue

        # Localizar membro correspondente na estrutura de pilares
        membro_encontrado = None
        pilar_encontrado = None

        for pilar_nome, pilar_info in pilares.items():
            for membro in pilar_info.get("membros", []):
                match = False
                if id_str and membro.get("id") == id_str:
                    match = True
                elif chave_str and membro.get("chave_publica") == chave_str:
                    match = True

                if match:
                    membro_encontrado = membro
                    pilar_encontrado = pilar_nome
                    break
            if membro_encontrado:
                break

        if membro_encontrado:
            status = membro_encontrado.get("status")
            if status == "revogado":
                chaves_revogadas.append({
                    "id": membro_encontrado.get("id"),
                    "pilar": pilar_encontrado,
                    "chave": membro_encontrado.get("chave_publica")
                })
            elif status != "ativo":
                chaves_inativas.append({
                    "id": membro_encontrado.get("id"),
                    "pilar": pilar_encontrado,
                    "chave": membro_encontrado.get("chave_publica"),
                    "status": status
                })
            else:
                membro_id = membro_encontrado.get("id")
                if membro_id not in membros_processados:
                    membros_processados.add(membro_id)
                    pilares_atingidos.add(pilar_encontrado)
                    chaves_validas.append({
                        "id": membro_id,
                        "pilar": pilar_encontrado,
                        "org": membro_encontrado.get("organizacao"),
                        "chave": membro_encontrado.get("chave_publica")
                    })

    # Regra de Segurança Fail-Closed: Rejeição categórica de chaves revogadas
    if chaves_revogadas:
        return {
            "aprovado": False,
            "motivo_rejeicao": f"REJEIÇÃO DE SEGURANÇA: {len(chaves_revogadas)} chave(s) revogada(s) detectada(s).",
            "total_assinaturas_validas": len(chaves_validas),
            "total_pilares_distintos": len(pilares_atingidos),
            "pilares_presentes": list(pilares_atingidos),
            "membros_assinantes": chaves_validas,
            "chaves_revogadas_detectadas": chaves_revogadas,
            "chaves_inativas_detectadas": chaves_inativas,
            "requisito_tecnico_atendido": "tecnologia_e_criptografia" in pilares_atingidos,
            "requisito_substantivo_atendido": bool(pilares_atingidos.intersection({"jornalismo_investigativo", "auditoria_e_controle_social"})),
        }

    # Regra de Segurança Fail-Closed: Rejeição categórica de chaves inativas
    if chaves_inativas:
        return {
            "aprovado": False,
            "motivo_rejeicao": f"REJEIÇÃO DE SEGURANÇA: {len(chaves_inativas)} chave(s) inativa(s) detectada(s).",
            "total_assinaturas_validas": len(chaves_validas),
            "total_pilares_distintos": len(pilares_atingidos),
            "pilares_presentes": list(pilares_atingidos),
            "membros_assinantes": chaves_validas,
            "chaves_revogadas_detectadas": chaves_revogadas,
            "chaves_inativas_detectadas": chaves_inativas,
            "requisito_tecnico_atendido": "tecnologia_e_criptografia" in pilares_atingidos,
            "requisito_substantivo_atendido": bool(pilares_atingidos.intersection({"jornalismo_investigativo", "auditoria_e_controle_social"})),
        }

    total_assinaturas = len(chaves_validas)
    total_pilares = len(pilares_atingidos)
    tem_tech = "tecnologia_e_criptografia" in pilares_atingidos

    substantive_pillars = set(politica.get("substantive_pillars", [
        "jornalismo_investigativo",
        "auditoria_e_controle_social"
    ]))
    tem_substantivo = bool(pilares_atingidos.intersection(substantive_pillars))

    min_total = politica.get("min_total_signatures", 3)
    min_distinct = politica.get("min_distinct_pillars", 3)
    req_tech = politica.get("require_tech_pillar", True)
    req_subst = politica.get("require_substantive_pillar", True)

    aprovado = True
    motivo_rejeicao = None

    if total_assinaturas < min_total:
        aprovado = False
        motivo_rejeicao = "Quórum insuficiente: total de assinaturas válidas abaixo do mínimo exigido."
    elif total_pilares < min_distinct:
        aprovado = False
        motivo_rejeicao = "Quórum insuficiente: diversidade de pilares abaixo do mínimo exigido."
    elif req_tech and not tem_tech:
        aprovado = False
        motivo_rejeicao = "Quórum insuficiente: pilar obrigatório de tecnologia_e_criptografia ausente."
    elif req_subst and not tem_substantivo:
        aprovado = False
        motivo_rejeicao = "Quórum insuficiente: pilar substantivo obrigatório ausente."

    return {
        "aprovado": aprovado,
        "motivo_rejeicao": motivo_rejeicao,
        "total_assinaturas_validas": total_assinaturas,
        "total_pilares_distintos": total_pilares,
        "pilares_presentes": list(pilares_atingidos),
        "membros_assinantes": chaves_validas,
        "chaves_revogadas_detectadas": chaves_revogadas,
        "chaves_inativas_detectadas": chaves_inativas,
        "requisito_tecnico_atendido": tem_tech,
        "requisito_substantivo_atendido": tem_substantivo,
    }


if __name__ == "__main__":
    print("=" * 65)
    print("  VERIFICADOR DE QUÓRUM CRIPTOGRÁFICO MULTI-SETORIAL")
    print("=" * 65)

    # Exemplo de teste de simulação com 3 chaves de 3 pilares diferentes:
    chaves_exemplo = [
        "ssh-ed25519 AAAAC3NzaC1lZDI1NTE5AAAAIGov3eEXAMPLEPUBLICKEYCIVICTECH01",
        "ssh-ed25519 AAAAC3NzaC1lZDI1NTE5AAAAIGov3eEXAMPLEPUBLICKEYPRESS01",
        "ssh-ed25519 AAAAC3NzaC1lZDI1NTE5AAAAIGov3eEXAMPLEPUBLICKEYAUDIT01"
    ]

    resultado = validar_quorum(chaves_exemplo)
    print(f"\nStatus de Homologação: {'✅ APROVADO PARA MERGE' if resultado['aprovado'] else '❌ REJEITADO (QUÓRUM INSUFICIENTE)'}")
    if resultado.get("motivo_rejeicao"):
        print(f"Motivo: {resultado['motivo_rejeicao']}")
    print(f"Total de Assinaturas Válidas: {resultado['total_assinaturas_validas']}")
    print(f"Pilares Distintos Representados: {resultado['total_pilares_distintos']}")
    print("\nDetalhamento dos Votos Registrados:")
    for m in resultado.get("membros_assinantes", []):
        print(f"  • [{m['pilar'].upper()}] {m['id']} ({m['org']})")

    if not resultado["aprovado"]:
        sys.exit(1)
