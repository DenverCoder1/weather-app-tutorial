const pausa = (ms) => new Promise((resolver) => setTimeout(resolver, ms));

function tecla(seletor, key) {
  buscar(seletor).dispatchEvent(new (janela().KeyboardEvent)("keydown", { key, bubbles: true, cancelable: true }));
}

function digitar(seletor, valor) {
  const campo = buscar(seletor);
  campo.focus();
  campo.value = valor;
  campo.dispatchEvent(new (janela().Event)("input", { bubbles: true }));
}

async function consultar(cidade, estado = "ready") {
  enviar(".topbar .search", cidade);
  await esperar(() => buscar(".weather-status").dataset.state === estado, "Estado incorreto ao consultar " + cidade);
  if (estado === "ready") exigir(texto(".city") === cidade, "Cidade incorreta após a busca.");
}

function verificarLargura(largura) {
  const raiz = quadro.contentDocument.documentElement;
  exigir(janela().innerWidth === largura && raiz.scrollWidth <= janela().innerWidth,
    "A página tem rolagem horizontal em " + largura + " px, na seção " + janela().location.hash + ".");
}

async function testarRevisao() {
  localStorage.clear();
  quadro.style.width = "1280px";
  await abrir();
  verificarLargura(1280);
  digitar("#city-search", "Rec");
  tecla("#city-search", "ArrowDown");
  await esperar(() => janela().consultas.includes("Rec"), "A seta deve iniciar a consulta.");
  buscar(".topbar .search").requestSubmit();
  await esperar(() => texto(".city") === "Recife", "A busca por uma cidade brasileira deve carregar o painel.");
  exigir(janela().consultas.filter((consulta) => consulta === "Rec").length === 1,
    "Enviar enquanto as sugestões carregam deve reutilizar a requisição.");
  exigir(texto(".region").includes("Pernambuco"), "Identifique o primeiro Recife pela região.");
  clicar(".favorite-toggle");

  digitar("#city-search", "Rec");
  tecla("#city-search", "ArrowUp");
  await esperar(() => Boolean(buscar("#city-search").getAttribute("aria-activedescendant")), "A seta deve destacar uma opção.");
  exigir(buscar("#city-suggestions").children.length === 2, "Resultados duplicados e coordenadas inválidas devem ser descartados.");
  exigir(texto('#city-suggestions [aria-selected="true"]').includes("Bahia"), "Diferencie as cidades homônimas.");
  buscar(".topbar .search").requestSubmit();
  await esperar(() => texto(".region").includes("Bahia"), "A seleção pelo teclado deve consultar Recife, Bahia.");
  clicar(".favorite-toggle");
  exigir(buscar(".favorite-list").children.length === 2 && buscar(".history-list").children.length === 2,
    "Cidades homônimas devem ser armazenadas por ID.");
  clicar(".favorite-toggle");
  exigir(buscar(".favorite-list").children.length === 1, "Remova apenas o favorito selecionado.");
  await consultar("Recife");
  exigir(buscar(".history-list").children.length === 2 && texto(".history-list li").includes("Pernambuco"),
    "Buscas repetidas devem mover a cidade existente para o topo.");
  clicar(".refresh-button");
  await esperar(() => !buscar(".refresh-button").disabled, "A atualização deve retornar ao estado disponível.");
  exigir(buscar(".history-list").children.length === 2, "Atualizar a previsão deve preservar o histórico.");

  digitar("#city-search", "Dev");
  tecla("#city-search", "ArrowDown");
  await esperar(() => janela().consultas.includes("Dev"), "Inicie a consulta lenta de sugestões.");
  tecla("#city-search", "Escape");
  exigir(buscar("#city-search").getAttribute("aria-expanded") === "false", "Escape deve fechar a lista.");
  await esperar(() => janela().consultasCanceladas.includes("Dev"), "Escape deve cancelar a consulta sem consumidores.");
  await consultar("Local inexistente", "empty");
  exigir(texto(".weather-status").includes("Cidade não encontrada.") && texto(".city") === "Recife",
    "Uma busca inválida deve preservar a previsão carregada.");
  await consultar("Rede indisponível", "error");
  await consultar("Falha", "error");
  exigir(texto(".city") === "Recife" && buscar(".skeleton").hidden, "Falhas devem preservar os últimos dados.");
  await consultar("Vazia", "empty");
  exigir(texto(".city") === "Recife", "Uma resposta sem leituras deve preservar a previsão anterior.");

  enviar(".topbar .search", "Devagar");
  await esperar(() => janela().consultas.includes("api.open-meteo.com:7"), "Inicie a previsão lenta.");
  await consultar("Parcial");
  await esperar(() => janela().consultasCanceladas.includes("api.open-meteo.com:7"), "A nova previsão deve cancelar a anterior.");
  await pausa(400);
  exigir(texto(".city") === "Parcial" && texto(".description") === "Trovoadas fortes",
    "A resposta antiga deve ser ignorada e o código WMO 97 deve ser exibido.");
  exigir(texto(".wind") === "Indisponível" && texto(".humidity") === "Indisponível" &&
    texto(".observation-time").includes("indisponível"), "Leituras e horários inválidos devem ser tratados.");
  exigir(texto(".current-date").includes("09:00"), "Use o fuso válido da cidade quando o fuso da resposta for inválido.");
  exigir(buscar(".hourly-list").children.length === 2 && buscar(".forecast-list").children.length === 1 &&
    texto(".forecast-range") === "1 dia disponível", "Exiba somente horários e datas válidos com leituras.");
  exigir(texto(".hourly-list li:first-child strong") === "20 °C" && texto(".hourly-list li:last-child strong") === "22 °C",
    "Ordene as horas sem perder a correspondência com suas medidas.");
  clicar(".forecast-list button");
  exigir(quadro.contentDocument.activeElement.id === "detalhes-do-dia", "O resumo semanal deve receber foco.");
  await navegar("graficos");
  const controle = buscar("#graficos .chart-hour");
  controle.value = "1";
  controle.dispatchEvent(new (janela().Event)("input"));
  exigir(texto("#graficos .chart-reading").includes("11:00") && texto("#graficos .chart-reading").includes("22 °C"),
    "O gráfico deve corresponder à hora e à unidade selecionadas.");
  exigir(janela().eval("chart.samples[1].timestamp - chart.samples[0].timestamp") === 7200, "Preserve a lacuna de duas horas no eixo.");
  clicar(".chart-reset");
  exigir(quadro.contentDocument.activeElement === controle, "Voltar às próximas horas deve manter o foco no gráfico.");

  await consultar("Recife");
  janela().resultadoGeolocalizacao = "negado";
  clicar(".location-button");
  await esperar(() => buscar(".weather-status").dataset.state === "error", "Trate a geolocalização negada.");
  exigir(texto(".weather-status").includes("permissão"), "Informe a falha da geolocalização.");
  janela().resultadoGeolocalizacao = "permitido";
  clicar(".location-button");
  await esperar(() => texto(".city") === "Minha localização", "Consulte as coordenadas fornecidas pelo navegador.");
  exigir(buscar(".favorite-toggle").hidden, "Favoritos exigem uma cidade identificada.");

  await navegar("comparar");
  const a = ".compare-city:nth-child(1) .compare-search";
  const b = ".compare-city:nth-child(2) .compare-search";
  enviar(a, "Recife");
  await esperar(() => texto(".compare-city:nth-child(1) h3") === "Recife", "Carregue a primeira cidade para comparar.");
  enviar(b, "Recife");
  await esperar(() => texto(".compare-city:nth-child(2) .compare-status").includes("já está"), "Impeça selecionar a mesma cidade duas vezes.");
  enviar(b, "Denver");
  await esperar(() => !buscar(".compare-charts").hidden, "Compare duas cidades em fusos diferentes.");
  exigir(texto(".compare-city:nth-child(1) .compare-date").includes("18/11/2026") &&
    texto(".compare-city:nth-child(2) .compare-date").includes("19/11/2026"), "Use o dia local de cada cidade.");
  exigir(texto(".difference-context").includes("datas locais distintas"), "Evite comparar os resumos diários de datas diferentes.");
  exigir(texto(".compare-charts .chart-reading").includes("GMT-3") && texto(".compare-charts .chart-reading").includes("GMT+14"),
    "Mostre o deslocamento de cada leitura comparada.");
  clicar(".compare-swap");
  exigir(texto(".compare-city:nth-child(1) h3") === "Denver", "Troque os lados da comparação.");

  await navegar("qualidade-do-ar");
  await esperar(() => !buscar(".air-data").hidden, "Carregue a qualidade do ar.");
  mudar("#air-scale", "european_aqi");
  exigir(texto(".air-index") === "20,2 pts" && texto(".air-category") === "Razoável" &&
    texto(".air-pm25") === "Indisponível", "Classifique pelo valor válido na escala escolhida.");
  mudar("#air-chart-metric", "pm10");
  exigir(texto("#air-chart-reading").includes("10 µg/m³"), "Ordene as amostras e aplique as unidades do material particulado.");
  const chamadasDoAr = janela().consultas.filter((consulta) => consulta.startsWith("air-quality")).length;
  await navegar("painel");
  await navegar("qualidade-do-ar");
  exigir(janela().consultas.filter((consulta) => consulta.startsWith("air-quality")).length === chamadasDoAr,
    "Reabrir a qualidade do ar deve reutilizar a estimativa recente.");
  janela().falharQualidadeDoAr = true;
  await consultar("São Paulo");
  await esperar(() => !buscar(".air-retry").hidden, "Ofereça nova tentativa quando a qualidade do ar falhar.");
  janela().falharQualidadeDoAr = false;
  clicar(".air-retry");
  await esperar(() => !buscar(".air-data").hidden, "A nova tentativa deve recuperar a qualidade do ar.");

  await navegar("painel");
  janela().ajustarRelogio("2026-11-01T04:00:00Z");
  await consultar("Nova York");
  const horasRepetidas = Array.from(quadro.contentDocument.querySelectorAll(".hourly-list time"))
    .filter((hora) => hora.textContent.startsWith("01:00"));
  exigir(horasRepetidas.length === 2 && horasRepetidas[0].textContent !== horasRepetidas[1].textContent,
    "Diferencie as duas ocorrências de 01:00 na mudança de horário de verão.");
  clicar(".forecast-list [data-day='2026-11-01']");
  janela().ajustarRelogio("2026-11-02T06:00:00Z");
  janela().eval("displayDailyMetrics(new Date())");
  exigir(!buscar(".forecast-list [data-day='2026-11-01']") && buscar("#detalhes-do-dia").hidden &&
    buscar('.calendar-days [aria-current="date"]').dataset.day === "2026-11-02", "Atualize as datas na virada do dia local.");

  quadro.style.width = "320px";
  await esperar(() => buscar(".layout").classList.contains("menu-collapsed"), "O menu móvel deve recolher.");
  janela().eval('loadLeaflet.pending = Promise.reject(new Error("CDN indisponível.")); loadLeaflet.pending.catch(() => {})');
  await navegar("mapas");
  await esperar(() => !buscar(".map-retry").hidden, "Mostre a opção de tentar abrir o mapa novamente.");
  janela().eval('loadLeaflet.pending = Promise.resolve(undefined)');
  clicar(".map-retry");
  await esperar(() => !buscar(".map-retry").hidden, "O botão de nova tentativa deve reconsultar a biblioteca.");
  for (const secao of ["painel", "graficos", "favoritos", "comparar", "mapas", "qualidade-do-ar", "calendario", "configuracoes"]) {
    await navegar(secao);
    verificarLargura(320);
  }
  clicar(".skip-link");
  exigir(janela().location.hash === "#configuracoes" && quadro.contentDocument.activeElement.id === "painel",
    "O atalho de conteúdo deve manter a seção aberta.");
  clicar(".sidebar-toggle");
  buscar('nav a[href="#configuracoes"]').focus();
  tecla('nav a[href="#configuracoes"]', "Escape");
  exigir(quadro.contentDocument.activeElement.classList.contains("sidebar-toggle"), "Escape deve devolver o foco ao menu.");
  await navegar("configuracoes");
  exigir(quadro.contentDocument.activeElement.id === "configuracoes", "Reabrir a mesma seção deve restaurar o foco.");

  const gravados = JSON.parse(localStorage.getItem("atmos-cidades"));
  gravados.favorites = [gravados.favorites[0], gravados.favorites[0], { id: 29, name: "Inválida", latitude: 91, longitude: 91 }];
  gravados.history = [...gravados.history, gravados.history[0]];
  localStorage.setItem("atmos-cidades", JSON.stringify(gravados));
  await abrir("#configuracoes");
  exigir(texto(".city") === "Nova York" && buscar(".favorite-list").children.length === 1 &&
    buscar(".history-list").children.length === gravados.history.length - 1, "Valide e deduplique os dados ao recarregar.");
  janela().eval('Storage.prototype.setItem = () => { throw new DOMException("Armazenamento indisponível.", "QuotaExceededError"); }');
  mudar("#temperature-unit", "fahrenheit");
  exigir(texto(".settings-feedback").includes("nesta visita") && texto(".temp").includes("°F"),
    "A troca de unidade deve funcionar mesmo quando o armazenamento falha.");
  exigir(janela().errosDoATMOS.length === 0, "O navegador registrou erros: " + janela().errosDoATMOS.join(" · "));
  resultado.textContent = "Regressão do ATMOS em 1.280, 350 e 320 px.";
}

