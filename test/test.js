var should = require("chai").should();
var Live = require('../live-templates');
var fs = require('fs');
var jsdom = require('jsdom');
global._ = require('underscore');
var arrays = require('async-arrays');

var data = JSON.parse(fs.readFileSync('test/test-data.json').toString());
var shallowData = JSON.parse(fs.readFileSync('test/test-data-shallow.json').toString());

var userModel;
var itemListModel;
var addOne;
var addTwo;
var changeValues;

var tests = {};

//model libraries:
var Backbone = require('backbone');
var EventedArray = require('array-events');
var EventedObject = require('object-events');

var hardExit = function(){
    console.log.apply(console, arguments);
    process.exit();
}

describe('live-templates', function(){

    describe('with handlebars templates', function(){
        
        before(function(done){
            //setup the browser context we're going to attach to
            jsdom.env(
                '<html><head></head><body></body></html>',
                ["http://code.jquery.com/jquery.js"],
                function(errors, window){
                    Live.bondTarget = function(){
                        return window;
                    };
                    console.log('##', !!window.NodeList);
                    //rootContext = window;
                    global.HTMLCollection = window.HTMLCollection;
                    global.NodeList = window.NodeList;
                    done();
                }
            );
        });
        
        //*
        describe('uses EventedArray and EventedObject to', function(){
            before(function(done){
                Live.models('evented');
                Live.views('handlebars');
                userModel = new EventedObject(data.user);
                itemListModel = new EventedArray(data.user_list.map(function(item){
                    return new EventedObject(item);
                }));
                Live.model('user', userModel);
                Live.model('item_list', itemListModel);
                addOne = new EventedObject(data.extra_users[0]);
                addTwo = new EventedObject(data.extra_users[1]);
                addThree = new EventedObject(data.extra_users[2]);
                changeValues = function(){
                    data.extra_names.forEach(function(name, index){
                        Live.model('item_list')[index].set('name', name);
                    });
                };
                done();
            });
    
            describe('render live data', tests.live = function(){
                it('as atomic values', tests.atomic = function(complete){
                    var template = new Live.Template({
                        template:'test/simple-test.handlebars',
                        complete : function(){
                            Live.value(template.dom[0]).should.equal('User:');
                            Live.value(template.dom[1]).should.equal('[user:name.first]');
                            Live.value(template.dom[2]).should.equal("Ed");
                            Live.value(template.dom[3]).should.equal("\n");
                            template.dom[4].nodeName.should.equal('BR');
                            Live.value(template.dom[5]).should.equal("\n");
                            template.destroy();
                            complete();
                        }
                    });
                });
                
                it('as atomic values with updates', tests.atomic_updates = function(complete){
                    var template = new Live.Template({
                        template:'test/simple-test.handlebars',
                        complete : function(){
                            Live.model('user').set('name.first', 'Bob');
                            Live.value(template.dom[2]).should.equal("Bob");
                            Live.model('user').set('name.first', 'Ed');
                            Live.value(template.dom[2]).should.not.equal("Bob");
                            template.destroy();
                            complete();
                        }
                    });
                });
                
                //*
                it('as a list of arbitrary HTML', tests.html_list = function(complete){
                    var template = new Live.Template({
                        template:'test/simple-test.handlebars',
                        complete : function(){
                            var lis = template.select('li');
                            lis.length.should.equal(2);
                            var domSelectedValues = [];
                            lis.forEach(function(item, index){
                                domSelectedValues.push(item.textContent);
                            });
                            var dataGeneratedValues = [];
                            Live.model('item_list').forEach(function(item){
                                dataGeneratedValues.push(item.get('name')+':'+item.get('value'));
                            });
                            domSelectedValues.length.should.equal(2);
                            dataGeneratedValues.length.should.equal(2);
                            dataGeneratedValues.forEach(function(item){
                                arrays.erase(domSelectedValues, item);
                            });
                            domSelectedValues.length.should.equal(0);
                            template.destroy();
                            complete();
                        }
                    });
                });
                
                it('as a list of arbitrary HTML with async member additions', tests.html_list_async = function(complete){
                    var template = new Live.Template({
                        template:'test/simple-test.handlebars',
                        complete : function(error, tracer){
                            Live.model('item_list').push(addOne);
                            Live.model('item_list').push(addTwo);
                            setTimeout(function(){ //wait for the nodes to hit the DOM
                                var lis = template.select('li');
                                lis.length.should.equal(Live.model('item_list').length);
                                var domSelectedValues = [];
                                lis.forEach(function(item, index){
                                    domSelectedValues.push(item.textContent);
                                });
                                var dataGeneratedValues = [];
                                Live.model('item_list').forEach(function(item){
                                    dataGeneratedValues.push(item.get('name')+':'+item.get('value'));
                                });
                                domSelectedValues.length.should.equal(4);
                                dataGeneratedValues.length.should.equal(4);
                                dataGeneratedValues.forEach(function(item){
                                    arrays.erase(domSelectedValues, item);
                                });
                                domSelectedValues.length.should.equal(0);
                                template.destroy();
                                complete();
                            }, 1000);
                        }
                    });
                });
                
                it('as a list of arbitrary HTML with member value updates', tests.html_list = function(complete){
                    var template = new Live.Template({
                        template:'test/simple-test.handlebars',
                        complete : function(){
                            changeValues();
                            var lis = template.select('li');
                            lis.length.should.equal(4);
                            var domSelectedValues = [];
                            lis.forEach(function(item, index){
                                domSelectedValues.push(item.textContent);
                            });
                            var dataGeneratedValues = [];
                            Live.model('item_list').forEach(function(item){
                                dataGeneratedValues.push(item.get('name')+':'+item.get('value'));
                            });
                            domSelectedValues.length.should.equal(4);
                            dataGeneratedValues.length.should.equal(4);
                            domSelectedValues.forEach(function(item){
                                arrays.erase(dataGeneratedValues, item);
                            });
                            dataGeneratedValues.length.should.equal(0);
                            domSelectedValues[0].split(':').shift().should.equal('Armand');
                            domSelectedValues[1].split(':').shift().should.equal('Edmund');
                            domSelectedValues[2].split(':').shift().should.equal('Harlan');
                            domSelectedValues[3].split(':').shift().should.equal('Lemmy');
                            template.destroy();
                            complete();
                        }
                    });
                });
                
                it('as a list of arbitrary HTML with out of order insertions', tests.html_list = function(complete){
                    var template = new Live.Template({
                        template:'test/simple-test.handlebars',
                        complete : function(){
                            Live.model('item_list').unshift(addThree);
                            setTimeout(function(){ //wait for the nodes to hit the DOM
                                var lis = template.select('li');
                                var domSelectedValues = [];
                                lis.forEach(function(item, index){
                                    domSelectedValues.push(item.textContent);
                                });
                                var dataGeneratedValues = [];
                                Live.model('item_list').forEach(function(item){
                                    dataGeneratedValues.push(item.get('name')+':'+item.get('value'));
                                });
                                console.log(domSelectedValues, dataGeneratedValues, addThree.attributes);
                                dataGeneratedValues.forEach(function(item, index){
                                    domSelectedValues[index].should.equal(item)
                                });
                                //console.log('!!!', dataGeneratedValues, domSelectedValues);
                                complete();
                            }, 1000);
                        }
                    });
                });
                //*/
                
                it('as a list of arbitrary HTML with out of order removals', tests.html_list = function(complete){
                    var template = new Live.Template({
                        template:'test/simple-test.handlebars',
                        complete : function(error, tracer){
                            Live.model('item_list').length.should.equal(5);
                            template.select('li').length.should.equal(5);
                            Live.model('item_list').shift();
                            setTimeout(function(){ //wait for the nodes to hit the DOM
                                Live.model('item_list').length.should.equal(4);
                                var lis = template.select('li');
                                lis.length.should.equal(4);
                                var domSelectedValues = [];
                                lis.forEach(function(item, index){
                                    domSelectedValues.push(item.textContent);
                                });
                                domSelectedValues[0].should.equal('Armand:14.8');
                                complete();
                            }, 200);
                        }
                    });
                });
                //*/
            });
        });
        //*
        describe('uses EventedArray and Backbone to', function(){
            before(function(done){
                Live.models('backbone-hybrid');
                Live.views('handlebars');
                userModel = new Backbone.Model(shallowData.user);
                itemListModel = new EventedArray(data.user_list.map(function(item){ 
                    return new Backbone.Model(item);
                }));
                Live.model('user', userModel);
                Live.model('item_list', itemListModel);
                addOne = new Backbone.Model(data.extra_users[0]);
                addTwo = new Backbone.Model(data.extra_users[1]);
                addThree = new Backbone.Model(data.extra_users[2]);
                changeValues = function(){
                    data.extra_names.forEach(function(name, index){
                        Live.model('item_list')[index].set('name', name);
                    });
                };
                done();
            });
    
            describe('render live data', tests.live);
        }); //*/
        
        //*
        describe('uses Backbone to', function(){
            before(function(done){
                Live.models('backbone');
                Live.views('handlebars');
                userModel = new Backbone.Model(shallowData.user);
                itemListModel = new Backbone.Collection([], {
                      model: userModel
                });
                shallowData.user_list.forEach(function(item){
                    itemListModel.add(new Backbone.Model(item));
                });
                Live.model('user', userModel);
                Live.model('item_list', itemListModel);
                addOne = new Backbone.Model(data.extra_users[0]);
                addTwo = new Backbone.Model(data.extra_users[1]);
                addThree = new Backbone.Model(data.extra_users[2]);
                changeValues = function(){
                    data.extra_names.forEach(function(name, index){
                        Live.model('item_list').at(index).set('name', name);
                    });
                };
                done();
            });
    
            describe('render live data', tests.live);
        }); //*/
        
        /*
        describe('uses EventedArray and BackboneDeepModel to', function(){
            before(function(done){
                Live.models('backbone-deep-hybrid');
                Live.views('handlebars');
                userModel = new Backbone.DeepModel(data.user);
                itemListModel = new EventedArray(data.user_list.map(function(item){ 
                    return new Backbone.DeepModel(item);
                }));
                Live.model('user', userModel);
                Live.model('item_list', itemListModel);
                addOne = new Backbone.DeepModel(data.extra_users[0]);
                addTwo = new Backbone.DeepModel(data.extra_users[1]);
                addThree = new Backbone.DeepModel(data.extra_users[2]);
                changeValues = function(){
                    data.extra_names.forEach(function(name, index){
                        Live.model('item_list')[index].set('name', name);
                    });
                };
                done();
            });
    
            describe('render live data', tests.live);
        }); //*/
        
        /*
        describe('uses BackboneDeepModel to', function(){
            
            before(function(done){
                Live.models('backbone-deep');
                Live.views('handlebars');
                userModel = new Backbone.DeepModel(data.user);
                itemListModel = new Backbone.Collection([], {
                      model: userModel
                });
                data.user_list.forEach(function(item){
                    itemListModel.add(new Backbone.DeepModel(item));
                });
                Live.model('user', userModel);
                Live.model('item_list', itemListModel);
                addOne = new Backbone.DeepModel(data.extra_users[0]);
                addTwo = new Backbone.DeepModel(data.extra_users[1]);
                addThree = new Backbone.DeepModel(data.extra_users[2]);
                changeValues = function(){
                    data.extra_names.forEach(function(name, index){
                        Live.model('item_list').at(index).set('name', name);
                    });
                };
                done();
            });
    
            describe('render live data', tests.live);
        }); //*/
    
    });
    
    //describe('and smarty');
    
    //describe('and mustache');
    
    //describe('and UBB');
    
    //describe('and Jade?');
    
    //describe('and HAML?');
    
});

// UTILITY FUNCTIONS

should.select = function(selector, root){
    var selected = (
        root.nodeType != 11 ?
        Templates.domSelector(root).find(selector) :
        Templates.domSelector(root.childNodes).find(selector).add(
            Templates.domSelector(root.childNodes).filter(selector)
        )
    );
    //if(!selected[0]) throw new Error(selector+' returned nothing');
    return selected[0];
};

function liveNodeQuery(root, model, field){
    return should.select('span[data-field-link="'+field+'"][data-model-link="'+model+'"]', root);
}