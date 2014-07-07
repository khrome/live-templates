var should = require("chai").should();
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
        if(err) throw err;
        callback(response.toString());
    });
};
Templates.use('handlebars');

var tests = {};

should.select = function(selector, root){
    var selected = (
        root.nodeType != 11 ?
        Templates.domSelector(root).find(selector) :
        Templates.domSelector(root.childNodes).find(selector).add(
            Templates.domSelector(root.childNodes).filter(selector)
        )
    );
    if(!selected[0]) throw new Error(selector+' returned nothing');
    return selected[0];
};

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
                    done();
                });
            });
        
            it('values in html bodies', function(complete){
                Templates.render('simple-test', {}, function(domNodes){
                    should.select('span[data-field-link="name.first"][data-model-link="user"]', domNodes)
                        .innerHTML.should.equal('Ed');
                    complete();
                });
            });
            
            it('list item html bodies', function(complete){
                Templates.render('simple-test', {}, function(domNodes){
                    should.select('span[data-field-link="name"][data-model-link="item_list.0"]', domNodes)
                        .innerHTML.should.equal('Agnot');
                    should.select('span[data-field-link="value"][data-model-link="item_list.0"]', domNodes)
                        .innerHTML.should.equal('14.8');
                    should.select('span[data-field-link="name"][data-model-link="item_list.1"]', domNodes)
                        .innerHTML.should.equal('Corbin');
                    should.select('span[data-field-link="value"][data-model-link="item_list.1"]', domNodes)
                        .innerHTML.should.equal('21.2');
                    complete();
                });
            }); //*/
        
            it('changes list item html attributes', function(complete){
                Templates.render('simple-test', {}, function(domNodes){
                    var firstItemAttr = Templates.domSelector(should.select(
                        'span[data-field-link="name"][data-model-link="item_list.0"]', 
                        domNodes
                    )).parent().attr('data-info');
                    firstItemAttr.should.contain('Whatnot');
                    firstItemAttr.should.contain('Agnot');
                    var secondItemAttr = Templates.domSelector(should.select(
                        'span[data-field-link="name"][data-model-link="item_list.1"]', 
                        domNodes
                    )).parent().attr('data-info');
                    secondItemAttr.should.contain('Dallas');
                    secondItemAttr.should.contain('Corbin');
                    complete();
                });
            });
    
        });
        
        describe('updates live', tests.live = function(){
        
            it('values in html bodies', function(complete){
                Templates.render('simple-test', {}, function(domNodes){
                    should.select('span[data-field-link="name.first"][data-model-link="user"]', domNodes)
                        .innerHTML.should.equal('Ed');
                    Templates.model('user').set('name.first', 'Armand');
                    should.select('span[data-field-link="name.first"][data-model-link="user"]', domNodes)
                        .innerHTML.should.equal('Armand');
                    Templates.model('user').set('name.first', 'Ed');
                    complete();
                });
            });
            
            it('values in html attributes', function(complete){
                Templates.render('simple-test', {}, function(domNodes){
                    Templates.domSelector(should.select('ul', domNodes)).attr('data-surname').should.contain('Beggler');
                    Templates.model('user').set('name.last', 'TheWind');
                    Templates.domSelector(should.select('ul', domNodes)).attr('data-surname').should.contain('TheWind');
                    complete();
                });
            });
    
        });
        
    });
    
});