# Melhorias do ATMOS Weather Dashboard

A comparação usa a versão original de Jonah Lawrence (DenverCoder1) preservada no histórico deste repositório, no commit `602e3b4`. A implementação atual foi conferida no código e exercitada pela suíte de navegador. [Projeto original](https://github.com/DenverCoder1/weather-app-tutorial) · [Testes de navegador](tests/testar_configuracoes.py)

## 1. Melhoria funcional — previsão ampliada

- **Como era.** Uma consulta à OpenWeatherMap exibia a condição atual, a temperatura, a umidade e o vento de uma cidade.
- **O que mudou.** A Open-Meteo fornece condições atuais, até 24 horas de previsão horária e até sete dias de previsão diária. O usuário pode selecionar um dia no painel ou no calendário para abrir o resumo e os gráficos daquele período.
- **Por quê.** O tempo atual responde à consulta imediata. Uma sequência de horas e dias ajuda a decidir quando sair ou programar uma atividade.
- **Benefício.** É possível verificar máximas, mínimas e chance de precipitação no fuso da cidade. A interface limita o calendário às datas disponíveis na resposta.
- **Arquivos.** [Interface](index.html) · [Painel](script.js) · [Dados meteorológicos](weather-data.js) · [Gráficos](charts.js)

## 2. Melhoria funcional — favoritos e histórico persistentes

- **Como era.** A cidade era consultada por nome e o painel voltava a Denver a cada carregamento.
- **O que mudou.** O coração salva ou remove favoritos. O navegador guarda as dez buscas mais recentes e a última cidade selecionada com sucesso. As listas usam o identificador da geocodificação para evitar duplicatas e diferenciar cidades homônimas.
- **Por quê.** Quem consulta as mesmas cidades com frequência precisava digitar os nomes de novo.
- **Benefício.** O usuário pode reabrir uma previsão com poucos cliques e reencontrar as listas depois de recarregar a página no mesmo navegador.
- **Arquivos.** [Busca e armazenamento](cities.js) · [Painel](script.js) · [Interface](index.html)

## 3. Melhoria visual — redesenho do painel

- **Como era.** Um único cartão central agrupava busca e condições atuais, sobre um fundo fotográfico.
- **O que mudou.** O ATMOS organiza o conteúdo em uma barra lateral e cartões de condições atuais, métricas e previsão. A tipografia Manrope e a hierarquia de tamanhos dão destaque à leitura principal. A primeira consulta mostra uma estrutura de carregamento.
- **Por quê.** Com mais informações, a interface precisava deixar claro onde consultar o tempo atual, os detalhes e as outras seções.
- **Benefício.** A temperatura fica fácil de localizar e as métricas e ferramentas relacionadas têm destinos previsíveis.
- **Arquivos.** [Interface](index.html) · [Estilos](style.css) · [Painel](script.js)

## 4. Melhoria visual — temas claro e escuro em telas responsivas

- **Como era.** O cartão tinha largura máxima de 420 px e aparência escura fixa.
- **O que mudou.** A composição se reorganiza em telas estreitas e o menu lateral pode ser recolhido. O tema acompanha o sistema por padrão. A escolha manual entre claro e escuro é salva no navegador.
- **Por quê.** Computadores e celulares oferecem espaços diferentes, e a preferência de leitura pode variar ao longo do dia.
- **Benefício.** O usuário acessa os mesmos controles em telas estreitas e mantém sua preferência visual entre visitas.
- **Arquivos.** [Estilos](style.css) · [Tema](theme.js) · [Interface](index.html) · [Configurações e navegação](script.js)

## 5. Novo recurso — comparação de duas cidades

- **Como era.** Uma nova busca substituía na tela as informações da cidade anterior.
- **O que mudou.** A seção **Comparar** permite buscar duas cidades de forma independente, trocar suas posições e consultar os cartões e o gráfico comparativo. O gráfico alinha os horários locais. As diferenças atuais exigem o mesmo instante, e os resumos diários exigem a mesma data local de referência.
- **Por quê.** Alternar repetidamente entre buscas obrigava o usuário a memorizar valores e dificultava perceber diferenças de fuso.
- **Benefício.** É possível comparar condições de dois destinos e interpretar os valores com a indicação da data e do horário de cada cidade.
- **Arquivos.** [Comparação](compare.js) · [Gráficos](charts.js) · [Interface](index.html) · [Estilos](style.css)
