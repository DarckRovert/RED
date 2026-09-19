(globalThis.TURBOPACK||(globalThis.TURBOPACK=[])).push(["object"==typeof document?document.currentScript:void 0,60124,e=>{"use strict";var a=e.i(88911),o=e.i(6825),t=e.i(76725),n=e.i(28223);class i{static instance=null;static getInstance(){return i.instance||(i.instance=new i),i.instance}getConnectomeSnapshot(){let e=o.ringAttractor.getTelemetry(),i=a.synapticMeshRouter.getTelemetry(),s=t.dtnMushroomBody.getTelemetry(),r=n.giantFiberReflex.getTelemetry(),c=a.synapticMeshRouter.getAllActiveBearings(),l=c.length>0?c[0]:null,d="OPTIMAL";r.emconLockActive?d="EMCON_REFLEX":i.meanWeight<.25||i.prunedLinksCount>.5*i.totalSynapses?d="DEGRADED":0===i.totalSynapses&&s.currentSaturationRatio>.8&&(d="CRITICAL");let u=`Conectoma Drosophila MaleCNS activo. Br\xfajula E-PG a ${e.headingDeg}\xb0 (${e.cardinal}, Conf: ${(100*e.confidence).toFixed(0)}%). Enrutador sin\xe1ptico con ${i.totalSynapses} sinapsis, ${i.richClubHubs.length} hubs troncales y ${c.length} marcaciones AoA RF activas. Cuerpo fungiforme con ${s.totalEnqueuedRecords} engramas (${s.ltpPinnedRecords} inmunes LTP). Fibras gigantes: ${r.emconLockActive?"EMCON SILENCIO RADIO":"RADAR ACTIVO"}.`;return{timestamp:Date.now(),compass:{headingDeg:e.headingDeg,cardinal:e.cardinal,confidence:e.confidence,isSensoryAnchored:e.isSensoryAnchored,angularVelocityDps:e.angularVelocityDps,driftEstimateDpm:e.driftEstimateDpm,rfBearingsCount:e.rfBearings?.length||0},synapticRouter:{totalSynapses:i.totalSynapses,meanWeight:i.meanWeight,richClubHubsCount:i.richClubHubs.length,prunedCount:i.prunedLinksCount,lifMembranePotentialMv:i.lifMembranePotentialMv,lifQueueLength:i.lifAccumulatedCount,activeBearings:c},mushroomBody:{enqueuedRecords:s.totalEnqueuedRecords,ltpPinnedRecords:s.ltpPinnedRecords,ltdEvictedTotal:s.ltdEvictedTotal,meanValence:s.meanValence,saturationRatio:s.currentSaturationRatio},giantFiber:{state:r.emconLockActive?"EMCON_LOCKED":r.isReflexActive?"REFLEX_ACTIVE":"STANDBY",isRadioSilenced:r.emconLockActive,reflexTriggerCount:r.totalEscapesExecuted,lastEscapeLatencyMs:r.lastReflexLatencyMs,activeThreatsCount:+!!r.isReflexActive},tacticalEvaluation:{meshHealth:d,aoaBearingsActive:c.length,topPeerBearing:l,summary:u}}}getFormattedContextForCopilot(){let e=this.getConnectomeSnapshot(),a=e.synapticRouter.activeBearings.slice(0,3).map(e=>`  • Par ${e.peerId.slice(0,8)}...: Rumbo RF ${e.bearingDeg}\xb0 (Confianza ${(100*e.confidence).toFixed(0)}%, LQS: ${e.lqs}%, Muestras: ${e.samplesCount})`),o=a.length>0?`
Radiogoniometr\xeda Bio-Inercial AoA:
${a.join("\n")}`:"\nRadiogoniometría AoA: Sin marcaciones direccionales suficientes (rotar dispositivo para calibrar).";return`[Conectoma Bio-Inspirado Drosophila MaleCNS]:
• Rumbo Br\xfajula E-PG: ${e.compass.headingDeg}\xb0 (${e.compass.cardinal}, Conf: ${(100*e.compass.confidence).toFixed(0)}%, Anclaje: ${e.compass.isSensoryAnchored?"OK":"INERCIAL PURA"})
• Red Sin\xe1ptica: ${e.synapticRouter.totalSynapses} enlaces | Peso medio: ${e.synapticRouter.meanWeight.toFixed(2)} | Hubs Rich-Club: ${e.synapticRouter.richClubHubsCount} | Podados: ${e.synapticRouter.prunedCount}
• Potencial LIF: ${e.synapticRouter.lifMembranePotentialMv} mV | Cola sub-umbral: ${e.synapticRouter.lifQueueLength} paquetes
• Memoria Fungiforme DTN: ${e.mushroomBody.enqueuedRecords} engramas | LTP Inmunes: ${e.mushroomBody.ltpPinnedRecords} | Desalojos LTD: ${e.mushroomBody.ltdEvictedTotal}
• Fibras Gigantes (GF): Estado ${e.giantFiber.state} | Silencio EMCON: ${e.giantFiber.isRadioSilenced?"ACTIVO":"NO"}${o}`}evaluateConnectomeTacticalQuery(e){let a=this.getConnectomeSnapshot(),o=(e||"").toLowerCase();if(/bearing|radiogoniometr|aoa|direcci[oó]n.*rf|l[oó]bulo/i.test(o)){if(0===a.synapticRouter.activeBearings.length)return`🧭 **Radiogoniometr\xeda Bio-Inercial AoA (Direction-Finding)**

• **Estado:** No se han acumulado suficientes muestras angulares en los 16 sectores para una soluci\xf3n confiable.
• **Rumbo Actual del Dispositivo (E-PG):** ${a.compass.headingDeg}\xb0 (${a.compass.cardinal})
• **Procedimiento de Calibraci\xf3n:**
  1. Mant\xe9n la app abierta mientras recibes transmisiones de los pares o difusiones de la malla.
  2. Rota lentamente el dispositivo en 360\xb0 en el plano horizontal para que la antena interna registre la modulaci\xf3n de se\xf1al (LQS / RSSI) en distintos azimuts.
  3. La red calcular\xe1 autom\xe1ticamente el vector de poblaci\xf3n circular de Rayleigh para estimar la direcci\xf3n de origen del transmisor.`;let e=a.synapticRouter.activeBearings.map((e,a)=>`**${a+1}. Nodo ${e.peerId.slice(0,12)}...**
• **Marcaci\xf3n Estimada (Azimut):** ${e.bearingDeg}\xb0 (Respecto al Norte magn\xe9tico/inercial)
• **Confianza Vectorial:** ${(100*e.confidence).toFixed(1)}% (Concentraci\xf3n de Rayleigh)
• **Calidad de Se\xf1al LQS:** ${e.lqs}/100
• **Muestras Angulares Acumuladas:** ${e.samplesCount} paquetes en 16 sectores
• **\xdaltimo Contacto:** hace ${Math.round((Date.now()-e.lastSeenTs)/1e3)}s`).join("\n\n");return`🎯 **Soluci\xf3n de Radiogoniometr\xeda Bio-Inercial AoA**

Decodificaci\xf3n de Angle of Arrival mediante vector poblacional de 16 sectores circulares:

${e}

*Puedes consultar la Br\xfajula T\xe1ctica o el HUD del Conectoma para visualizar el cono de marcaci\xf3n en vivo.*`}return`🧠 **Telemetr\xeda Conect\xf3mica Unificada (Drosophila MaleCNS v1.0)**

**1. Complejo Central (Central Complex / CX):**
• Rumbo Bio-Inercial E-PG: **${a.compass.headingDeg}\xb0 (${a.compass.cardinal})**
• Confianza del Atractor: ${(100*a.compass.confidence).toFixed(0)}%
• Modo de Anclaje: ${a.compass.isSensoryAnchored?"Anclado a Sensores Nativo":"🛡️ Memoria de Trabajo Inercial Pura (Anti-Spoofing)"}
• Velocidad Angular: ${a.compass.angularVelocityDps}\xb0/s (Deriva est: ${a.compass.driftEstimateDpm}\xb0/min)

**2. Enrutador Sin\xe1ptico Hebbiano (Mesh Topology):**
• Conexiones Sin\xe1pticas: ${a.synapticRouter.totalSynapses} pares
• Conductancia Media: ${a.synapticRouter.meanWeight.toFixed(3)}
• Hubs de Club Rico (Repetidores Troncales): ${a.synapticRouter.richClubHubsCount}
• Enlaces Podados (Supresi\xf3n de Tormentas): ${a.synapticRouter.prunedCount}
• Acumulador Neuronal LIF: ${a.synapticRouter.lifMembranePotentialMv} mV (Cola: ${a.synapticRouter.lifQueueLength} paquetes)
• Nodos con Marcaci\xf3n AoA Activa: ${a.synapticRouter.activeBearings.length}

**3. Cuerpo Fungiforme (Mushroom Body / MB - DTN):**
• Engramas Asociativos en Memoria: ${a.mushroomBody.enqueuedRecords}
• Paquetes Inmunes LTP (SOS / CBRN / Blockchain): ${a.mushroomBody.ltpPinnedRecords}
• Desalojos por Depresi\xf3n Sin\xe1ptica LTD: ${a.mushroomBody.ltdEvictedTotal}
• Saturaci\xf3n de Memoria: ${(100*a.mushroomBody.saturationRatio).toFixed(1)}%

**4. Sistema de Fibras Gigantes (Giant Fiber Reflex - EW):**
• Estado Operativo: ${a.giantFiber.state}
• Silencio de Radio (EMCON): ${a.giantFiber.isRadioSilenced?"🔴 ACTIVO":"🟢 RECEPTOR HABILITADO"}
• Latencia de Escape Monosin\xe1ptico: ${a.giantFiber.lastEscapeLatencyMs>0?`${a.giantFiber.lastEscapeLatencyMs} ms`:"< 15 ms nominal"}`}}let s=i.getInstance();e.s(["ConnectomeCortexBridge",()=>i,"connectomeCortexBridge",0,s])}]);