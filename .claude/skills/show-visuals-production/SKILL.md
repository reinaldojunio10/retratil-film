---
name: show-visuals-production
description: Pipeline de produção de visuais para shows ao vivo (telões/LED) — music visuals, logos, ambient loops, special moments, abertura/encerramento, transições e pacotes por tela. Use ao receber briefing, música, logo ou roteiro de palco para planejar, produzir, validar ou empacotar conteúdo visual de show.
---

# Show Visuals Production

Todo o trabalho do estúdio fica em `estudio-visuais/` (na raiz do repositório). Leia `estudio-visuais/CLAUDE.md` antes de começar: ele define identidade, gates de aprovação e regras de LED.

## Referências (leia a que se aplica)
- `references/CONTENT-TYPES.md` — matriz de categorias e pacote sugerido de show.
- `references/MUSIC-ANALYSIS.md` — inspeção de áudio, BPM, seções e cue sheet.
- `references/LED-TECHNICAL.md` — ficha de LED, múltiplas telas e codecs.
- `references/QUALITY-CONTROL.md` — gates de conceito, preview e master; status.

## Fluxo
1. **Classificar** a peça em uma categoria: `MUSIC_VISUAL`, `LOGO_BRAND`, `AMBIENT_LOOP`, `SPECIAL_MOMENT`, `SHOW_OPEN_CLOSE`, `INTERLUDE_TRANSITION` ou `SCREEN_PACKAGE`.
2. **Briefing**: preencher `estudio-visuais/templates/BRIEF-ARTISTA-SHOW.md` (uma vez por artista/show) e `BRIEF-PECA.md` (por peça). Campos sem resposta ficam marcados como pendentes; não inventar.
3. **Inventário** de arquivos, direitos/licenças e specs de LED recebidos.
4. **Referências e direção de arte** (subagente `creative-director`): até três rotas originais.
5. **Análise musical**, se houver áudio (subagente `music-analyst`): gerar `CUE-SHEET.md`.
6. **Storyboard e plano técnico** (`led-stage-director` para mapas e telas).
7. **Produção** (`3d-artist`, `motion-designer`, `ai-video-specialist`).
8. **Preview** leve, sempre antes do master.
9. **QC** (`quality-finisher`): preencher `RELATORIO-QC.md` com dados medidos no arquivo real.
10. **Aprovação humana**, depois master, validação e pacote conforme `ESTRUTURA-PACOTE-SHOW.md`.

## Por categoria
| Categoria | Briefing mínimo | Aprovação | Entregáveis |
|---|---|---|---|
| MUSIC_VISUAL | Áudio, duração, energia, telas | Conceito, cue sheet, preview | Visual por faixa, cue sheet, contingência |
| LOGO_BRAND | Logo vetorial e grafia oficial | Fidelidade da marca, preview | Reveal, loop, still de segurança |
| AMBIENT_LOOP | Atmosfera, duração do ciclo | Loop testado em 3 ciclos | Loop seamless, parâmetros |
| SPECIAL_MOMENT | Deixa, quem/o quê é destacado | Gatilho e foco claros | Entrada, sustentação, saída |
| SHOW_OPEN_CLOSE | Roteiro, duração, deixa operacional | Impacto e timing | Countdown, abertura, encerramento |
| INTERLUDE_TRANSITION | Blocos de origem e destino | Continuidade | Transição curta, contingência |
| SCREEN_PACKAGE | Mapa de pixels e specs do operador | Playback por tela | Arquivos por tela, layout, instruções |

## Pastas (dentro de `estudio-visuais/`)
`artistas/` · `shows/` · `projetos/` · `referencias/` · `assets/` · `audio/` · `specs-led/` · `renders/` · `entregas/` · `logs/` · `templates/`

`audio/`, `assets/`, `renders/` e `entregas/` não vão para o Git (material privado e arquivos pesados).

## Nomenclatura e versão
`ARTISTA_SHOW_CATEGORIA_PECA_TELA_LARGURAxALTURA_FPS_vNN_STATUS.ext`
Exemplo: `DUPLA_TURNE26_LOGO-BRAND_reveal_MAIN_3840x2160_30_v03_PREVIEW.mp4`

- Nunca sobrescrever: cada alteração gera `vNN+1`. Originais são somente leitura.
- Status conforme `QUALITY-CONTROL.md`. Sem specs do operador, o status máximo é `PREVIEW`.
- Registrar decisões, fontes de referência e pendências em `estudio-visuais/logs/PROJECT-LOG.md`.

## Gates (sempre pedir aprovação antes)
Compras ou assinaturas, consumo de créditos, APIs pagas, envio de material privado a serviços externos, instalação de software, apagar ou substituir originais, render final longo, envio ao cliente.
