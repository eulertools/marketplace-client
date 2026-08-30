# marketplace-client

WebSocket listener for Euler OTC/marketplace contract events, plus a GitHub → ECR CDK pipeline. Archived snapshot, as-is.

This tree is a **new public commit** with no git history. The original private archive is `eulertools/marketplace-client-archive`.

## What was built (EN)

`services/` connects to a node websocket, decodes `CreateSale` / `Buy` / `Cancel` / `Claim`, resolves token metadata via TokenInfo, and writes to DynamoDB. `pipelines/` is CodePipeline + CodeBuild. Wallet/RPC from env (`.env.example`). AWS account id in the CDK branch selector was replaced with `CDK_DEV_ACCOUNT`.

## Qué se construyó (ES)

Listener de eventos del marketplace y pipeline CDK. Sin secretos de cuenta AWS.

## Deployments

From `services/.env.example` (BSC testnet):

| Contract | Address |
|---|---|
| Marketplace | `0x4134e2a8fad6222c914805dcce9f095cbc6368a7` |

No mainnet address is recorded in this tree.

---

## Notice / Aviso

**Euler Tools ha cerrado. Euler Tools is closed.**

La empresa quebró. Este repositorio está archivado y no se mantiene. El software se ofrece tal cual (as is), sin garantía ni soporte. Parte del material puede ser reclamado por acreedores.

The company went bankrupt. This repository is archived and unmaintained. Software is provided as is, with no warranty and no support. Some material may be claimed by creditors.

Site: https://euler.tools  
Org: https://github.com/eulertools  
Enquiries: https://sinequix.com · https://github.com/tebayoso
