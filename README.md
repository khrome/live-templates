#live-templates.js

[![NPM version](https://img.shields.io/npm/v/live-templates.svg)]()
[![npm](https://img.shields.io/npm/dt/live-templates.svg)]()
[![Travis](https://img.shields.io/travis/khrome/live-templates.svg)]()

Bind data directly to HTML. No virtual DOM! No wasted elements! Write only changes directly onto the elements in question (at a rate that the browser can withstand) in the client or on the server.

Generally speaking, it's as if you insert variables directly onto the page, rather than rendering dead text.

###More Detail ...

Bind variables directly to markup, so that as your objects update thier DOM references without any need for selection logic, html manipulation or textual replacement.

The other major difference when compared to most Model/View solutions is that live-templates can bind to any number of models or lists... I don't pretend that real interfaces bind 1:1 with the models that power them.

Because templates have access to many models on a namespace, it removes the need for any kind of boilerplate to bind a view to it's model allowing you to reduce MVVM or MVC to MV. It runs on the client or on the server under Node.js.

Because I do not replace or rerender HTML elements, **there is no orphaned/zombie listener problem**, so we can get back to using core web features.

##Installation

    npm install live-templates
    
####Including an AMD module

    define(['live-templates'], function(Live){
    	//do stuff
    });
    
####Including a commonjs module
This works in Node.js and Browsers (via webpack)

    var Live = require('live-templates');

##Configuration
The simplest solution is [the Evented model](docs/evented.md) which wraps vanilla arrays and objects with notifiers, which are then bonded to the view. Then when you `.push()` into an array you got from the model, it pushes into the interface as well.

Soon there [will be support](docs/indexed.md) for [Indexed.Set]()

There is also [support for backbone models](docs/backbone.md), with support for both vanilla (flat) objects as well as `backbone-deep-model` (This module's future is uncertain).

It's also possible to write an adapter for almost any ORM or object heirarchy.

#### setting up the `Live` object

Set your model system

	//set your models
	Live.templates(<model name>);
	
	//set your templates (only handlebars, for now)
    Live.templates('handlebars');
    
    //set the root context (usually window)
	Live.setGlobalContext(window); 

	//optionally, define a loader
	Live.enableRequestTemplateLoader(request, '/myTemplateDir/');
	
The default loader will work both locally in node as well as using network requests in the client via UMD, or you can pass the instance of `request` you are using (`browser-request` is fine in the client)


##Creating Models
To register a model, you just have to call `model` and if you pass in a raw array or object they are converted to your chosen type as it's registered.

    Live.model(namespace, <model or collection>);

and to return it's value:

    Live.model(namespace);
    
##Creating Views
    
###`Live.template()` vs `new Live.Template()`
`Live.template()` uses a promise based idiom which implicitly creates instances (a popular way to work) and `new Live.Template()` is the underlying implementation which uses explicit object creation and callbacks.

###`Live.template()`

    Live.template(<template>).then(function(view){
    	// view.dom is available as well as view.appendTo(el);
    });
    
###`new Live.Template()`
Live template instances are the logic which runs each bonded UI. There are two recommended forms of syntax (though in practice, you may find other variations are possible). The first allows you to directly control the rendered output:

	new Live.Template('my-template.handlebars', function(view){
    	// view.dom is available as well as view.appendTo(el);
    });
    
More simply, if you do not need signalling, you may directly inject content into an element

	var view = new Live.Template('my-template.handlebars', '#targetid');

There are also some member functions:

- `.on('event'[, conditions], handlerFunction);` An implementation of [Emitter.on()](http://nodejs.org/api/events.html#events_emitter_on_event_listener) which accepts mongo-style selectors.
- `.once('event'[, conditions], handlerFunction);` An implementation of [Emitter.once()](http://nodejs.org/api/events.html#events_emitter_once_event_listener) which accepts mongo-style selectors.
- `.off('event', handlerFunction);` An implementation of [Emitter.off()](http://nodejs.org/api/events.html#events_emitter_removelistener_event_listener).
- `.emit('event', data ... );` An implementation of [Emitter.emit()](http://nodejs.org/api/events.html#events_emitter_emit_event_arg1_arg2).
- `.when(event/asyncFn ... );` Allows you to chain ready functions or promises to events.
- `.focus();` Force browser/application cursor focus onto this element
- `.blur();` Force browser/application cursor focus onto this element 
- `.activate();` Make sure an element is in it's active state, without triggering focus
- `.deactivate();` Make sure an element is in it's inactive state, without triggering blur
    
###Live.Template Events

Emitted events include `blur`, `focus`, `activate`, `deactivate` as well as:

- `dom-update` : throw an event when a DOM element is updated arguments are: element, changes where changes is an array of objects with fields: model, name, value, oldValue
- `before-dom-update` : throw an event before a DOM element is updated, with the same arguments as dom-update
- `object-update` : throw an event when an object field which is bound to this template changes with fields: model, name, value, oldValue, domNode, target where target is either 'body' or an attribute name
- `before-object-update` : throw an event before an object field which is bound to this template changes, with the same arguments as object-update

######*A Note: for now DOM updates and object updates are 1:1, this will not always be true... code accordingly.*


as well, update events can be fired from the DOM by calling `view.proxyEventsToDOM();` if you'd prefer to interact with changes that way.
also if you bind a field to an input, you may automatically update the model on field changes:

    view.enableModelFeedback([selector, ]confirmationFunction);

the confirmation function allows you to do form checking, or any async action before the object is updated
There's also some available properties:

- **view.dom** : this is the generated DOM, which may be a DocumentFragment with many nodes or a single node;

##Template Macros

Each Template language has macros injected into them, in Handlebars this takes the form of 'model' and 'models'.

- **{{#models "model-list-name"}}** : this iterates through a list of models and generates a live template for each object, and monitors the list adding and removing content to reflect the model
- **{{#model "<model-name>:<field-name>"}}** : this outputs a single live field from an object, if the model-name is omitted and you are inside a `{{models}}` scope that item is used.


##Example : A User Feed

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

##Contributing
Make sure you add a test for your new feature, then submit a pull request.

##Testing
for the local tests, just run
    
    mocha
    
for the full suite of tests run 

	./full-test.sh

##Disclaimer

This is not an official Google product. (The only commit requiring this notice is [this one](https://github.com/khrome/live-templates/commit/ede2881df015b8ecf10176b8aa10dbb1ed0208dc) )

Enjoy,

-Abbey Hawk Sparrow
