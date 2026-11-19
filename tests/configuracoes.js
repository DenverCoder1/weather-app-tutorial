const quadro = document.querySelector("iframe");
const resultado = document.querySelector("output");
const chave = "atmos-configuracoes";
const janela = () => quadro.contentWindow;
const buscar = (seletor) => quadro.contentDocument.querySelector(seletor);
const clicar = (seletor) => buscar(seletor).click();
const texto = (seletor) => buscar(seletor).textContent;
const exigir = (condicao, mensagem) => { if (!condicao) throw new Error(mensagem); };
const esperar = async (condicao, mensagem, limite = 65) => {
  for (let tentativa = 0; tentativa < limite; tentativa++) {
    if (condicao()) return;
    await new Promise((resolver) => setTimeout(resolver, 30));
  }
  throw new Error(mensagem);
};

async function abrir(hash = "#painel") {
  const url = new URL("../simulacao", location.href);
  const erros = janela().errosDoATMOS;
  exigir(!erros?.length, "O navegador registrou erros: " + erros?.join(" · "));
  const pronto = new Promise((resolver) => quadro.addEventListener("load", resolver, { once: true }));
  if (janela().location.pathname === url.pathname) {
    janela().history.replaceState(null, "", hash);
    janela().location.reload();
  } else quadro.src = url.href + hash;
  await pronto;
  await esperar(() => !buscar(".weather")?.hidden && texto(".city"), "O painel deve carregar.");
}

async function navegar(secao) {
  if (janela().matchMedia("(max-width: 720px)").matches && buscar(".layout").classList.contains("menu-collapsed")) {
    clicar(".sidebar-toggle");
  }
  clicar('nav a[href="#' + secao + '"]');
  await esperar(() => buscar("nav a[aria-current]").hash === "#" + secao, "Falha ao abrir " + secao);
  exigir(!buscar("#" + secao).hidden, "Seção oculta: " + secao);
}

function mudar(seletor, valor) {
  const controle = buscar(seletor);
  controle.value = valor;
  controle.dispatchEvent(new (janela().Event)("change"));
}

function enviar(seletor, cidade) {
  const formulario = buscar(seletor);
  formulario.querySelector("input").value = cidade;
  formulario.requestSubmit();
}

async function confirmar(acao, confirmarLimpeza) {
  clicar("#configuracoes ." + acao);
  exigir(buscar("dialog").open, "A limpeza deve pedir confirmação.");
  clicar('dialog [value="' + (confirmarLimpeza ? "limpar" : "cancelar") + '"]');
  await esperar(() => !buscar("dialog").open, "O diálogo deve fechar.");
}

