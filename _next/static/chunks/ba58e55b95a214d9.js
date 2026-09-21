(globalThis.TURBOPACK||(globalThis.TURBOPACK=[])).push(["object"==typeof document?document.currentScript:void 0,60124,e=>{"use strict";var o=e.i(88911),a=e.i(6825),t=e.i(50871),i=e.i(76725),r=e.i(28223),n=e.i(42533),s=e.i(90814),c=e.i(84749),d=e.i(65244),l=e.i(94970),m=e.i(88301);class u{static instance=null;static getInstance(){return u.instance||(u.instance=new u),u.instance}getConnectomeSnapshot(){let e=a.ringAttractor.getTelemetry(),l=t.fanShapedBody.getTelemetry(),u=o.synapticMeshRouter.getTelemetry(),g=i.dtnMushroomBody.getTelemetry(),p=r.giantFiberReflex.getTelemetry(),h=n.johnstonOrgan.getTelemetry(),x=s.metabolicGovernor.getTelemetry(),b=c.opticLobe.getTelemetry(),v=d.tacticalMotorActuator.getTelemetry(),C=o.synapticMeshRouter.getAllActiveBearings(),$=C.length>0?C[0]:null,f="OPTIMAL";p.emconLockActive?f="EMCON_REFLEX":"TORPOR"===x.regime?f="TORPOR":u.meanWeight<.25||u.prunedLinksCount>.5*u.totalSynapses?f="DEGRADED":0===u.totalSynapses&&g.currentSaturationRatio>.8&&(f="CRITICAL");let A=`Conectoma Drosophila MaleCNS activo [R\xe9gimen: ${x.regime}]. Br\xfajula E-PG a ${e.headingDeg}\xb0 (${e.cardinal}). Home Vector FB a ${l.homeVector.distanceMeters}m rumbo ${l.homeVector.bearingDeg}\xb0 (${l.homeVector.cardinal}). Red sin\xe1ptica con ${u.totalSynapses} pares (${u.richClubHubs.length} hubs), DTN: ${g.totalEnqueuedRecords} engramas (${g.behavioralDrive}). Visi\xf3n T4/T5: ${b.translationalFlow.magnitude} m/s, Looming: ${b.loomingThreat.isThreatDetected?"AMENAZA":"OK"}. Actuador DNa: ${v.currentHapticMode}. Fibras gigantes: ${p.emconLockActive?"EMCON SILENCIO RADIO":"RADAR ACTIVO"}.`;return{timestamp:Date.now(),compass:{headingDeg:e.headingDeg,cardinal:e.cardinal,confidence:e.confidence,isSensoryAnchored:e.isSensoryAnchored,angularVelocityDps:e.angularVelocityDps,driftEstimateDpm:e.driftEstimateDpm,rfBearingsCount:e.rfBearings?.length||0},fanShapedBody:{homeDistanceMeters:l.homeVector.distanceMeters,homeBearingDeg:l.homeVector.bearingDeg,homeCardinal:l.homeVector.cardinal,totalDistanceTraveledMeters:l.totalDistanceTraveledMeters,position:{x:l.currentPosition.xMeters,y:l.currentPosition.yMeters,z:l.currentPosition.zMeters},hasTarget:l.goalVector.hasTarget,targetDistanceMeters:l.goalVector.distanceMeters,targetBearingDeg:l.goalVector.bearingDeg,steeringErrorDeg:l.goalVector.steeringErrorDeg},synapticRouter:{totalSynapses:u.totalSynapses,meanWeight:u.meanWeight,richClubHubsCount:u.richClubHubs.length,prunedCount:u.prunedLinksCount,lifMembranePotentialMv:u.lifMembranePotentialMv,lifQueueLength:u.lifAccumulatedCount,activeBearings:C},mushroomBody:{enqueuedRecords:g.totalEnqueuedRecords,ltpPinnedRecords:g.ltpPinnedRecords,ltdEvictedTotal:g.ltdEvictedTotal,meanValence:g.meanValence,saturationRatio:g.currentSaturationRatio,behavioralDrive:g.behavioralDrive,behavioralValenceScore:g.behavioralValenceScore,activePheromonesCount:g.activePheromonesCount},giantFiber:{state:p.emconLockActive?"EMCON_LOCKED":p.isReflexActive?"REFLEX_ACTIVE":"STANDBY",isRadioSilenced:p.emconLockActive,reflexTriggerCount:p.totalEscapesExecuted,lastEscapeLatencyMs:p.lastReflexLatencyMs,activeThreatsCount:+!!p.isReflexActive},johnstonOrgan:{acousticEnergyLevel:h.acousticEnergyLevel,windDeflectionAngleDeg:h.windDeflectionAngleDeg,vibrationFrequencyHz:h.vibrationFrequencyHz,shockEventsCount:h.shockEventsCount},metabolicGovernor:{regime:x.regime,ipcLevel:x.ipcLevel,npfLevel:x.npfLevel,batteryPct:x.batteryPct,neuralClockIntervalMs:x.neuralClockIntervalMs,estimatedStandbyHours:x.estimatedStandbyHours},opticLobe:{translationalVelocity:b.translationalFlow.magnitude,rotationalVelocityDps:b.visualAngularVelocityDegPerSec,loomingDetected:b.loomingThreat.isThreatDetected,loomingExpansionRate:b.loomingThreat.expansionRate,activeOmmatidiaCount:256},motorActuator:{currentMode:v.currentHapticMode,steeringErrorDeg:v.steeringErrorDeg,dna01Excitation:v.dna01IpsilateralExcitation,dna02Excitation:v.dna02ContralateralExcitation,totalPulsesDispatched:v.totalPulsesDispatched},tacticalEvaluation:{meshHealth:f,aoaBearingsActive:C.length,topPeerBearing:$,summary:A},consciousnessBus:m.globalWorkspaceConsciousnessBus.getSnapshot()}}getFormattedContextForCopilot(){let e=this.getConnectomeSnapshot(),o=e.synapticRouter.activeBearings.slice(0,3).map(e=>`  • Par ${e.peerId.slice(0,8)}...: Rumbo RF ${e.bearingDeg}\xb0 (Confianza ${(100*e.confidence).toFixed(0)}%, LQS: ${e.lqs}%, Muestras: ${e.samplesCount})`),a=o.length>0?`
Radiogoniometr\xeda Bio-Inercial AoA:
${o.join("\n")}`:"\nRadiogoniometría AoA: Sin marcaciones direccionales suficientes.",t=l.humanBrainOrchestrator.getSnapshot(),i=`

[Neocorteza Bio-Cibern\xe9tica Humana (7 N\xfacleos Cognitivos)]:
• Alerta General: ${t.alertLevel} (${t.synthesisSummary})
• Odometr\xeda Entorrinal MEC: [X=${t.entorhinal.currentCoordsLocal.xMeters.toFixed(1)}, Y=${t.entorhinal.currentCoordsLocal.yMeters.toFixed(1)}, Z=${t.entorhinal.currentCoordsLocal.zMeters.toFixed(1)}]m | Actividad: ${(100*t.entorhinal.compositeGridActivity).toFixed(0)}%
• Hipocampo CA3/DG: ${t.hippocampal.patternCompletionsCount} tramas mutiladas recuperadas por pattern completion
• Inferencia Activa (Zero-Bandwidth): ${t.predictive.isZeroBandwidthModeActive?"ACTIVO":"NO"} | Ahorro RF: ${t.predictive.overallBandwidthReductionPct.toFixed(0)}% | Sorpresa: ${t.predictive.currentFreeEnergy.toFixed(2)}
• Teor\xeda de la Mente ToM: Confianza ${Math.round(100*t.theoryOfMind.meanNetworkTrustScore)}% | Alertas Emboscada: ${t.theoryOfMind.activeAmbushAlertsCount}
• Memoria Ejecutiva DLPFC: Objetivo "${t.workingMemory.activeTask?.title||"Completado"}" | Progreso: ${t.workingMemory.overallProgressPct}%
• \xcdnsula Anterior TCCC: Vagal ${t.insular.isBoxBreathingActive?t.insular.boxBreathingPhase:"STANDBY"} | Bajas: ${t.insular.activeCasualtiesCount} | Torniquetes: ${t.insular.activeTourniquetsCount}
• Econom\xeda OFC: Autarqu\xeda: ${t.orbitofrontal.autarkyDaysRemaining} d\xedas | Contratos Barter: ${t.orbitofrontal.activeContractsCount}`,r=m.globalWorkspaceConsciousnessBus.getSnapshot(),n=`

[Espacio de Trabajo Global (GNWT & Conciencia de Enjambre)]:
• Ignici\xf3n Atencional: ${r.isIgnited?"🔥 IGNITADO":"🟢 LATENTE"} (Intensidad: ${(100*r.ignitionIntensity).toFixed(0)}%)
• Foco Consciente: ${r.consciousFocus} (${r.salienceWinner.rationale})
• Integraci\xf3n Φ (IIT): ${(10*r.phiApprox).toFixed(1)}/10 | Energ\xeda Libre F: ${r.variationalFreeEnergy.toFixed(3)}
• Sincronizaci\xf3n Kuramoto: ${(100*r.kuramotoOrderR).toFixed(1)}% coherencia de enjambre`;return`[Conectoma Bio-Cibern\xe9tico Drosophila MaleCNS v1.0]:
• Rumbo E-PG: ${e.compass.headingDeg}\xb0 (${e.compass.cardinal}, Conf: ${(100*e.compass.confidence).toFixed(0)}%, Anclaje: ${e.compass.isSensoryAnchored?"OK":"INERCIAL"})
• Navegaci\xf3n FB (Home Vector): ${e.fanShapedBody.homeDistanceMeters}m hacia ${e.fanShapedBody.homeBearingDeg}\xb0 (${e.fanShapedBody.homeCardinal}) | Recorrido: ${e.fanShapedBody.totalDistanceTraveledMeters}m
• Red Sin\xe1ptica: ${e.synapticRouter.totalSynapses} pares | Conductancia: ${e.synapticRouter.meanWeight.toFixed(2)} | Rich-Club: ${e.synapticRouter.richClubHubsCount}
• Memoria MB: ${e.mushroomBody.enqueuedRecords} engramas | Conducta: ${e.mushroomBody.behavioralDrive} | Feromonas: ${e.mushroomBody.activePheromonesCount}
• Visi\xf3n T4/T5 & LC4: Flujo ${e.opticLobe.translationalVelocity.toFixed(2)} m/s | Looming: ${e.opticLobe.loomingDetected?"🚨 AMENAZA BALÍSTICA":"DESPEJADO"}
• Actuador H\xe1ptico DNa: Modo ${e.motorActuator.currentMode} (Error: ${e.motorActuator.steeringErrorDeg}\xb0)
• Fibras Gigantes: ${e.giantFiber.state} (EMCON: ${e.giantFiber.isRadioSilenced?"ACTIVO":"NO"})
• Sensor JO: ${(100*e.johnstonOrgan.acousticEnergyLevel).toFixed(0)}% energ\xeda ac\xfastica (${e.johnstonOrgan.vibrationFrequencyHz} Hz)
• Metabolismo IPC/NPF: R\xe9gimen ${e.metabolicGovernor.regime} (Bater\xeda: ${e.metabolicGovernor.batteryPct}%, Autonom\xeda: ${e.metabolicGovernor.estimatedStandbyHours}h)${a}${i}${n}`}evaluateConnectomeTacticalQuery(e){let o=this.getConnectomeSnapshot(),a=(e||"").toLowerCase(),t=l.humanBrainOrchestrator.getSnapshot();if(/triage|march|trauma|torniquete|isquemia|vagal|respiraci[oó]n|box breathing/i.test(a))return`🩸 **\xcdnsula Anterior & Protocolo TCCC MARCH**

• **Estado Vagal (Box Breathing 4-4-4-4):** ${t.insular.isBoxBreathingActive?`ACTIVO • Fase: ${t.insular.boxBreathingPhase} (${t.insular.phaseSecondsRemaining}s)`:"Standby / Pausado"}
• **Bajas Registradas Bajo Fuego:** ${t.insular.activeCasualtiesCount}
• **Torniquetes Aplicados:** ${t.insular.activeTourniquetsCount}
• **Alerta de Isquemia:** ${t.insular.criticalTourniquetWarning?"🚨 ¡PELIGRO DE NECROSIS IRREVERSIBLE (>90 min)!":"🟢 Sin riesgo de necrosis irreversible"}
• **Acceso:** Puedes abrir el panel TCCC desde el Mapa T\xe1ctico con el bot\xf3n [TCCC].`;if(/emboscada|decepci[oó]n|trampa|honey.*pot|teor[ií]a.*mente|tom|path loss/i.test(a))return`🛡️ **Teor\xeda de la Mente (mPFC / TPJ - Detecci\xf3n de Emboscadas)**

• **Alerta de Emboscada Activa:** ${t.theoryOfMind.activeAmbushAlertsCount>0?`🚨 \xa1ALERTA! ${t.theoryOfMind.activeAmbushAlertsCount} anomal\xedas cr\xedticas detectadas`:"🟢 Malla segura sin incongruencias físicas"}
• **Confianza Media de la Red:** ${Math.round(100*t.theoryOfMind.meanNetworkTrustScore)}%
• **Pares Auditados:** ${t.theoryOfMind.totalPeersAudited} (Sospechosos: ${t.theoryOfMind.suspiciousNodesCount})
• **F\xedsica Verificada:** Cruce de Log-Distance Path Loss (distancia vs RSSI medido) y coherencia de velocidad cinem\xe1tica (< 45 m/s).`;if(/cueva|t[uú]nel|subterr[aá]neo|entorrinal|grid.*cell|rejilla|miga/i.test(a))return`🗺️ **Corteza Entorrinal Medial (MEC - Navegaci\xf3n Hexagonal Subterr\xe1nea)**

• **Offset Local 3D:** X=${t.entorhinal.currentCoordsLocal.xMeters.toFixed(1)}m, Y=${t.entorhinal.currentCoordsLocal.yMeters.toFixed(1)}m, Z=${t.entorhinal.currentCoordsLocal.zMeters.toFixed(1)}m
• **Densidad de Rejilla:** ${(100*t.entorhinal.compositeGridActivity).toFixed(0)}% (Interferencia en 4 m\xf3dulos: λ=0.5m, 2m, 8m, 32m)
• **Hitos Grabados (Breadcrumbs):** ${t.entorhinal.breadcrumbsCount}
• **Alerta de Bordes:** ${t.entorhinal.borderProximityWarning?"⚠️ Obstáculo o pared detectada por células de borde":"🟢 Espacio despejado"}
• **Funci\xf3n:** Permite desplazamiento y retorno a ciegas sin se\xf1al satelital GNSS.`;if(/zero.*bandwidth|silencio.*rf|inferencia.*activa|friston|energ[ií]a.*libre|sorpresa/i.test(a))return`⚡ **Corteza Predictiva Humana (Inferencia Activa de Friston)**

• **Modo Zero-Bandwidth:** ${t.predictive.isZeroBandwidthModeActive?"🟢 ACTIVO (Emisión de 0 Bytes mientras el movimiento sea predecible)":"🔴 Desactivado"}
• **Reducci\xf3n de Tr\xe1fico RF:** ${Math.round(t.predictive.overallBandwidthReductionPct)}% de emisiones LoRa ahorradas
• **Nivel Actual de Energ\xeda Libre (Sorpresa):** ${t.predictive.currentFreeEnergy.toFixed(3)}
• **Gemelos Cinem\xe1ticos:** ${t.predictive.trackedPeersCount} nodos aliados en seguimiento predictivo descendente`;if(/barter|trueque|asedio|autarqu[ií]a|suministro|precio|econom[ií]a/i.test(a))return`⚖️ **Corteza Orbitofrontal (OFC - Valoraci\xf3n y Barter en Asedio)**

• **Autarqu\xeda Estimada del Destacamento:** **${t.orbitofrontal.autarkyDaysRemaining} d\xedas** antes del agotamiento del recurso m\xe1s escaso
• **Contratos de Trueque P2P:** ${t.orbitofrontal.activeContractsCount} acuerdos evaluados
• **Criterio de Valoraci\xf3n:** Ley de Gossen y utilidad marginal subjetiva. El agua y medicamentos multiplican su valor seg\xfan la reserva f\xedsica real.`;if(/optic|visi[oó]n|looming|amenaza.*visual|centinela|colisi[oó]n/i.test(a))return`👁️ **L\xf3bulos \xd3pticos Neurom\xf3rficos (T4/T5 & LC4 Looming)**

• **Detecci\xf3n Bal\xedstica Looming:** ${o.opticLobe.loomingDetected?"🚨 ¡AMENAZA EN APROXIMACIÓN RÁPIDA DETECTADA!":"🟢 Espacio visual despejado"}
• **Tasa de Expansi\xf3n Angular η(t):** ${o.opticLobe.loomingExpansionRate.toFixed(2)}/s (Umbral bal\xedstico: 1.20/s)
• **Odometr\xeda Visual (LPTC VS):** ${o.opticLobe.translationalVelocity.toFixed(2)} m/s
• **Rotaci\xf3n Angular Visual (LPTC HS):** ${o.opticLobe.rotationalVelocityDps.toFixed(1)} \xb0/s
• **Receptores Omatidiales:** 256 sensores (malla 16x16) activos`;if(/h[aá]ptic|vibraci[oó]n|ojos.*libres|cieg|gui[aá].*h[aá]ptic|timoneo|dna/i.test(a))return`📳 **Actuador Somatosensorial H\xe1ptico (DNa01/DNa02)**

• **Modo H\xe1ptico Actual:** **${o.motorActuator.currentMode}**
• **Error de Timoneo:** ${o.motorActuator.steeringErrorDeg>0?`+${o.motorActuator.steeringErrorDeg}\xb0 (Virar a Estribor / Derecha)`:`${o.motorActuator.steeringErrorDeg}\xb0 (Virar a Babor / Izquierda)`}
• **Excitaci\xf3n DNa01 (Babor):** ${o.motorActuator.dna01Excitation.toFixed(2)}
• **Excitaci\xf3n DNa02 (Estribor):** ${o.motorActuator.dna02Excitation.toFixed(2)}
• **Pulsos H\xe1pticos Despachados:** ${o.motorActuator.totalPulsesDispatched}
• **Navegaci\xf3n en Sigilo:** Permite avance t\xe1ctico nocturno sin encender la pantalla hacia el Home Vector o Goal Vector.`;if(/feromona|pheromone|estigmergia|rastro|enjambre.*olor|alerta.*zona/i.test(a))return`🍄 **Estigmergia de Malla & Feromonas de Enjambre (Mushroom Body)**

• **Feromonas Activas en Memoria:** ${o.mushroomBody.activePheromonesCount}
• **Propensi\xf3n Conductual:** **${o.mushroomBody.behavioralDrive}** (${o.mushroomBody.behavioralValenceScore})
• **Din\xe1mica de Desv\xedo:** Las feromonas ALARM deprimen la conductancia sin\xe1ptica de la ruta, provocando evasi\xf3n autom\xe1tica del tr\xe1fico en el sector hostil.
• **Emisi\xf3n:** Puedes difundir feromonas ALARM, TRAIL o AGGREGATION desde el Mapa T\xe1ctico o el Centro de Comando.`;if(/home.*vector|retorno|volver|nido|casa|odometr|fan.*shaped|rumbo.*casa/i.test(a))return`🧭 **Navegaci\xf3n Vectorial 3D Fan-Shaped Body (Retorno a Casa)**

• **Distancia al Punto de Partida:** ${o.fanShapedBody.homeDistanceMeters} metros
• **Rumbo Azimutal de Retorno:** ${o.fanShapedBody.homeBearingDeg}\xb0 (${o.fanShapedBody.homeCardinal})
• **Distancia Total Recorrida:** ${o.fanShapedBody.totalDistanceTraveledMeters} metros
• **Posici\xf3n Relativa:** X=${o.fanShapedBody.position.x}m (Este), Y=${o.fanShapedBody.position.y}m (Norte), Z=${o.fanShapedBody.position.z}m (Altitud Barom\xe9trica)
`+(o.fanShapedBody.hasTarget?`• **Objetivo Activo:** ${o.fanShapedBody.targetDistanceMeters}m hacia ${o.fanShapedBody.targetBearingDeg}\xb0 (Error de timoneo: ${o.fanShapedBody.steeringErrorDeg}\xb0)
`:"")+`• **Integraci\xf3n:** Matriz de 16 columnas x 9 capas P-FN y Δ7 activas en tiempo real.`;if(/metabol|torpor|bater|ipc|npf|consumo.*energ|reloj.*sin[aá]ptico/i.test(a))return`⚡ **Gobernador Metab\xf3lico Neuroendocrino (IPC / NPF)**

• **R\xe9gimen Operacional:** **${o.metabolicGovernor.regime}**
• **Nivel de Bater\xeda:** ${o.metabolicGovernor.batteryPct}%
• **Autonom\xeda Estimada en Malla:** ~${o.metabolicGovernor.estimatedStandbyHours} horas
• **\xcdndice de Saciedad (IPC):** ${(100*o.metabolicGovernor.ipcLevel).toFixed(0)}%
• **\xcdndice de Austeridad (NPF):** ${(100*o.metabolicGovernor.npfLevel).toFixed(0)}%
• **Intervalo del Reloj Sin\xe1ptico:** ${o.metabolicGovernor.neuralClockIntervalMs} ms (${1e3/o.metabolicGovernor.neuralClockIntervalMs} Hz)
• **Impacto Operativo:** ${"TORPOR"===o.metabolicGovernor.regime?"Máxima conservación activa. Tráfico LoRa limitado a balizas SOS.":"Operación fluida con refresco nominal."}`;if(/bearing|radiogoniometr|aoa|direcci[oó]n.*rf|l[oó]bulo/i.test(a)){if(0===o.synapticRouter.activeBearings.length)return`🧭 **Radiogoniometr\xeda Bio-Inercial AoA (Direction-Finding)**

• **Estado:** No se han acumulado suficientes muestras angulares en los 16 sectores para una soluci\xf3n confiable.
• **Rumbo Actual del Dispositivo (E-PG):** ${o.compass.headingDeg}\xb0 (${o.compass.cardinal})
• **Procedimiento de Calibraci\xf3n:** Rota lentamente el dispositivo en 360\xb0 en el plano horizontal para muestrear la se\xf1al LoRa/BLE en todos los sectores.`;let e=o.synapticRouter.activeBearings.map((e,o)=>`**${o+1}. Nodo ${e.peerId.slice(0,12)}...**
• **Marcaci\xf3n Estimada (Azimut):** ${e.bearingDeg}\xb0 (Respecto al Norte magn\xe9tico/inercial)
• **Confianza Vectorial:** ${(100*e.confidence).toFixed(1)}%
• **Calidad de Se\xf1al LQS:** ${e.lqs}/100
• **Muestras Angulares:** ${e.samplesCount} paquetes en 16 sectores`).join("\n\n");return`🎯 **Soluci\xf3n de Radiogoniometr\xeda Bio-Inercial AoA**

${e}`}return`🧠 **Telemetr\xeda Conect\xf3mica Unificada (Drosophila MaleCNS v1.0)**

**1. Complejo Central (Central Complex / CX):**
• Rumbo E-PG: **${o.compass.headingDeg}\xb0 (${o.compass.cardinal})** (Confianza: ${(100*o.compass.confidence).toFixed(0)}%)
• Home Vector FB: **${o.fanShapedBody.homeDistanceMeters} m** hacia **${o.fanShapedBody.homeBearingDeg}\xb0** (${o.fanShapedBody.homeCardinal})

**2. Enrutador Sin\xe1ptico Hebbiano & AoA:**
• Sinapsis Activas: ${o.synapticRouter.totalSynapses} pares | Hubs Troncales: ${o.synapticRouter.richClubHubsCount}
• Nodos con Marcaci\xf3n AoA Activa: ${o.synapticRouter.activeBearings.length}

**3. Memoria Fungiforme DTN & Conducta:**
• Engramas Asociativos: ${o.mushroomBody.enqueuedRecords} (Inmunes LTP: ${o.mushroomBody.ltpPinnedRecords})
• Propensi\xf3n Conductual: **${o.mushroomBody.behavioralDrive}** (Balance: ${o.mushroomBody.behavioralValenceScore})
• Feromonas de Enjambre Activas: ${o.mushroomBody.activePheromonesCount}

**4. Sistema de Fibras Gigantes (EW / Escape):**
• Estado: ${o.giantFiber.state} | Silencio EMCON: ${o.giantFiber.isRadioSilenced?"🔴 ACTIVO":"🟢 RECEPTOR HABILITADO"}

**5. \xd3rgano de Johnston & Metabolismo:**
• Nivel Ac\xfastico JO: ${(100*o.johnstonOrgan.acousticEnergyLevel).toFixed(0)}% (${o.johnstonOrgan.vibrationFrequencyHz} Hz) | Choques: ${o.johnstonOrgan.shockEventsCount}
• R\xe9gimen Metab\xf3lico: **${o.metabolicGovernor.regime}** (Bater\xeda: ${o.metabolicGovernor.batteryPct}%, Est. Standby: ${o.metabolicGovernor.estimatedStandbyHours}h)`}}let g=u.getInstance();e.s(["ConnectomeCortexBridge",()=>u,"connectomeCortexBridge",0,g])}]);