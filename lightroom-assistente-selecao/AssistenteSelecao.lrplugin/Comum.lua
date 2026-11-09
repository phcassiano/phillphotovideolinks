-- Funções e configurações compartilhadas pelos menus do plugin.

local LrPrefs = import 'LrPrefs'
local LrPathUtils = import 'LrPathUtils'
local LrFileUtils = import 'LrFileUtils'

local M = {}

-- Valores padrão. Percentuais de 0 a 100; nitidez na escala do programa auxiliar.
M.padroes = {
    focoMinimo = 12,       -- nitidez abaixo disso = sem foco

    detectarOlhos = true,
    olhosAbertura = 18,    -- abertura do olho (altura/largura, em %) abaixo disso = fechado

    detectarCortadas = true,
    margemBorda = 2,       -- % do lado maior que conta como "encostado na borda"
    contarPernas = true,   -- pés/pernas cortados também contam

    claraMedia = 80,       -- brilho médio acima disso = muito clara
    claraEstouro = 25,     -- ou mais que isso % de pixels estourados

    escuraMedia = 15,      -- brilho médio abaixo disso = muito escura
    escuraSombras = 60,    -- ou mais que isso % de pixels quase pretos

    corFoco = 'blue',
    corOlhos = 'green',
    corCortada = 'purple',
    corClara = 'yellow',
    corEscura = 'red',

    aplicarRotulos = true,
    sobrescreverRotulos = true,
    aplicarPalavrasChave = true,
    criarColecoes = true,
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
M.colecaoRevisar = 'Para revisar'

-- Categorias em ordem de prioridade: quando a foto tem mais de um problema,
-- recebe a cor da primeira desta lista.
M.ordem = { 'foco', 'olhos', 'cortada', 'clara', 'escura' }
M.nomes = {
    foco = 'Sem foco',
    olhos = 'Olhos fechados',
    cortada = 'Pessoa cortada',
    clara = 'Muito clara',
    escura = 'Muito escura',
}
M.prefCor = {
    foco = 'corFoco',
    olhos = 'corOlhos',
    cortada = 'corCortada',
    clara = 'corClara',
    escura = 'corEscura',
}
M.nomesPartes = { cabeca = 'cabeça', braco = 'braço', tronco = 'tronco', perna = 'perna/pé' }

function M.prefs()
    local p = LrPrefs.prefsForPlugin()
    for k, v in pairs(M.padroes) do
        if p[k] == nil then p[k] = v end
    end
    return p
end

function M.usaVisao(p)
    return p.detectarOlhos or p.detectarCortadas
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

-- Partes cortadas que contam, conforme as configurações. Retorna lista (pode ser vazia).
function M.partesQueContam(m, p)
    local lista = {}
    for parte in (m.partes or ''):gmatch('[^,]+') do
        if parte ~= 'perna' or p.contarPernas then lista[#lista + 1] = parte end
    end
    return lista
end

-- Decide o que há de errado com a foto a partir das medidas.
-- Retorna { foco = bool, olhos = bool, ... } e a categoria principal (ou nil).
function M.classificar(m, p)
    local r = {}
    r.foco = m.nitidez < p.focoMinimo
    r.olhos = (p.detectarOlhos and m.abertura ~= nil and m.abertura * 100 < p.olhosAbertura) or false
    r.cortada = (p.detectarCortadas and #M.partesQueContam(m, p) > 0) or false
    r.escura = (m.media * 100 < p.escuraMedia) or (m.sombras * 100 > p.escuraSombras)
    r.clara = (m.media * 100 > p.claraMedia) or (m.estouro * 100 > p.claraEstouro)
    if r.escura and r.clara then
        -- Muito contraste: fica com o lado que domina
        if m.media < 0.5 then r.clara = false else r.escura = false end
    end

    local principal = nil
    for _, k in ipairs(M.ordem) do
        if r[k] then principal = k; break end
    end
    return r, principal
end

function M.corDe(categoria, p)
    local chave = M.prefCor[categoria]
    return chave and p[chave] or nil
end

function M.ehCorDoAssistente(cor, p)
    for _, k in ipairs(M.ordem) do
        if cor == M.corDe(k, p) then return true end
    end
    return false
end

-- A foto tem alguma palavra-chave criada pelo assistente?
function M.temMarcacao(palavras)
    for _, kw in ipairs(palavras or {}) do
        local pai = kw:getParent()
        if pai and pai:getName() == M.palavraPai then return true end
    end
    return false
end

-- Cria (ou reaproveita) palavras-chave e coleções. Precisa estar dentro de withWriteAccessDo.
-- Retorna { palavras = {categoria = LrKeyword}, colecoes = {categoria = LrCollection, revisar = ...} }
function M.prepararCatalogo(catalogo, comColecoes)
    local alvo = { palavras = {}, colecoes = nil }
    local pai = catalogo:createKeyword(M.palavraPai, {}, false, nil, true)
    for _, k in ipairs(M.ordem) do
        alvo.palavras[k] = catalogo:createKeyword(M.nomes[k], {}, false, pai, true)
    end
    if comColecoes then
        local conjunto = catalogo:createCollectionSet(M.palavraPai, nil, true)
        alvo.colecoes = { revisar = catalogo:createCollection(M.colecaoRevisar, conjunto, true) }
        for _, k in ipairs(M.ordem) do
            alvo.colecoes[k] = catalogo:createCollection(M.nomes[k], conjunto, true)
        end
    end
    return alvo
end

-- Coleções já existentes (sem criar). Retorna nil se o conjunto não existir.
function M.colecoesExistentes(catalogo)
    for _, conjunto in ipairs(catalogo:getChildCollectionSets()) do
        if conjunto:getName() == M.palavraPai then
            local t = {}
            for _, c in ipairs(conjunto:getChildCollections()) do t[#t + 1] = c end
            return t
        end
    end
    return nil
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

return M
