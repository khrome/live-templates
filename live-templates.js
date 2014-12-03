(function(root, factory){
    if (typeof define === 'function' && define.amd){
        define(['array-events', 'object-events', 'jquery', 'handlebars', 'extended-emitter', 'dom-tool'], 
        function(a,b, $, c,d, dTool){
            dTool.jQuery = $;
            dTool.window = win;
            if(dTool.setup) dTool.setup();
            return factory.apply(factory, arguments);
        });
    }else if(typeof exports === 'object'){
        var jsdom = require('jsdom');
        var JQ;
        var win;
        var onready = [];
        jsdom.env(
            '<html><head></head><body></body></html>',
            ["http://code.jquery.com/jquery.js"],
            function(errors, window){
                JQ = window.$;
                win = window;
                if(onready.length) onready.forEach(function(cb){
                    cb(JQ);
                })
            }
        );
        var dTool = require('dom-tool');
        onready.push(function($){
            dTool.jQuery = $;
            dTool.window = win;
            if(dTool.setup) dTool.setup();
        });
        module.exports = factory(require('array-events'), require('object-events'), {ready:function(cb){
            if(!JQ) onready.push(cb);
            else JQ.ready(cb);
        }}, require('Handlebars'), require('extended-emitter'), dTool);
    }else{
        root.LiveTemplates = factory(
            root.EventedArray, root.EventedObject, root.$, root.Handlebars, 
            root.ExtendedEmitter, root.DOMTool, root.HashMap
        );
    }
}(this, function(EventedArray, EventedObject, $, Handlebars, Emitter, dTool){
    var mode = 'evented';
    var corpse = false;
    var engine;
    
    var root = {}; //models
    var listOptions = {}; //the options used in rendering a list, stored by list id
    
    //Modes, currently hardcoded, will eventually move to their own, loadable modules
    
    function getModelValue(model, field){
        switch(mode){
            case 'backbone' :
            
            case 'deep-backbone' :
            case 'evented' :
            case 'backbone-hybrid' :
            case 'deep-hybrid' :
                return model.get(field);
                break;
        }
    }
    
    function modelAttach(model, field, update){
        switch(mode){
            case 'backbone' :
            case 'deep-backbone' :
            case 'backbone-hybrid' :
            case 'deep-hybrid' :
                model.on('change:'+field, function(value){
                    update(value);
                });
                break;
            case 'evented' :
                model.on('change', field, function(value){
                    update(value);
                });
                break;
        }
    }
    
    function escapeRegExp(str){
        return str.replace(/[\-\[\]\/\{\}\(\)\*\+\?\.\\\^\$\|]/g, "\\$&");
    }
    
    function listAttach(list, id, root){
        var sentinel = Templates.opener+':ITEM:'+Templates.closer;
        var add = function(item){
            var position = list.indexOf(item);
            var newHTML = engine.block(item, engine.context(listOptions[id].data || {}), listOptions[id]);
            var dom = dTool.live({
                sentinel : new RegExp(escapeRegExp(Templates.opener)+'(.*)'+escapeRegExp(Templates.closer), 'g')
            }, root, function(updaters, dom){
                Object.keys(updaters).forEach(function(id){
                    var updater = updaters[id];
                    var selector = updater.marker;
                    var parts = selector.split(':');
                    var model = Template.model(parts.shift());
                    var field = parts.shift();
                    modelAttach(model, field, updater.set);
                })
            });
            
        };
        
        var remove = function(item, previousPosition){
            tool.removeBlockAt(sentinel, root);
        };
        
        switch(mode){
            case 'backbone' :
            case 'deep-backbone' :
                list.on('add', add);
                list.on('remove', remove);
                break;
            case 'evented' :
            case 'backbone-hybrid' :
            case 'deep-hybrid' :
                list.on('add', add);
                list.on('remove', remove);
                //list.on('move', function(item, previousPosition){ });
                break;
        }
    }
    var listOptions = {};
    var Templates = {};
    Templates.domSelector = $;
    //var modelStack = [];
    var listStack = [];
    var listNameStack = [];
    function currentListName(){
        return (listNameStack[listNameStack.length -1]);
    }
    var liveReferences = {};
    //todo: view association for GC
    Templates.engine = function(eng){
        if(!eng) return engine;
        engine = eng;
        engine.macro('model', function(options){
            if(options.args && options.args[0] && !options.path) options.path = options.args[0];
            if(options.args && options.args[1] && !options.storeInto) options.storeInto = options.args[1];
            var id = dTool.uniqueID();
            var parts = options.path.split(':');
            var modelPath = parts[0];
            var fieldPath = parts[1];
            var model = modelPath?Templates.model(modelPath):this;
            if(!modelPath){
                var listName = currentListName();
                var list = listName?Templates.model(listName):Templates.containingList(model);
                if(!listName) listName = Templates.modelName(list)
                modelPath = listName+'.'+(list?list.indexOf(model):'*');
            }
            liveReferences[id] = {
                type : 'item',
                modelName : modelPath,
                fieldName : fieldPath,
                model : model
            };
            
            if(corpse){
                return engine.literal(getModelValue(model, fieldPath));
            }else{
                return engine.literal('<!--<<<<'+id+'>>>>-->');
            }
        });
        
        engine.macro({
            name : 'models',
            type : 'block'
        }, function(options){
            var id = dTool.uniqueID();
            listOptions[id] = options;
            if(options.args && options.args[0] && !options.selector) options.selector = options.args[0];
            var list = Templates.model(options.selector);
            if(!Array.isArray(list)) return '<!-- MODEL LIST NOT FOUND -->';
            var output = '';
            function makeItem(item, index, options){
                var item_id = dTool.uniqueID();
                var data = {};
                if(options.data){
                    data = engine.context(options.data || {});
                    data.index = i;
                    data.item = item;
                }
                return '<!--<<<<='+id+':'+item_id+'>>>>-->'+"\n"+
                    engine.block(list[i], data, options);
            }
            if(!corpse) output += '<!--<<<<+'+id+'>>>>-->';
            listNameStack.push(options.selector);
            listStack.push(list);
            for(var i=0; i<list.length; i++){
                output += makeItem(list[i], i, options);
            }
            listStack.pop();
            listNameStack.pop();
            if(!corpse) output += '<!--<<<<-'+id+'>>>>-->';
            liveReferences[id] = {
                type : 'list',
                list : list,
                name : options.selector,
                makeNew : function(item){
                    return makeItem(item, list.length, options);
                },
                id : id
            };
            return output;
        });
    };
    Templates.loader = function(name, callback){
        
    };
    var dynamicImports = {};
    function rqr(modules, callback){
        if(!Array.isArray(modules)) modules = [modules];
        //var results = 
        return dynamicImports[module]?
            dynamicImports[module]:
            ( dynamicImports[module] = require(module) );
    }
    Templates.wrap = function(object){
        if(!object) return;
        switch(mode){
            case 'evented': //EventedArray + EventedObject
                if(Array.isArray(object)){
                    if(!EventedArray.is(object)){
                        if(
                            object.length && 
                            typeof object[0] == 'object' && 
                            !EventedObject.is(object[0])
                        ){
                            object = object.map(function(item){
                                var res = new EventedObject(item);
                                res.setMaxListeners(500);
                                return res;
                            });
                        }
                        return new EventedArray(object, function(item){
                            if( EventedObject.is(item)) return item;
                            var res = new EventedObject(item);
                            res.setMaxListeners(500);
                            return res;
                        });
                    }else return object;
                }else if(typeof object == 'object'){
                    if(!EventedObject.is(object)){
                        var res = new EventedObject(object);
                        res.setMaxListeners(500);
                        return res;
                    }
                    else return object;
                }
                return object;
                break;
            case 'backbone': //Backbone Collection + Backbone Model
                if(Array.isArray(object)){
                    if(!EventedArray.is(object)){
                        if(
                            object.length && 
                            typeof object[0] == 'object' && 
                            !EventedObject.is(object[0])
                        ){
                            object = object.map(function(item){
                                return new EventedObject(item);
                            });
                        }
                        return new EventedArray(object, function(item){
                            return EventedObject.is(item)?item:new EventedObject(item);
                        });
                    }else return object;
                }else if(typeof object == 'object'){
                    if(!EventedObject.is(object)) return new EventedObject(object);
                    else return object;
                }
                return object;
                break;
            case 'hybrid': //Backbone Collection + Backbone Model
                throw new Error('not yet supported');
                break;
            case 'deep-backbone': //Backbone Collection + Backbone DeepModel
                throw new Error('not yet supported');
                break;
            case 'deep-hybrid': //Backbone Collection + Backbone Model
                throw new Error('not yet supported');
                break;
            default : throw new Error('unknown object mode');
        }
    }
    
    Templates.opener = '<<<<';
    
    Templates.closer = '>>>>';
    
    Templates.render = function render(view, data, callback, emitter){
        var gcItems = [];
        engine.render(view, data, function(html){
            var dom = dTool.dom(html);
            dTool.live({
                emitter : emitter,
                registry : liveReferences,
                sentinel : [Templates.opener, Templates.closer],
                onValue : function(id, link, el){
                    var marker = link.marker.substring(
                        Templates.opener.length,
                        link.marker.length - Templates.closer.length
                    );
                    var model = link.model;
                    var field = link.fieldName;
                    el.setAttribute('data-model-link', link.modelName);
                    el.setAttribute('data-field-link', field);
                    link.model.on('change', {field:field}, function(event){
                        link.set(event.value);
                    });
                    link.set(model.get(field));
                },
                onAttribute : function(id, link, el){
                    var model = link.model;
                    var field = link.fieldName;
                    el.setAttribute('data-model-link', link.modelName);
                    el.setAttribute('data-field-link', field);
                    //*
                    link.model.on('change', {field:field}, function(event){
                        link.set(event.value);
                    });
                    link.set(model.get(field));//*/
                },
                onList : function(id, link, el){
                    var on = true;
                    function add(item, index){
                        if(on && link.add) link.add(item);
                    }
                    function remove(item, index){
                        if(on && link.remove) link.remove(index);
                    }
                    link.list.on('add', add);
                    link.list.on('remove', remove);
                    gcItems.push(function(){
                        on = false; // 'kill' :P FIX ME!
                        link.list.off('add', add);
                        link.list.off('remove', remove); 
                    });
                }
            }, dom, function(domIndex, newDom){
                //console.log('???', newDom.html());
                newDom.creationStack = (new Error()).stack;
                callback(newDom, function Kill(){
                    gcItems.forEach(function(gcAction){
                        gcAction();
                    })
                });
            });
        });
        
    };
    function LiveView(){
        this.emitter = new Emitter();
        if(this.emitter.emitter && this.emitter.emitter.setMaxListeners) 
            this.emitter.emitter.setMaxListeners(500);
    };
    LiveView.prototype.on = function(){ return this.emitter.on.apply(this.emitter, arguments); };
    LiveView.prototype.once = function(){ return this.emitter.once.apply(this.emitter, arguments); };
    LiveView.prototype.off = function(){ return this.emitter.off.apply(this.emitter, arguments); };
    LiveView.prototype.emit = function(){ return this.emitter.emit.apply(this.emitter, arguments); };
    LiveView.prototype.when = function(){ return this.emitter.when.apply(this.emitter, arguments); };
    LiveView.prototype.activate = function(){
        this.emitter.emit('activate');
        
    };
    LiveView.prototype.deactivate = function(){
        this.emitter.emit('deactivate');
        
    };
    LiveView.prototype.focus = function(){
        this.emitter.emit('focus');
        
    };
    LiveView.prototype.blur = function(){
        this.emitter.emit('blur');
        
    };
    LiveView.prototype.set = function(name, value){
        if(typeof name == 'object') return Object.keys(name).forEach(function(key){
            
        });
        //todo: determine if this value is referenced in the template
        
    };
    //proxyEventsToDOM
    //enableModelFeedback
    
    var field = function field(root, path, value){
        if(!Array.isArray(path)) return field(root, path.split('.'), value);
        if(path.length === 1){ //terminal
            var fieldName = path.shift();
            if(value) root[fieldName] = value;
            else return root[fieldName];
        }else return root[fieldName]?field(root[fieldName], path, value):undefined;
    }
    
    Templates.createView = function createView(view, data, el){
        var v = new LiveView();
        Templates.render(view, data || {}, function(dom){
            v.elements = dom;
            if(el) el.appendChild(dom);
        }, v.emitter);
        return v;
    };
    Templates.createComponent = function createComponent(name, data, el){
        var options = {};
        var v = new LiveView();
        if(typeof name == 'object'){
            options = name;
            name = options.name;
        }
        require([name], function(Component){
            if(!Component){
                throw new Error('Component \''+name+'\' was not found, perhaps it was not imported.');
            }
            var instance = Component.createComponent?Component.createComponent(el, options):new Component(el, options);
            v.component = instance;
            v.set(data); //not a great model, improve me
            v.emit('ready');
            //todo: handle live data bindings
        });
        return v;
    };
    Templates.model = function model(name, value){
        if(!name) return undefined;
        if(value && value['__modelName']) throw new Error(
            'Model is already registered as \''+
            value['__modelName']+
            '\', please remove this entry before trying to register this model again.'
        );
        //if(value) map.set(value, name);
        //*
        return field(root, name, value?Templates.wrap(value):value);
    };
    Templates.modelName = function(value){
        var name;
        Object.keys(root).forEach(function(modelName){
            if(root[modelName] === value) name = modelName;
        });
        return name;
    };
    Templates.containingList = function(item){
        var result;
        Object.keys(root).forEach(function(modelName){
            if(Templates.model.isList(root[modelName])){
                if(root[modelName].indexOf(item) != -1){
                    result = root[modelName];
                }
            }
        });
        return result;
    };
    Templates.model.use = function(type){
        mode = type;
    };
    Templates.model.isList = function(type){
        return Array.isArray(type);
    };
    Templates.handlebarsAdapter = function handlebarsAdapter(Handlebars){
        var cache = {};
        if(Handlebars.default) Handlebars = Handlebars.default; //yay, node & the browser come in differently :P
        var result = {
            macro : function(options, callback){
                options = options || {};
                if(typeof options == 'string') options = { name : options };
                Handlebars.registerHelper(options.name, function(){
                    var args = Array.prototype.slice.call(arguments);
                    var opts = (typeof args[args.length-1] == 'object'?args.pop():{});
                    opts.args = args;
                    return callback.apply(this, [opts]);
                });
            },
            render : function render(template, data, callback){
                if(cache[template]){
                    callback(cache[template](data));
                }else{
                    Templates.loader(template, function(body){
                        cache[template] = Handlebars.compile(body);
                        render(template, data, callback);
                    })
                }
            },
            literal : function(str){
                return new Handlebars.SafeString(str);
            },
            block : function(context, data, options){
                return options.fn(context, { data: data });
            },
            context : function(data){
                return Handlebars.createFrame(data);
            }
        };
        return result;
    };
    Templates.smartyAdapter = function smartyAdapter(Smarty){
        
    };
    Templates.mustacheAdapter = function mustacheAdapter(Mustache){
        //concept: use lambdas to make macros available
    };
    
    Templates.use = function(type){
        switch(type.toLowerCase()){
            case 'handlebars':
                Templates.engine(Templates.handlebarsAdapter(Handlebars));
                break;
            default : throw('Unknown template type: '+type);
        }
    };
    
    Templates.component = function Component(options){
        
    };
    
    Templates.dump = function(){
        console.log(root);
    }
    
    return Templates;
}));