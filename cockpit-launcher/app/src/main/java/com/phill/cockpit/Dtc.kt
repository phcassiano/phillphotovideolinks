package com.phill.cockpit

/** Explicação em português dos códigos de falha mais comuns. */
object Dtc {
    private val known = mapOf(
        "P0100" to "Sensor de fluxo de ar (MAF): falha no circuito",
        "P0101" to "Sensor MAF fora da faixa — filtro de ar sujo ou entrada falsa de ar",
        "P0102" to "Sensor MAF com sinal baixo",
        "P0105" to "Sensor de pressão do coletor (MAP): falha no circuito",
        "P0106" to "Sensor MAP fora da faixa / desempenho",
        "P0110" to "Sensor de temperatura do ar de admissão: falha",
        "P0115" to "Sensor de temperatura do motor: falha no circuito",
        "P0116" to "Sensor de temperatura do motor fora da faixa",
        "P0117" to "Sensor de temperatura do motor com sinal baixo",
        "P0118" to "Sensor de temperatura do motor com sinal alto",
        "P0120" to "Sensor de posição do acelerador (TPS): falha",
        "P0121" to "Sensor do acelerador fora da faixa",
        "P0128" to "Motor demorando para esquentar — válvula termostática",
        "P0130" to "Sonda lambda (antes do catalisador): falha no circuito",
        "P0133" to "Sonda lambda com resposta lenta",
        "P0134" to "Sonda lambda sem atividade",
        "P0135" to "Aquecimento da sonda lambda: falha",
        "P0141" to "Aquecimento da sonda lambda (depois do catalisador): falha",
        "P0171" to "Mistura pobre (banco 1) — entrada de ar, bico ou bomba fraca",
        "P0172" to "Mistura rica (banco 1) — bico vazando ou sensor com erro",
        "P0174" to "Mistura pobre (banco 2)",
        "P0175" to "Mistura rica (banco 2)",
        "P0201" to "Bico injetor do cilindro 1: falha no circuito",
        "P0202" to "Bico injetor do cilindro 2: falha no circuito",
        "P0203" to "Bico injetor do cilindro 3: falha no circuito",
        "P0204" to "Bico injetor do cilindro 4: falha no circuito",
        "P0230" to "Bomba de combustível: falha no circuito",
        "P0300" to "Falha de combustão aleatória — velas, cabos, bobina ou combustível",
        "P0301" to "Falha de combustão no cilindro 1",
        "P0302" to "Falha de combustão no cilindro 2",
        "P0303" to "Falha de combustão no cilindro 3",
        "P0304" to "Falha de combustão no cilindro 4",
        "P0325" to "Sensor de detonação: falha no circuito",
        "P0335" to "Sensor de rotação (virabrequim): falha",
        "P0340" to "Sensor de fase (comando): falha",
        "P0351" to "Bobina de ignição A: falha no circuito",
        "P0352" to "Bobina de ignição B: falha no circuito",
        "P0400" to "Recirculação de gases (EGR): falha de fluxo",
        "P0401" to "EGR com fluxo insuficiente",
        "P0420" to "Catalisador com eficiência baixa (banco 1)",
        "P0430" to "Catalisador com eficiência baixa (banco 2)",
        "P0440" to "Sistema de vapor de combustível (cânister): falha",
        "P0442" to "Pequeno vazamento no sistema de vapor — confira a tampa do tanque",
        "P0443" to "Válvula do cânister: falha no circuito",
        "P0455" to "Grande vazamento no sistema de vapor — tampa do tanque solta?",
        "P0480" to "Eletroventilador 1: falha no circuito",
        "P0500" to "Sensor de velocidade do veículo: falha",
        "P0505" to "Controle de marcha lenta: falha",
        "P0506" to "Marcha lenta abaixo do esperado",
        "P0507" to "Marcha lenta acima do esperado — entrada falsa de ar",
        "P0562" to "Tensão do sistema baixa — bateria ou alternador",
        "P0563" to "Tensão do sistema alta — regulador do alternador",
        "P0601" to "Módulo de injeção: erro de memória",
        "P0606" to "Módulo de injeção: falha no processador",
        "P0700" to "Câmbio automático: falha (veja o módulo da transmissão)",
        "P0715" to "Sensor de rotação de entrada do câmbio: falha",
        "P0720" to "Sensor de rotação de saída do câmbio: falha",
        "P2135" to "Sensores do pedal/acelerador não concordam entre si",
        "P2187" to "Mistura pobre em marcha lenta (banco 1)",
        "P2188" to "Mistura rica em marcha lenta (banco 1)",
        "U0100" to "Sem comunicação com o módulo de injeção",
        "U0101" to "Sem comunicação com o módulo do câmbio",
        "U0121" to "Sem comunicação com o módulo do ABS",
        "U0155" to "Sem comunicação com o painel de instrumentos",
    )

    fun describe(code: String): String {
        known[code]?.let { return it }
        val area = when {
            code.startsWith("P00") || code.startsWith("P01") || code.startsWith("P02") -> "Medição de ar e combustível"
            code.startsWith("P03") -> "Ignição ou falha de combustão"
            code.startsWith("P04") -> "Controle de emissões"
            code.startsWith("P05") -> "Velocidade, marcha lenta ou entradas auxiliares"
            code.startsWith("P06") -> "Módulo de injeção ou saídas"
            code.startsWith("P07") || code.startsWith("P08") || code.startsWith("P09") -> "Câmbio / transmissão"
            code.startsWith("P1") || code.startsWith("P3") -> "Código específico da montadora (motor)"
            code.startsWith("P2") -> "Ar, combustível ou emissões"
            code.startsWith("B") -> "Carroceria (airbag, travas, conforto)"
            code.startsWith("C") -> "Chassi (freios ABS, direção, suspensão)"
            code.startsWith("U") -> "Comunicação entre módulos"
            else -> "Código"
        }
        return "$area — consulte um mecânico para o diagnóstico"
    }

    fun severe(code: String) = code.startsWith("P03") || code in setOf("P0115", "P0117", "P0118", "P0335", "P0562", "P0606", "U0100")
}
