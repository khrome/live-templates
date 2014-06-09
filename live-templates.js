(function(root, factory){
    if (typeof define === 'function' && define.amd){
        define(['array-events', 'object-events', 'jquery', 'Handlebars', 'extended-emitter', 'dom-tool'], factory);
    }else if(typeof exports === 'object'){
        var jsdom = require('jsdom');
        var JQ;
        var onready = [];
        jsdom.env(
            '<html><head></head><body></body></html>',
            ["http://code.jquery.com/jquery.js"],
            function(errors, window){
                JQ = window.$;
                if(onready.length) onready.forEach(function(cb){
                    cb(JQ);
                })
            }
        );
        module.exports = factory(require('array-events'), require('object-events'), {ready:function(cb){
            if(!JQ) onready.push(cb);
            else JQ.ready(cb);
        }}, require('Handlebars'), require('extended-emitter'), require('dom-tool'));
    }else{
        root.LiveTemplates = factory(root.EventedArray, root.EventedObject, root.$, root.Handlebars, root.ExtendedEmitter, root.DOMTool);
    }
}(this, function(EventedArray, EventedObject, $, Handlebars, Emitter, dTool){
    var mode = 'evented';
    var corpse = false;
    $.ready(function(JQ){
        dTool.dom = JQ.parseHTML;
        dTool.fragment = JQ;
        dTool.attach = modelAttach;
    });
    console.log(Object.keys(dTool), Object.keys($));
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
            }, root, function(updaters){
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
    var modelStack = [];
    function currentModelContext(){
        return modelStack[modelStack.length -1];
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
            //console.log('???', modelPath);
            var model = modelPath?Templates.model(modelPath):this;
            if(!modelPath) Templates.modelName(this);
            //console.log('SSS', model);
            liveReferences[id] = {
                type : 'item',
                modelName : modelPath,
                fieldName : fieldPath,
                model : model
            };
            
            if(corpse){
                return engine.literal(getModelValue(model, fieldPath));
            }else{
                console.log('!!', modelPath, fieldPath);
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
                var data = {};
                if(options.data){
                    data = engine.context(options.data || {});
                    data.index = i;
                    data.item = item;
                }
                if(!corpse) output += '<!--<<<<='+id+'>>>>-->';
                return engine.block(list[i], data, options);
            }
            if(!corpse) output += '<!--<<<<+'+id+'>>>>-->';
            for(var i=0; i<list.length; i++){
                modelStack.push(list[i]);
                output += makeItem(list[i], i, options);
                modelStack.pop();
            }
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
            /*var root = function(){
                //todo: index blocks on create, so they don't have to be in the DOM
                return this.root || (this.root = findComment(document, Templates.opener+id+Templates.closer).parentNode);
            };
            list.on('add', function(item, index){
                item.namekey = options.selector+'.'+(list.length-1);
                var newHTML = engine.block(item, engine.context(options.data || {}), options);
                var dom = Templates.domSelector.parseHTML(newHTML);
                convertMarkersToLiveHTML(dom);
                var replaceableAttrs = scanAttributesFor('<!--', dom);
                replaceableAttrs.forEach(function(replaceable){
                    createLiveAttribute(replaceable.field, replaceable.node);
                });
                insertAt(root(), dom, index);
            });
            list.on('move', function(item, index){
                
            });
            list.on('remove', function(item, index){
                var rt = root();
                var els = findBlockNumber(rt, index);
                els.forEach(function(el){
                    rt.removeChild(el);
                });
            });*/
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
    
    Templates.closer = '>>>>'
    
    Templates.render = function render(view, data, callback, emitter){
        engine.render(view, data, function(html){
            console.log('HTML', html);
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
                    var $el = dTool.fragment(el);
                    $el.attr('data-model-link', link.modelName);
                    $el.attr('data-field-link', field);
                    link.model.on('change', {field:field}, function(value, oldValue){
                        link.set(value);
                    });
                    link.set(model.get(field));
                }
            }, dom, function(){
                console.log('$$2', dom.map(function(node){return (node.innerHTML || node.wholeText || node.data)}));
                callback(dom);
            });
        });
        
    };
    function LiveView(){
        this.emitter = new Emitter();
    };
    LiveView.prototype.on = function(){ return this.emitter.on.apply(emitter, arguments); };
    LiveView.prototype.once = function(){ return this.emitter.once.apply(emitter, arguments); };
    LiveView.prototype.off = function(){ return this.emitter.off.apply(emitter, arguments); };
    LiveView.prototype.emit = function(){ return this.emitter.emit.apply(emitter, arguments); };
    LiveView.prototype.when = function(){ return this.emitter.when.apply(emitter, arguments); };
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
    //proxyEventsToDOM
    //enableModelFeedback
    
    function field(root, path, value){
        if(!Array.isArray(path)) return field(root, path.split('.'), value);
        if(path.length === 1){ //terminal
            if(value) root[path.unshift()] = value;
            else return root[path.unshift()];
        }else return root[path.unshift()]?field(root[path.unshift()], path, value):undefined;
    }
    
    
    Templates.createView = function createView(view, data, el){
        var v = new LiveView();
        Templates.render(view, data || {}, function(dom){
            v.elements = dom;
            if(el) el.appendChild(dom);
        }, v.emitter);
        return v;
    };
    Templates.model = function model(name, value){
        if(!name) return undefined;
        if(value && value['__modelName']) throw new Error(
            'Model is already registered as \''+
            value['__modelName']+
            '\', please remove this entry before trying to register this model again.'
        );
        if(value) value['__modelName'] = name;
        return field(root, name, Templates.wrap(value));
    };
    Templates.modelName = function(value){
        if(!value) throw new Error('no model passed!');
        return value['__modelName'];
    };
    Templates.model.use = function(type){
        mode = type;
    };
    Templates.handlebarsAdapter = function handlebarsAdapter(Handlebars){
        var cache = {};
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
    
    return Templates;
}));