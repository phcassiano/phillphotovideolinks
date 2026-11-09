-- Funções e configurações compartilhadas pelos menus do plugin.

local LrPrefs = import 'LrPrefs'
local LrPathUtils = import 'LrPathUtils'
local LrFileUtils = import 'LrFileUtils'

local M = {}

-- Valores padrão. Percentuais de 0 a 100; nitidez na escala do programa auxiliar.
M.padroes = {
    focoMinimo = 12,       -- nitidez abaixo disso = sem foco

    detectarTremidas = true,
    tremorLimite = 15,     -- indício de tremido (x100) acima disso = tremida

    detectarOlhos = true,
    olhosAbertura = 18,    -- abertura do olho (altura/largura, em %) abaixo disso = fechado

    detectarCortadas = true,
    margemBorda = 2,       -- % do lado maior que conta como "encostado na borda"
    contarPernas = true,   -- pés/pernas cortados também contam

    claraMedia = 80,       -- brilho médio acima disso = muito clara
    claraEstouro = 25,     -- ou mais que isso % de pixels estourados

    escuraMedia = 15,      -- brilho médio abaixo disso = muito escura
    escuraSombras = 60,    -- ou mais que isso % de pixels quase pretos

    detectarDuplicadas = true,
    duplicadaSegundos = 3,   -- fotos tiradas com até esse intervalo podem ser da mesma sequência
    duplicadaDiferenca = 10, -- diferença máxima de assinatura (0 = idênticas, 64 = nada a ver)
    usarExpressao = true,       -- na melhor da sequência, considerar sorriso e expressão
    pesoExpressao = 50,         -- % da nota que vem da expressão (o resto: nitidez e problemas)
    rejeitarDuplicadas = false, -- marcar as repetidas como "rejeitada" (X)
    escolherMelhor = false,     -- marcar a melhor de cada sequência como "escolhida" (bandeira)

    corFoco = 'blue',
    corTremida = 'white',
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
    { title = 'Branco (rótulo com o nome do problema)', value = 'white' },
}

M.palavraPai = 'Assistente de Seleção'
M.colecaoRevisar = 'Para revisar'

-- Problemas de qualidade, em ordem de prioridade: quando a foto tem mais de um,
-- recebe a cor do primeiro desta lista.
M.ordem = { 'foco', 'tremida', 'olhos', 'cortada', 'clara', 'escura' }
-- Sequências: não têm cor, só palavra-chave, coleção e (opcional) bandeira.
M.extras = { 'duplicada', 'melhor' }

M.nomes = {
    foco = 'Sem foco',
    tremida = 'Tremida',
    olhos = 'Olhos fechados',
    cortada = 'Pessoa cortada',
    clara = 'Muito clara',
    escura = 'Muito escura',
    duplicada = 'Duplicada',
    melhor = 'Melhor da sequência',
}
M.prefCor = {
    foco = 'corFoco',
    tremida = 'corTremida',
    olhos = 'corOlhos',
    cortada = 'corCortada',
    clara = 'corClara',
    escura = 'corEscura',
}
-- Peso de cada problema na escolha da melhor foto de uma sequência (multiplica a nitidez).
M.pesos = { foco = 0.3, tremida = 0.4, olhos = 0.4, cortada = 0.7, clara = 0.8, escura = 0.8 }
M.nomesPartes = { cabeca = 'cabeça', braco = 'braço', tronco = 'tronco', perna = 'perna/pé' }

function M.prefs()
    local p = LrPrefs.prefsForPlugin()
    for k, v in pairs(M.padroes) do
        if p[k] == nil then p[k] = v end
    end
    return p
end

function M.usaVisao(p)
    return p.detectarOlhos or p.detectarCortadas or (p.detectarDuplicadas and p.usarExpressao)
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
-- Retorna { foco = bool, tremida = bool, ... } e a categoria principal (ou nil).
function M.classificar(m, p)
    local r = {}
    r.foco = m.nitidez < p.focoMinimo
    r.tremida = (p.detectarTremidas and m.tremor ~= nil and m.tremor * 100 >= p.tremorLimite) or false
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

-- Nota para escolher a melhor foto de uma sequência: nitidez, descontando problemas.
function M.pontuacao(m, r)
    local nota = m.nitidez or 0
    for _, k in ipairs(M.ordem) do
        if r[k] then nota = nota * M.pesos[k] end
    end
    return nota
end

-- Quantos bits diferem entre duas assinaturas (16 caracteres hexadecimais).
local diferencaNibble = {}
for a = 0, 15 do
    diferencaNibble[a] = {}
    for b = 0, 15 do
        local x, y, n = a, b, 0
        for _ = 1, 4 do
            if x % 2 ~= y % 2 then n = n + 1 end
            x, y = math.floor(x / 2), math.floor(y / 2)
        end
        diferencaNibble[a][b] = n
    end
end
function M.diferenca(a, b)
    if not a or not b or #a ~= 16 or #b ~= 16 then return 64 end
    local n = 0
    for i = 1, 16 do
        local x, y = tonumber(a:sub(i, i), 16), tonumber(b:sub(i, i), 16)
        if not x or not y then return 64 end
        n = n + diferencaNibble[x][y]
    end
    return n
end

