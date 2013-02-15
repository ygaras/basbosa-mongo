/**
 * Created with JetBrains WebStorm.
 * User: youssef
 * Date: 2/15/13
 * Time: 12:48 PM
 * To change this template use File | Settings | File Templates.
 */
var Async = require('Async'),
    Cm = require('./cm'),
    Basbosa = require('basbosa-registry');

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
        var modelsClasses = Basbosa(/Model$/), count = 0;

        modelsClasses.forEach(function(modelClass) {
            if (!modelClass.collectionName) return;
            count++;
            console.log('registering with model ' + modelClass.collectionName);
            modelClass.on('ready', function() {
                count--;
                if (count == 0) Cm.emit('modelsReady');
            })
        });
        if (count == 0) Cm.emit('modelsReady');
    },


    createModelClass : function (name, _static, _instance, done) {
        var newClass = Basbosa.Model.extend(_instance, _static);
        newClass.initClass(function(err, result) {
            if (err) throw new Error(err);
            done(err, result);
        })
        return Basbosa.add(className + 'Model', newClass);
    }
};

module.exports = AutoModels;
Cm.on('connected', function() {
    AutoModels.watchModelClasses();
});

Basbosa.add('AutoModels', AutoModels);
