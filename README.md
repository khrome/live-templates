live-templates.js
=================

By allowing templates to access many models on a namespace, you remove the need for any kind of boilerplate to bind a view to it's model allowing you to reduce MVVM or MVC to MV. In addition, because the models are directly attached to the templates, they can update themselves

    var Templates = require('live-templates');
    Templates.engine(Templates.handlebarsAdapter(require('handlebars')));

Usage
-----
To register a model, you just have to call:

    Templates.model(namespace, <model, Array or EventedArray of models>);

and to return it's value:

    Templates.model(namespace);

Then, any model is available for render in the template
    
    Templates.render('testTemplate', function(DomNodes){
        //stick the nodes onto the dom somewhere
    });
    
Now any models referenced in the template will be live and the views will adjust as the models change(they update without rerendering)

You will need to define a loader for your templates as well, which is something like:

    var request = require('request');
    Templates.loader = function(name, callback){
        request('./templates/'+name+'.html', function(error, response, body){
            if(!error && response.statusCode == 200){
                callback(body);
            }
        })
    };

UMD loading
-----------

Because we do not impose a template language, you'll need to create your own UMD package in order to use this both in the browser and in node... if you want handlebars, it would look like this:

    (function (root, factory) {
        if(typeof define === 'function' && define.amd) define(['live-templates', 'handlebars'], factory);
        else if(typeof exports === 'object') module.exports = factory(require('live-templates', 'handlebars'));
        else root.Templates = factory(root.LiveTemplates, root.Handlebars);
    }(this, function(Templates, Handlebars) {
        Templates.engine(Templates.handlebarsAdapter(Handlebars));
        //maybe define a loader here
        return Templates;
    }));

Testing
-------
just run
    
    mocha

Enjoy,

-Abbey Hawk Sparrow