//    backbone-mongodb mongodb-sync.js
//    (c) 2011 Done.
var ObjectId = require('mongodb').ObjectID,
  Async = require('async'),
  Cm = require('./cm'),
  Basbosa = require('basbosa-registry'),
  Backbone = require('backbone'),
  _ = require('underscore'),
  _inflections = require('underscore.inflections'),
  _str = require('underscore.string');

_.mixin(_str.exports());
_.mixin(_inflections);

var BackboneMongoStatic = {

  connectionName:'default',

  collection:null,

  collectionName:false,

  skipMongoId:false,

  initClass:function (done) {
    var functions = [], self = this;
    functions.push(function (next) {
      self.getDb(next, true);
    });

    functions.push(function (next) {
      self.getCollection(function (err, collection) {
        if (err) throw new Error(err);
        self.collection = collection;
        next(err, collection);
      });
    });

    functions.push(function (next) {
      self.ensureIndecies(next);
    });

    Async.series(functions, function (err, results) {
      if (err) throw new Error(err);
      self.trigger('ready');
      if (typeof done === 'function') done(err, results);
    });
  },

  getDb:function (cb) {
    var connection = Cm.getDb(this.connectionName), self = this;
    if (connection !== false && typeof cb === 'function') return cb(null, connection);
    if (connection !== false) return connection;
    if (typeof cb === 'function') {
      Cm.on('connected:' + this.connectionName, function () {
        cb(null, self.getDb());
      })
    } else {
      throw new Error('Connection not established yet to DB: ' + this.connectionNam);
    }
  },

  getCollection:function (cb) {
    return this.getDb().collection(this.collectionName, cb);
  },

  ensureIndecies:function (done) {
    var functions = [], indecies = this.indecies, self = this;
    _(indecies).each(function (indexDetails) {
      functions.push(function (next) {
        var arr = indexDetails.slice();
        arr.push(next);
        self.collection.ensureIndex.apply(self.collection, arr);

      });
    });

    Async.series(functions, function (err, res) {
      if (err) {
        Basbosa('Logger').debug(err);
        throw new Error(err);
      }
      done(err, res);
    });
  },

  populateHasMany:function (HasMany, models, cb, res, qOptions) {
    var self = this, modelMap = {}, modelIds = [], query = {},
      foreignModelName = HasMany.modelName,
      foreign_key = HasMany.foreign_key || _(self.collectionName).singularize() + '_id',
      foreignModelNameModel = foreignModelName + 'Model';

    _.each(models, function (model) {
      modelIds.push(model.id);
      modelMap[model.id] = model;
    });

    query[foreign_key] = {$in:modelIds};

    Basbosa(foreignModelNameModel).search(query, {}, qOptions, function (err, results) {
      _.each(results, function (result) {
        modelMap[result[foreign_key]][foreignModelName] = modelMap[result[foreign_key]][foreignModelName] || [];
        modelMap[result[foreign_key]][foreignModelName].push(result);
      });

      cb(err, results);

    }, res);

  },

  populateBelongsTo:function (BelongsTo, models, cb, res) {
    var modelIds = [], query = {}, modelMap = {},
      foreignModelName = BelongsTo.modelName,
      local_foreign_key = BelongsTo.local_foreign_key || foreignModelName.toLowerCase() + '_id';

    _.each(models, function (model) {
      modelIds.push(model[local_foreign_key]);

      //modelMap[model[local_foreign_key]] = model;
    });

    if (BelongsTo.skipMongoID) {
      query['id'] = {$in:modelIds};
    } else {
      query['_id'] = {$in:modelIds};
    }

    Basbosa(foreignModelName + 'Model').search(query, function (err, results) {

      _.each(results, function (result) {
        if (BelongsTo.skipMongoID) {
          modelMap[result.id] = result;
        } else {
          modelMap[result._id.toString()] = result;
        }

      });

      _.each(models, function (model) {
        if (BelongsTo.skipMongoID) {
          model[foreignModelName] = modelMap[model[local_foreign_key]];
        } else {
          model[foreignModelName] = modelMap[model[local_foreign_key].toString()];
        }

      });

      cb(err, results);
    }, res);

  },

  fetchContained:function (contains, models, completed, res) {
    var functions = [], self = this, allowedRelations = ['HasMany', 'BelongsTo'];
    _.each(contains, function (relations, relationType) {
      if (allowedRelations.indexOf(relationType) === -1) return;
      _.each(relations, function (ModelContains, ModelName) {
        functions.push(function (next) {
          var relation = {}, qOptions = ModelContains.qOptions || {};
          relation = {
            modelName:ModelName,
            local_foreign_key:relations[ModelName].local_foreign_key,
            foreign_key:relations[ModelName].foreign_key
          };
          self['populate' + relationType](relation, models, function (err, results) {
            Basbosa(ModelName + 'Model').fetchContained(ModelContains, results, next, res);
          }, res, qOptions);
        });

      });
    });

    Async.parallel(functions, function (err) {
      completed(err, models);
    });

  },


  /*
   *Possible ways to pass parameters
   * cb
   * cb, res
   * query, cb
   * query, cb, res
   * query, fields, cb
   * query, fields, cb, res
   * query, fields, qOptions, cb
   * query fields, qOptions, cb, res
   *
   * @param query
   * @param fields
   * @param qOptions
   * @param cb
   * @param res
   */
  find:function () {
    var dbCommand, query, fields, qOptions, cb, res, contains,
      args = Array.prototype.slice.call(arguments, 0), self = this;

    query = typeof args[0] === 'object' ? args[0] : {};
    fields = args.length >= 3 && typeof args[1] === 'object' ? args[1] : {};
    qOptions = args.length >= 4 && typeof args[2] === 'object' ? args[2] : {};
    contains = qOptions.contains || {};
    delete qOptions.contains;

    res = args.pop();
    // If the last parameter is an object, log the query to it
    if (typeof res === 'object') {
      res.locals = res.locals || {};
      res.locals.dbCommands = res.locals.dbCommands || [];

      dbCommand = {
        collection:this.collectionName,
        name:'find',
        query:query,
        fields:fields,
        qOptions:qOptions,
        duration:(new Date).getTime()
      };

      // Remove original call back
      cb = args.pop();
    } else {
      cb = res;
    }

    self.collection.find(query, fields, qOptions).toArray(function (err, results) {
      if (err) return cb(err, results);

      results = _.map(results, function (result) {
        result._id = result._id.toString();
        return result;
      });

      // If a response was sent, log to it;
      if (typeof res === 'object') {
        dbCommand.duration = (new Date).getTime() - dbCommand.duration;
        dbCommand.result = results;
        dbCommand.resultCount = results.length;
        dbCommand.err = err;
        res.locals.dbCommands.push(dbCommand);
      }
      var modelName = _(_(self.collectionName).singularize()).classify();
      Basbosa('AutoModels').getCollection(modelName + 'Collection', function (err, coll) {
        results = new coll(results);
        self.fetchContained(contains, results, function (err) {
          cb(err, results);
        }, res);
      });


    });
  },

  /*
   *
   * @param query
   * @param qOptions
   * @param cb
   * @param res
   */
  findOne:function (query, qOptions, cb, res) {
    if (typeof qOptions === 'function') {
      res = cb;
      cb = qOptions;
      qOptions = {};
    }

    qOptions.limit = 1;

    return this.search(query, {}, qOptions, function (err, results) {
      cb(err, results.pop());
    }, res);
  },
  stringsToNative:function (obj) {
    var self;

    if (Array.isArray(obj)) {
      obj.forEach(function (subObj) {
        self.processFields(subObj);
      });
    }
    for (var key in obj) {
      if (typeof obj[key] == 'object') self.processFields(obj);
    }

    if (typeof obj === 'string' && (field.length == '12' || field.length == '24')) {

    }


  }

};
var BackboneMongo;
BackboneMongo = {

  idAttribute:'_id',

  saveDb:function (cb) {
    var self = this;
    this.constructor.getCollection(function (error, collection) {
      if (self.get('_id')) {
        var ob = self.toJSON();
        delete ob._id;
        return collection.update({_id:new ObjectID(self.get('_id'))}, {$set:ob}, {upsert:true}, cb);
      }
      collection.insert(self.toJSON(), function (err, result) {
        if (!err && result) {
          result = result.pop();
          self.set('_id', result._id.toString());
        }

        cb(err, result);
      });
    });
    return this;
  },

  saveDbField:function (field, cb) {
    var self = this, update = {$set:{}};

    if (field.indexOf('_id') > -1 && (field.length == '12' || field.length == '24')) {
      update.$set[field] = new ObjectID(this.get(field));
    } else {
      update.$set[field] = this.get(field);
    }

    this.constructor.getCollection(function (error, collection) {
      collection.update({_id:new ObjectID(self.id)}, update, cb);
    });

  }
};

BackboneMongoStatic = _.extend(BackboneMongoStatic, Backbone.Events);

var BasbosaModel = Backbone.Model.extend(BackboneMongo, BackboneMongoStatic);
module.exports = BasbosaModel;
Basbosa.add('BasbosaModel', BasbosaModel);
Basbosa.add('ObjectId', ObjectId);