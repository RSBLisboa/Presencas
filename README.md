# Presenças RSB Lisboa

App web (PWA) para validação de presenças em sessões técnicas do **Regimento de Sapadores Bombeiros de Lisboa**, alojada em GitHub Pages.

Funciona em qualquer tablet/telemóvel/portátil com browser. Cada toque numa linha marca/desmarca presença e sincroniza automaticamente com o repositório GitHub. O Access faz pull deste estado após o evento e dispara emissão de certificados + envio de emails num único clique.

---

## Como se encaixa no fluxo do evento

```
┌─────────────────────────────────────────────────────────────────────┐
│  ANTES do evento                                                     │
│  ────────────────                                                    │
│  Access  ──[modIntegra_Presencas.blnPublicarInscritos]──▶  GitHub    │
│             escreve  data/inscritos.json                             │
│                                                                      │
│  DURANTE o evento                                                    │
│  ────────────────                                                    │
│  Tablet (este index.html)  ◀──┐                                      │
│      lê inscritos.json        │  Múltiplos tablets podem coexistir;  │
│      escreve presencas.json   │  conflitos resolvem-se via SHA do    │
│      após cada toque          │  GitHub e merge last-write-wins.     │
│                               │                                      │
│  GitHub  ──data/presencas.json──┘                                    │
│                                                                      │
│  DEPOIS do evento                                                    │
│  ────────────────                                                    │
│  Access  ──[pFecharEventoEEnviar]:                                   │
│      1. pull data/presencas.json                                     │
│      2. emite certificados aos presentes                             │
│      3. envia emails (Outlook)                                       │
│      4. publica certs.json no repo Certificados                      │
└─────────────────────────────────────────────────────────────────────┘
```

---

## Estrutura do repositório

```
/
├── index.html                     ← App principal (PWA)
├── manifest.webmanifest           ← Metadata PWA (instalação no tablet)
├── sw.js                          ← Service worker (offline cache do shell)
├── data/
│   ├── inscritos.example.json     ← Schema/exemplo
│   ├── presencas.example.json     ← Schema/exemplo
│   ├── inscritos.json             ← (gerado pelo Access antes do evento)
│   └── presencas.json             ← (escrito pela app durante o evento)
├── assets/
│   ├── rsb-brasao.png
│   ├── lisboa-cml-transparent.png
│   └── cabecalho.png
└── README.md
```

---

## Setup — primeira instalação

### 1. Criar o repositório no GitHub

1. `https://github.com/new` → nome: `Presencas`, owner: `RSBLisboa`, **Public** (para Pages funcionar sem subscrição), sem README/license/gitignore.
2. Copiar o conteúdo desta pasta (`APP/Github/Presencas/`) para a raiz do repositório local clonado e fazer push:
   ```bash
   git clone https://github.com/RSBLisboa/Presencas.git
   # copiar ficheiros desta pasta para o clone
   git add . && git commit -m "Initial PWA + service worker" && git push
   ```
3. **Settings → Pages**: source = `Deploy from a branch`, branch = `main`, folder = `/ (root)`. Save.
4. Em ~1 minuto, a app fica em `https://rsblisboa.github.io/Presencas/`.

> Verificação: abrir `https://rsblisboa.github.io/Presencas/` deve mostrar o ecrã de login (PIN + Token).

### 2. Criar o fine-grained PAT (token GitHub)

1. `https://github.com/settings/personal-access-tokens/new`
2. **Token name**: `RSB-Presencas-2026-05-18`
3. **Resource owner**: a tua conta (ou organização) — a mesma que detém `RSBLisboa`
4. **Expiration**: até 2 dias após o evento (ex.: 2026-05-20). **Não usar tokens com expiração longa.**
5. **Repository access**: *Only select repositories* → escolher `Presencas` **e** `Certificados`.
6. **Permissions** → **Repository permissions**:
   - **Contents**: `Read and write`
   - (todas as outras: `No access`)
