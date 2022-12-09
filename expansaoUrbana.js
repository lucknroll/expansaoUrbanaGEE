//// Assets:
// table: shapefile IBGE estados brasileiros
// table2: shapefile IBGE municípios catarinenses
// table3: shapefile IBGE setores censitários catarinenses

function expansaoUrbana(nomeMun, t0Ano, t1Ano) {

if (t1Ano <= t0Ano) {
  throw new Error('selecione outras datas');
}

// Carregando os polígonos
var sc = table.filter(ee.Filter.eq('sigla', 'SC'));
var municipio = table2.filter(ee.Filter.eq('NM_MUN', nomeMun));
var setores = table3.filter(ee.Filter.eq('NM_MUN', nomeMun));

// Carregando as imagens
var colNL1 = ee.ImageCollection("BNU/FGS/CCNL/v1")     // Coleção corrigida (1992-2013)
               .filterBounds(municipio).select('b1'); 
var colNL2 = ee.ImageCollection("NOAA/VIIRS/DNB/MONTHLY_V1/VCMSLCFG")     // Coleção não corrigida (2014-2021)
               .filterBounds(municipio).select('avg_rad');

var nl_t0_1 = colNL1.filter(ee.Filter.calendarRange(t0Ano, t0Ano, 'year')).median().rename('nl_t0_1');     // 1992-2013
var nl_t1_1 = colNL1.filter(ee.Filter.calendarRange(t1Ano, t1Ano, 'year')).median().rename('nl_t1_1');
var nl_t0_2 = colNL2.filter(ee.Filter.calendarRange(t0Ano, t0Ano, 'year')).median().rename('nl_t0_2');     // 2014-2021
var nl_t1_2 = colNL2.filter(ee.Filter.calendarRange(t1Ano, t1Ano, 'year')).median().rename('nl_t1_2');

var medianasNL = nl_t0_1.addBands(nl_t1_1).addBands(nl_t0_2).addBands(nl_t1_2);

var nl_t0 = medianasNL.select(0);
var nl_t1 = medianasNL.select(1);

// Reajustando escala do dataset
if (t0Ano <= 2013 && t1Ano > 2013) {
  nl_t1 = nl_t1.reproject({crs:'EPSG:4326', scale:1000});
}

// Isolando as luzes
var boxcar = ee.Kernel.square({     // Arredondando as bordas dos pixels
  radius: 1, units: 'pixels', magnitude: 1
});

var nightClass_t1 = nl_t1.convolve(boxcar).gt(5).add(nl_t1.gt(50).add(nl_t1.gt(100)));
nightClass_t1 = nightClass_t1.selfMask().clip(municipio);

var nightClass_t0 = nl_t0.convolve(boxcar).gt(5).add(nl_t0.gt(50).add(nl_t0.gt(100)));
nightClass_t0 = nightClass_t0.selfMask().clip(municipio);

// Realizando a subtração
var diferenca = nl_t1.subtract(nl_t0);

// Calculando as regiões que mais se expandiram
var expansao = diferenca.reduceRegions(setores, ee.Reducer.mean(), 463.83);

var expansaoRaster = expansao.reduceToImage({
  properties: ['mean'],
  reducer: ee.Reducer.first()
});

// Parâmetros de visualização
var maximo = expansaoRaster.reduceRegion(ee.Reducer.max(), municipio, 463.83).getInfo().first;
var visParams = {bands:['first'],
                 palette:["#115f9a", "#1984c5", "#22a7f0", "#48b5c4", "#76c68f", "#a6d75b", "#c9e52f", "#d0ee11", "#d0f400"],
                 min:0,
                 max:maximo};

// Visualização
Map.addLayer(expansaoRaster, visParams, 'Expansão Urbana');
Map.addLayer(setores.style({color: 'black', fillColor: 'FF000000',  width: 0.1}), {}, 'Setores Censitários');
Map.addLayer(nightClass_t1, {palette:['white'], min:0, max:3, opacity:0.8}, 'Iluminação noturna 2021', 0);
Map.addLayer(nightClass_t0, {palette:['grey'], min:0, max:3, opacity:0.9}, 'Iluminação noturna 2014', 0);
Map.centerObject(municipio, 10);

}
