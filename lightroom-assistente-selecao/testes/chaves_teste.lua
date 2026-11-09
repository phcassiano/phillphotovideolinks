-- Confere os nomes de metadados que o plugin pede ao Lightroom contra as listas do SDK.
-- Um nome errado só aparece como "Unknown key" quando o plugin já está rodando.
--   lua testes/chaves_teste.lua AssistenteSelecao.lrplugin
local pasta = arg[1]

local brutos = {}
for k in ([[fileSize rating dimensions croppedDimensions shutterSpeed aperture exposureBias flash
  isoSpeedRating focalLength focalLength35mm dateTimeOriginal dateTimeDigitized dateTime gps
  gpsAltitude countVirtualCopies virtualCopies masterPhoto isVirtualCopy countStackInFolderMembers
  stackInFolderMembers isInStackInFolder stackInFolderIsCollapsed stackPositionInFolder
  topOfStackInFolderContainingPhoto colorNameForLabel fileFormat width height aspectRatio isCropped
  dateTimeOriginalISO8601 dateTimeDigitizedISO8601 dateTimeISO8601 lastEditTime editCount
  copyrightState uuid path isVideo durationInSeconds keywords customMetadata pickStatus
  trimmedDurationInSeconds smartPreviewInfo bitDepth]]):gmatch('%S+') do brutos[k] = true end

local formatados = {}
for k in ([[keywordTags keywordTagsForExport fileName copyName folderName fileSize fileType rating
  label title caption dimensions croppedDimensions exposure shutterSpeed aperture brightnessValue
  exposureBias flash exposureProgram meteringMode isoSpeedRating focalLength focalLength35mm lens
  subjectDistance dateTimeOriginal dateTimeDigitized dateTime cameraMake cameraModel
  cameraSerialNumber artist software gps gpsAltitude creator creatorJobTitle creatorAddress
  creatorCity creatorStateProvince creatorPostalCode creatorCountry creatorPhone creatorEmail
  creatorUrl headline iptcSubjectCode descriptionWriter iptcCategory iptcOtherCategories dateCreated
  intellectualGenre scene location city stateProvince country isoCountryCode jobIdentifier
  instructions provider source copyright rightsUsageTerms copyrightInfoUrl personShown]]):gmatch('%S+') do
  formatados[k] = true
end

local falhas = 0
for _, arquivo in ipairs({ 'Analisar.lua', 'Limpar.lua', 'Comum.lua' }) do
  local texto = assert(io.open(pasta .. '/' .. arquivo)):read('*a')
  for tipo, lista in texto:gmatch('batchGet(%a+)Metadata%s*%(%s*[%w_]+%s*,%s*(%b{})') do
    local validos = tipo == 'Raw' and brutos or formatados
    for chave in lista:gmatch("'([%w_]+)'") do
      local ok = validos[chave]
      print((ok and 'OK  ' or 'ERRO') .. ' ' .. arquivo .. ' ' .. tipo .. ': ' .. chave)
      if not ok then falhas = falhas + 1 end
    end
  end
end
print(falhas == 0 and 'Todos os nomes existem.' or (falhas .. ' nome(s) desconhecido(s).'))
os.exit(falhas == 0 and 0 or 1)
