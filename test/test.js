var should = require("chai").should();
var Templates = require('../live-templates');
var fs = require('fs');

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
    },{ 
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

var tests = {};

describe('live-templates', function(){

    describe('and handlebars', function(){
        
        before(function(done){
            Templates.loader = function(name, callback){
                fs.readFile('test/'+name+'.handlebars', function(err, response){
                    if(err) throw err;
                    callback(response.toString());
                });
            };
            Templates.use('handlebars');
            done();
        });
    
        describe('uses EventedArray and EventedObject and', tests.evented = function(){
            before(function(){
                Templates.model.use('evented');
                Templates.model('user', user);
                Templates.model('item_list', item_list);
            });
    
            describe('renders live', tests.render = function(){
    
                before(function(done){
                    Templates.domSelector.ready(function(selector){
                        Templates.domSelector = selector;
                        done();
                    });
                });
        
                it('values in html bodies', function(complete){
                    Templates.render('simple-test', {}, function(domNodes){
                        liveNodeQuery(domNodes, 'user', 'name.first').innerHTML.should.equal('Ed');
                        complete();
                    });
                });
            
                it('list item html bodies', function(complete){
                    Templates.render('simple-test', {}, function(domNodes){
                        liveNodeQuery(domNodes, 'item_list.0', 'name').innerHTML.should.equal('Agnot');
                        liveNodeQuery(domNodes, 'item_list.0', 'value').innerHTML.should.equal('14.8');
                        liveNodeQuery(domNodes, 'item_list.1', 'name').innerHTML.should.equal('Corbin');
                        liveNodeQuery(domNodes, 'item_list.1', 'value').innerHTML.should.equal('21.2');
                        complete();
                    });
                }); //*/
        
                it('changes list item html attributes', function(complete){
                    Templates.render('simple-test', {}, function(domNodes){
                        var firstItemAttr = Templates.domSelector(
                            liveNodeQuery(domNodes, 'item_list.0', 'name')
                        ).parent().attr('data-info');
                        firstItemAttr.should.contain('Whatnot');
                        firstItemAttr.should.contain('Agnot');
                        var secondItemAttr = Templates.domSelector(
                            liveNodeQuery(domNodes, 'item_list.1', 'name')
                        ).parent().attr('data-info');
                        secondItemAttr.should.contain('Dallas');
                        secondItemAttr.should.contain('Corbin');
                        complete();
                    });
                });
                
                it('list item html bodies in added data', function(complete){
                    Templates.render('simple-test', {}, function(domNodes){
                        Templates.model('item_list').push({ 
                            name : 'Jean-Baptiste', 
                            subject : 'Zorg', 
                            value : 91.3 
                        });
                        liveNodeQuery(domNodes, 'item_list.2', 'name').innerHTML.should.equal('Jean-Baptiste');
                        liveNodeQuery(domNodes, 'item_list.2', 'value').innerHTML.should.equal('91.3');
                        complete();
                    });
                });
    
            });
        
            describe('updates live', tests.live = function(){
        
                it('values in html bodies', function(complete){
                    Templates.render('simple-test', {}, function(domNodes){
                        liveNodeQuery(domNodes, 'user', 'name.first').innerHTML.should.equal('Ed');
                        Templates.model('user').set('name.first', 'Armand');
                        liveNodeQuery(domNodes, 'user', 'name.first').innerHTML.should.equal('Armand');
                        Templates.model('user').set('name.first', 'Ed');
                        complete();
                    });
                });
            
                it('values in html attributes', function(complete){
                    Templates.render('simple-test', {}, function(domNodes){
                        Templates.domSelector(should.select('ul', domNodes)).attr('data-surname').should.contain('Beggler');
                        Templates.model('user').set('name.last', 'TheWind');
                        Templates.domSelector(should.select('ul', domNodes)).attr('data-surname').should.contain('TheWind');
                        Templates.model('user').set('name.last', 'Beggler');
                        complete();
                    });
                });
    
            });
        
        });
        
        //describe('uses EventedArray and Backbone DeepModel and');
        
        //describe('uses EventedArray and Backbone and');
        
        //describe('uses Backbone DeepModel and');
        
        //describe('uses Backbone and');
        
        
    
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
    if(!selected[0]) throw new Error(selector+' returned nothing');
    return selected[0];
};

function liveNodeQuery(root, model, field){
    return should.select('span[data-field-link="'+field+'"][data-model-link="'+model+'"]', root);
}