(globalThis.TURBOPACK||(globalThis.TURBOPACK=[])).push(["object"==typeof document?document.currentScript:void 0,60124,e=>{"use strict";var a=e.i(88911),o=e.i(6825),t=e.i(50871),i=e.i(76725),r=e.i(28223),n=e.i(42533),s=e.i(90814),c=e.i(84749),d=e.i(65244),l=e.i(94970),m=e.i(88301),u=e.i(37116),g=e.i(21917);class p{static instance=null;static getInstance(){return p.instance||(p.instance=new p),p.instance}getConnectomeSnapshot(){let e=o.ringAttractor.getTelemetry(),l=t.fanShapedBody.getTelemetry(),p=a.synapticMeshRouter.getTelemetry(),h=i.dtnMushroomBody.getTelemetry(),x=r.giantFiberReflex.getTelemetry(),C=n.johnstonOrgan.getTelemetry(),b=s.metabolicGovernor.getTelemetry(),v=c.opticLobe.getTelemetry(),$=d.tacticalMotorActuator.getTelemetry(),f=a.synapticMeshRouter.getAllActiveBearings(),A=f.length>0?f[0]:null,y="OPTIMAL";x.emconLockActive?y="EMCON_REFLEX":"TORPOR"===b.regime?y="TORPOR":p.meanWeight<.25||p.prunedLinksCount>.5*p.totalSynapses?y="DEGRADED":0===p.totalSynapses&&h.currentSaturationRatio>.8&&(y="CRITICAL");let E=`Conectoma Drosophila MaleCNS activo [R\xe9gimen: ${b.regime}]. Br\xfajula E-PG a ${e.headingDeg}\xb0 (${e.cardinal}). Home Vector FB a ${l.homeVector.distanceMeters}m rumbo ${l.homeVector.bearingDeg}\xb0 (${l.homeVector.cardinal}). Red sin\xe1ptica con ${p.totalSynapses} pares (${p.richClubHubs.length} hubs), DTN: ${h.totalEnqueuedRecords} engramas (${h.behavioralDrive}). Visi\xf3n T4/T5: ${v.translationalFlow.magnitude} m/s, Looming: ${v.loomingThreat.isThreatDetected?"AMENAZA":"OK"}. Actuador DNa: ${$.currentHapticMode}. Fibras gigantes: ${x.emconLockActive?"EMCON SILENCIO RADIO":"RADAR ACTIVO"}.`;return{timestamp:Date.now(),compass:{headingDeg:e.headingDeg,cardinal:e.cardinal,confidence:e.confidence,isSensoryAnchored:e.isSensoryAnchored,angularVelocityDps:e.angularVelocityDps,driftEstimateDpm:e.driftEstimateDpm,rfBearingsCount:e.rfBearings?.length||0},fanShapedBody:{homeDistanceMeters:l.homeVector.distanceMeters,homeBearingDeg:l.homeVector.bearingDeg,homeCardinal:l.homeVector.cardinal,totalDistanceTraveledMeters:l.totalDistanceTraveledMeters,position:{x:l.currentPosition.xMeters,y:l.currentPosition.yMeters,z:l.currentPosition.zMeters},hasTarget:l.goalVector.hasTarget,targetDistanceMeters:l.goalVector.distanceMeters,targetBearingDeg:l.goalVector.bearingDeg,steeringErrorDeg:l.goalVector.steeringErrorDeg},synapticRouter:{totalSynapses:p.totalSynapses,meanWeight:p.meanWeight,richClubHubsCount:p.richClubHubs.length,prunedCount:p.prunedLinksCount,lifMembranePotentialMv:p.lifMembranePotentialMv,lifQueueLength:p.lifAccumulatedCount,activeBearings:f},mushroomBody:{enqueuedRecords:h.totalEnqueuedRecords,ltpPinnedRecords:h.ltpPinnedRecords,ltdEvictedTotal:h.ltdEvictedTotal,meanValence:h.meanValence,saturationRatio:h.currentSaturationRatio,behavioralDrive:h.behavioralDrive,behavioralValenceScore:h.behavioralValenceScore,activePheromonesCount:h.activePheromonesCount,channelWeights:h.channelWeights,activeTracesCount:h.activeTracesCount,jammingEvasionActive:h.jammingEvasionActive,recommendedChannel:h.recommendedChannel,pamRewardScore:h.pamRewardScore,ppl1AversionScore:h.ppl1AversionScore},giantFiber:{state:x.emconLockActive?"EMCON_LOCKED":x.isReflexActive?"REFLEX_ACTIVE":"STANDBY",isRadioSilenced:x.emconLockActive,reflexTriggerCount:x.totalEscapesExecuted,lastEscapeLatencyMs:x.lastReflexLatencyMs,activeThreatsCount:+!!x.isReflexActive},johnstonOrgan:{acousticEnergyLevel:C.acousticEnergyLevel,windDeflectionAngleDeg:C.windDeflectionAngleDeg,vibrationFrequencyHz:C.vibrationFrequencyHz,shockEventsCount:C.shockEventsCount},metabolicGovernor:{regime:b.regime,ipcLevel:b.ipcLevel,npfLevel:b.npfLevel,batteryPct:b.batteryPct,neuralClockIntervalMs:b.neuralClockIntervalMs,estimatedStandbyHours:b.estimatedStandbyHours},opticLobe:{translationalVelocity:v.translationalFlow.magnitude,rotationalVelocityDps:v.visualAngularVelocityDegPerSec,loomingDetected:v.loomingThreat.isThreatDetected,loomingExpansionRate:v.loomingThreat.expansionRate,activeOmmatidiaCount:256},motorActuator:{currentMode:$.currentHapticMode,steeringErrorDeg:$.steeringErrorDeg,dna01Excitation:$.dna01IpsilateralExcitation,dna02Excitation:$.dna02ContralateralExcitation,totalPulsesDispatched:$.totalPulsesDispatched,cpgGaitMode:$.cpg?.gaitMode??"QUIESCENT",cpgFrequencyHz:$.cpg?.meanFrequencyHz??0,cpgTripodCoherence:$.cpg?.tripodCoherenceIndex??1,cpgTotalCycles:$.cpg?.totalGaitCycles??0},tacticalEvaluation:{meshHealth:y,aoaBearingsActive:f.length,topPeerBearing:A,summary:E},consciousnessBus:m.globalWorkspaceConsciousnessBus.getSnapshot(),criticality:u.swarmCriticality.getTelemetry(),bioCompassDual:g.bioCompassDualFusion.getTelemetry()}}getFormattedContextForCopilot(){let e=this.getConnectomeSnapshot(),a=e.synapticRouter.activeBearings.slice(0,3).map(e=>`  • Par ${e.peerId.slice(0,8)}...: Rumbo RF ${e.bearingDeg}\xb0 (Confianza ${(100*e.confidence).toFixed(0)}%, LQS: ${e.lqs}%, Muestras: ${e.samplesCount})`),o=a.length>0?`
Radiogoniometr\xeda Bio-Inercial AoA:
${a.join("\n")}`:"\nRadiogoniometría AoA: Sin marcaciones direccionales suficientes.",t=l.humanBrainOrchestrator.getSnapshot(),i=`

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
• Metabolismo IPC/NPF: R\xe9gimen ${e.metabolicGovernor.regime} (Bater\xeda: ${e.metabolicGovernor.batteryPct}%, Autonom\xeda: ${e.metabolicGovernor.estimatedStandbyHours}h)${o}${i}${n}`}evaluateConnectomeTacticalQuery(e){let a=this.getConnectomeSnapshot(),o=(e||"").toLowerCase(),t=l.humanBrainOrchestrator.getSnapshot();if(/triage|march|trauma|torniquete|isquemia|vagal|respiraci[oó]n|box breathing/i.test(o))return`🩸 **\xcdnsula Anterior & Protocolo TCCC MARCH**

• **Estado Vagal (Box Breathing 4-4-4-4):** ${t.insular.isBoxBreathingActive?`ACTIVO • Fase: ${t.insular.boxBreathingPhase} (${t.insular.phaseSecondsRemaining}s)`:"Standby / Pausado"}
• **Bajas Registradas Bajo Fuego:** ${t.insular.activeCasualtiesCount}
• **Torniquetes Aplicados:** ${t.insular.activeTourniquetsCount}
• **Alerta de Isquemia:** ${t.insular.criticalTourniquetWarning?"🚨 ¡PELIGRO DE NECROSIS IRREVERSIBLE (>90 min)!":"🟢 Sin riesgo de necrosis irreversible"}
• **Acceso:** Puedes abrir el panel TCCC desde el Mapa T\xe1ctico con el bot\xf3n [TCCC].`;if(/emboscada|decepci[oó]n|trampa|honey.*pot|teor[ií]a.*mente|tom|path loss/i.test(o))return`🛡️ **Teor\xeda de la Mente (mPFC / TPJ - Detecci\xf3n de Emboscadas)**

• **Alerta de Emboscada Activa:** ${t.theoryOfMind.activeAmbushAlertsCount>0?`🚨 \xa1ALERTA! ${t.theoryOfMind.activeAmbushAlertsCount} anomal\xedas cr\xedticas detectadas`:"🟢 Malla segura sin incongruencias físicas"}
• **Confianza Media de la Red:** ${Math.round(100*t.theoryOfMind.meanNetworkTrustScore)}%
• **Pares Auditados:** ${t.theoryOfMind.totalPeersAudited} (Sospechosos: ${t.theoryOfMind.suspiciousNodesCount})
• **F\xedsica Verificada:** Cruce de Log-Distance Path Loss (distancia vs RSSI medido) y coherencia de velocidad cinem\xe1tica (< 45 m/s).`;if(/cueva|t[uú]nel|subterr[aá]neo|entorrinal|grid.*cell|rejilla|miga/i.test(o))return`🗺️ **Corteza Entorrinal Medial (MEC - Navegaci\xf3n Hexagonal Subterr\xe1nea)**

• **Offset Local 3D:** X=${t.entorhinal.currentCoordsLocal.xMeters.toFixed(1)}m, Y=${t.entorhinal.currentCoordsLocal.yMeters.toFixed(1)}m, Z=${t.entorhinal.currentCoordsLocal.zMeters.toFixed(1)}m
• **Densidad de Rejilla:** ${(100*t.entorhinal.compositeGridActivity).toFixed(0)}% (Interferencia en 4 m\xf3dulos: λ=0.5m, 2m, 8m, 32m)
• **Hitos Grabados (Breadcrumbs):** ${t.entorhinal.breadcrumbsCount}
• **Alerta de Bordes:** ${t.entorhinal.borderProximityWarning?"⚠️ Obstáculo o pared detectada por células de borde":"🟢 Espacio despejado"}
• **Funci\xf3n:** Permite desplazamiento y retorno a ciegas sin se\xf1al satelital GNSS.`;if(/comp[aá]s.*dual|dual.*comp[aá]s|fusi[oó]n.*dual|coherencia.*fase|anclaje.*hipocamp/i.test(o)){let e=g.bioCompassDualFusion.getTelemetry();return`🧭 **Comp\xe1s Bio-Cibern\xe9tico Dual (CX Fan-Shaped Body + MEC Grid Cells)**

• **Rumbo Fused (E-PG):** **${e.headingDeg}\xb0 (${e.cardinal})**
• **Coherencia de Fase (C_coherence):** **${(100*e.phaseCoherence).toFixed(0)}%** (${e.phaseCoherenceState})
• **Deriva Inercial Estimada:** ${e.estimatedDriftMeters} metros (Resets hipocampales: ${e.hippocampalResetsCount})
• **Posici\xf3n Relativa:** X=${e.currentPosition.xMeters}m, Y=${e.currentPosition.yMeters}m, Z=${e.currentPosition.zMeters}m
• **Home Vector:** ${e.homeVector.distanceMeters}m hacia ${e.homeVector.bearingDeg}\xb0 (${e.homeVector.cardinal})
• **Error de Timoneo Fused:** ${e.fusedSteeringErrorDeg>0?`+${e.fusedSteeringErrorDeg}\xb0`:`${e.fusedSteeringErrorDeg}\xb0`} (Modo CPG: **${e.autonomousCpgSteering}**)
• **Actividad C\xe9lulas de Rejilla:** ${(100*e.gridCellActivity.compositeActivity).toFixed(0)}% (4 m\xf3dulos λ=0.5m, 2m, 8m, 32m)
• **Bucle Cerrado:** Modula directamente las motoneuronas DNa01/DNa02 del robot hex\xe1podo y emite micro-espigas AER de 14 bytes.`}if(/zero.*bandwidth|silencio.*rf|inferencia.*activa|friston|energ[ií]a.*libre|sorpresa/i.test(o))return`⚡ **Corteza Predictiva Humana (Inferencia Activa de Friston)**

• **Modo Zero-Bandwidth:** ${t.predictive.isZeroBandwidthModeActive?"🟢 ACTIVO (Emisión de 0 Bytes mientras el movimiento sea predecible)":"🔴 Desactivado"}
• **Reducci\xf3n de Tr\xe1fico RF:** ${Math.round(t.predictive.overallBandwidthReductionPct)}% de emisiones LoRa ahorradas
• **Nivel Actual de Energ\xeda Libre (Sorpresa):** ${t.predictive.currentFreeEnergy.toFixed(3)}
• **Gemelos Cinem\xe1ticos:** ${t.predictive.trackedPeersCount} nodos aliados en seguimiento predictivo descendente`;if(/barter|trueque|asedio|autarqu[ií]a|suministro|precio|econom[ií]a/i.test(o))return`⚖️ **Corteza Orbitofrontal (OFC - Valoraci\xf3n y Barter en Asedio)**

• **Autarqu\xeda Estimada del Destacamento:** **${t.orbitofrontal.autarkyDaysRemaining} d\xedas** antes del agotamiento del recurso m\xe1s escaso
• **Contratos de Trueque P2P:** ${t.orbitofrontal.activeContractsCount} acuerdos evaluados
• **Criterio de Valoraci\xf3n:** Ley de Gossen y utilidad marginal subjetiva. El agua y medicamentos multiplican su valor seg\xfan la reserva f\xedsica real.`;if(/optic|visi[oó]n|looming|amenaza.*visual|centinela|colisi[oó]n/i.test(o))return`👁️ **L\xf3bulos \xd3pticos Neurom\xf3rficos (T4/T5 & LC4 Looming)**

• **Detecci\xf3n Bal\xedstica Looming:** ${a.opticLobe.loomingDetected?"🚨 ¡AMENAZA EN APROXIMACIÓN RÁPIDA DETECTADA!":"🟢 Espacio visual despejado"}
• **Tasa de Expansi\xf3n Angular η(t):** ${a.opticLobe.loomingExpansionRate.toFixed(2)}/s (Umbral bal\xedstico: 1.20/s)
• **Odometr\xeda Visual (LPTC VS):** ${a.opticLobe.translationalVelocity.toFixed(2)} m/s
• **Rotaci\xf3n Angular Visual (LPTC HS):** ${a.opticLobe.rotationalVelocityDps.toFixed(1)} \xb0/s
• **Receptores Omatidiales:** 256 sensores (malla 16x16) activos`;if(/cpg|marcha|tr[ií]pode|hex[aá]pod|locomoci[oó]n|neuromechfly|flygym|rel[eé].*rob[oó]tico|pata/i.test(o))return`🦗 **Generador de Patrones Centrales (CPG & NeuroMechFly v2)**

• **R\xe9gimen de Marcha:** **${a.motorActuator.cpgGaitMode||"TRIPOD"}**
• **Frecuencia Media de Zancada:** ${a.motorActuator.cpgFrequencyHz||2} Hz
• **Coherencia Tr\xedpode (Kuramoto R):** ${((a.motorActuator.cpgTripodCoherence??1)*100).toFixed(1)}%
• **Ciclos de Marcha Completados:** ${a.motorActuator.cpgTotalCycles||0}
• **Modulaci\xf3n Bilateral DNa:** DNa01=${a.motorActuator.dna01Excitation.toFixed(2)} (Babor), DNa02=${a.motorActuator.dna02Excitation.toFixed(2)} (Estribor)
• **Hardware Rel\xe9 Rob\xf3tico:** Tramas binarias de 12 bytes activas con CRC-8 para streaming hacia micro-controladores ESP32-S3.`;if(/critical|criticalidad|soc|branching|ramificaci[oó]n|neurolib|avalancha|transici[oó]n.*fase|tormenta.*difusi[oó]n/i.test(o)){let e=a.criticality;return`🌐 **Criticalidad Auto-Organizada de Enjambre (SOC & neurolib)**

• **Estado de Fase Din\xe1mico:** **${e?.criticalityState||"CRITICAL"}**
• **Branching Ratio (σ):** **${e?.branchingRatio.toFixed(2)||"1.00"}** (Rango Cr\xedtico \xd3ptimo: 0.90 - 1.10)
• **Exponente Libre de Escala (α):** ${e?.estimatedAlpha.toFixed(2)||"1.50"} (P(S) ~ S^-α, valor biof\xedsico: 1.50)
• **Probabilidad de Retransmisi\xf3n Homeost\xe1tica (Prelay):** ${((e?.relayProbability??1)*100).toFixed(0)}%
• **Umbral Adaptativo K-Counter:** ${e?.adaptiveKCounterThreshold||3} vecinos concurrentes
• **Avalanchas de Red Rastreadas:** ${e?.totalAvalanchesCount||0} eventos (\xdaltima: ${e?.lastAvalancheSize||0} paquetes, ${e?.lastAvalancheDurationMs||0}ms)
• **Gobernanza:** Erradica tormentas de difusi\xf3n ALOHA en mallas densas y previene desconexiones en mallas dispersas.`}if(/stdp|mushroom|cuerpo.*fungiforme|dopamin|jamming|ppl1|pam|evasi[oó]n.*frecuenc|salto.*canal/i.test(o)){let e=a.mushroomBody,o=e.jammingEvasionActive?`🚨 ACTIVA (Salto recomendado hacia **${e.recommendedChannel||"lora_ch_0"}**)`:"🟢 Inactiva (Canales limpios)";return`🍄 **Cuerpo Fungiforme & STDP 3-Factores (Evasi\xf3n de Jamming EW)**

• **Estado de Evasi\xf3n EW:** ${o}
• **Conducta de Red (MBON):** **${e.behavioralDrive}** (Score: ${e.behavioralValenceScore>0?`+${e.behavioralValenceScore}`:e.behavioralValenceScore})
• **Dopamina PAM (Recompensa/LTP):** ${e.pamRewardScore??.5}
• **Dopamina PPL1 (Aversi\xf3n/Jamming/LTD):** ${e.ppl1AversionScore??0}
• **Huellas de Elegibilidad Activas (e_ij):** ${e.activeTracesCount??0}
• **Engramas Memorizados DTN:** ${e.enqueuedRecords} (Inmunizados LTP: ${e.ltpPinnedRecords})
• **Mecanismo Biof\xedsico:** Regla de 3 factores (Pre KC \xd7 Post MBON \xd7 DA). Ante interferencia o ca\xedda de SNR, el cl\xfaster PPL1 deprime el canal y fuerza el salto \xe1gil de frecuencia.`}if(/h[aá]ptic|vibraci[oó]n|ojos.*libres|cieg|gui[aá].*h[aá]ptic|timoneo|dna/i.test(o))return`📳 **Actuador Somatosensorial H\xe1ptico (DNa01/DNa02)**

• **Modo H\xe1ptico Actual:** **${a.motorActuator.currentMode}**
• **Error de Timoneo:** ${a.motorActuator.steeringErrorDeg>0?`+${a.motorActuator.steeringErrorDeg}\xb0 (Virar a Estribor / Derecha)`:`${a.motorActuator.steeringErrorDeg}\xb0 (Virar a Babor / Izquierda)`}
• **Excitaci\xf3n DNa01 (Babor):** ${a.motorActuator.dna01Excitation.toFixed(2)}
• **Excitaci\xf3n DNa02 (Estribor):** ${a.motorActuator.dna02Excitation.toFixed(2)}
• **Pulsos H\xe1pticos Despachados:** ${a.motorActuator.totalPulsesDispatched}
• **Navegaci\xf3n en Sigilo:** Permite avance t\xe1ctico nocturno sin encender la pantalla hacia el Home Vector o Goal Vector.`;if(/feromona|pheromone|estigmergia|rastro|enjambre.*olor|alerta.*zona/i.test(o))return`🍄 **Estigmergia de Malla & Feromonas de Enjambre (Mushroom Body)**

• **Feromonas Activas en Memoria:** ${a.mushroomBody.activePheromonesCount}
• **Propensi\xf3n Conductual:** **${a.mushroomBody.behavioralDrive}** (${a.mushroomBody.behavioralValenceScore})
• **Din\xe1mica de Desv\xedo:** Las feromonas ALARM deprimen la conductancia sin\xe1ptica de la ruta, provocando evasi\xf3n autom\xe1tica del tr\xe1fico en el sector hostil.
• **Emisi\xf3n:** Puedes difundir feromonas ALARM, TRAIL o AGGREGATION desde el Mapa T\xe1ctico o el Centro de Comando.`;if(/home.*vector|retorno|volver|nido|casa|odometr|fan.*shaped|rumbo.*casa/i.test(o))return`🧭 **Navegaci\xf3n Vectorial 3D Fan-Shaped Body (Retorno a Casa)**

• **Distancia al Punto de Partida:** ${a.fanShapedBody.homeDistanceMeters} metros
• **Rumbo Azimutal de Retorno:** ${a.fanShapedBody.homeBearingDeg}\xb0 (${a.fanShapedBody.homeCardinal})
• **Distancia Total Recorrida:** ${a.fanShapedBody.totalDistanceTraveledMeters} metros
• **Posici\xf3n Relativa:** X=${a.fanShapedBody.position.x}m (Este), Y=${a.fanShapedBody.position.y}m (Norte), Z=${a.fanShapedBody.position.z}m (Altitud Barom\xe9trica)
`+(a.fanShapedBody.hasTarget?`• **Objetivo Activo:** ${a.fanShapedBody.targetDistanceMeters}m hacia ${a.fanShapedBody.targetBearingDeg}\xb0 (Error de timoneo: ${a.fanShapedBody.steeringErrorDeg}\xb0)
`:"")+`• **Integraci\xf3n:** Matriz de 16 columnas x 9 capas P-FN y Δ7 activas en tiempo real.`;if(/metabol|torpor|bater|ipc|npf|consumo.*energ|reloj.*sin[aá]ptico/i.test(o))return`⚡ **Gobernador Metab\xf3lico Neuroendocrino (IPC / NPF)**

• **R\xe9gimen Operacional:** **${a.metabolicGovernor.regime}**
• **Nivel de Bater\xeda:** ${a.metabolicGovernor.batteryPct}%
• **Autonom\xeda Estimada en Malla:** ~${a.metabolicGovernor.estimatedStandbyHours} horas
• **\xcdndice de Saciedad (IPC):** ${(100*a.metabolicGovernor.ipcLevel).toFixed(0)}%
• **\xcdndice de Austeridad (NPF):** ${(100*a.metabolicGovernor.npfLevel).toFixed(0)}%
• **Intervalo del Reloj Sin\xe1ptico:** ${a.metabolicGovernor.neuralClockIntervalMs} ms (${1e3/a.metabolicGovernor.neuralClockIntervalMs} Hz)
• **Impacto Operativo:** ${"TORPOR"===a.metabolicGovernor.regime?"Máxima conservación activa. Tráfico LoRa limitado a balizas SOS.":"Operación fluida con refresco nominal."}`;if(/bearing|radiogoniometr|aoa|direcci[oó]n.*rf|l[oó]bulo/i.test(o)){if(0===a.synapticRouter.activeBearings.length)return`🧭 **Radiogoniometr\xeda Bio-Inercial AoA (Direction-Finding)**

• **Estado:** No se han acumulado suficientes muestras angulares en los 16 sectores para una soluci\xf3n confiable.
• **Rumbo Actual del Dispositivo (E-PG):** ${a.compass.headingDeg}\xb0 (${a.compass.cardinal})
• **Procedimiento de Calibraci\xf3n:** Rota lentamente el dispositivo en 360\xb0 en el plano horizontal para muestrear la se\xf1al LoRa/BLE en todos los sectores.`;let e=a.synapticRouter.activeBearings.map((e,a)=>`**${a+1}. Nodo ${e.peerId.slice(0,12)}...**
• **Marcaci\xf3n Estimada (Azimut):** ${e.bearingDeg}\xb0 (Respecto al Norte magn\xe9tico/inercial)
• **Confianza Vectorial:** ${(100*e.confidence).toFixed(1)}%
• **Calidad de Se\xf1al LQS:** ${e.lqs}/100
• **Muestras Angulares:** ${e.samplesCount} paquetes en 16 sectores`).join("\n\n");return`🎯 **Soluci\xf3n de Radiogoniometr\xeda Bio-Inercial AoA**

${e}`}return`🧠 **Telemetr\xeda Conect\xf3mica Unificada (Drosophila MaleCNS v1.0)**

**1. Complejo Central (Central Complex / CX):**
• Rumbo E-PG: **${a.compass.headingDeg}\xb0 (${a.compass.cardinal})** (Confianza: ${(100*a.compass.confidence).toFixed(0)}%)
• Home Vector FB: **${a.fanShapedBody.homeDistanceMeters} m** hacia **${a.fanShapedBody.homeBearingDeg}\xb0** (${a.fanShapedBody.homeCardinal})

**2. Enrutador Sin\xe1ptico Hebbiano & AoA:**
• Sinapsis Activas: ${a.synapticRouter.totalSynapses} pares | Hubs Troncales: ${a.synapticRouter.richClubHubsCount}
• Nodos con Marcaci\xf3n AoA Activa: ${a.synapticRouter.activeBearings.length}

**3. Memoria Fungiforme DTN & Conducta:**
• Engramas Asociativos: ${a.mushroomBody.enqueuedRecords} (Inmunes LTP: ${a.mushroomBody.ltpPinnedRecords})
• Propensi\xf3n Conductual: **${a.mushroomBody.behavioralDrive}** (Balance: ${a.mushroomBody.behavioralValenceScore})
• Feromonas de Enjambre Activas: ${a.mushroomBody.activePheromonesCount}

**4. Sistema de Fibras Gigantes (EW / Escape):**
• Estado: ${a.giantFiber.state} | Silencio EMCON: ${a.giantFiber.isRadioSilenced?"🔴 ACTIVO":"🟢 RECEPTOR HABILITADO"}

**5. \xd3rgano de Johnston & Metabolismo:**
• Nivel Ac\xfastico JO: ${(100*a.johnstonOrgan.acousticEnergyLevel).toFixed(0)}% (${a.johnstonOrgan.vibrationFrequencyHz} Hz) | Choques: ${a.johnstonOrgan.shockEventsCount}
• R\xe9gimen Metab\xf3lico: **${a.metabolicGovernor.regime}** (Bater\xeda: ${a.metabolicGovernor.batteryPct}%, Est. Standby: ${a.metabolicGovernor.estimatedStandbyHours}h)`}}let h=p.getInstance();e.s(["ConnectomeCortexBridge",()=>p,"connectomeCortexBridge",0,h])}]);