7. Generate token, copiar **uma vez** e guardar em sítio seguro (vai ser dado a quem tem o tablet à porta + colado em `tblConfiguracao.GITHUB_TOKEN` no Access).

> ⚠️ O token vê-se uma única vez. Se o perderes, gera-se outro.

### 3. Configurar o PIN

O PIN é a barreira contra acesso acidental por quem encontre o URL. **Não é segurança forte** — quem souber ler JS vê o hash. Serve apenas para um evento controlado.

#### Gerar o hash do novo PIN

Abrir DevTools (F12) em qualquer browser, na consola correr:

```js
(async pin => {
  const buf = new TextEncoder().encode(pin);
  const h = await crypto.subtle.digest('SHA-256', buf);
  console.log(Array.from(new Uint8Array(h)).map(b => b.toString(16).padStart(2,'0')).join(''));
})('TEU-PIN-AQUI')
```

Copiar o hex impresso.

#### Editar `index.html`

Procurar a constante `pinHash` em `CONFIG`:

```js
pinHash: '03ac674216f3e15c761ee1a5e255f067953623c8b388b4459e13f978d7c846f4',
```

Substituir pelo hash novo, commit + push.

> O hash default actual corresponde ao PIN `1234`. **MUDAR ANTES DO EVENTO.**

### 4. Configurar o Access

1. Confirmar que tens **`Gestão de Eventos.accdb`** funcional (passos 1–4 do `APP/README.md`).
2. **Importar os módulos novos** (no VBE: File > Import File…):
   - `src/modIntegra_Presencas.bas` (novo)
3. **Re-importar os módulos modificados** (Remove + Import):
   - `src/modIntegra_GitHubPages.bas` (agora inclui `blnPublicarCertsViaAPI`)
4. **Aplicar o patch 06** — no Imediato (Ctrl+G):
   ```vba
   ' Importar primeiro o script (Insert Module → cola scripts/06_AdicionarPresencas.bas)
   Call AplicarPatch06_Presencas
   ```
   Resultado: novas chaves em `tblConfiguracao` e `frmEmissaoCertificados` reconstruído com 4 botões + botão de workflow completo.
5. **Preencher `GITHUB_TOKEN`** em `tblConfiguracao`:
   - Abrir `tblConfiguracao` em vista de tabela
   - Localizar linha `GITHUB_TOKEN`
   - Colar o PAT no campo `Valor`
6. Confirmar `GITHUB_OWNER` (default `RSBLisboa`), `GITHUB_REPO_PRESENCAS` (default `Presencas`), `GITHUB_REPO_CERTIFICADOS` (default `Certificados`), `GITHUB_BRANCH` (default `main`).

### 5. Teste de fim-a-fim (recomendado, dias antes do evento)

1. **Access**: `frmEmissaoCertificados` → **1. Publicar inscritos** — deve produzir um `data/inscritos.json` no repo (até 1 minuto para o Pages refrescar).
2. **Tablet**: abrir `https://rsblisboa.github.io/Presencas/`, login com PIN + token.
3. Marcar 2–3 presenças de teste, confirmar que o indicador de sync pisa verde.
4. No GitHub: ver que `data/presencas.json` foi commitado.
5. **Access**: `frmEmissaoCertificados` → **2. Sincronizar presenças** — deve marcar `Presente=True` nas inscrições escolhidas.
6. **Reverter**: na app, "Marcar todos ausentes" + Sincronizar de novo.

---

## Operação no dia do evento

### Antes da abertura de portas

1. **Access**: `frmEmissaoCertificados` → **1. Publicar inscritos**.
   - Confirma `inscritos.json` actualizado no repo (qualquer alteração de inscrições de última hora exige nova publicação).

### Check-in (porta)

