# ATMOS

Painel meteorológico em português brasileiro, com data e hora locais da cidade selecionada e previsão dos próximos sete dias.

## Dados do painel

- As condições atuais da Open-Meteo são estimativas de modelos meteorológicos. O painel mostra a temperatura e a sensação térmica em °C, a umidade relativa e a cobertura de nuvens em %, o vento e as rajadas em km/h, a direção de origem do vento em graus, a pressão na superfície em hPa e a precipitação acumulada em mm.
- A previsão do dia indica a maior probabilidade horária de precipitação, o índice UV máximo e a estimativa de UV para a hora local, as temperaturas máxima e mínima e os horários locais de nascer e pôr do sol.
- Campos ausentes aparecem como **Indisponível**. Se uma nova consulta falhar, o painel mantém os últimos dados carregados e mostra uma mensagem de erro.

## Como usar

1. Abra a pasta do projeto no VS Code e sirva o arquivo `index.html` com o Live Server.
2. Digite o nome de uma cidade e escolha uma sugestão, pressione Enter ou clique na lupa. Na primeira visita, o painel abre em Denver. Depois, abre na última cidade selecionada com sucesso.
3. Para consultar as condições no seu local, use **Minha localização** e permita o acesso no navegador. Esse recurso requer HTTPS ou um servidor local, como o Live Server.
4. Use **Atualizar dados** para refazer a última consulta bem-sucedida. Na primeira visita, o tema acompanha a preferência do sistema. Ao alternar entre claro e escuro, o navegador guarda sua escolha para as próximas visitas.

O GitHub Pages pode servir os arquivos estáticos diretamente da raiz da branch escolhida. O projeto usa caminhos relativos e dispensa compilação. Os dados vêm das APIs públicas da [Open-Meteo](https://open-meteo.com/) sem chave para uso não comercial.

## Escopo desta etapa

A barra lateral pode ser recolhida. **Painel**, **Gráficos**, **Favoritos**, **Comparar**, **Mapas** e **Qualidade do ar** estão disponíveis. Calendário e Configurações estão desativados.

## Mapas

- Abra **Mapas** para ver a cidade selecionada no mapa interativo. Arraste, use as setas ou controle o zoom com os botões do mapa.
- Selecione um ponto no mapa ou use **Consultar centro do mapa** para buscar as condições meteorológicas nas coordenadas escolhidas. **Voltar à cidade** reposiciona o mapa.
- A base cartográfica usa Leaflet e os mosaicos do [OpenStreetMap](https://www.openstreetmap.org/copyright). Os dados do ponto são consultados na Open-Meteo.

## Qualidade do ar

- Abra **Qualidade do ar** para ver a estimativa da cidade selecionada. Escolha entre o **IQA dos EUA** e o **IQA europeu**. Cada escala usa suas próprias faixas de classificação.
- PM₂,₅ e PM₁₀ são apresentados em µg/m³. O gráfico mostra as estimativas horárias disponíveis nas últimas 24 horas, no fuso indicado. As métricas podem ser alternadas no seletor do gráfico.
- Os dados da [Open-Meteo](https://open-meteo.com/en/docs/air-quality-api) são estimativas do modelo [Copernicus CAMS](https://atmosphere.copernicus.eu/). Valores ausentes aparecem como **Indisponível**. Cada cidade consultada pode reutilizar a resposta por até 15 minutos.

## Comparação de cidades

1. Abra **Comparar** na barra lateral. Busque uma cidade em cada cartão e selecione os resultados. Use **Trocar cidades** para inverter os lados.
2. Leia as diferenças como **Cidade B menos Cidade A**. Um sinal positivo indica que a leitura de B é maior. Diferenças de umidade, nebulosidade e probabilidade de precipitação são expressas em pontos percentuais.
3. As condições atuais só têm diferença calculada quando as duas respostas indicam o mesmo instante. Os valores diários correspondem ao dia civil de cada cidade e só têm diferença calculada quando a data local coincide.
4. Escolha a métrica no gráfico. As linhas usam a faixa de hora local de cada cidade, indicada com a data, e podem representar instantes distintos. Passe o cursor, toque ou use o controle de horário para consultar as duas leituras.

## Favoritos e buscas recentes

- Use o coração no cartão de tempo atual para salvar a cidade ou removê-la. Na seção **Favoritos**, selecione uma cidade salva ou uma busca recente para abrir a previsão.
- As sugestões mostram a região e o país quando disponíveis. Use as setas para navegar pela lista, Enter para escolher e Escape para fechar. Sem destacar uma opção, Enter e a lupa carregam o primeiro resultado.
- O navegador guarda os favoritos, as dez cidades buscadas mais recentemente e a última cidade selecionada. Cidades homônimas são identificadas pelo código de geocodificação da Open-Meteo. **Limpar histórico** pede confirmação e preserva os favoritos e a cidade padrão.

## Previsão interativa

- Deslize a faixa de previsão horária para consultar as próximas 24 horas, incluindo a hora atual quando houver dados. Os horários seguem o fuso da cidade.
- Selecione um dia na previsão semanal para ver o resumo e ajustar o período dos gráficos. A probabilidade semanal é a maior probabilidade horária de precipitação de cada dia.
- Escolha uma métrica e passe o cursor, toque no gráfico ou use as setas do teclado no controle de horário para consultar valores. **Próximas 24 h** restaura o período inicial.
- As interações reutilizam os dados da mesma consulta à Open-Meteo. Horas com valores ausentes aparecem sem pontos nos gráficos.

## Navegação e acessibilidade

- Use Tab para navegar pelos controles. O primeiro atalho permite pular diretamente para o conteúdo. Em telas pequenas, use o botão do menu para abrir a navegação e Escape para fechá-la.
- Com a faixa horária em foco, use as setas para rolar os cartões. No gráfico, as setas percorrem as leituras quando o controle de horário está em foco.
- As animações seguem a preferência de movimento reduzido do sistema. Durante a consulta inicial, o painel mostra a estrutura de carregamento. Nas consultas seguintes, os dados existentes continuam visíveis enquanto a nova resposta está pendente.
