/**
 * Created with JetBrains WebStorm.
 * User: youssef
 * Date: 2/15/13
 * Time: 2:15 PM
 * To change this template use File | Settings | File Templates.
 */
var Cm = require('../lib/cm');
    BasbosaModel = require('../lib/model'),
    AutoModels = require('../lib/auto_models'),
    Basbosa = require('basbosa-registry');

Cm.add({database : 'hawks'});
Cm.on('connected:default', function() {
   //console.log('connected to db default');
});

var FeedModel = BasbosaModel.extend({}, {collectionName : 'users'});
FeedModel.on('ready', function() {
    FeedModel.search({}, function(err, results) {
        //console.log(results);
    })
});

Basbosa.add('FeedModel', FeedModel);

Basbosa('Cm').on('modelsReady', function() {
    console.log('models are now ready');
});