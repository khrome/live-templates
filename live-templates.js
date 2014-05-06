(function(root, factory){
    if (typeof define === 'function' && define.amd){
        define(['array-events', 'object-events', 'jquery', 'Handlebars', 'extended-emitter'], factory);
    }else if(typeof exports === 'object'){
        var jsdom = require('jsdom');
        var JQ;
        var onready;
        jsdom.env(
            '<html><head></head><body></body></html>',
            ["http://code.jquery.com/jquery.js"],
            function(errors, window){
                JQ = window.$;
                if(onready) onready(JQ);
            }
        );
        module.exports = factory(require('array-events'), require('object-events'), {ready:function(cb){
            if(!JQ) onready = cb;
            else JQ.ready(cb);
        }}, require('Handlebars'), require('extended-emitter'));
    }else{
        root.LiveTemplates = factory(root.EventedArray, root.EventedObject, root.$, root.Handlebars, root.ExtendedEmitter);
    }
}(this, function(EventedArray, EventedObject, $, Handlebars, Emitter){
    var mode = 'evented';
    var root = {};
    var Templates = {};
    Templates.domSelector = $;
    var updaters = {}; //calls to bind model fields to individual view elements
    var updaterModel = {};
    var cache = {};
    var blocks = {};
    var engine;
    var nodeTypeMap = {
        ELEMENT_NODE : 1, ATTRIBUTE_NODE  : 2, TEXT_NODE : 3, CDATA_SECTION_NODE  : 4,
        ENTITY_REFERENCE_NODE  : 5, ENTITY_NODE  : 6, PROCESSING_INSTRUCTION_NODE : 7,
        COMMENT_NODE : 8, DOCUMENT_NODE : 9, DOCUMENT_TYPE_NODE : 10, DOCUMENT_FRAGMENT_NODE : 11,
        NOTATION_NODE  : 12, element : 1, attribute  : 2, text : 3, cdata  : 4,
        entity_reference  : 5, entityReference  : 5, entity  : 6, instruction : 7,
        comment : 8, document : 9, document_type : 10, documentType : 10,
        document_fragment : 11, documentFragment : 11, notation  : 12,
    }
    function isNumber(n) {
        return !isNaN(parseFloat(n)) && isFinite(n);
    }
    function traverseDOM(root, nodeMap, onComplete){ //not async
        if(typeof nodeMap == 'function'){
            nodeMap = { 'element+text' : nodeMap }
        }
        if(!isNumber(Object.keys(nodeMap))){
            var transformedMap = {};
            Object.keys(nodeMap).forEach(function(key){
                var keys = key.split('+');
                keys.forEach(function(typeName){
                    transformedMap[nodeTypeMap[typeName]] = nodeMap[key];
                })
            });
            nodeMap = transformedMap;
        }
        if(Array.isArray(root)){ //so we can pass in the output of $.parseHTML
            var replace = function(target, replacement){
                var index = root.indexOf(target);
                if(index != -1) root.splice(index, 1, replacement);
            }
            root.forEach(function(node){
                if(nodeMap[node.nodeType]) nodeMap[node.nodeType](node, replace);
                traverseDOM(node, nodeMap);
            });
        }else{
            Array.prototype.forEach.apply(root.childNodes, [function(child){
                if(nodeMap[child.nodeType]) nodeMap[child.nodeType](child, replace);
                traverseDOM(child, nodeMap);
            }])
        }
        if(onComplete) onComplete();
    }
    function field(root, name, value){
        if(typeof name == 'string') return field(root, name.split('.'), value);
        var current = root;
        var fieldName;
        while(name.length){
            fieldName = name.shift();
            if(!current[fieldName]){
                if(value) current[fieldName] = {};
                else return undefined;
            }
            if(!name.length){
                if(value) current[fieldName] = value;
                return current[fieldName];
            }else current = current[fieldName];
        }
        return undefined;
    }
    var uniqueID = function(){
        return Math.floor( Math.random() * 100000000 )+'';
    };
    var getItemBreaks = function(root){
        var itemBreaks = [];
        traverseDOM(root, {'comment':function(node, replace){
            var matches = (node.innerHTML || node.wholeText || node.data) === '<!--{{item}}-->';
            if(matches) itemBreaks.push(node);
        }});
        return itemBreaks;
    }
    var insertAt = function(root, nodes, position){
        //todo: cache this stuff
        var itemBreaks = getItemBreaks();
        if(itemBreaks.length > position) throw new Error('out of range insert');
        if(itemBreaks.length === position) root.appendChild(nodes);
        var target = itemBreaks[position];
        root.insertBefore(nodes, target);
    };
    var findComment = function(root, text){
        var root;
        traverseDOM(root, {'comment':function(node, replace){
            var matches = (node.innerHTML || node.wholeText || node.data) === text;
            if(matches && !root) root = node.parentNode;
        }});
        return root;
    };
    var findBlockNumber = function(root, position){
        var itemBreaks = getItemBreaks(root);
        var target = root.children.indexOf(itemBreaks[position]);
        var blocks;
        switch(position){
            case 0 :
                blocks = root.children.slice(0, target);
                break;
            case blocks.length - 1 :
                blocks = root.children.slice(target);
                break;
            default : 
                var bottom = root.children.indexOf(itemBreaks[position-1]);
                blocks = root.children.slice(bottom, target);
                break;
        }
        return blocks;
    };
    Templates.engine = function(eng){
        if(!eng) return engine;
        engine = eng;
        engine.macro('model', function(options){
            if(options.args && options.args[0] && !options.path) options.path = options.args[0];
            if(options.args && options.args[1] && !options.storeInto) options.storeInto = options.args[1];
            var parts = options.path.split(':');
            var modelPath = parts[0];
            var fieldPath = parts[1];
            var model = Templates.model(modelPath) || this;
            if(modelPath) model.namekey = modelPath;
            var id = uniqueID(); //todo: switch to uuid
            updaterModel[id] = model;
            return engine.literal('<!--[['+id+':'+fieldPath+']]-->');
        });
        var items = {};
        engine.macro({
            name : 'models',
            type : 'block'
        }, function(options){
            if(options.args && options.args[0] && !options.selector) options.selector = options.args[0];
            var list = Templates.model(options.selector);
            var id = uniqueID();
            if(!Array.isArray(list)) return '<!-- MODEL LIST NOT FOUND -->';
            var output = '';
            output += '<!--{{block_'+id+'_start}}-->';
            for(var i=0; i<list.length; i++){
                var item_id = uniqueID();
                var data = {};
                if(options.data){
                    data = engine.context(options.data || {});
                    data.index = i;
                    data.item = list[i];
                }
                list[i].namekey = options.selector+'.'+i
                output += '<!--{{item}}-->'
                output += engine.block(list[i], data, options);
            }
            output += '<!--{{block_'+id+'_end}}-->';
            var root = function(){
                //todo: index blocks on create, so they don't have to be in the DOM
                return this.root || (this.root = findComment(document, '<!--{{block_'+id+'_start}}-->').parentNode);
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
            list.on('remove', function(item, index){
                var rt = root();
                var els = findBlockNumber(rt, index);
                els.forEach(function(el){
                    rt.removeChild(el);
                });
            });
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
    var convertMarkersToLiveHTML = function(dom, emitter){
        traverseDOM(dom, {'comment':function(node, replace){
            var matches = (node.innerHTML || node.wholeText || node.data).match(/^\[\[(.*)\]\]$/);
            if(matches){
                var parts = matches[1].split(':');
                var id = parts[0];
                var field = parts[1];
                createLiveDOM(node, id, field, replace, emitter);
            }
            matches = (node.innerHTML || node.wholeText || node.data).match(/^\{\{(.*)\}\}$/);
            if(matches){
                blocks[matches[1]] = node;
            }
        }});
    }
    
    var createLiveDOM = function(node, id, field, replace, emitter){
        var element = Templates.domSelector.parseHTML('<span></span>')[0];
        var model = updaterModel[id];
        element.setAttribute('model-link', model.namekey);
        element.setAttribute('field-link', field);
        var container = node.parentNode;
        updaters[id] = function(){
            var old = element.innerHTML;
            var newValue = model.get(field);
            var payload = {
                previous : old, 
                value : newValue, 
                field : field
            };
            if(emitter) emitter.emit('before-dom-update', payload);
            element.innerHTML = newValue;
            if(emitter) emitter.emit('dom-update', payload);
        };
        if(container && container.nodeType != 11) container.replaceChild(element, node);
        else if(replace) replace(node, element);
        model.on('change', {field : field}, function(payload){
            var payload = {
                previous : old, 
                value : newValue, 
                field : field
            };
            if(emitter) emitter.emit('before-model-update', payload);
            updaters[id]();
            if(emitter) emitter.emit('model-update', payload);
        });
        updaters[id]();
    }
    
    var createLiveAttribute = function(field, node){
        var attr = node.getAttribute(field);
        var matches = (attr||'').match(/<!--\[\[.*?\]\]-->/g);
        var id = uniqueID();
        if(attr && matches){
            //*
            var links = []; //keep a list of the models we touch in this attr
            updaters[id] = function(callback){
                var value = attr;
                matches.forEach(function(match){
                    var parts = match.match(/<!--\[\[(.*):(.*)\]\]-->/);
                    var modelID = parts[1];
                    var field = parts[2];
                    var model = updaterModel[modelID];
                    if(model) value = value.replace(parts[0], model.get(field));
                    if(callback) callback(model, field);
                });
                node.setAttribute(field, value);
            };
            updaters[id](function(model, field){ //the first time, we attach listeners
                model.on('change:'+field, function(){ //if any connected field changes, rewrite attr
                    updaters[id]();
                });
            });//*/
        }
    }
    
    var scanAttributesFor = function(str, root){
        var result  = [];
        var filterFn = function(index, item){
            //console.log('NODE', item);
            if(item && item.attributes) Array.prototype.forEach.call(item.attributes, function(attr, key){
                if(attr.value.indexOf(str) != -1) result.push({field: attr.name, node:item}); 
            })
        };
        var fragment = $(root || window.document);
        fragment.find('*').add(fragment).filter(filterFn);
        return result;
    }
    
    Templates.render = function render(view, data, callback, emitter){
        engine.render(view, data, function(html){
            var dom = Templates.domSelector.parseHTML(html);
            convertMarkersToLiveHTML(dom, emitter);
            var replaceableAttrs = scanAttributesFor('<!--', dom);
            replaceableAttrs.forEach(function(replaceable){
                createLiveAttribute(replaceable.field, replaceable.node);
            });
            callback(dom);
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
        return field(root, name, Templates.wrap(value));
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