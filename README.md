# ATMOS Weather Dashboard

O ATMOS é um painel meteorológico em português brasileiro desenvolvido como projeto escolar. Consulte as condições atuais, planeje os próximos dias e compare cidades em uma interface que se adapta a computadores e celulares. As horas e datas são exibidas de acordo com o fuso da cidade consultada.

## Projeto original e licença

O ATMOS adapta o projeto **Simple Weather App Tutorial**, de **Jonah Lawrence (DenverCoder1)**. A versão original deste histórico consultava o tempo atual com a OpenWeatherMap. O ATMOS migrou para a Open-Meteo e ampliou a interface e os dados apresentados. [Repositório original](https://github.com/DenverCoder1/weather-app-tutorial) · [Perfil do autor](https://github.com/DenverCoder1)

O projeto mantém a licença MIT e o aviso original **Copyright (c) 2020 DenverCoder1**. [Texto integral da licença](LICENSE)

## Tecnologias e serviços

- HTML, CSS e JavaScript nativo. Os gráficos usam Canvas e as preferências usam `localStorage`. A aplicação é estática e dispensa instalação de pacotes ou compilação.
- Previsão, busca de cidades e qualidade do ar consultadas pelas APIs públicas da Open-Meteo via HTTPS, sem chave para o uso não comercial deste projeto. A geocodificação usa dados do GeoNames e a qualidade do ar usa estimativas do Copernicus CAMS. [Previsão](https://open-meteo.com/en/docs) · [Geocodificação](https://open-meteo.com/en/docs/geocoding-api) · [Qualidade do ar](https://open-meteo.com/en/docs/air-quality-api) · [GeoNames](https://www.geonames.org/) · [Copernicus CAMS](https://atmosphere.copernicus.eu/)
- Mapas com Leaflet e mosaicos do OpenStreetMap. Tipografia Manrope, distribuída pelo Google Fonts. [Leaflet](https://leafletjs.com/) · [OpenStreetMap](https://www.openstreetmap.org/copyright) · [Manrope](https://fonts.google.com/specimen/Manrope)

## Recursos principais

- Condições atuais, previsão horária com até 24 horas, previsão de até sete dias, calendário e gráficos interativos.
- Busca com sugestões, geolocalização mediante permissão, favoritos e buscas recentes.
- Comparação de duas cidades com gráficos por horário local, mapa interativo e estimativas de qualidade do ar.
- Temas claro e escuro, escolha da cidade padrão e unidades de temperatura e vento.

[Detalhes das cinco melhorias](MELHORIAS.md) · [Roteiro da apresentação](ROTEIRO.md)

## Dados do painel

- As condições atuais da Open-Meteo são estimativas de modelos meteorológicos. As unidades padrão são °C para temperatura e sensação térmica e km/h para vento e rajadas. A umidade relativa e a cobertura de nuvens aparecem em %, a direção de origem do vento em graus, a pressão na superfície em hPa e a precipitação acumulada em mm.
- A previsão do dia indica a maior probabilidade horária de precipitação, o índice UV máximo e a estimativa de UV para a hora local, as temperaturas máxima e mínima e os horários locais de nascer e pôr do sol.
- Campos ausentes aparecem como **Indisponível**. Se uma nova consulta falhar, o painel mantém os últimos dados carregados e mostra uma mensagem de erro.
- O painel usa o fuso da cidade para exibir leituras horárias. A previsão diária segue a data de referência da API, que usa um deslocamento fixo por resposta. Nas mudanças de horário de verão, as duas ocorrências de um horário repetido exibem seus respectivos deslocamentos.

## Como usar

1. Sirva a raiz do projeto com o Live Server no VS Code. Se você já usa Python, também pode executar `python -m http.server 8000` na raiz e abrir `http://localhost:8000/` no navegador.
2. Digite o nome de uma cidade e escolha uma sugestão, pressione Enter ou clique na lupa. O painel abre em Denver na primeira visita. Depois, abre na cidade padrão escolhida nas configurações ou na última cidade selecionada com sucesso.
3. Para consultar as condições no seu local, use **Minha localização** e permita o acesso no navegador. Esse recurso requer HTTPS ou um servidor local, como o Live Server.
4. Use **Atualizar dados** para refazer a última consulta bem-sucedida. Na primeira visita, o tema acompanha a preferência do sistema. Ao alternar entre claro e escuro, o navegador guarda sua escolha para as próximas visitas.

## Publicação no GitHub Pages

1. Envie a branch `entrega-atmos` ao remoto `origin` com os comandos abaixo.
2. No repositório do GitHub, abra **Settings** (Configurações) → **Pages**. Em **Build and deployment** (Compilação e publicação), selecione **Deploy from a branch** (Publicar de uma branch).
3. Escolha a branch `entrega-atmos` e a pasta `/(root)`. Salve. O `index.html` fica na raiz, junto dos arquivos estáticos, com caminhos relativos que funcionam no subdiretório do repositório.
4. Acompanhe a execução em **Actions** (Ações) e abra a URL que aparecer em **Pages**. Ative **Enforce HTTPS** (Exigir HTTPS) se a opção estiver disponível. Confirme na URL publicada que a página inicia e que uma busca por Recife retorna a previsão.

[Guia oficial do GitHub Pages](https://docs.github.com/pt/pages/getting-started-with-github-pages/configuring-a-publishing-source-for-your-github-pages-site)

### Commit e envio ao fork

```powershell
git status --short
git remote -v
git fetch origin
if ($LASTEXITCODE -ne 0) { throw "Confira o acesso ao remoto antes de continuar." }
git log --left-right --oneline origin/main...HEAD
if (git diff --cached --name-only) { throw "Revise os arquivos que já estão preparados para commit." }
git switch -c entrega-atmos
if ($LASTEXITCODE -ne 0) { throw "Escolha um nome livre para a branch de entrega." }
git add -- .nojekyll README.md MELHORIAS.md ROTEIRO.md index.html style.css theme.js script.js weather-data.js cities.js compare.js charts.js environment.js tests/configuracoes.html tests/configuracoes.js tests/revisao.js tests/simulacao.js tests/testar_configuracoes.py
git diff --cached --stat
git diff --cached --check
```

Depois de revisar os arquivos preparados, faça o commit e envie a branch.

```powershell
git commit -m "Prepara o ATMOS para a entrega escolar"
if ($LASTEXITCODE -ne 0) { throw "Revise a falha do commit antes de enviar a branch." }
git push -u origin entrega-atmos
```

Confira se `origin` aponta para o repositório **AFFODAO/Atmos-Weather-Dashboard.** e revise o conteúdo preparado antes do commit. Se `entrega-atmos` já existir no remoto, escolha outro nome livre e use esse nome também na configuração do Pages. Se a entrega exigir publicação pela `main`, abra uma solicitação de integração da branch de entrega para `main` e selecione `main` no Pages após a integração.

## Limitações

- As condições atuais e os índices de qualidade do ar são estimativas de modelos. A cobertura, a disponibilidade e as atualizações dependem dos serviços externos.
- O calendário exibe as datas disponíveis na resposta de previsão, com horizonte de até sete dias. A comparação horária alinha horários locais que podem corresponder a instantes diferentes.
- A aplicação precisa de internet para obter dados e mapas. A geolocalização exige permissão e um contexto seguro, como HTTPS ou `localhost`.
- Favoritos, histórico e configurações ficam no navegador usado. O armazenamento pode ser limpo ou bloqueado pelo navegador e não é sincronizado entre dispositivos.

## Calendário

- Abra **Calendário** para consultar as datas retornadas pela Open-Meteo, com ícone de condição e temperaturas máxima e mínima. O destaque **Hoje** segue o fuso da cidade selecionada.
- Selecione uma data para abrir seus detalhes. Use **Ver gráficos do dia** para consultar os dados horários disponíveis para essa data.

## Configurações

- Escolha Celsius ou Fahrenheit para temperaturas e km/h ou mph para velocidades do vento. A alteração também atualiza os dados já carregados, incluindo gráficos, comparações e leituras do mapa.
- Em **Tema**, escolha **Claro**, **Escuro** ou **Seguir o sistema**. O botão de tema na barra superior atualiza a mesma preferência.
- Busque e selecione uma **Cidade padrão** para abrir na próxima visita. **Usar a última cidade consultada** restaura o comportamento inicial.
- **Limpar buscas recentes** e **Limpar favoritos** pedem confirmação e afetam apenas a lista escolhida. As preferências são salvas no armazenamento local do navegador e verificadas ao iniciar o ATMOS.

## Mapas

- Abra **Mapas** para ver a cidade selecionada no mapa interativo. Arraste, use as setas ou controle o zoom com os botões do mapa.
- Selecione um ponto no mapa ou use **Consultar centro do mapa** para buscar as condições meteorológicas nas coordenadas escolhidas. **Voltar à cidade** reposiciona o mapa.
- A base cartográfica usa a biblioteca [Leaflet](https://leafletjs.com/) e os mosaicos do [OpenStreetMap](https://www.openstreetmap.org/copyright). Os dados do ponto são consultados na Open-Meteo.

## Qualidade do ar

- Abra **Qualidade do ar** para ver a estimativa da cidade selecionada. Escolha entre o **IQA dos EUA** e o **IQA europeu**. Cada escala usa suas próprias faixas de classificação.
- PM₂,₅ e PM₁₀ são apresentados em µg/m³. O gráfico mostra as estimativas horárias disponíveis nas últimas 24 horas, no fuso indicado. As métricas podem ser alternadas no seletor do gráfico.
- Os dados da [Open-Meteo](https://open-meteo.com/en/docs/air-quality-api) são estimativas do modelo [Copernicus CAMS](https://atmosphere.copernicus.eu/). Valores ausentes aparecem como **Indisponível**. Cada cidade consultada pode reutilizar a resposta por até 15 minutos.

## Comparação de cidades

1. Abra **Comparar** na barra lateral. Busque uma cidade em cada cartão e selecione os resultados. Use **Trocar cidades** para inverter os lados.
2. Leia as diferenças como **Cidade B menos Cidade A**. Um sinal positivo indica que a leitura de B é maior. Diferenças de umidade, nebulosidade e probabilidade de precipitação são expressas em pontos percentuais.
3. As condições atuais só têm diferença calculada quando as duas respostas indicam o mesmo instante. Os resumos diários só têm diferença calculada quando as datas locais de referência coincidem.
4. Escolha a métrica no gráfico. As linhas alinham as leituras pela hora e pelo minuto locais de cada cidade e podem representar instantes distintos. Passe o cursor, toque ou use o controle de horário para consultar as duas leituras e seus deslocamentos em relação ao UTC.

## Favoritos e buscas recentes

- Use o coração no cartão de tempo atual para salvar a cidade ou removê-la. Na seção **Favoritos**, selecione uma cidade salva ou uma busca recente para abrir a previsão.
- As sugestões mostram a região e o país quando disponíveis. Use as setas para navegar pela lista, Enter para escolher e Escape para fechar. Sem destacar uma opção, Enter e a lupa carregam o primeiro resultado.
- A busca usa a API de geocodificação da Open-Meteo com dados do [GeoNames](https://www.geonames.org/).
- O navegador guarda os favoritos, as dez cidades buscadas mais recentemente e a última cidade selecionada. Cidades homônimas são identificadas pelo código de geocodificação da Open-Meteo. **Limpar histórico** pede confirmação e preserva os favoritos e a cidade padrão.

## Previsão interativa

- Deslize a faixa de previsão horária para consultar as próximas 24 horas, incluindo a hora atual quando houver dados. Os horários seguem o fuso da cidade.
- Selecione um dia na previsão semanal para ver o resumo e ajustar o período dos gráficos. A probabilidade semanal é a maior probabilidade horária de precipitação de cada dia.
- Escolha uma métrica e passe o cursor, toque no gráfico ou use as setas do teclado no controle de horário para consultar valores. **Próximas 24 h** restaura o período inicial.
- As interações reutilizam os dados da mesma consulta à Open-Meteo. Horas com valores ausentes aparecem sem pontos nos gráficos.

## Navegação e acessibilidade

- Use Tab para navegar pelos controles. O primeiro atalho leva ao conteúdo da seção atual. Em telas pequenas, use o botão do menu para abrir a navegação e Escape para fechá-la.
- Com a faixa horária em foco, use as setas para rolar os cartões. No gráfico, as setas percorrem as leituras quando o controle de horário está em foco.
- As animações seguem a preferência de movimento reduzido do sistema. Durante a consulta inicial, o painel mostra a estrutura de carregamento. Nas consultas seguintes, os dados existentes continuam visíveis enquanto a nova resposta está pendente.
- A interface usa a fonte [Manrope, distribuída pelo Google Fonts](https://fonts.google.com/specimen/Manrope).

## Testes

Execute `python tests/testar_configuracoes.py` com Python 3.12 e Google Chrome. Use a variável `ATMOS_CHROME` se o executável estiver em outro caminho.

- A suíte com dados simulados verifica a busca, cidades homônimas, falhas e respostas incompletas, cancelamento de consultas, unidades, temas, armazenamento, previsões, comparação entre fusos, geolocalização e navegação em larguras de 320, 350 e 1.280 px.
- Execute `python tests/testar_configuracoes.py --servicos-reais` para verificar previsão, geocodificação e qualidade do ar da Open-Meteo, além do Leaflet e dos mosaicos do OpenStreetMap. O teste precisa de acesso à internet.
- As duas suítes servem o projeto em um subdiretório local para verificar os caminhos relativos usados no GitHub Pages.
- A verificação de preparação também executou a suíte com serviços reais a partir de uma origem HTTPS local, sob um subdiretório. A confirmação da URL pública deve ser feita após a publicação no Pages.

## Lista de conferência da entrega

- [ ] Revisar a seleção de arquivos do commit e enviar a branch ao fork.
- [ ] Configurar o Pages e confirmar que a URL HTTPS publicada abre em uma janela anônima.
- [ ] Na URL publicada, buscar Recife e conferir previsão, favoritos, temas e comparação em computador e celular.
- [ ] Gravar a demonstração do site publicado em até cinco minutos e conferir se o vídeo e seu link estão acessíveis.
- [ ] Enviar os links do repositório, do site e do vídeo no local indicado pela escola.