1. Tablet com a PWA aberta em `rsblisboa.github.io/Presencas/`. Em iPad/Android dá para "Adicionar ao ecrã principal" — fica em fullscreen como app nativa.
2. Login (PIN + token) — basta uma vez por sessão; o token é guardado apenas em `sessionStorage` (apaga ao fechar o separador).
3. Pesquisar nome → **toque na linha** marca presente (linha verde + hora). Toque de novo desmarca.
4. Indicador de sync no topo:
   - 🟢 **Sincronizado** — tudo bem
   - 🟡 **Alterações por sincronizar…** — debounce em curso, normal
   - 🔴 **Falha de sync** — verifica rede; volta a tentar sozinho em 8 s
   - ⚪ **Offline** — toques continuam a funcionar e sincronizam quando voltar a haver rede
5. Múltiplos tablets podem coexistir — a app lê o estado do servidor a cada 20 s. Cada toque é o "carimbo" final, last-write-wins.

### Pós-evento

1. **Access**: `frmEmissaoCertificados` → **▶ FECHAR EVENTO E ENVIAR** (botão grande).
   - Confirma a operação no diálogo.
   - O sistema corre, em sequência:
     1. Pull de `presencas.json` → marca `tblInscricao.Presente`
     2. Emite certificados (gera nº `AAAA/NNNN`, link com hash) para todos os presentes
     3. Envia emails via Outlook (template `Certificado` em `tblTemplateEmail`)
     4. Publica `certs.json` no repo Certificados
   - Resumo no fim com totais.
2. Auditoria em `tblAudit` (entrada `Workflow_FecharEvento`).

> Os 4 passos também correm individualmente — útil se quiseres reenvio manual ou inspecção entre passos.

### Após o evento (limpeza)

1. **Revogar o PAT** em `https://github.com/settings/personal-access-tokens` (ou deixar expirar).
2. Apagar `GITHUB_TOKEN` em `tblConfiguracao`.
3. Limpar localStorage do tablet (menu da app → "Terminar sessão") ou desinstalar a PWA.

---

## Schemas

### `data/inscritos.json` (Access → repo)

```json
{
  "schema": "inscritos@1",
  "evento": {
    "id": 1,
    "titulo": "Sessão Técnica em Substâncias Perigosas",
    "data": "2026-05-18",
    "local": "Auditório do Metropolitano de Lisboa",
    "horaInicio": "09:00",
    "horaFim": "12:00",
    "cargaHoraria": "3 horas"
  },
  "exportadoEm": "2026-05-17T18:00:00",
  "inscritos": [
    {
      "id": 101,
      "nome": "João Silva",
      "cargo": "Bombeiro Sapador",
      "entidade": "RSB Lisboa",
      "categoria": "Bombeiros Profissionais",
      "estado": "Confirmada"
    }
  ]
}
```

### `data/presencas.json` (PWA → repo)

```json
{
  "schema": "presencas@1",
  "eventoId": 1,
  "actualizadoEm": "2026-05-18T11:45:00",
  "versao": 17,
  "marcacoes": [
    {
      "idInscricao": 101,
      "presente": true,
      "horaEntrada": "2026-05-18T09:13:42",
      "marcadoPor": "tablet-porta"
    }
  ]
}
```

> O `id` em `inscritos[]` é o `IDInscricao` do Access (não o `IDParticipante`) — assim a sync é directa, sem joins.

---

## Arquitectura e decisões