async function testar() {
  localStorage.removeItem(chave);
  localStorage.removeItem("atmos-cidades");
  localStorage.setItem("atmos-tema", "dark");
  await abrir();
  exigir(buscar("html").dataset.theme === "dark", "O tema antigo deve ser reaproveitado.");
  await navegar("calendario");
  exigir(buscar(".calendar-days").children.length === 2, "Exiba apenas as datas recebidas.");
  exigir(buscar('.calendar-days [aria-current="date"]').dataset.day === "2026-11-19",
    "Hoje deve seguir o fuso da cidade, mesmo com data UTC diferente.");
  clicar('.calendar-days [data-day="2026-11-20"]');
  exigir(!buscar("#detalhes-calendario").hidden && texto("#detalhes-calendario").includes("Chuva"),
    "A data deve abrir a previsão correspondente.");
  exigir(quadro.contentDocument.activeElement.id === "detalhes-calendario", "Os detalhes devem receber foco.");
  clicar('#detalhes-calendario a');
  await esperar(() => buscar('nav a[aria-current]').hash === "#graficos", "O link deve abrir os gráficos.");
  exigir(texto(".chart-period").includes("20"), "O gráfico deve usar o dia selecionado.");

  await navegar("comparar");
  const comparacoes = quadro.contentDocument.querySelectorAll(".compare-search");
  comparacoes[0].querySelector("input").value = "Denver";
  comparacoes[0].requestSubmit();
  comparacoes[1].querySelector("input").value = "Recife";
  comparacoes[1].requestSubmit();
  await esperar(() => !buscar(".compare-differences").hidden, "A comparação deve carregar.");

  await navegar("configuracoes");
  mudar("#temperature-unit", "fahrenheit");
  mudar("#wind-unit", "mph");
  mudar("#theme-preference", "light");
  exigir(buscar("html").dataset.theme === "light", "O tema claro deve ser aplicado.");
  clicar(".theme-button");
  exigir(buscar("#theme-preference").value === "dark" && buscar("html").dataset.theme === "dark",
    "O botão de tema deve atualizar a configuração.");
  mudar("#theme-preference", "system");
  exigir(buscar("html").dataset.theme === (janela().matchMedia("(prefers-color-scheme: dark)").matches ? "dark" : "light"),
    "O tema deve acompanhar o sistema.");
  mudar("#theme-preference", "dark");
  exigir(texto(".temp") === "32 °F" && texto(".feels-like").includes("33,8 °F"), "Converta a temperatura no painel.");
  exigir(texto(".wind") === "10 mph" && texto(".wind-gusts") === "20 mph", "Converta vento e rajadas.");
  exigir(texto(".hourly-list").includes("32 °F") && texto(".temperature-max") === "41 °F", "Converta as previsões.");
  exigir(texto("#detalhes-calendario").includes("44,6 °F"), "Atualize os detalhes do calendário.");
  exigir(texto(".difference-values").includes("+18 °F"), "A diferença em Fahrenheit não usa o deslocamento de 32.");
  exigir(texto(".compare-details").includes("10 mph"), "Atualize a comparação.");
  exigir(texto(".compare-charts .chart-reading").includes("50 °F") && texto("#graficos .chart-reading").includes("32 °F"),
    "Atualize as temperaturas nos dois gráficos.");
  mudar("#compare-chart-metric", "wind_speed_10m");
  mudar("#chart-metric", "wind_speed_10m");
  exigir(texto(".compare-charts .chart-reading").includes("10 mph") && texto("#graficos .chart-reading").includes("10 mph"),
    "Atualize os dois gráficos de vento.");
  exigir(janela().eval("chart.values[0][0]") === 10, "A escala do gráfico deve usar valores convertidos.");
  janela().eval("weatherMap.pointWeather = { temperature_2m: 10, wind_speed_10m: 16.09344 }; weatherMap.renderPointWeather()");
  exigir(texto(".map-point-values").includes("50 °F") && texto(".map-point-values").includes("10 mph"), "Converta leituras do mapa.");
  mudar("#temperature-unit", "celsius");
  mudar("#wind-unit", "kmh");
  exigir(texto(".temp") === "0 °C" && texto(".wind") === "16,1 km/h", "Restaure as unidades originais.");
  exigir(texto(".map-point-values").includes("10 °C") && texto(".map-point-values").includes("16,1 km/h"),
    "Atualize também as leituras do mapa já carregadas.");
  mudar("#temperature-unit", "fahrenheit");
  mudar("#wind-unit", "mph");

  await navegar("painel");
  enviar(".topbar .search", "Recife");
  await esperar(() => texto(".city") === "Recife", "A busca deve continuar funcionando.");
  clicar(".favorite-toggle");
  await navegar("configuracoes");
  enviar(".default-city-search", "São Paulo");
  await esperar(() => texto(".default-city-label").includes("São Paulo"), "Escolha a cidade padrão.");
  for (const acao of ["clear-history", "clear-favorites"]) {
    await confirmar(acao, false);
    exigir(!buscar("#configuracoes ." + acao).disabled, "Cancelar deve preservar a lista.");
    await confirmar(acao, true);
    await esperar(() => buscar("#configuracoes ." + acao).disabled, "Confirme a limpeza da lista.");
  }

  await abrir("#configuracoes");
  exigir(texto(".city") === "São Paulo", "A cidade padrão deve prevalecer após recarregar.");
  exigir(buscar("#temperature-unit").value === "fahrenheit" && buscar("#wind-unit").value === "mph",
    "As unidades devem persistir.");
  exigir(buscar("html").dataset.theme === "dark" && buscar("#theme-preference").value === "dark", "O tema deve persistir.");
  exigir(buscar(".favorite-list").children.length === 0 && buscar(".history-list").children.length === 0, "As listas devem permanecer vazias.");
  clicar(".reset-default-city");
  await abrir("#configuracoes");
  exigir(texto(".city") === "Recife", "O painel deve voltar à última cidade consultada.");
  janela().eval('loadLeaflet.pending = Promise.resolve({})');
  for (const secao of ["painel", "graficos", "favoritos", "comparar", "mapas", "qualidade-do-ar", "calendario", "configuracoes"]) {
    await navegar(secao);
  }
  exigir(quadro.contentDocument.documentElement.scrollWidth <= janela().innerWidth, "As configurações devem caber na tela.");
  localStorage.setItem(chave, JSON.stringify({
    temperature: "kelvin", wind: [], theme: "inválido",
    defaultCity: { id: 1, name: "Inválida", latitude: 91, longitude: 0 },
  }));
  await abrir("#configuracoes");
  exigir(buscar("#temperature-unit").value === "celsius" && buscar("#wind-unit").value === "kmh", "Rejeite unidades inválidas.");
  exigir(buscar("#theme-preference").value === "system" && texto(".city") === "Recife", "Rejeite tema e cidade inválidos.");
  localStorage.setItem(chave, "{");
  await abrir("#configuracoes");
  exigir(buscar("#temperature-unit").value === "celsius" && texto(".city") === "Recife", "Tolere preferências corrompidas.");
}

function publicar(mensagem) {
  resultado.textContent = mensagem;
  return fetch("../resultado", { method: "POST", body: mensagem });
}
