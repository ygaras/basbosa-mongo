var ObjectId = require('mongodb').ObjectID,
    Async = require('async'),
    Cm = require('./cm'),
    Fs = require('fs'),
    Basbosa = require('basbosa-registry'),
    Backbone = require('backbone'),
    _ = require('underscore'),
    _inflections = require('underscore.inflections'),
    _str = require('underscore.string');

_.mixin(_str.exports());
_.mixin(_inflections);

_.irregular('cache', 'caches');

var ERR_EXIST = 47,
    BILLION = 1000000000,
    // Machine ID: a 3-byte machine identifier - use random for now
    MACHINE_ID = _.pad(Math.floor((Math.random() * BILLION)).toString(16).substr(0, 6), 6, 0),

    // PROCESS ID:  a 2-byte process id,
    PROCESS_ID = _.pad(process.pid.toString(16).substr(0, 4), 4, 0),
    // Used to create an ever incrementing counter when generating documents ids
    // Maps to the:  3-byte counter, starting with a random value.
    LAST_GEN_ID = Math.floor(Math.random() * BILLION);

var BackboneFs = {
  idAttribute : '_id',

  // Bad name, this doesn't actually saves to db, it saves to the FS but the same function name is used to
  // to provide drop-replace functionality with other modules using Basbosa Models backed by Mongo DB
  saveDb : function (cb) {
    var self = this;
    if (!this.get(this.idAttribute)) this.set(this.idAttribute, this.constructor.genId());
    B('Logger').trace('Saving model', this.toJSON(), this.getPath());
    var json = this.toJSON();
    Fs.writeFile(this.getPath(), JSON.stringify(json), function(err){
      cb(err, json);
    });
    return this;
  },

  getPath : function() {
    return this.constructor.collectionPath + '/' + this.id;
  },

  saveDbField : function (field, cb) {

    var self = this, update = {$set:{}};

    if (field.indexOf('_id') > -1 && (field.length == '12' || field.length == '24')) {
      update.$set[field] = new (Basbosa('ObjectId'))(this.get(field));
    } else {
      update.$set[field] = this.get(field);
    }

    this.constructor.collection.update({_id : new (Basbosa('ObjectId'))(self.get('_id'))}, update, cb);
  },

  deleteDb : function(cb) {
    return Fs.unlink(this.getPath(), cb);
  }
};