| Decisão | Razão |
|---|---|
| **PWA com `service-worker`** em vez de app nativa | Funciona em qualquer plataforma sem licença/distribuição. Pode ser instalada no tablet como app fullscreen. |
| **GitHub Pages como host** | Mesma infra-estrutura dos certificados. Gratuito, HTTPS automático, alta disponibilidade. |
| **GitHub REST API como persistência** | Sem servidor próprio. Cada tablet escreve directamente. Histórico Git dá auditoria gratuita. |
| **Fine-grained PAT em `sessionStorage`** | Não persiste em disco. Apaga quando o separador fecha. Tem TTL curto (1–2 dias) para reduzir blast-radius. |
| **PIN + hash SHA-256** em vez de OAuth | Suficiente para um evento fechado num venue controlado. OAuth seria overkill e exigiria backend. |
| **Last-write-wins** para conflitos | Marcação de presença é idempotente em essência — dois tablets a marcar a mesma pessoa convergem. Conflitos detectam-se via SHA e resolvem-se com refetch + merge. |
| **Polling 20 s** em vez de webhooks/SSE | Sem servidor, polling é a única opção. 20 s é equilíbrio entre frescura e quotas da API. |
| **localStorage como fallback** | Se o GitHub estiver down ou rede cair, marcações ficam locais e empurram quando voltar — não se perde nada. |
| **Schema versionado (`@1`)** | Permite evoluir formato sem quebrar instâncias antigas. |
| **PWA mostra `inscritos.json` sem token** | Ficheiro é público (repo é Public para Pages). Não contém PII sensível além de nome+cargo+entidade. Email **não** está no JSON. |
| **`presencas.json` requer token para escrever** | Só quem tem o PAT consegue commitar. Quem só tem o link só consegue ver (ler). |

---

## Limites e riscos

### Críticos

- **Quota da GitHub API**: 5000 pedidos/hora por token. Cada toque na app gera no máximo 1 PUT (debounced 1.5 s). 48 inscritos × 5 toques ≈ 240 pedidos — confortavelmente dentro do limite.
- **Token comprometido**: PAT vê-se em DevTools → sessionStorage. Mitigação: TTL curto (1–2 dias), scope mínimo (só estes 2 repos, só Contents:write), revogação obrigatória após evento.
- **Repo público**: `inscritos.json` fica visível na internet para quem souber o URL. Antes de publicar, considerar se algum dos campos (nome+entidade) é sensível para o caso. Se for, mudar repo para Private + GitHub Pro/Team (Pages em repos privados não são gratuitos).

### Não-críticos

- **Conflitos com 3+ tablets simultâneos**: o protocolo PUT-com-SHA + retry resolve, mas em rajadas pode demorar segundos. Para 1–2 tablets em check-in normal, irrelevante.
- **Latência de propagação Pages**: até ~1 minuto após push de `inscritos.json` para o site servir o novo ficheiro. O tablet usa `cache: no-store` mas o CDN do Pages pode ter cache de bordo.
- **Browser sem Service Worker**: a app funciona, mas perde o cache offline do shell. Todos os browsers modernos suportam SW.

---

## Comandos VBA úteis (painel Imediato)

```vba
' Publicar lista de inscritos (antes do evento)
?blnPublicarInscritos(lngProximoEventoID())

' Sincronizar presenças (lê presencas.json e aplica)
?lngSincronizarPresencas(lngProximoEventoID())

' Workflow completo (sync + emite + envia + publica certs)
Call FecharEventoEEnviar

' Publicar certs.json directamente (sem o resto do workflow)
Call PublicarCertsViaAPI
```

---

## Troubleshooting

| Sintoma | Causa provável | Solução |
|---|---|---|
| Login devolve "Token inválido…" | PAT expirou / scope errado / repo errado | Re-criar PAT com `Contents:write` em `Presencas` + `Certificados`, expiração ≥ data do evento. |
| App carrega mas lista fica vazia | `inscritos.json` ausente ou inválido | Correr **Publicar inscritos** no Access; verificar URL `https://rsblisboa.github.io/Presencas/data/inscritos.json` no browser. |
| Sync fica 🔴 sempre | Sem rede / token sem permissão de escrita / rate limit | Forçar sync no menu; verificar consola DevTools (F12). |
| "Atenção: certificados emitidos mas nenhum email enviado" | Outlook não disponível / template em falta | Verificar `tblErrorLog`; reabrir Outlook; reenviar individualmente em `frmInscricoes`. |
| `pFecharEventoEEnviar` falha no passo 4 | Repo Certificados ou GITHUB_REPO_CERTIFICADOS errado / token sem acesso | Confirmar `tblConfiguracao` e scope do PAT. |
| App no tablet mostra dados antigos | Service worker em cache | Pull-to-refresh ou menu → "Recarregar lista". |
