-- Remove as palavras-chave, coleções e cor de rótulo que o assistente colocou
-- nas fotos selecionadas.

local LrApplication = import 'LrApplication'
local LrDialogs = import 'LrDialogs'
local LrFunctionContext = import 'LrFunctionContext'

local Comum = require 'Comum'

LrFunctionContext.postAsyncTaskWithContext('AssistenteSelecaoLimpar', function(contexto)
    LrDialogs.attachErrorDialogToFunctionContext(contexto)

    local p = Comum.prefs()
    local catalogo = LrApplication.activeCatalog()
    local fotos = catalogo:getTargetPhotos()
    local info = catalogo:batchGetRawMetadata(fotos, { 'keywords', 'colorNameForLabel' })

    local marcadas = {}
    for _, foto in ipairs(fotos) do
        if Comum.temMarcacao(info[foto].keywords) then marcadas[#marcadas + 1] = foto end
    end
    if #marcadas == 0 then
        LrDialogs.message('Assistente de Seleção', 'Nenhuma foto selecionada tem marcação do assistente.')
        return
    end

    if LrDialogs.confirm('Limpar ' .. #marcadas .. ' fotos?',
            'Remove as palavras-chave, as coleções e a cor de rótulo que o assistente colocou.',
            'Limpar', 'Cancelar') ~= 'ok' then
        return
    end

    catalogo:withWriteAccessDo('Limpar Assistente de Seleção', function()
        local palavras = Comum.prepararCatalogo(catalogo, false).palavras
        for _, colecao in ipairs(Comum.colecoesExistentes(catalogo) or {}) do
            colecao:removePhotos(marcadas)
        end
        for _, foto in ipairs(marcadas) do
            for _, k in ipairs(Comum.ordem) do foto:removeKeyword(palavras[k]) end
            if Comum.ehCorDoAssistente(info[foto].colorNameForLabel, p) then
                Comum.definirCor(foto, 'none')
            end
        end
    end, { timeout = 120 })

    LrDialogs.message('Assistente de Seleção', #marcadas .. ' foto(s) limpas.')
end)
