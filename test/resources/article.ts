import * as JSData from 'js-data'
import { DS } from '../ds'

export const Article:JSData.DSResourceDefinition<any>  = DS.defineResource({
  name: 'Article',
  endpoint: 'articles',
  relations: {
    belongsTo: {
      'User': {
        localField: 'author',
        localKey: 'authorId'
      }
    },
    haMany: {
      'UserFavorite': {
        localField: 'followers',
        foreignKey: 'articleId'
      }
    }
  }
})