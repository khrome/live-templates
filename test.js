require("chai").should();
var Templates = require('./live-templates');

var templates = {
    main :'User:{{model "user:name.first"}}<br/><ul data-surname="{{model "user:name.last"}}">{{#models "item_list"}}<li>{{model ":name"}}:{{model ":value"}}</li>{{/models}}</ul>'
};
var $;

var user =  {
    name : {
        first : 'Ed',
        last : 'Beggler'
    }
};
var item_list = [
    {
        name : 'Agnot',
        subject : 'Whatnot',
        value : 14.8
    },
    {
        name : 'Corbin',
        subject : 'Dallas',
        value : 21.2
    }
];

Templates.component('widget', {
    create : function(){},
    update : function(){},
    destroy : function(){},
    activate : function(){},
    deactivate : function(){}
});

Templates.loader = function(name, callback){
    callback(templates[name]);
};
Templates.use('handlebars');

var tests = {};

describe('live-templates', function(){
    
    describe('uses EventedArray and EventedObject and', function(){

        before(function(){
            Templates.model.use('evented');
            Templates.model('user', user);
            Templates.model('item_list', item_list);
        });
        
        describe('renders static', function(){
    
        });
    
        describe('renders live', tests.live = function(){
    
            before(function(done){
                Templates.domSelector.ready(function(selector){
                    Templates.domSelector = selector;
                    $ = selector;
                    $.all = function(selector, root){
                        root = $(root || window.document.body);
                        return root.filter(selector).add(root.find(selector));
                    };
                    done();
                });
            });
        
            it('values in html bodies', function(complete){
                Templates.render('main', {}, function(domNodes){
                    $.all('span[field-link="name.first"][model-link="user"]', domNodes).html().should.equal('Ed');
                    complete();
                });
            });
        
            it('lists in html bodies', function(complete){
                Templates.render('main', {}, function(domNodes){
                    $.all('span[field-link="name"][model-link="item_list.0"]', domNodes).html().should.equal('Agnot');
                    $.all('span[field-link="value"][model-link="item_list.0"]', domNodes).html().should.equal('14.8');
                    $.all('span[field-link="name"][model-link="item_list.1"]', domNodes).html().should.equal('Corbin');
                    $.all('span[field-link="value"][model-link="item_list.1"]', domNodes).html().should.equal('21.2');
                    complete();
                });
            });
        
            it('values in html attributes', function(complete){
                Templates.render('main', {}, function(domNodes){
                    $.all('ul', domNodes).attr('data-surname').should.equal('Beggler');
                    complete();
                });
            });
    
        });
    
        describe('updates live', function(){
    
            before(function(done){
                Templates.domSelector.ready(function(selector){
                    Templates.domSelector = selector;
                    $ = selector;
                    $.all = function(selector, root){
                        root = $(root || window.document.body);
                        return root.filter(selector).add(root.find(selector));
                    };
                    done();
                });
            });
        
            it('lists', function(complete){
                Templates.render('main', {}, function(domNodes){
                    Templates.model('item_list').push({
                        name : 'Brash',
                        subject : 'McCanyon',
                        value : 88.8
                    });
                    $.all('span[field-link="name"][model-link="item_list.2"]', domNodes).html().should.equal('Brash');
                    $.all('span[field-link="value"][model-link="item_list.2"]', domNodes).html().should.equal('88.8');
                    complete();
                });
            });
        
            it('model fields in html bodies', function(complete){
                Templates.render('main', {}, function(domNodes){
                    Templates.model('item_list')[0].set('value', 17.4);
                    $.all('span[field-link="value"][model-link="item_list.0"]', domNodes).html().should.equal('17.4');
                    Templates.model('item_list')[1].set('name', 'Darill');
                    $.all('span[field-link="name"][model-link="item_list.1"]', domNodes).html().should.equal('Darill');
                    complete();
                });
            });
        
            it('model fields in html attributes', function(complete){
                Templates.render('main', {}, function(domNodes){
                    Templates.model('user').set('name.last', 'Baggins');
                    $.all('ul', domNodes).attr('data-surname').should.equal('Baggins');
                    complete();
                });
            });
    
        });
    
        describe('binds javascript components', function(){
    
            before(function(done){
                Templates.domSelector.ready(function(selector){
                    Templates.domSelector = selector;
                    $ = selector;
                    $.all = function(selector, root){
                        root = $(root || window.document.body);
                        return root.filter(selector).add(root.find(selector));
                    };
                    done();
                });
            });
        
            it('to object fields', function(){
            });
        
            it('to object field updates', function(){
            });
    
        });
    });
    
    /*describe('uses Backbone and', function(){

        before(function(){
            Templates.model.use('backbone');
            Templates.model('user', user);
            Templates.model('item_list', item_list);
        });
        
        //describe('renders static', tests.static);
        describe('renders live', tests.live);
        //describe('updates live', tests.liveUpdate);
        //describe('binds javascript components', tests.components);
        
        //todo: test model types
        
    });*/
    
    //describe('uses Backbone Models with EventedArrays and', function(){ });
    
    //describe('uses Backbone DeepModels', function(){ });
    
    //describe('uses Backbone DeepModels with EventedArrays and', function(){ });
    
});