live-templates.js [Beta]
=================

By allowing templates to access many models on a namespace, you remove the need for any kind of boilerplate to bind a view to it's model allowing you to reduce MVVM or MVC to MV. In addition, because the models are directly attached to the templates, they can update themselves. It runs on the client or on the server under Node.js.

Live Templates allows you to register models against named values which are in turn made available to the template. First this means that you don't have to maintain some binding boilerplate linking the objects to the DOM and Most importantly, because these templates output DOM nodes, the models are able to bind directly to it so that as the models change, any views produced from them are seamlessly updated as well, without recreating *any* nodes. That's right, at no time are we doing textual replacement. The other major difference when compared to most Model/View solutions is that live-templates can bind to any number of models or lists... I don't pretend that real interfaces bind 1:1 with the models that power them, so you don't have to do organizational gymnastics to maintain a complex interface.

Your current view system is worthless by comparison.

Installation
------------

    npm install live-templates

inclusion through AMD define:

    define(['live-templates'], function(Templates){
    
    });
    
inclusion through require:

    var Templates = require('live-templates');

Configuration
-------------
Tell it what models you want to use:

    //backbone models and collections[Implementation in progress]
    Templates.model.use('backbone');
    
    //backbone models with EventedArrays as collections[Implementation in progress]
    Templates.model.use('backbone-hybrid');
    
    //backbone-deep-models with backbone collections[Implementation in progress]
    Templates.model.use('deep-backbone');
    
    //backbone-deep-models with EventedArrays as collections[Implementation in progress]
    Templates.model.use('deep-hybrid');
    
    //EventedObjects models with EventedArrays as collections
    Templates.model.use('evented');
    
You also need to tell it what template system you want to use:

    //only handlerbars, for now
    Templates.use('handlebars');


Usage
-----
To register a model, you just have to call `model` and if you pass in a raw array or object they are converted to your chosen type as it's registered.

    Templates.model(namespace, <model or collection>);

and to return it's value:

    Templates.model(namespace);

Now, any model is available for render in the template
    
    Templates.render('testTemplate', function(DomNodes){
        //stick the nodes onto the dom somewhere
    });

Define a loader for your templates as well... something like:

    var request = require('request');
    Templates.loader = function(name, callback){
        request('./templates/'+name+'.html', function(error, response, body){
            if(!error && response.statusCode == 200){
                callback(body);
            }
        })
    };
    
That's all the setup required, then you can generate and bond new views to the DOM:

    Templates.createView('my-view'[, data[, element]]);
    
which returns an object with a number of utility functions:

    view.on('event'[, conditions], handlerFunction);
    view.once('event'[, conditions], handlerFunction);
    view.off('event', handlerFunction);
    view.emit('event', data ... );
    view.when(event/asyncFn ... );
    view.focus();
    view.blur();
    view.activate();
    view.deactivate();
    
Available events are[Implementation in progress]:
- *blur*
- *focus*
- *activate*
- *deactivate*
- *dom-update* : throw an event when a DOM element is updated arguments are: element, changes where changes is an array of objects with fields: model, name, value, oldValue
- *before-dom-update* : throw an event before a DOM element is updated, with the same arguments as dom-update
- *object-update* : throw an event when an object field which is bound to this template changes with fields: model, name, value, oldValue, domNode, target where target is either 'body' or an attribute name
- *before-object-update* : throw an event before an object field which is bound to this template changes, with the same arguments as object-update

A Note: for the time being DOM updates and object updates are 1:1, this will not always be true 


as well, update events can be fired from the DOM if you'd prefer to interact with changes that way:

    view.proxyEventsToDOM();
    ...
    $('#someid').on('dom-update', updateNotificationFunction);
    
also if you bind a field to an input, you may automatically update the model on field changes:

    view.enableModelFeedback([selector, ]confirmationFunction);

the confirmation function allows you to do form checking, or any async action before the object is updated
There's also some available properties:

- *view.elements* : this is the generated DOM, which may be a DocumentFragment with many nodes or a single node;

Handlebars Macros
-----------------

Each Template language has macros injected into them, in Handlebars this takes the form of 'model' and 'models'.


An Example
----------

Let's define some models (we'll assume we've loaded the vars user, feed, offers):

    Templates.model('user', user);
    Templates.model('feed', feed);
    Templates.model('offers', offers);

then let's define a simplistic view, 'feed':

    <header>{{strings.sitename}} : {{strings.tagline}}</header>
    <nav>
        <a href="{{strings.signup}}">{{config.privacy_policy_url}}</a>
        <a href="{{strings.login}}">{{config.terms_of_service_url}}</a>
        <a href="{{strings.products}}">{{config.help_url}}</a>
        <a href="{{strings.mission}}">{{config.about_url}}</a>
    </nav>
    <article id="feed">
        <h1>{{strings.feed}}</h1>
        {{#models "feed"}}
            <div class="feed_item">
                <h2>{{model ":subject"}}</h2>
                <span class="byline">{{model ":name"}} <span>{{model ":role"}}</span></span>
                <p>
                    {{model ":body"}}
                </p>
            </div>
        {{/models}}
    </article>
    <aside id="offers">
        {{#models "offers"}}
            <a href="{{model ":link"}}"><img src="{{model ":image"}}"/></a>
        {{/models}}
    </aside>
    <footer>
        <a href="{{strings.privacy_policy}}">{{config.privacy_policy_url}}</a>
        <a href="{{strings.terms_of_service}}">{{config.terms_of_service_url}}</a>
        <a href="{{strings.help}}">{{config.help_url}}</a>
        <a href="{{strings.about}}">{{config.about_url}}</a>
    </footer>

then let's create an instance of that view (assuming we have a 'strings' var and a 'config var') and attach it to the body:

    var common = {string:strings, config:config};
    var view = Template.createView('feed', common, document.body);
    
Now you can just concentrate on the models/data and stop screwing around in the DOM. (and there was much rejoicing)

Components[Implementation in progress]
----------
Sometimes instead of binding to the DOM, you want to bind to a JS object to provide some kind of additional functionality... so there's a component system to help with that:

    Templates.component({
        create : function(options){
            //return the component;
        },
        // if not defined, attempts to call component.set(name, value) 
        //  or component.val(value) or component.set<Name>(value)
        //  or component.setValue(value)
        //changes: [{name: 'fieldname', value: 43754, model: [Object]}, ...]
        update : function(component, changes){
        
        },
        notify : function(changes){ // or function(model, name, value)
        
        },
        // if not defined, tests if component has destroy or gc, 
        //  if not it traverses and de-links component
        destroy : function(component){
            
        },
        show : function(component){ //if not defined, checks component or will alias activate
            
        },
        hide : function(component){ //if not defined, checks component or will alias deactivate
            
        },
        activate : function(component){ //if not defined, checks component or will alias show
            
        },
        deactivate : function(component){ //if not defined, checks component or will alias hide
            
        },
        //if not defined, tests if component has focus, if not null op
        focus : function(component){
            
        },
        //if not defined, tests if component has blur, if not null op
        blur : function(component){
            
        },
        //if not defined, automatically created and responds to ':visible', ':focus', and ':active'
        is : function(component, state){
            
        }
    });
    
    if()

Prescanners[Implementation in progress]
-----------
You can also register a pre-scan function so that you can interact with the text templates before the binding and DOM conversion is done. if the function definition contains an argument, it will be passed an async callback which must be called to complete the scan

    Templates.scanner(function(){
        //return the results of the scan
    });
    
    Templates.scanner(function(done){
        //call done(results) to return the results of the scan and continue processing
    });

Contributing
------------
Make sure you add a test for your new feature, then submit a pull request.

Testing
-------
just run
    
    mocha

Enjoy,

-Abbey Hawk Sparrow