async function testarServicosReais() {
  quadro.style.width = "1280px";
  const pronto = new Promise((resolver) => quadro.addEventListener("load", resolver, { once: true }));
  quadro.src = "../#painel";
  await pronto;
  enviar(".topbar .search", "Recife");
  await esperar(() => !buscar(".weather").hidden && texto(".city") === "Recife",
    "A previsão real de Recife não abriu no Chrome.", 480);
  exigir(texto(".region").includes("Pernambuco") && buscar(".hourly-list").children.length > 0 &&
    buscar(".forecast-list").children.length > 0, "A resposta real deve incluir Recife, Pernambuco, e os períodos previstos.");
  const a = ".compare-city:nth-child(1) .compare-search";
  const b = ".compare-city:nth-child(2) .compare-search";
  await navegar("comparar");
  enviar(a, "Recife");
  enviar(b, "Tóquio");
  await esperar(() => !buscar(".compare-charts").hidden, "A comparação real entre Recife e Tóquio não carregou.", 480);
  await navegar("qualidade-do-ar");
  await esperar(() => !buscar(".air-data").hidden, "A resposta real de qualidade do ar não carregou.", 480);
  await navegar("mapas");
  await esperar(() => !buscar(".map-grid").hidden && Boolean(buscar(".leaflet-tile-loaded")),
    "O Leaflet ou os mosaicos do OpenStreetMap não carregaram.", 480);
  exigir(Boolean(buscar('.leaflet-control-attribution a[href*="leafletjs.com"]')) &&
    Boolean(buscar('.leaflet-control-attribution a[href*="openstreetmap.org"]')), "Atribua o mapa a suas fontes.");
  clicar(".map-center");
  clicar(".map-inspect");
  await esperar(() => !buscar(".map-point-data").hidden, "A consulta real do centro do mapa não carregou.", 480);
  verificarLargura(1280);
  quadro.style.width = "320px";
  await esperar(() => janela().innerWidth === 320, "O mapa deve acompanhar a mudança de largura.");
  verificarLargura(320);
  resultado.textContent = "Serviços reais de previsão, geocodificação, qualidade do ar e mapas.";
}
