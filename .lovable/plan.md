

## Plan: Suporte robusto a múltiplos Outputs simultâneos

### Problema
Cada Output espera passivamente por um "join" da câmera (re-anunciado a cada 5s). Se o segundo output abrir entre re-anúncios, fica sem vídeo até o próximo ciclo. Além disso, não há mecanismo para o Output pedir às câmeras que se re-anunciem.

### Solução
Adicionar um sinal `"request-join"` que o Output envia ao conectar-se ao canal. As câmeras, ao receberem esse sinal, re-enviam o "join" imediatamente, permitindo que qualquer novo Output descubra todas as câmeras instantaneamente.

### Alterações

**1. `src/lib/signaling.ts`**
- Adicionar `"request-join"` ao tipo `SignalType`

**2. `src/pages/OutputPage.tsx`**
- Após subscrever ao canal, enviar `{ type: "request-join", from: outputId }` para que todas as câmeras respondam com "join"

**3. `src/pages/CameraPage.tsx`**
- No handler de mensagens, adicionar caso para `"request-join"`: ao receber, re-enviar o sinal "join" com o nome do participante

### Resultado
- Múltiplos outputs abertos simultaneamente (mesmo link, diferentes abas/browsers/máquinas)
- Cada output descobre todas as câmeras em <1 segundo
- Sem impacto no fluxo existente

