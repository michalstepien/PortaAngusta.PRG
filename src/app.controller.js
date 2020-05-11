import { Controller, Post, Dependencies, Body } from '@nestjs/common';
import { ElasticsearchService } from '@nestjs/elasticsearch';

@Controller()
@Dependencies(ElasticsearchService)
export class AppController {
  constructor(elasticsearchService) {
    this.elasticsearchService = elasticsearchService;
  }

  @Post('search')
  async search(@Body() req) {
    let size = req.size ? req.size : 10;
    let results = { data: [], error: false };
    let data = [];
    req.search.forEach(el => {
      let searchFilter = {
        from : 0, size: size,
        query: {
          bool: {}
        }
      };
      if (el.teryt || el.ulic || el.simc || el.pna) {
        searchFilter.query.bool.filter = [];
        if (el.teryt) {
          searchFilter.query.bool.filter.push({ term: { TERYT: el.teryt } });
        }
        if (el.ulic) {
          searchFilter.query.bool.filter.push({ term: { ULIC_id: el.ulic } });
        }
        if (el.pna) {
          searchFilter.query.bool.filter.push({ term: { PNA: el.pna } });
        }
      }

      if (el.street || el.city || el.nr) {
        searchFilter.query.bool.should = [];
        if (el.city) {
          searchFilter.query.bool.should.push({ match: { SIMC_nazwa: el.city } });
        }
        if (el.street) {
          searchFilter.query.bool.should.push({ match: { ULIC_nazwa: el.street } });
        }
        if (el.nr) {
          searchFilter.query.bool.should.push({ match: { NR: el.nr } });
        }
      }

      data.push(searchFilter);
    });

    const bodySearch = data.flatMap(doc => [{ index: 'prgdb' }, doc]);
    try {
      const { body } = await this.elasticsearchService.msearch({ body: bodySearch });
      if (body.responses) {
        body.responses.forEach(el => {
          results.data.push({ results: el.hits.hits.map((x) => x._source) })
        });
      }
    } catch (error) {
      results.error = error;
      console.error(error);
    }


    return { results };
  }
}