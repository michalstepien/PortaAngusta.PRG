const geojsonStream = require('geojson-stream');
const proj4 = require('proj4');
const projection = 'PROJCS["ETRS89_Poland_CS92",GEOGCS["GCS_ETRS_1989",DATUM["D_ETRS_1989",SPHEROID["GRS_1980",6378137,298.257222101]],PRIMEM["Greenwich",0],UNIT["Degree",0.017453292519943295]],PROJECTION["Transverse_Mercator"],PARAMETER["latitude_of_origin",0],PARAMETER["central_meridian",19],PARAMETER["scale_factor",0.9993],PARAMETER["false_easting",500000],PARAMETER["false_northing",-5300000],UNIT["Meter",1]]';
const projectionOut = proj4.defs('EPSG:4326');
const fs = require('fs');
const { Client } = require('@elastic/elasticsearch');
const client = new Client({ node: 'http://localhost:9200' });


let resultsToSave = [];
let i = 0;

(async () => {

  await client.indices.create({ index: 'prgdb' });
  client.indices.putMapping({
    index: 'prgdb',
    body: {
      properties: {
        TERYT: { type: 'text' },
        PNA: { type: 'text' },
        SIMC_id: { type: 'text' },
        SIMC_nazwa: { type: 'text' },
        ULIC_id: { type: 'text' },
        ULIC_nazwa: { type: 'text' },
        NR: { type: 'text' },
        COORD: { type: 'geo_point' }
      }
    }
  });

  fs
    .createReadStream(`results.json`)
    .pipe(geojsonStream.parse(async (building, index) => {
      const ret = {
        TERYT: building.properties.TERYT,
        PNA: building.properties.PNA,
        SIMC_id: building.properties.SIMC_id,
        SIMC_nazwa: building.properties.SIMC_nazwa,
        ULIC_id: building.properties.ULIC_id,
        ULIC_nazwa: building.properties.ULIC_nazwa,
        NR: building.properties.Numer,
        COORD: proj4(projection, projectionOut, building.geometry.coordinates)
      };
      resultsToSave.push(ret);
      if (resultsToSave.length == 5000) {
        i = i + 5000;
        console.log('saving chunk...', i);
        const body = resultsToSave.flatMap(doc => [{ index: { _index: 'prgdb' } }, doc]);
        try {
          const { body: bulkResponse } = await client.bulk({ refresh: true, body });
          if (bulkResponse.errors) {
            const erroredDocuments = []
            bulkResponse.items.forEach((action, i) => {
              console.log(action);
            })
            //console.log(erroredDocuments)
          }
        } catch (error) {
          console.log(error);
        }

        resultsToSave = [];
      }
    })).on("end", async () => {
      console.log('End mapping...', resultsToSave.length);
      let i;
      let j;
      const chunk = 5000;
      for (i = 0, j = resultsToSave.length; i < j; i += chunk) {
        console.log('saving chunk...')
        const temparray = resultsToSave.slice(i, i + chunk);
        const body = temparray.flatMap(doc => [{ index: { _index: 'prgdb' } }, doc]);
        await client.bulk({ refresh: true, body });
      }
      console.log('End saving...', resultsToSave.length);
    });

})();