-- Nota de cada foto dentro da sequência (0 a 1), em r.nota.
-- Parte técnica: pontuação ÷ maior pontuação do grupo (nitidez descontando problemas).
-- Parte de expressão (peso 0 a 1): só entra se alguma foto do grupo tem rosto medido; foto sem
-- rosto num grupo com rostos (pessoa de costas, rosto tampado) recebe expressão baixa.
function M.notarSequencia(grupo, peso)
    local maior, algumRosto = 0, false
    for _, r in ipairs(grupo) do
        if r.pontuacao > maior then maior = r.pontuacao end
        if r.expressao then algumRosto = true end
    end
    for _, r in ipairs(grupo) do
        local tecnica = maior > 0 and r.pontuacao / maior or 0
        if algumRosto and peso and peso > 0 then
            r.nota = (1 - peso) * tecnica + peso * (r.expressao or 0.2)
        else
            r.nota = tecnica
        end
    end
end

-- Agrupa fotos em sequências de quase-duplicadas.
-- registros: lista de { tempo = segundos ou nil, assinatura = 'hex', pontuacao = n, indice = n,
--                       expressao = 0..1 ou nil }
-- pesoExpressao: 0 a 1 (0 = só a parte técnica).
-- Retorna lista de grupos (só os com 2+ fotos); cada grupo é uma lista de registros, com
-- grupo.melhor apontando para o registro de maior nota.
function M.agruparDuplicadas(registros, segundos, diferencaMaxima, pesoExpressao)
    local ordenados = {}
    for i, r in ipairs(registros) do ordenados[i] = r end
    table.sort(ordenados, function(a, b)
        if a.tempo and b.tempo and a.tempo ~= b.tempo then return a.tempo < b.tempo end
        if a.tempo and not b.tempo then return true end
        if b.tempo and not a.tempo then return false end
        return a.indice < b.indice
    end)

    local grupos, atual = {}, nil
    for _, r in ipairs(ordenados) do
        local anterior = atual and atual[#atual]
        local junto = false
        if anterior and r.assinatura and anterior.assinatura then
            local pertoNoTempo = (r.tempo == nil and anterior.tempo == nil)
                or (r.tempo ~= nil and anterior.tempo ~= nil and math.abs(r.tempo - anterior.tempo) <= segundos)
            junto = pertoNoTempo and M.diferenca(r.assinatura, anterior.assinatura) <= diferencaMaxima
        end
        if junto then
            atual[#atual + 1] = r
        else
            if atual and #atual >= 2 then grupos[#grupos + 1] = atual end
            atual = { r }
        end
    end
    if atual and #atual >= 2 then grupos[#grupos + 1] = atual end

    for _, g in ipairs(grupos) do
        M.notarSequencia(g, pesoExpressao or 0)
        g.melhor = g[1]
        for _, r in ipairs(g) do
            if r.nota > g.melhor.nota then g.melhor = r end
        end
    end
    return grupos
end

function M.corDe(categoria, p)
    local chave = M.prefCor[categoria]
    return chave and p[chave] or nil
end

-- A cor/rótulo atual da foto foi posta pelo assistente?
function M.ehCorDoAssistente(cor, textoRotulo, p)
    for _, k in ipairs(M.ordem) do
        local c = M.corDe(k, p)
        if c == 'white' then
            if textoRotulo == M.nomes[k] then return true end
        elseif cor == c then
            return true
        end
    end
    return false
end

-- A foto tem a palavra-chave do assistente com esse nome? (nil = qualquer uma)
function M.temPalavra(palavras, nome)
    for _, kw in ipairs(palavras or {}) do
        local pai = kw:getParent()
        if pai and pai:getName() == M.palavraPai and (nome == nil or kw:getName() == nome) then
            return true
        end
    end
    return false
end

function M.temMarcacao(palavras)
    return M.temPalavra(palavras, nil)
end

local function todasCategorias()
    local t = {}
    for _, k in ipairs(M.ordem) do t[#t + 1] = k end
    for _, k in ipairs(M.extras) do t[#t + 1] = k end
    return t
end
M.todas = todasCategorias()

-- Cria (ou reaproveita) palavras-chave e coleções. Precisa estar dentro de withWriteAccessDo.
-- Retorna { palavras = {categoria = LrKeyword}, colecoes = {categoria = LrCollection, revisar = ...} }
function M.prepararCatalogo(catalogo, comColecoes)
    local alvo = { palavras = {}, colecoes = nil }
    local pai = catalogo:createKeyword(M.palavraPai, {}, false, nil, true)
    for _, k in ipairs(M.todas) do
        alvo.palavras[k] = catalogo:createKeyword(M.nomes[k], {}, false, pai, true)
    end
    if comColecoes then
        local conjunto = catalogo:createCollectionSet(M.palavraPai, nil, true)
        alvo.colecoes = { revisar = catalogo:createCollection(M.colecaoRevisar, conjunto, true) }
        for _, k in ipairs(M.todas) do
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

-- Aplica cor de rótulo. 'none' remove; 'white' grava o nome do problema como texto do
-- rótulo (o Lightroom mostra rótulos fora do conjunto de cores em branco).
function M.definirCor(foto, cor, categoria)
    if cor == 'white' then
        pcall(function() foto:setRawMetadata('label', M.nomes[categoria] or M.palavraPai) end)
        return
    end
    if cor == 'none' then
        pcall(function() foto:setRawMetadata('colorNameForLabel', 'none') end)
        pcall(function() foto:setRawMetadata('label', '') end)
        return
    end
    local ok = pcall(function() foto:setRawMetadata('colorNameForLabel', cor) end)
    if not ok then
        -- Versões antigas: o rótulo é um texto. Funciona com o conjunto de rótulos padrão.
        local textos = { red = 'Red', yellow = 'Yellow', green = 'Green', blue = 'Blue', purple = 'Purple', none = '' }
        pcall(function() foto:setRawMetadata('label', textos[cor] or '') end)
    end
end

return M
