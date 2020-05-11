import { Module } from '@nestjs/common';
import { AppController } from './app.controller';
import { ElasticsearchModule, ElasticsearchService  } from '@nestjs/elasticsearch';

@Module({
  imports: [ElasticsearchModule.register({
    node: 'http://localhost:9200',
  })],
  controllers: [AppController],
  providers: [],
})
export class AppModule {}