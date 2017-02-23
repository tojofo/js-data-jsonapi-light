/// <reference path="../typings/main.d.ts" />

import { utils, DataStore, Mapper } from 'js-data';
import { HttpAdapter } from 'js-data-http';
import { Adapter } from 'js-data-adapter';

export class JsonApiAdapter extends HttpAdapter{
  adapter: Adapter;
  private store: DataStore;

  constructor(options?:any) {
    options = utils.deepMixIn({
      // Enable the possibility to retrieve more informations in the promise of
      // a response.
      // compositePromiseResponse: false
    }, options || {})

    if (!options.store) {
      throw new Error('JsonApiAdapter needs to be given a store option.')
    }

    if (options.serialize) {
      options.beforeSerialize = options.serialize
    }

    if (options.deserialize) {
      options.afterDeserialize = options.deserialize
    }

    var selfWrapper:any = {};

    options.serialize = function(wrapper:any):any{
      return function(){
        return wrapper.self.jsonApiSerialize.apply(wrapper.self, arguments);
      }
    }(selfWrapper);

    options.deserialize = function(wrapper:any):any{
      return function(){
        return wrapper.self.jsonApiDeserialize.apply(wrapper.self, arguments);
      }
    }(selfWrapper);

    super(options);

    selfWrapper.self = this;
    this.store = options.store;
  }
  
  private warn(...args:any[]) {
    console.warn.apply(null, arguments);
    return;
  }
  
  public jsonApiSerialize(resourceConfig:Mapper, data:any){
    // console.log('Serialize: ', resourceConfig, res);
    
    console.log(data)

    return data;
  }
  
  public jsonApiDeserialize(mapper:Mapper, res:any, opts:any){
    
    if (!res.data || !res.data.data) return;

    const collectionReceived = utils.isArray(res.data.data)

    // We store all possible items stores in the response in a Object[type][id]
    // structure
    let itemsIndexed:any = {};
    let itemCollection:Array<any> = [].concat(res.data.included || [])
                                      .concat(res.data.data || []);

    let i = itemCollection.length;
    while (i--) {
      let item:any = itemCollection[i]
      if (!item.type || !item.id) {
        //@warn
        // Just remove it so that we don't need to deal with it later
        itemCollection.splice(i, 1);
        continue;
      }

      if (!itemsIndexed[item.type]) itemsIndexed[item.type] = {};
      itemsIndexed[item.type][item.id] = item;
    }

    // Know we will check every possible relationships and try to affect them
    // the correct key/id
    for (let type in itemsIndexed) {
      let resource:any = this.store.getMapper(type);
      if (!resource) { this.warn(`Can\'t find resource '${type}'`); continue; }

      // Just cache a pointer to relations for the Resource
      if (!resource.relationByFields) {
        resource.relationByFields = {};
        for (let i = 0, l = (resource.relationList || []).length; i < l; i++ ) {
          let field:string = resource.relationList[i].localField;
          if (!field) { this.warn('localField missing'); continue; }
          resource.relationByFields[field] = resource.relationList[i];
        }
      }

      for (let id in itemsIndexed[type]) {
        let item:any = itemsIndexed[type][id];
        item.attributes[resource.idAttribute] = id;

        if (!item.relationships || !Object.keys(item.relationships)) continue;

        for (let relationField in (item.relationships || {})) {
          let relation:any = resource.relationByFields[relationField]
          if (!relation || !item.relationships[relationField] || !item.relationships[relationField].data) {
            continue;
          }

          if (relation.type === 'belongsTo' || relation.type === 'hasOne') {
            let link:any = item.relationships[relationField].data
            if (!utils.isObject(link)) {
              this.warn('Wrong relation somewhere, object expected', relation);
              continue;
            }

            if (itemsIndexed[link.type] && itemsIndexed[link.type][link.id]) {
              let itemLinked:any = itemsIndexed[link.type][link.id];
              item.attributes[relation.localField] = itemLinked.attributes;
            }
          } else if (relation.type === 'hasMany') {
            let links:any = item.relationships[relationField].data
            if (!utils.isArray(links)) {
              this.warn('Wrong relation somewhere, array expected');
              continue;
            }

            item.attributes[relation.localField] = [];
            for (let i = 0, l = links.length; i < l; i++) {
              let link:any = links[i];
              if (itemsIndexed[link.type] && itemsIndexed[link.type][link.id]) {
                let itemLinkd:any = itemsIndexed[link.type][link.id];
                item.attributes[relation.localField].push(itemLinkd.attributes);
              }
            }
          } else { this.warn('Unknown relation'); continue; }
        }
      }
    }

    let outputDatas:Array<any> | any;
    if (!collectionReceived) {
      outputDatas = res.data.data.attributes;
    } else {
      outputDatas = [];
      for (let i = 0, l = res.data.data.length; i < l; i++) {
        outputDatas.push(res.data.data[i].attributes);
      }
    }

    if (!opts.raw) {
      return outputDatas;
    }

    return {
      result: outputDatas,
      meta: res.data.meta
    };
  }

  private handleResponse (opts?:any) { return function (response:any): Promise<any> {
    if (opts && opts.raw) {
      response.meta = response.data.meta;
      response.data = response.data.result;
    }

    // @todo #6 need to handle errors here

    return response;
  }}

  public find(mapper: Mapper, id: string | number, opts?: any): Promise<any> {
    return super.find(mapper, id, opts).then(this.handleResponse(opts))
  }  
  
  public findAll(mapper: Mapper, query?: any, opts?: any): Promise<any> {
    return super.findAll(mapper, query, opts).then(this.handleResponse(opts))
  }

  public create(mapper: Mapper, props: any, opts?: any): Promise<any> {
    return super.create(mapper, props, opts).then(this.handleResponse(opts))
  }

  public createMany(mapper: Mapper, props: any, opts?: any): Promise<any> {
    return super.createMany(mapper, props, opts).then(this.handleResponse(opts))
  }

  public update(mapper: Mapper, id: any, props: any, opts?: any): Promise<any> {
    return super.update(mapper, id, opts).then(this.handleResponse(opts))
  }

  public updateAll(mapper: Mapper, props: any, query: any, opts?: any): Promise<any> {
    return super.updateAll(mapper, query, opts).then(this.handleResponse(opts))
  }

  public updateMany(mapper: Mapper, records: any, opts?: any): Promise<any> {
    return super.updateMany(mapper, records, opts).then(this.handleResponse(opts))
  }

  public destroy(mapper: Mapper, id: string | number, opts?: any): Promise<any> {
    return super.destroy(mapper, id, opts).then(this.handleResponse(opts))
  }

  public destroyAll(mapper: Mapper, query: any, opts?: any): Promise<any> {
    return super.destroyAll(mapper, query, opts).then(this.handleResponse(opts))
  }
}