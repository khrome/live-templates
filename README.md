live-templates.js
=================

[![NPM version](https://img.shields.io/npm/v/live-templates.svg)]()
[![npm](https://img.shields.io/npm/dt/live-templates.svg)]()
[![Travis](https://img.shields.io/travis/khrome/live-templates.svg)]()

Bind data directly to HTML. No virtual DOM! No wasted elements! Write only changes directly onto the elements in question (at a rate that the browser can withstand) in the client or on the server.

Generally speaking, it's as if you insert variables directly onto the page, rather than rendering dead text.

What?!
------

As your objects update, thier DOM references are kept in sync without any need for selection logic, html manipulation or textual replacement and does not require a 1:1 binding between view and model. Because templates have access to many models on a namespace, it removes the need for any kind of boilerplate to bind a view to it's model allowing you to reduce MVVM or MVC to MV. It runs on the client or on the server under Node.js. It uses a comment marking strategy which is widely compatible with new and old browsers alike and it's economical because the only new DOM creation is rows being added or deleted and all values are directly inserted at a rate your browser can withstand.

Because `live-templates` does not replace or rerender HTML elements, **there is no orphaned/zombie listener problem**, so we can get back to using core web features.

Installation
------------

    npm install live-templates

Usage
-----
`live-templates` supports a number of module idioms, because it is natively UMD it may be included without modification from source and will work in all targets. While it is webpack and browserify (and other preprocessors), it is written in browser and node compatible JS and needs no retargeting to function.

- **AMD**
```javascript
    define(['live-templates'], function(Live){
        //do stuff
    });
```
- **commonjs**
```javascript
    var Live = require('live-templates');
```
- **browser global**
```html
    <script src="node_modules/live-templates/live-templates.js"></script>
```
Configuration
-------------
`live-templates` wraps the raw arrays and objects you provide with [array-events](https://www.npmjs.com/package/array-events) and [object-events](https://www.npmjs.com/package/object-events) which then are then always up to date in the DOM as long as you use functions to update them. Soon there will be support for [Indexed.Set](https://www.npmjs.com/package/indexed-set) and it's possible to write an adapter for almost any ORM or object hierarchy. To setup the Live object:
```javascript
    Live.models(require(live-templates/models/evented));
    Live.templates(require(live-templates/models/handlebars));
    Live.setGlobalContext(window);
```
[`request`](https://www.npmjs.com/package/request) and [`browser-request`](https://www.npmjs.com/package/browser-request) are used by default, but should you want to change the loader:
```javascript
    Live.enableRequestTemplateLoader(request, '/myTemplateDir/');
```
The Model Namespace
-------------------
To register a model, you just have to call `Live.model(<namespace>, <model or collection>)` and pass in a namespace (something like `root.subitem.item`) and the object or array. And to return the wrapped value just use `Live.model(<namespace>)`.

Creating Views
--------------

###Promises
`Live.template()` uses a promise based idiom
```javascript
    Live.template(<template>).then(function(view){
        // view.dom is available as well as view.appendTo(el);
    });
```
###Objects
`new Live.Template()` creates a new instance of the view, which is immediately ready for interaction (though devoid of any content until the callback)
```javascript
    var sameView = new Live.Template('my-template.handlebars', function(view){
        // view.dom is available as well as view.appendTo(el);
    });
```
Either way, the produced view has a number of events (`blur`, `focus`, `activate`, `deactivate`, `dom-update`, `before-dom-update`, `object-update`, `before-object-update`) and member functions:

- `.on('event'[, conditions], handlerFunction);` An implementation of [Emitter.on()](http://nodejs.org/api/events.html#events_emitter_on_event_listener) which accepts mongo-style selectors.
- `.once('event'[, conditions], handlerFunction);` An implementation of [Emitter.once()](http://nodejs.org/api/events.html#events_emitter_once_event_listener) which accepts mongo-style selectors.
- `.off('event', handlerFunction);` An implementation of [Emitter.off()](http://nodejs.org/api/events.html#events_emitter_removelistener_event_listener).
- `.emit('event', data ... );` An implementation of [Emitter.emit()](http://nodejs.org/api/events.html#events_emitter_emit_event_arg1_arg2).
- `.when(event/asyncFn ... );` Allows you to chain ready functions or promises to events.
- `.focus();` Force browser/application cursor focus onto this element
- `.blur();` Force browser/application cursor focus onto this element
- `.activate();` Make sure an element is in it's active state, without triggering focus
- `.deactivate();` Make sure an element is in it's inactive state, without triggering blur


If you want the events to bubble through the DOM call `view.proxyEventsToDOM();`

also if you bind a field to an input, you may automatically update the model on field changes:

    view.enableModelFeedback([selector, ]confirmationFunction);

the confirmation function allows you to do form checking, or any async action before the object is updated
There's also some available properties:

- **view.dom** : this is the generated DOM, which may be a DocumentFragment with many nodes or a single node;

##Template Macros

Handlebars integration with `live-templates` takes the form of 'model' and 'models'. All template loading and interaction is handled for you.

- **{{#models "model-list-name"}}** : this iterates through a list of models and generates a live template for each object, and monitors the list adding and removing content to reflect the model
- **{{#model "<model-name>:<field-name>"}}** : this outputs a single live field from an object, if the model-name is omitted and you are inside a `{{models}}` scope that item is used.

Examples
--------
- [**User Feed**](docs/example.md) - A simple feed-based content stream
- **Chat App**[TBD]
- **Badges**[TBD]


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
