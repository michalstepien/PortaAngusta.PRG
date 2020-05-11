const geojsonStream = require('geojson-stream');
const proj4 = require('proj4');
const projection = 'PROJCS["ETRS89_Poland_CS92",GEOGCS["GCS_ETRS_1989",DATUM["D_ETRS_1989",SPHEROID["GRS_1980",6378137,298.257222101]],PRIMEM["Greenwich",0],UNIT["Degree",0.017453292519943295]],PROJECTION["Transverse_Mercator"],PARAMETER["latitude_of_origin",0],PARAMETER["central_meridian",19],PARAMETER["scale_factor",0.9993],PARAMETER["false_easting",500000],PARAMETER["false_northing",-5300000],UNIT["Meter",1]]';
const projectionOut = proj4.defs('EPSG:4326');
const fs = require('fs');
const { Client } = require('@elastic/elasticsearch');
const client = new Client({ node: 'http://localhost:9200' });

(async () => {
  let resultsToSave = [];
  let i = 0;
  
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

  const rs = fs
    .createReadStream(`results.json`)
    .pipe(geojsonStream.parse());

    rs.on("data", async (building) => {
      rs.pause();
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
      
      if (resultsToSave.length == 500) { 
        i = i + 1;
        const body = resultsToSave.flatMap(doc => [{ index: { _index: 'prgdb' } }, doc]);
        try {
          const { body: bulkResponse } = await client.bulk({ refresh: true, body });
          console.log('saving chunk...', i * 500);
          if (bulkResponse.errors) { console.err(err); return; }
 
          let errorCount = 0;
          bulkResponse.items.forEach(item => {
            if(item.index._version !== 1) {
              console.log('Not version !', item.index._version);
            }
            if(item.index.result !== 'created') {
              console.log('Not created !', item.index.result);
            }
            if(item.index.status !== 201) {
              console.log('Not status 201!', item.index.status);
            }
            
            if (item.index && item.index.error) {
              console.log(++errorCount, item.index.error);
            }
          });
        } catch (error) {
          console.log(error);
        }
        resultsToSave = [];
      }
      rs.resume();
    });
    
    rs.on("end", async () => {
      console.log('End mapping... . Saving last elements: ', resultsToSave.length);
      const body = resultsToSave.flatMap(doc => [{ index: { _index: 'prgdb' } }, doc]);
      try {
        const { body: bulkResponse } = await client.bulk({ refresh: true, body });
        if (bulkResponse.errors) {
          console.log(JSON.stringify(bulkResponse, null, ' '));
        }
      } catch (error) {
        console.log(error);
        console.log(body);
      }
      console.log('End saving...', resultsToSave.length);
    });

})();