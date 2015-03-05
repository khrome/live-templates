#live-templates.js

Live templates allows you to bind an object or list directly to the dom created by your template, so that as your objects update this is reflected in the DOM without any need for selection logic, html manipulation or textual replacement. Generally speaking, it avoids working on Elements altogether. The other major difference when compared to most Model/View solutions is that live-templates can bind to any number of models or lists... I don't pretend that real interfaces bind 1:1 with the models that power them, so you don't have to do organizational gymnastics to maintain a complex interface.

By allowing templates to access many models on a namespace, you remove the need for any kind of boilerplate to bind a view to it's model allowing you to reduce MVVM or MVC to MV. In addition, because the models are directly attached to the templates, the views update themselves. It runs on the client or on the server under Node.js.

##Installation

    npm install live-templates

inclusion through AMD define:

    define(['live-templates'], function(Live){
    
    });
    
inclusion through require:

    var Live = require('live-templates');

##Configuration
Tell it what models you want to use:
    
    //backbone-deep-models with backbone collections
    Live.models('backbone-deep');
    
    //EventedObjects models with EventedArrays as collections
    Live.models('evented');
    
    //backbone models and collections
    Live.models('backbone');
    
    //backbone models with EventedArrays as collections
    Live.models('backbone-hybrid');
    
    //backbone-deep-models with EventedArrays as collections
    Live.models('backbone-deep-hybrid');
    
You also need to tell it what template system you want to use:

    //only handlerbars, for now
    Live.templates('handlebars');
    
The last required setting is to bond the root context(in this example, the window object in the browser). Normally you will be binding to the window, so this has a sensible default.

	Live.bondTarget = function(){
        return window;
    };
    
The default loader will work both locally in node as well as using network requests in the client, it looks like this:

    var request = require('request');
    var fs = require('fs');
    Live.defaultTemplateLoader = function(name, callback){
        //if not absolute, prepend the current dir
        var url = 
        	(name.indexOf('://') != -1 || name[0] == '/') ?
        	name :
        	__dirname + '/' + name;
        if(url[0] == '/' && module.exports){ //in node?
            fs.readFile(url, function(err, data){
                if(data.toString) data = data.toString();
                callback(err, data);
            });
        }else{ //in the client
            request({
                uri : url
            }, function(err, req, data){
                if(data.toString) data = data.toString();
                callback(err, data);
            });
        }
    };
If you need something more complex you'll have to write your own.


##Usage
To register a model, you just have to call `model` and if you pass in a raw array or object they are converted to your chosen type as it's registered.

    Live.model(namespace, <model or collection>);

and to return it's value:

    Live.model(namespace);
    
That's all the setup required, then you can generate and bond new views to the DOM:

    var view = new Live.Template({
        template:'my-template.handlebars',
        complete : function(){
            // template is done rendering, output is at template.dom
        }
    });
    
or, more simply:

	var view = new Live.Template('my-template.handlebars', '#targetid');
    
which returns an object with a number of utility functions:

###view.on('event'[, conditions], handlerFunction);
An implementation of [Emitter.on()](http://nodejs.org/api/events.html#events_emitter_on_event_listener) which accepts mongo-style selectors.
###view.once('event'[, conditions], handlerFunction);
An implementation of [Emitter.once()](http://nodejs.org/api/events.html#events_emitter_once_event_listener) which accepts mongo-style selectors.
###view.off('event', handlerFunction);
An implementation of [Emitter.off()](http://nodejs.org/api/events.html#events_emitter_removelistener_event_listener).
###view.emit('event', data ... );
An implementation of [Emitter.emit()](http://nodejs.org/api/events.html#events_emitter_emit_event_arg1_arg2).
###view.when(event/asyncFn ... );
Allows you to chain ready functions or promises to events.
###view.focus();
###view.blur();
###view.activate();
###view.deactivate();
    
###Events:

- **blur**
- **focus**
- **activate**
- **deactivate**
- **dom-update** : throw an event when a DOM element is updated arguments are: element, changes where changes is an array of objects with fields: model, name, value, oldValue
- **before-dom-update** : throw an event before a DOM element is updated, with the same arguments as dom-update
- **object-update** : throw an event when an object field which is bound to this template changes with fields: model, name, value, oldValue, domNode, target where target is either 'body' or an attribute name
- **before-object-update** : throw an event before an object field which is bound to this template changes, with the same arguments as object-update

A Note: for the time being DOM updates and object updates are 1:1, this will not always be true 


as well, update events can be fired from the DOM if you'd prefer to interact with changes that way:

    view.proxyEventsToDOM();
    ...
    $('#someid').on('dom-update', updateNotificationFunction);
    
also if you bind a field to an input, you may automatically update the model on field changes:

    view.enableModelFeedback([selector, ]confirmationFunction);

the confirmation function allows you to do form checking, or any async action before the object is updated
There's also some available properties:

- **view.dom** : this is the generated DOM, which may be a DocumentFragment with many nodes or a single node;

##Template Macros

Each Template language has macros injected into them, in Handlebars this takes the form of 'model' and 'models'.


##An Example

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

##Upcoming Features

1. ****Components**** : Sometimes instead of binding to the DOM, you want to bind to a JS object to provide some kind of additional functionality. This allows you to create such a binding on your component, but not require it.
2. ****Prescanners**** : You can also register a pre-scan function so that you can interact with the text templates before the binding and DOM conversion is done. if the function definition contains an argument, it will be passed an async callback which must be called to complete the scan

	    Templates.scanner(function(){
	        //return the results of the scan
	    });
	    
	    Templates.scanner(function(done){
	        //call done(results) to return the results of the scan and continue processing
	    });

##Contributing
Make sure you add a test for your new feature, then submit a pull request.
If you find a bug:

1. If you add a test and a fix, I will review your patch and approve it as quickly as possible
2. If you submit only a patch it will sit around until I have time to write a test for it
3. If you find a defect submit a bug
4. Share anything you learn!

##Testing
for the local tests, just run
    
    mocha
    
for the full suite of tests run 

	./full-test.sh

##Disclaimer

This is not an official Google product.

Enjoy,

-Abbey Hawk Sparrow
