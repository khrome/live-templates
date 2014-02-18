require("chai").should();
var Templates = require('./live-templates');

var templates = {
    main :'User:{{model "user:name.first"}}<br/><ul>{{#models "item_list"}}<li>{{model ":name"}}:{{model ":value"}}</li>{{/models}}</ul>'
};
var $;

Templates.model('user', {
    name : {
        first : 'Ed',
        last : 'Beggler'
    }
});
Templates.model('item_list', [
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
]);
Templates.loader = function(name, callback){
    callback(templates[name]);
};
Templates.engine(Templates.handlebarsAdapter(require('handlebars')));


describe('live-templates', function(){
    
    describe('renders', function(){
    
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
        
        it('a live view', function(complete){
            Templates.render('main', {}, function(domNodes){
                $.all('span[field-link="name.first"][model-link="user"]', domNodes).html().should.equal('Ed');
                $.all('span[field-link="name"][model-link="item_list.0"]', domNodes).html().should.equal('Agnot');
                $.all('span[field-link="value"][model-link="item_list.0"]', domNodes).html().should.equal('14.8');
                $.all('span[field-link="name"][model-link="item_list.1"]', domNodes).html().should.equal('Corbin');
                $.all('span[field-link="value"][model-link="item_list.1"]', domNodes).html().should.equal('21.2');
                Templates.model('item_list')[0].set('value', 17.4);
                $.all('span[field-link="value"][model-link="item_list.0"]', domNodes).html().should.equal('17.4');
                Templates.model('item_list')[1].set('name', 'Darill');
                $.all('span[field-link="name"][model-link="item_list.1"]', domNodes).html().should.equal('Darill');
                Templates.model('item_list').push({
                    name : 'Brash',
                    subject : 'McCanyon',
                    value : 88.8
                });
                $.all('span[field-link="name"][model-link="item_list.2"]', domNodes).html().should.equal('Brash');
                $.all('span[field-link="value"][model-link="item_list.2"]', domNodes).html().should.equal('88.8');
                complete();
            })
        });
    
    });
    
});