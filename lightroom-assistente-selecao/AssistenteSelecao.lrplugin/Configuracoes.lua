-- Janela de configurações: limites de cada detecção e o que fazer com o resultado.

local LrBinding = import 'LrBinding'
local LrDialogs = import 'LrDialogs'
local LrFunctionContext = import 'LrFunctionContext'
local LrView = import 'LrView'

local Comum = require 'Comum'

LrFunctionContext.callWithContext('AssistenteSelecaoConfig', function(contexto)
    local p = Comum.prefs()
    local tabela = LrBinding.makePropertyTable(contexto)
    for k in pairs(Comum.padroes) do tabela[k] = p[k] end

    local f = LrView.osFactory()
    local bind = LrView.bind

    local function numero(chave, minimo, maximo, casas)
        return f:edit_field {
            value = bind(chave), min = minimo, max = maximo,
            precision = casas or 0, increment = 1, width_in_digits = 6,
        }
    end
    local function linha(rotulo, campo, sufixo)
        return f:row {
            f:static_text { title = rotulo, width = LrView.share('rotulo'), alignment = 'right' },
            campo,
            f:static_text { title = sufixo or '' },
        }
    end
    local function cor(chave)
        return f:popup_menu { value = bind(chave), items = Comum.cores }
    end

    local conteudo = f:column {
        bind_to_object = tabela,
        spacing = f:control_spacing(),

        f:static_text {
            title = 'Prioridade da cor quando a foto tem mais de um problema: sem foco, olhos fechados,\n'
                .. 'pessoa cortada, muito clara, muito escura.',
        },
        f:group_box {
            title = '1. Sem foco', fill_horizontal = 1,
            linha('Nitidez abaixo de', numero('focoMinimo', 0, 1000, 1),
                '(veja a coluna "nitidez" do relatório para calibrar)'),
            linha('Cor do rótulo', cor('corFoco')),
        },
        f:group_box {
            title = '2. Olhos fechados', fill_horizontal = 1,
            f:checkbox { title = 'Detectar olhos fechados', value = bind('detectarOlhos') },
            linha('Abertura do olho abaixo de', numero('olhosAbertura', 0, 100), '% (aberto ≈ 25–40, fechado ≈ 5–15)'),
            linha('Cor do rótulo', cor('corOlhos')),
        },
        f:group_box {
            title = '3. Pessoa cortada', fill_horizontal = 1,
            f:checkbox { title = 'Detectar pessoas cortadas (cabeça, braços, tronco)', value = bind('detectarCortadas') },
            f:checkbox { title = 'Contar também pernas/pés cortados', value = bind('contarPernas') },
            linha('Distância da borda que conta como corte', numero('margemBorda', 0, 20, 1), '% do lado maior'),
            linha('Cor do rótulo', cor('corCortada')),
        },
        f:group_box {
            title = '4. Muito clara', fill_horizontal = 1,
            linha('Brilho médio acima de', numero('claraMedia', 0, 100), '%'),
            linha('ou pixels estourados acima de', numero('claraEstouro', 0, 100), '%'),
            linha('Cor do rótulo', cor('corClara')),
        },
        f:group_box {
            title = '5. Muito escura', fill_horizontal = 1,
            linha('Brilho médio abaixo de', numero('escuraMedia', 0, 100), '%'),
            linha('ou pixels quase pretos acima de', numero('escuraSombras', 0, 100), '%'),
            linha('Cor do rótulo', cor('corEscura')),
        },
        f:group_box {
            title = 'Resultado', fill_horizontal = 1,
            f:checkbox { title = 'Aplicar cor de rótulo', value = bind('aplicarRotulos') },
            f:checkbox {
                title = 'Substituir rótulos que eu já tinha colocado',
                value = bind('sobrescreverRotulos'), enabled = bind('aplicarRotulos'),
            },
            f:checkbox {
                title = 'Adicionar palavras-chave (permite filtrar mais de um problema por foto)',
                value = bind('aplicarPalavrasChave'),
            },
            f:checkbox {
                title = 'Organizar em coleções (Assistente de Seleção › Para revisar, Sem foco, …)',
                value = bind('criarColecoes'),
            },
            f:checkbox { title = 'Salvar relatório .csv na Mesa', value = bind('salvarRelatorio') },
        },
        f:push_button {
            title = 'Restaurar padrões',
            action = function()
                for k, v in pairs(Comum.padroes) do tabela[k] = v end
            end,
        },
    }

    local resposta = LrDialogs.presentModalDialog {
        title = 'Assistente de Seleção – Configurações',
        contents = conteudo,
        actionVerb = 'Salvar',
    }
    if resposta == 'ok' then
        for k in pairs(Comum.padroes) do p[k] = tabela[k] end
    end
end)
