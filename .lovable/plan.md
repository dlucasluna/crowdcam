

# CrowdCam -- 100% Online, Zero Dependencias Externas

## Resumo

Recriar o CrowdCam inteiramente na Lovable, usando **WebRTC nativo** (sem LiveKit) e **Supabase Realtime** como servidor de sinalizacao. Nenhum programa externo necessario.

## Como funciona sem LiveKit

O LiveKit era um servidor SFU (Selective Forwarding Unit) para video. Vamos substitui-lo por:

- **WebRTC peer-to-peer nativo** do browser para transmitir video
- **Supabase Realtime Channels** como servidor de sinalizacao (trocar offers/answers/ICE candidates)
- **STUN servers publicos gratuitos** (Google) para NAT traversal

```text
┌──────────────────────────────────────────────┐
│  Frontend (Lovable)                          │
│  ┌──────┐ ┌───────┐ ┌───────┐ ┌──────────┐  │
│  │ Home │ │ Admin │ │Camera │ │  Output  │  │
│  └──────┘ └───────┘ └───────┘ └──────────┘  │
│         WebRTC P2P (video direto)            │
└─────────┬────────────────────────────────────┘
          │ Sinalizacao (offer/answer/ICE)
          ▼
┌─────────────────────┐
│ Supabase Realtime   │
│ (Channels/Broadcast)│
└─────────────────────┘
```

## Infraestrutura Lovable Cloud

- **Supabase Realtime Channels**: sinalizacao WebRTC + sync de estado (qual camera esta selecionada)
- **Supabase Database**: tabela `rooms` para persistir salas ativas
- **Sem Edge Functions**: tudo roda no frontend, sem necessidade de tokens

## Paginas (4 rotas)

| Rota | Quem usa | Funcao |
|------|----------|--------|
| `/` | Admin | Criar sala (gera codigo 6 chars) ou entrar como camera |
| `/admin/:roomId` | Admin | Grid de cameras, selecionar feed ativo, QR code |
| `/cam/:roomId` | Publico | Ativa camera do celular, controlos (zoom, lanterna, exposicao) |
| `/output/:roomId` | OBS/Telao | Fullscreen com o feed selecionado + lower third |

## Fluxo WebRTC

1. Camera entra na sala → envia `join` via Supabase Realtime channel
2. Admin/Output recebem o `join` → criam `RTCPeerConnection` e enviam `offer`
3. Camera responde com `answer` + trocam ICE candidates via channel
4. Video flui diretamente peer-to-peer (sem servidor de video)
5. Admin seleciona camera → envia `select` event via channel → Output muda o feed

## O que sera construido

1. **Ativar Lovable Cloud** (Supabase) para Realtime
2. **Tabela `rooms`** no Supabase (id, code, created_at, is_active)
3. **Modulo `webrtc.ts`** -- wrapper para criar peer connections, gerir offers/answers/ICE via Supabase Realtime
4. **Modulo `signaling.ts`** -- abstrai a comunicacao via Supabase channels (join, offer, answer, ice, select)
5. **Pagina Home** -- criar sala ou entrar com codigo
6. **Componente QRModal** -- QR code com link da sala
7. **Pagina Camera** -- captura video, controlos avancados, envia via WebRTC
8. **Pagina Admin** -- grid de feeds, selecionar camera ativa, botao QR, botao output
9. **Pagina Output** -- fullscreen, lower third, recebe feed selecionado
10. **Theme escuro** -- visual identico ao original (fundo #0a0a0a, accent azul)

## Dependencias npm (apenas bibliotecas JS, zero programas externos)

- `qrcode.react` -- gerar QR codes no browser

## Limitacoes vs LiveKit

- **Escala**: WebRTC P2P funciona bem ate ~10-15 cameras simultaneas (cada viewer precisa de uma conexao por camera). Para eventos grandes, LiveKit seria melhor, mas para a maioria dos eventos e suficiente.
- **NAT**: STUN publico funciona na maioria dos casos. Em redes muito restritivas, seria preciso TURN (pode-se adicionar depois).
- **Latencia**: Excelente (~100-300ms), melhor que LiveKit por ser direto.

## Ordem de implementacao

1. Ativar Lovable Cloud + criar tabela `rooms`
2. Configurar theme escuro no `index.css`
3. Criar modulos `signaling.ts` e `webrtc.ts`
4. Criar pagina Home + QRModal
5. Criar pagina Camera
6. Criar pagina Admin
7. Criar pagina Output
8. Configurar rotas no App.tsx

