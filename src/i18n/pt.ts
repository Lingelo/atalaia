/**
 * Dictionnaire de référence (portugais).
 *
 * Ce fichier fait AUTORITÉ : le type `TranslationKey` en est dérivé, et les
 * autres langues doivent satisfaire `Dictionary`. Une clé oubliée dans une
 * traduction casse donc la compilation, jamais l'affichage à l'exécution.
 *
 * PORTÉE : uniquement l'habillage de l'interface. Les DONNÉES restent dans la
 * langue de la source — toponymes (« Vila Verde »), libellés bruts. Seules deux
 * familles sont traduisibles parce qu'on les indexe sur un code et non sur un
 * texte : les statuts (via `statusCode`) et les natures de sinistre.
 */

export const pt = {
  // Navigation
  'nav.dashboard': 'Dashboard',
  'nav.analytics': 'Histórico',
  'nav.watchZones': 'Alertas',
  'nav.map': 'Mapa',
  'nav.stats': 'Dados',
  'nav.alerts': 'Alertas',

  // Périmètre affiché
  'scope.label': 'Âmbito',
  'scope.portugal': 'Portugal',
  'scope.europe': 'Europa',
  'scope.portugal.hint': 'Ocorrências da proteção civil',
  'scope.europe.hint': 'Deteções por satélite',

  // Bandeau de statistiques
  'stats.activeOccurrences': 'ocorrências ativas',
  'stats.personnel': 'operacionais',
  'stats.vehicles': 'veículos',
  'stats.aircraft': 'meios aéreos',
  'stats.detections': 'focos detetados',
  'stats.strongest': 'foco mais intenso',
  'stats.countries': 'PT, ES, FR e vizinhança',
  'stats.refresh': 'Atualizar',
  'stats.refreshing': 'A atualizar…',
  'stats.refreshNow': 'Atualizar agora',
  'stats.updated': 'Atualizado {time}',

  // Liste
  'list.searchPlaceholder': 'Pesquisar ocorrência…',
  'list.filters': 'Filtros',
  'list.filterByStatus': 'Filtrar por estado',
  'list.allStatuses': 'Todos os estados',
  'list.all': 'Todos',
  'list.clear': 'Limpar',
  'list.close': 'Fechar',
  'list.open': '{count} ocorrências',
  'list.openDetections': '{count} focos',
  'list.summary': '{active} ativas · {personnel} operacionais',
  'list.summaryDetections': '{count} focos · satélite',
  'list.empty': 'Nenhuma ocorrência corresponde aos filtros.',
  'list.chipOver100': '> 100 operacionais',
  'list.chipAerial': 'Meios aéreos',
  'list.chipOngoing': 'Em combate',
  'list.detectionRow': '{frp} MW · {passes} passagem(ns)',

  // Panneau de détail
  'detail.personnel': 'Operacionais',
  'detail.vehicles': 'Veículos',
  'detail.aircraft': 'Meios aéreos',
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
  'satellite.count': '{count} focos · PT, ES, FR e vizinhança',
  'satellite.disclaimer':
    'Anomalias térmicas VIIRS (NASA FIRMS), não confirmadas no terreno. Podem corresponder a queimadas agrícolas. Não são ocorrências da proteção civil.',
  'satellite.zoomHint': 'Aproxime o mapa para ver cada foco em detalhe.',
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

  // Statuts (indexés sur statusCode — voir src/lib/status.ts)
  'status.1': 'Despacho',
  'status.2': 'Despacho de 1º Alerta',
  'status.3': 'Chegada ao TO',
  'status.4': 'Despacho de 1º Alerta',
  'status.5': 'Em Curso',
  'status.6': 'Chegada ao TO',
  'status.7': 'Em Resolução',
  'status.8': 'Conclusão',
  'status.9': 'Vigilância',
  'status.10': 'Encerrada',
  'status.unknown': 'Estado {code}',

  // Natures de sinistre
  'nature.mato': 'Mato',
  'nature.povoamento': 'Povoamento florestal',
  'nature.agricola': 'Agrícola',

  // Vue historique (dados de maquete)
  'analytics.title': 'Histórico',
  'analytics.mockWarning':
    'Esta vista mostra dados de demonstração, não dados reais. Requer a ingestão do histórico.',
  'analytics.occurrences': 'Ocorrências',
  'analytics.burnedArea': 'Área ardida',
  'analytics.resources': 'Meios',
  'analytics.district': 'Distrito',
  'analytics.year': 'Ano',
  'analytics.records': '{count} registos',

  // Zones de surveillance (dados de maquete)
  'watch.title': 'Alertas',
  'watch.mockWarning':
    'Estas zonas são de demonstração: não são guardadas nem geram notificações reais.',
  'watch.newZone': 'Nova área',
  'watch.name': 'Nome',
  'watch.radius': 'Raio',
  'watch.condition': 'Condição',
  'watch.conditionAll': 'Qualquer ocorrência',
  'watch.conditionMajor': 'Apenas em curso',
  'watch.quietHours': 'Horário de silêncio',
  'watch.delete': 'Eliminar',
  'watch.save': 'Guardar',

  // Sélecteur de langue
  'stats.highConfidence': 'alta confiança',
  'stats.multiPass': 'multi-passagem',
  'time.justNow': 'agora mesmo',
  'app.name': 'Atalaia',
  'app.title': 'Atalaia — Incêndios em Portugal, Espanha e França · Mapa em tempo real',
  'lang.label': 'Idioma',

  // Attributions
  'credits.sources': 'Fontes: fogos.pt · ANEPC · ICNF · NASA FIRMS',
} as const;

export type TranslationKey = keyof typeof pt;
export type Dictionary = Record<TranslationKey, string>;
