/**
 * Dictionnaire de référence (portugais).
 *
 * Ce fichier fait AUTORITÉ : le type `TranslationKey` en est dérivé, et les
 * autres langues doivent satisfaire `Dictionary`. Une clé oubliée dans une
 * traduction casse donc la compilation, jamais l'affichage à l'exécution.
 *
 * PORTÉE : uniquement l'habillage de l'interface. Les DONNÉES restent dans la
 * langue de la source — toponymes (« Vila Verde », « Nigüelas »), libellés bruts
 * des services, noms de dispositifs (« BRICA », « ELIF »). Seules deux familles
 * sont traduisibles, parce qu'on les indexe sur un code et non sur un texte :
 * les phases de sinistre (via `IncidentPhase`) et les natures.
 */

export const pt = {
  // Navigation
  'nav.dashboard': 'Dashboard',
  'nav.watchZones': 'Alertas',
  'nav.map': 'Mapa',
  'nav.alerts': 'Alertas',

  // Périmètre affiché
  'scope.label': 'Âmbito',
  'scope.iberia': 'Península',
  'scope.iberia.hint': 'Portugal e Espanha — dados operacionais',
  'scope.portugal': 'Portugal',
  'scope.portugal.hint': 'Ocorrências da ANEPC',
  'scope.spain': 'Espanha',
  'scope.spain.hint': 'Andaluzia, Catalunha e Castela e Leão',

  // Bandeau de statistiques
  'stats.activeOccurrences': 'ocorrências ativas',
  'stats.personnel': 'operacionais',
  'stats.vehicles': 'veículos',
  'stats.aircraft': 'meios aéreos',
  'stats.refresh': 'Atualizar',
  'stats.refreshing': 'A atualizar…',
  'stats.refreshNow': 'Atualizar agora',
  'stats.updated': 'Atualizado {time}',

  // Couverture des sources
  'sources.title': 'Serviços consultados',
  'sources.count': '{ok}/{total} serviços',
  'sources.incidents': '{count} ocorrências',
  'sources.unavailable': 'indisponível',
  'sources.partialCoverage':
    'Não existe serviço nacional espanhol em tempo real: a cobertura limita-se às comunidades autónomas listadas. Um mapa vazio noutras regiões significa "sem dados", não "sem incêndios".',

  // Liste
  'list.searchPlaceholder': 'Pesquisar ocorrência…',
  'list.filters': 'Filtros',
  'list.filterByStatus': 'Filtrar por estado',
  'list.allStatuses': 'Todos os estados',
  'list.all': 'Todos',
  'list.clear': 'Limpar',
  'list.close': 'Fechar',
  'list.collapsePanel': 'Recolher a lista',
  'list.expandPanel': 'Mostrar a lista',
  'list.open': '{count} ocorrências',
  'list.summary': '{active} ativas · {personnel} operacionais',
  'list.empty': 'Nenhuma ocorrência corresponde aos filtros.',
  'list.chipOver100': '> 100 operacionais',
  'list.chipAerial': 'Meios aéreos',
  'list.chipOngoing': 'Em combate',

  // Panneau de détail
  'detail.personnel': 'Operacionais',
  'detail.vehicles': 'Veículos',
  'detail.aircraft': 'Meios aéreos',
  'detail.partialPersonnel':
    'Contagem parcial: este serviço publica brigadas e equipas cujo efetivo não é divulgado. O número real é superior.',
  'detail.resources': 'Meios destacados',
  'detail.severityLevel': 'Nível {level}',
  'detail.conditions': 'Condições no local',
  'detail.humidity': 'Humidade',
  'detail.wind': 'Vento {direction}',
  'detail.temperature': 'Temperatura',
  'detail.precipitation': 'Precipitação',
  'detail.weatherSource': 'Estação de {station}, a {distance} km · leitura de {time}',
  'detail.noWeather': 'Sem estação meteorológica associada a esta ocorrência.',
  'detail.statusHistory': 'Histórico de estado',
  'detail.noHistory': 'Histórico indisponível',
  'detail.burnedArea': 'Área ardida estimada',
  'detail.noBurnedArea': 'Sem dados de área ardida para esta ocorrência.',
  'detail.forestStand': 'Povoamento florestal',
  'detail.scrub': 'Mato',
  'detail.agricultural': 'Agrícola',
  'detail.technical': 'Detalhes técnicos',
  'detail.nature': 'Natureza',
  'detail.altitude': 'Altitude estimada',
  'detail.alertSource': 'Fonte de alerta',
  'detail.start': 'Início',
  'detail.share': 'Partilhar',
  'detail.viewOnMap': 'Ver no mapa',
  'detail.follow': 'Seguir esta zona',
  'detail.following': 'A seguir esta zona',
  'detail.close': 'Fechar painel',
  'detail.shareText': 'Incêndio em {title} ({location}) — Estado: {status} — Operacionais: {personnel}',

  // Couche satellite
  'satellite.title': 'Deteções por satélite',
  'satellite.off': 'Desligado',
  'satellite.loading': 'A carregar…',
  'satellite.count': '{count} focos · cobertura mundial',
  'satellite.disclaimer':
    'Anomalias térmicas VIIRS (NASA FIRMS), não confirmadas no terreno. Podem corresponder a queimadas agrícolas, vulcões ou chamas industriais. Não são ocorrências da proteção civil.',
  'satellite.zoomHint': 'Aproxime o mapa para ver cada foco em detalhe.',
  'satellite.freshnessHint': 'Do mais recente ao mais antigo (24 h)',
  'satellite.tooltipTitle': 'Deteção por satélite',
  'satellite.tooltipPower': '{frp} MW · {passes} passagem(ns)',
  'satellite.tooltipUnconfirmed': 'Não confirmado no terreno',
  'satellite.legendOperational': 'Ocorrência da proteção civil',
  'satellite.legendSatellite': 'Deteção por satélite',

  // États de chargement et erreurs
  'loading.incidents': 'A carregar ocorrências…',
  'error.noConnection': 'Sem ligação ao serviço de incêndios.',
  'error.serviceStatus': 'O serviço de incêndios respondeu {status}.',
  'error.unexpected': 'Resposta inesperada do serviço de incêndios.',
  'error.satellite': 'Serviço de deteção por satélite indisponível.',
  'error.unknown': 'Erro desconhecido.',
  'error.retry': 'Tentar novamente',

  // Phases de sinistre.
  // Indexées sur `IncidentPhase` et non sur le libellé publié : c'est ce qui
  // permet de traduire l'état d'un feu catalan comme celui d'un feu portugais.
  'phase.dispatched': 'Meios a caminho',
  'phase.active': 'Em curso',
  'phase.stabilised': 'Estabilizado',
  'phase.controlled': 'Dominado',
  'phase.extinguished': 'Extinto',
  'phase.surveillance': 'Vigilância',
  'phase.closed': 'Encerrada',
  'phase.unknown': 'Estado desconhecido',

  // Natures de sinistre
  'nature.mato': 'Mato',
  'nature.povoamento': 'Povoamento florestal',
  'nature.agricola': 'Agrícola',

  // Vue historique — dados reais dos arquivos oficiais

  // Zones de surveillance — reais e guardadas neste dispositivo
  'watch.title': 'Alertas',
  'watch.conditionAll': 'Qualquer ocorrência',
  'watch.conditionMajor': 'Apenas em curso',
  'watch.delete': 'Eliminar',
  'watch.empty': 'Nenhuma área de alerta configurada. Use o formulário ao lado para criar.',
  'watch.storageNote':
    'As áreas são guardadas apenas neste dispositivo, no navegador. Não são sincronizadas nem enviadas para nenhum servidor.',
  'watch.nearest': 'A {km} km — {status}, {location}',
  'watch.noneNearby': 'Nenhuma ocorrência ativa nas proximidades.',
  'watch.wouldAlert': 'Dentro do raio escolhido: seria notificado.',
  'watch.wouldNotAlert': 'Fora do raio escolhido.',
  'watch.insideCount': '{count} ocorrências ativas na área',
  'watch.insideCountOne': '1 incêndio em curso na zona',
  'watch.insideNone': 'Sem ocorrências ativas na área',
  'watch.notifDisabled': 'Notificações do navegador desativadas.',
  'watch.notifTabOnly': 'Os alertas só são enviados enquanto este separador estiver aberto: não há notificações em segundo plano.',
  'watch.notifEnable': 'Ative-as para ser avisado enquanto este separador estiver aberto.',
  'watch.activate': 'Ativar',
  'watch.newAreaTitle': 'Nova área de alerta',
  'watch.locationName': 'Nome da localização',
  'watch.locationPlaceholder': 'Ex: Casa, Escritório, Terreno…',
  'watch.watchRadius': 'Raio de vigilância',
  'watch.alertCondition': 'Condição de alerta',
  'watch.anyIncidentHint': 'Assim que um foco for reportado.',
  'watch.majorOnly': 'Grandes incêndios (> 50 op.)',
  'watch.majorOnlyHint': 'Apenas quando há mobilização significativa.',
  'watch.quietHoursFull': 'Horas de silêncio (não perturbar)',
  'watch.until': 'até',
  'watch.cancel': 'Cancelar',
  'watch.saveAlert': 'Guardar alerta',
  'watch.needName': 'Por favor insira um nome para a localização.',
  'watch.noNotifSupport': 'O seu navegador não suporta notificações.',
  'watch.created': 'Área "{name}" criada.',

  // Commandes de la carte
  'map.zoomIn': 'Aumentar zoom',
  'map.zoomOut': 'Diminuir zoom',
  'map.locate': 'A minha localização',
  'map.locate.denied':
    'Localização recusada. Autorize o acesso à sua posição nas definições do navegador e tente novamente.',
  'map.locate.unavailable':
    'Posição indisponível. O seu dispositivo não consegue localizar-se neste momento.',
  'map.locate.timeout': 'A localização demorou demasiado. Tente novamente.',
  'map.layers': 'Camadas do mapa',
  'map.layerDark': 'Escuro (padrão)',
  'map.layerSatellite': 'Satélite',
  'map.layerTerrain': 'Topográfico',

  'time.justNow': 'agora mesmo',
  'app.name': 'Atalaia',
  'app.title': 'Atalaia — Incêndios em Portugal e Espanha · Mapa em tempo real',
  'lang.label': 'Idioma',

  // Attributions
  'credits.sources':
    'Fontes: fogos.pt · ANEPC · ICNF · Plan INFOCA · Bombers de la Generalitat · Junta de Castilla y León · NASA FIRMS',
} as const;

export type TranslationKey = keyof typeof pt;
export type Dictionary = Record<TranslationKey, string>;
