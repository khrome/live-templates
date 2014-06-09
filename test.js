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
                    //console.log('NODES', $('span', domNodes));
                    $.all('span[data-field-link="name.first"][data-model-link="user"]', domNodes).html().should.equal('Ed');
                    complete();
                });
            });
        
            /*it('lists in html bodies', function(complete){
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
            });*/
    
        });
        
    });
    
});