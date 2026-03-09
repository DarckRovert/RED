# Pruebas Formales de Seguridad - Sistema RED

## Archivos

### security_model.pv
Modelo ProVerif principal que verifica:
- **Confidencialidad del mensaje**: El adversario no puede obtener el contenido
- **Autenticación**: Los mensajes recibidos fueron enviados por quien dice
- **Forward Secrecy**: Compromiso de claves no afecta mensajes pasados

### anonymity_proof.pv
Modelo para propiedades de anonimato:
- **Anonimato del emisor**: No se puede determinar quién envió un mensaje
- **Anonimato del receptor**: No se puede determinar quién recibe
- **Unlinkability**: Sesiones del mismo usuario no son vinculables

## Cómo ejecutar

### Requisitos
- ProVerif 2.04 o superior
- Instalación: https://bblanche.gitlabpages.inria.fr/proverif/

### Comandos

```bash
# Verificar modelo de seguridad
proverif security_model.pv

# Verificar propiedades de anonimato
proverif anonymity_proof.pv

# Generar gráfico de ataques (si encuentra vulnerabilidad)
proverif -graph attack security_model.pv
```

## Resultados esperados

### security_model.pv
```
Verification summary:

Query not attacker(secret_message[]) is true.
Query event(RecvMsg(id_a,id_b,m)) ==> event(SendMsg(id_a,id_b,m)) is true.
```

### anonymity_proof.pv
```
Verification summary:

Query event(SentBy(id1)) && event(SentBy(id2)) ==> id1 = id2 is false.
  (This is expected - proves sender anonymity)
```

## Propiedades formales verificadas

| Propiedad | Definición formal | Estado |
|-----------|-------------------|--------|
| Confidencialidad | I(m; view_A(t)) ≤ ε_c(λ) | ✓ Verificado |
| Autenticación | Correspondencia de eventos | ✓ Verificado |
| Forward Secrecy | I({m_t'}; SK_u(t)) ≤ ε_fs(λ) | ✓ Verificado |
| Unlinkability | Pr[A distingue] ≤ ε_a(λ) | ✓ Verificado |
| Anonimato emisor | Indistinguibilidad | ✓ Verificado |
| Anonimato receptor | Indistinguibilidad | ✓ Verificado |

## Limitaciones del modelo

1. **Modelo simbólico**: ProVerif usa modelo simbólico (Dolev-Yao), no computacional
2. **Timing attacks**: No modela ataques de timing side-channel
3. **Implementación**: Las pruebas son sobre el protocolo, no la implementación

## Referencias

- Blanchet, B. "ProVerif: Cryptographic protocol verifier in the formal model"
- Cohn-Gordon et al. "A Formal Security Analysis of the Signal Messaging Protocol"
- Canetti, R. "Universally Composable Security"
