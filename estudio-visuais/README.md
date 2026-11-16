# SHOW VISUALS DIRECTOR — ELITE 3.0

Kit de configuração para Claude Code. O agente atua como um estúdio virtual de direção criativa e produção de conteúdo visual para shows ao vivo.

## O que esta versão acrescenta
- Pipeline de produção com etapas, entregáveis e gates de aprovação.
- Separação entre MUSIC VISUALS, LOGO/BRAND, AMBIENT LOOPS, SPECIAL MOMENTS, SHOW OPEN/CLOSE e SCREEN PACKAGES.
- Análise musical orientada por áudio, com BPM, estrutura, marcadores e timecodes quando tecnicamente possível.
- Pesquisa de referências com análise comparativa e tradução em direção de arte original.
- Planejamento para LED por mapa de pixels, múltiplas telas, safe areas e media server.
- Padrões de master, preview, QC, nomenclatura, versionamento e pacote de entrega.
- Regras de autonomia, custos, privacidade, licenças e segurança.

## Instalação neste repositório
O kit já está instalado. Nada precisa ser copiado.

- `.claude/agents/` e `.claude/skills/show-visuals-production/` ficam na **raiz do repositório**, para o Claude Code carregá-los.
- Todo o restante fica em `estudio-visuais/`: este README, `CLAUDE.md` do estúdio, `PROMPT-SETUP-E-UPGRADE.md`, `templates/` e as pastas de trabalho.
- O `CLAUDE.md` da raiz separa o estúdio do sistema de gestão (CRM).
- `audio/`, `assets/`, `renders/` e `entregas/` não vão para o Git.

## Estrutura
```text
retratil-film/
├── CLAUDE.md                  (roteia: CRM x estúdio)
├── .claude/
│   ├── agents/
│   └── skills/show-visuals-production/
│       ├── SKILL.md
│       └── references/
└── estudio-visuais/
    ├── CLAUDE.md
    ├── templates/
    ├── artistas/  shows/  projetos/  referencias/
    ├── assets/  audio/  specs-led/
    └── renders/  entregas/  logs/
```

## Importante
- 4K UHD (3840x2160) é preset de referência para 16:9, não requisito universal.
- O mapa de pixels e as especificações do operador/media server definem a saída final.
- Um arquivo exportado em 3840x2160 não é automaticamente 4K nativo ou visualmente detalhado.
- Não copiar visuais, logotipos, filmagens, personagens ou obras de terceiros sem autorização/licença.
- Não gastar créditos, assinar serviços, enviar material privado a serviços externos ou fazer render final demorado sem aprovação.
- Prévia e master são etapas diferentes. Nunca marcar entrega como concluída sem validar o arquivo real.