var BackboneFsStatic = {
  // Flag to make to defien this model as a fsModel
  isFsModel : true,
  // TODO: Use it for in memory caching of collection data
  collection : null,

  // Collection Name is used to set folder inside which we store our json document
  // It is automatically set by the auto models class when the model class is initialized
  collectionName : false,

  // data folder
  dataStoreDir : false,

  // Not using mongo ids but will generate ones similar to them
  skipMongoId : true,

  initClass : function (done) {
    var self = this;
    // Make sure the folder to save model documents exist
    if (Basbosa && Basbosa.added('Config') && Basbosa('Config').get('dataStoreDir')) {
      this.dataStoreDir = Basbosa('Config').get('dataStoreDir');
    } else {
      // set it to the upper most folder with node_modules folder
      var index = __dirname.toString().indexOf('/node_modules');
      this.dataStoreDir = __dirname.toString().substr(0, index - 1) + '/data';
    }
    this.collectionPath = this.dataStoreDir + '/' + this.collectionName;

    Fs.mkdir(this.dataStoreDir, function(err) {
      var ERR_EXIST = 47;
      if (err && err.errno !== ERR_EXIST) throw new Error(err);

      Fs.mkdir(self.collectionPath, function(err) {
        var ERR_EXIST = 47;
        if (err && err.errno !== ERR_EXIST) throw new Error(err);
        if (typeof done === 'function') done(err);
      });

    });
  },

  genId : function() {
    var seconds = _.pad((Math.floor((new Date).getTime() / 1000)).toString(16), 8, 0),
        lasId = _.pad((LAST_GEN_ID++).toString(16).substr(0, 6), 6, 0);
    return seconds +  MACHINE_ID + PROCESS_ID + lasId ;
  },

  /*
   * Try to make the find function behaves as close as possible to find function on mongo db
   * Possible ways to pass parameters
   * cb
   * cb, res
   * query, cb
   * query, cb, res
   * query, fields, cb
   * query, fields, cb, res
   * query, fields, qOptions, cb
   * query, fields, qOptions, cb, res
   *
   * @param query
   * @param fields
   * @param qOptions
   * @param cb
   * @param res
   */
  find : function () {
    var dbCommand, query, fields, qOptions, cb, res, contains, defaultContains,
        args = Array.prototype.slice.call(arguments, 0), self = this;

    query = typeof args[0] === 'object' ? args[0] : {};
    fields = args.length >= 3 && typeof args[1] === 'object' ? args[1] : {};
    qOptions = args.length >= 4 && typeof args[2] === 'object' ? args[2] : {};
    defaultContains = self.autoContain && self.contains ?  self.contains : {};

    contains = qOptions.contains || defaultContains;
    delete qOptions.contains;

    res = args.pop();
    // If the last parameter is an object, log the query to it
    if (typeof res === 'object') {
      res.locals = res.locals || {};
      res.locals.dbCommands = res.locals.dbCommands || [];

      dbCommand = {
        collection : this.collectionName,
        name : 'find',
        query : query,
        fields : fields,
        qOptions : qOptions,
        duration : (new Date).getTime()
      };

      // Remove original call back
      cb = args.pop();
    } else {
      cb = res;
    }

    Fs.readdir(this.collectionPath, function(err, files) {
      if (err) {
        B('Logger').warn(err);
        return cb(err, files);
      }
      var functions = [];
      files.forEach(function(file) {
        functions.push(function(next) {
          Fs.readFile(self.collectionPath + '/' + file, function(err, data) {
            if (!err) data = JSON.parse(data);
            next(err, data);
          });
        })
      });
      var queryKeys = 0;
      for (var con in query) {
        if(con == '_id') query[con] = query[con].toString();
        queryKeys++;
      }
      Async.parallel(functions, function(err, results) {
        if (err) return cb(err, results);

        // Apply filtering
        if (queryKeys) {
          results = _.where(results, query);
        }

        // Apply fields inclusions and exclusions
        for (var field in fields) {
          results.forEach(function(result) {
            // Only support exclusions for now
            if (!fields[field]) delete result[field];
          });
        }

        // Apply sorting
        results = _.sortBy(results, function(result) {
          // default to id desc
          return -1 * parseInt(result._id.substr(0, 7), 16);
        });

        // If a response was sent, log to it;
        if (typeof res === 'object') {
          dbCommand.duration = (new Date).getTime() - dbCommand.duration;
          dbCommand.result = results;
          dbCommand.resultCount = results.length;
          dbCommand.err = err;
          res.locals.dbCommands.push(dbCommand);
        }

        var modelName = self.__registeredName.replace('Model', '');
        Basbosa('AutoModels').createCollectionClass(modelName + 'Collection',{}, {}, function (err, coll) {
          cb(err, new coll(results));

        });
      });
    });
  },

  delete : function(conditions, cb) {
    return this.collection.remove(conditions, cb);
  },

  /*
   *
   * @param query
   * @param qOptions
   * @param cb
   * @param res
   */
  findOne : function (query, qOptions, cb, res) {
    if (typeof qOptions === 'function') {
      res = cb;
      cb = qOptions;
      qOptions = {};
    }

    qOptions.limit = 1;

    return this.find(query, {}, qOptions, function (err, results) {
      cb(err, results.pop());
    }, res);
  }

};

BackboneFsStatic = _.extend(BackboneFsStatic, Backbone.Events);

var BasbosaFsModel = Backbone.Model.extend(BackboneFs, BackboneFsStatic);
module.exports = BasbosaFsModel;
Basbosa.add('BasbosaFsModel', BasbosaFsModel);
