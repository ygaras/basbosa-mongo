/**
 * Created with JetBrains WebStorm.
 * User: youssef
 * Date: 2/15/13
 * Time: 12:48 PM
 * To change this template use File | Settings | File Templates.
 */
var Async = require('async'),
  Cm = require('./cm'),
  Basbosa = require('basbosa-registry'),
  Backbone = require('backbone'),
  _ = require('underscore'),
  _inflections = require('underscore.inflections'),
  _str = require('underscore.string');

_.mixin(_str.exports());
_.mixin(_inflections);

var AutoModels = {
  modelsFromCollections: function () {
    var self = this;
    Cm.getDb('default').collectionNames(function (err, results) {
      _(results).each(function (collection) {
        var collectionName = collection.name.split('.').pop(),
          className = _(_(collectionName).singularize()).classify();
        if (!Basbosa(className + 'Model')) {
          self.createClass(className, collectionName);
        }

        if (!Basbosa(className + 'Model').collectionName) {
          Basbosa(className + 'Model').collectionName = collectionName;
        }

        Basbosa(className + 'Model').ensureIndecies();

        if (typeof Basbosa(className + 'Model').initClass === 'function') {
          Basbosa(className + 'Model').initClass();
        }

      });
      Basbosa('Database').emit('modelsReady');
      Basbosa('Logger').debug('Emitted models ready');
    });
  },

  initModels : function(done) {
    var models, functions;
    models = Basbosa(new RegExp("Model$"));
    models.forEach(function(model) {

    });

  },

  watchModelClasses : function() {
    var modelsClasses = Basbosa(/Model$/), count = 0, self = this;

    modelsClasses.forEach(function(modelClass) {
      if (modelClass.__registeredName === 'BasbosaModel') return;
      self.setCollectionName(modelClass.__registeredName);
      modelClass.initClass();
      count++;
      modelClass.on('ready', function() {
        count--;
        if (count == 0) Cm.emit('modelsReady');
      })
    });
    if (count == 0) Cm.emit('modelsReady');
  },

  setCollectionName : function(modelClassName) {
    var modelClass, collName;
    modelClass = Basbosa(modelClassName);
    if (modelClass.collectionName === false) {
      collName = _(modelClass.__registeredName.replace('Model', '')).underscored();
      collName = _(collName).pluralize();
      modelClass.collectionName = collName;
    }
  },

  createModelClass : function (modelClassName, _instance, _static, done) {
    if (Basbosa.added(modelClassName)) return done(null, Basbosa(modelClassName));
    var newClass = Basbosa('BasbosaModel').extend(_instance, _static);
    Basbosa.add(modelClassName , newClass);
    this.setCollectionName(modelClassName);
    newClass.initClass(function(err, result) {
      if (err) throw new Error(err);
      done(err, Basbosa(modelClassName));
    });
    return newClass;
  },

  getModel : function(modelName, done) {
    return this.createModelClass(modelName, {}, {}, done);
  },

  createCollectionClass : function(collectionClassName, _instance, _static, done) {
    if (Basbosa.added(collectionClassName)) {
      if (typeof done === 'function') return done(null, Basbosa(collectionClassName));
      return Basbosa(collectionClassName);
    }
    var modelName = collectionClassName.replace('Collection', '') + 'Model', self = this;
    if (!Basbosa.added(modelName)) {
      this.createModelClass(modelName, {}, {}, function() {
        done(null, self.getCollection(collectionClassName));
      });
      return;
    }
    _instance.model = Basbosa(modelName);
    var collection = Backbone.Collection.extend(_instance, _static);



    return done(null, Basbosa.add(collectionClassName, collection));
  }
};

module.exports = AutoModels;
Cm.on('connected', function() {
  Basbosa('Logger').trace('Cm fired db connected in auto models');
  AutoModels.watchModelClasses();
});

Basbosa.add('AutoModels', AutoModels);
