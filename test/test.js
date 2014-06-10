require("chai").should();
var Templates = require('../live-templates');
var fs = require('fs');

var $;

var user =  {
    name : { first : 'Ed', last : 'Beggler' }
};
var item_list = [
    { name : 'Agnot', subject : 'Whatnot', value : 14.8 },
    { name : 'Corbin', subject : 'Dallas', value : 21.2 }
];

Templates.component('widget', {
    create : function(){},
    update : function(){},
    destroy : function(){},
    activate : function(){},
    deactivate : function(){}
});

Templates.loader = function(name, callback){
    fs.readFile('test/'+name+'.handlebars', function(err, response){
        callback(response.toString());
    });
};
Templates.use('handlebars');

var tests = {};

function existsAndEquals(selector, value, root){
    var selector = $(selector, root);
    return selector[0] && selector[0].innerHTML && selector[0].innerHTML.should.equal(value);
}

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
        
            /*it('values in html bodies', function(complete){
                Templates.render('main', {}, function(domNodes){
                    Templates.dump();
                    console.log('NODES', $.all('span[data-field-link="name.first"][data-model-link="user"]', domNodes));
                    $.all('span[data-field-link="name.first"][data-model-link="user"]', domNodes).html().should.equal('Ed');
                    complete();
                });
            });*/
        
            it('lists in html bodies', function(complete){
                console.log('!!!');
                Templates.render('simple-test', {}, function(domNodes){
                    console.log('--!!!');
                    existsAndEquals('span[field-link="name"][data-model-link="item_list.0"]', 'Agnot', domNodes);
                    existsAndEquals('span[field-link="value"][data-model-link="item_list.0"]', '14.8', domNodes);
                    existsAndEquals('span[field-link="name"][data-model-link="item_list.1"]', 'Corbin', domNodes);
                    existsAndEquals('span[field-link="value"][data-model-link="item_list.1"]', '21.2', domNodes);
                    complete();
                });
            });
        
            /*it('values in html attributes', function(complete){
                Templates.render('main', {}, function(domNodes){
                    $.all('ul', domNodes).attr('data-surname').should.equal('Beggler');
                    complete();
                });
            });*/
    
        });
        
    });
    
});