-- Funções e configurações compartilhadas pelos menus do plugin.

local LrPrefs = import 'LrPrefs'
local LrPathUtils = import 'LrPathUtils'
local LrFileUtils = import 'LrFileUtils'

local M = {}

-- Valores padrão. Percentuais de 0 a 100; nitidez na escala do programa auxiliar.
M.padroes = {
    escuraMedia = 15,      -- brilho médio abaixo disso = muito escura
    escuraSombras = 60,    -- ou mais que isso % de pixels quase pretos
    claraMedia = 80,       -- brilho médio acima disso = muito clara
    claraEstouro = 25,     -- ou mais que isso % de pixels estourados
    focoMinimo = 12,       -- nitidez abaixo disso = sem foco

    corEscura = 'red',
    corClara = 'yellow',
    corFoco = 'blue',

    aplicarRotulos = true,
    sobrescreverRotulos = true,
    aplicarPalavrasChave = true,
    salvarRelatorio = true,
}

M.cores = {
    { title = 'Vermelho', value = 'red' },
    { title = 'Amarelo', value = 'yellow' },
    { title = 'Verde', value = 'green' },
    { title = 'Azul', value = 'blue' },
    { title = 'Roxo', value = 'purple' },
}

M.palavraPai = 'Assistente de Seleção'
M.nomes = {
    escura = 'Muito escura',
    clara = 'Muito clara',
    foco = 'Sem foco',
}
M.ordem = { 'escura', 'clara', 'foco' }

function M.prefs()
    local p = LrPrefs.prefsForPlugin()
    for k, v in pairs(M.padroes) do
        if p[k] == nil then p[k] = v end
    end
    return p
end

function M.caminhoAuxiliar()
    return LrPathUtils.child(LrPathUtils.child(_PLUGIN.path, 'bin'), 'assistente-analise')
end

function M.auxiliarExiste()
    return LrFileUtils.exists(M.caminhoAuxiliar()) == 'file'
end

-- Aspas simples para o shell (o Lightroom executa via sh no macOS).
function M.aspas(s)
    return "'" .. tostring(s):gsub("'", "'\\''") .. "'"
end

-- Decide o que há de errado com a foto a partir das medidas.
-- Retorna { escura = bool, clara = bool, foco = bool } e a categoria principal (ou nil).
function M.classificar(m, p)
    local r = { escura = false, clara = false, foco = false }
    r.escura = (m.media * 100 < p.escuraMedia) or (m.sombras * 100 > p.escuraSombras)
    r.clara = (m.media * 100 > p.claraMedia) or (m.estouro * 100 > p.claraEstouro)
    if r.escura and r.clara then
        -- Muito contraste: fica com o lado que domina
        if m.media < 0.5 then r.clara = false else r.escura = false end
    end
    r.foco = m.nitidez < p.focoMinimo

    local principal = nil
    for _, k in ipairs(M.ordem) do
        if r[k] then principal = k; break end
    end
    return r, principal
end

function M.corDe(categoria, p)
    if categoria == 'escura' then return p.corEscura end
    if categoria == 'clara' then return p.corClara end
    if categoria == 'foco' then return p.corFoco end
    return nil
end

-- A foto tem alguma palavra-chave criada pelo assistente?
function M.temMarcacao(palavras)
    for _, kw in ipairs(palavras or {}) do
        local pai = kw:getParent()
        if pai and pai:getName() == M.palavraPai then return true end
    end
    return false
end

-- Cria (ou reaproveita) as palavras-chave. Precisa estar dentro de withWriteAccessDo.
function M.palavrasChave(catalogo)
    local pai = catalogo:createKeyword(M.palavraPai, {}, false, nil, true)
    local t = {}
    for _, k in ipairs(M.ordem) do
        t[k] = catalogo:createKeyword(M.nomes[k], {}, false, pai, true)
    end
    return t
end

-- Aplica cor de rótulo. 'none' remove.
function M.definirCor(foto, cor)
    local ok = pcall(function() foto:setRawMetadata('colorNameForLabel', cor) end)
    if not ok then
        -- Versões antigas: o rótulo é um texto. Funciona com o conjunto de rótulos padrão.
        local textos = { red = 'Red', yellow = 'Yellow', green = 'Green', blue = 'Blue', purple = 'Purple', none = '' }
        pcall(function() foto:setRawMetadata('label', textos[cor] or '') end)
    end
end

function M.ehCorDoAssistente(cor, p)
    return cor == p.corEscura or cor == p.corClara or cor == p.corFoco
end

return M
