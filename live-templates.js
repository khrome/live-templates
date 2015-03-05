(function(root, factory){
    if (typeof define === 'function' && define.amd){
        define(['array-events', 'object-events', 'handlebars', 'extended-emitter', 'dom-tool', 'async-arrays', 'dirname-shim'], 
        factory);
    }else if(typeof exports === 'object'){
        module.exports = factory(require('array-events'), require('object-events'), require('handlebars'), require('extended-emitter'), require('dom-tool'), require('async-arrays'));
    }else{
        root.LiveTemplates = factory(
            root.EventedArray, root.EventedObject, root.Handlebars, 
            root.ExtendedEmitter, root.DOMTool, root.AsyncArrays
        );
    }
}(this, function(EventedArray, EventedObject, Handlebars, Emitter, Dom, arrays){ //Emitter, domTool, request + optional: Handlebars, Backbone
    
    var clone = function(out) {
        out = out || {};
        for (var i = 1; i < arguments.length; i++) {
            if (!arguments[i]) continue;
            for (var key in arguments[i]) {
                if (arguments[i].hasOwnProperty(key))
                out[key] = arguments[i][key];
            }
        }
        return out;
    };
    
    escapeRegEx = function(string) {
      return string.replace(/[-\/\\^$*+?.()|[\]{}]/g, '\\$&')
    };
    
    var Live = {};
    var error = function(error){
        if(typeof error == 'string'){
            error = new Error(error);
        }
        if(typeof Live.error == 'function'){
            return Live.error(error)
        }
        if(typeof Live.error === true){
            throw error;
        }
        if(typeof Live.error !== false){
            console.log(error);
        }
    }
    var rqst;
    var fs;
    Live.defaultTemplateLoader = function(name, callback){
        //if not absolute, prepend the current dir
        var url = (name.indexOf('://') != -1 || name[0] == '/')?name:__dirname + '/' + name;
        if(url[0] == '/' && (typeof exports === 'object')){ //in node, use the filesystem
            (rqst || (rqst = require('fs'))).readFile(url, function(err, data){
                if(data.toString) data = data.toString();
                callback(err, data);
            });
        }else{
            //remote : load on demand because this FN may be replaced
            (rqst || (rqst = require((typeof exports === 'object')?'request':'browser-request')))({
                uri : url
            }, function(err, req, data){
                if(data.toString) data = data.toString();
                callback(err, data);
            });
        }
    };
    Live.bondTarget = function(name, callback){
        return (typeof exports === 'object')?global.window:window; //naively assume we're in the browser or attached to global
    };
    Live.relativeTemplateRoot = function(){}; //todo: default this based on environment
    Live.defaultTemplates = function(loader){ //handlebars implementation
        throw new Error('please assign an adapter to \'Live.defaultTemplates\'');
    };
    
    Live.defaultModel = function(model){ //backbone implementation
        throw new Error('please assign an adapter to \'Live.defaultModel\'');
    };
    
    //todo: optimize recusive pattern to inline
    var setData = function(store, field, value){
        if(!Array.isArray(field)){
            return setData(store, field.split('.'), value)
        }else{
            if(field.length == 1){
                return store[field.shift()] = value;
            }else{
                var subfield = field.shift();
                return setData(store[subfield], field, value)
            }
        }
    };
    var getData = function(store, field){
        if(!field) error('cannot fetch an empty key!');
        if(!Array.isArray(field)){
            return getData(store, field.split('.'))
        }else{
            if(field.length == 0){
                return store;
            }else{
                var subfield = field.shift();
                return getData(store[subfield], field)
            }
        }
    };
    var getDataComponent = function(store, field){
        if(!Array.isArray(field)){
            return getDataComponent(store, field.split('.'))
        }else{
            if(field.length <= 1){
                return store;
            }else{
                var subfield = field.shift();
                return getDataComponent(store[subfield], field)
            }
        }
    };
    
    Live.data = {}; //namespace
    Object.defineProperty(Live, 'namespace', {
        get : function(){
            return Live.data;
        },
        set : function(value){
            Live.data = value;
        }
    });
    Object.defineProperty(Live, 'environment', {
        get : function(){
            return Live.data;
        },
        set : function(value){
            Live.data = value;
        }
    });
    Live.model = function(selector, data){
        if(Live.automap && Live.defaultModel.automap && !Live.defaultModel.is(data)){
            var isList = Array.isArray(data);
            data = Live.defaultModel.automap(data); //turn a POJSO into a model object
        }
        if(arguments.length > 1){
            return setData(Live.data, selector, data);
        }else{
            return getData(Live.data, selector);
        }
    }
    
    Live.defaultOpen  = '[';
    Live.defaultClose = ']';
    
    Live.Template = function(options){
        if(typeof options == 'string') options = {template:options};
        this.options = options || {};
        this.id = Math.floor(Math.random()*100000)+''; //todo: better ids
        if(!this.options.opener) this.options.opener = Live.defaultOpen;
        if(!this.options.closer) this.options.closer = Live.defaultClose;
        if(!options.template) throw new Error('live-templates requires, you know... a template');
        this.loader = options.loader || Live.defaultTemplateLoader;
        this.templates = options.templates || Live.defaultTemplates(this.loader);
        this.events = options.emitter || new Emitter();
        var ob  = this;
        if(options.on){
            Object.keys(options.on).forEach(function(event){
                ob.events.on(event, options.on[event]);
            });
        }
        this.domRoot = options.element || options.root;
        this.tool = new Dom.Tool();
        this.browserRoot = this.options.globalRoot || Live.bondTarget();
        this.document = this.browserRoot.document;
        this.tool.bond(this.browserRoot)
        this.data = Live.data;
        this.nextListId = 1;
        this.listHandlers = {};
        this.listObjects = {};
        this.liveObjects = [];
        this.modelWrap = Live.defaultModel;
        Object.defineProperty(this, 'namespace', {
            get : function(){
                return ob.data;
            },
            set : function(value){
                ob.data = value;
            }
        });
        Object.defineProperty(this, 'environment', {
            get : function(){
                return ob.data;
            },
            set : function(value){
                ob.data = value;
            }
        });
        
        /* SETUP FIRST PASS TEXTUAL OUTPUT */
        //register macros with this LiveTemplate's textual template dependency
        this.templates.macro('model', function(options){
            if(options.args && options.args[0] && !options.path) options.path = options.args[0];
            if(options.args && options.args[1] && !options.storeInto) options.storeInto = options.args[1];
            if(ob.options.corpse){ //static render
                return ob.templates.literal(getModelValue(model, fieldPath));
            }else{
                return ob.templates.literal('<!--'+ob.options.opener+options.path+ob.options.closer+'-->');
            }
        });
        
        var openerRE = escapeRegEx(ob.options.opener);
        var closerRE = escapeRegEx(ob.options.closer);
        
        this.templates.macro({
            name : 'models',
            type : 'block'
        }, function(options, subrender){
            if(options.args && options.args[0] && !options.selector) options.selector = options.args[0];
            var list = Live.model(options.selector);
            if(!Live.defaultModel.isList(list)) return '<!-- MODEL LIST NOT FOUND -->';
            var id = ob.id+'.'+(ob.nextListId++);
            ob.listHandlers[id] = function makeItem(item, environment){ //todo: remove indexing
                return (item?'<!--<<<<='+options.selector+':'+ob.id+'>>>>-->'+"\n":'')+
                    subrender(item || {}, ob.templates.context(environment));
            };
            var output = '<!--'+ob.options.opener+'+'+options.selector+':'+id+ob.options.closer+'-->';
            if(ob.options.corpse){
                for(var i=0; i<list.length; i++){
                    output += makeItem(list[i], i, options);
                }
            }else{
                output += ob.listHandlers[id](undefined, {}); //output, no values
            }
            output += '<!--'+ob.options.opener+'-'+options.selector+':'+id+ob.options.closer+'-->';
            return output;
        });
        /* SETUP SECOND PASS DOM PARSE & LIVE ELEMENT INJECTION */
        //setup DOM scanner for 2nd pass parse
        var scanStack = [];
        function current(id){
            return scanStack[scanStack.length-1];
        }
        var setups = 0;
        var queue = [];
        var last = {};
        this.ready = function(handler){
            if(setups == 0){
                flush();
                handler();
            }else{
                queue.push(handler);
            }
        }
        var scanning;
        var flush = function(){
            stopScanning();
            var jobs = queue;
            queue = [];
            scanning = false;
            if(jobs.length) jobs.forEach(function(handler){
                handler();
            })
        }
        var stopScanning = function(){
            clearInterval(ref);
        }
        var ref;
        var scannerStarted;
        var intervalScanner = function(){
            if(!scanning) stopScanning();
            var now = Date.now();
            Object.keys(last).forEach(function(key){
                if(last[key] && (now - last[key]) > (Live.timeout || 4000)){
                    scanning = false;
                    error('DOM Scanner stalled at '+(now - last[key])+' waiting for '+key+' ');
                }
            });
            if((now - scannerStarted) > (Live.timeout || 4000)){
                scanning = false;
                error('DOM Scanner stalled wating on '+setups+' jobs to complete to execute '+queue.length+' handlers');
            }
        };
        var setupStepStarted = function(name){
            if(name) last[name] = Date.now();
            if(!scanning){
                scannerStarted = Date.now();
                scanning = true;
                ref = setInterval(intervalScanner, 10);
            }
            setups++;
            Live.log(name+' started at '+last[name], setups);
        };
        var setupStepStopped = function(name){
            if(name) delete last[name];
            setups--;
            Live.log(name+' stopped at '+Date.now(), setups);
            if(setups == 0){
                flush();
            }
        };
        this.startJob = setupStepStarted;
        this.stopJob = setupStepStopped;
        this.tool.lookFor({
            nodeType : 'comment',
            regex : RegExp(openerRE+'.*?'+closerRE, 'g'),
        }, function(node, options, complete, tracer){
            var text = node.innerHTML || node.textContent || node.nodeValue;
            var id = text.substring(ob.options.opener.length, text.length - ob.options.closer.length);
            var type = (['+', '-', '='].indexOf(id[0])!=-1)?id[0]:'*';
            if(type == id[0]) id = id.substring(1);
            switch(type){
                case '+' :
                    setupStepStarted('open-list');
                    var parts = id.split(':');
                    var object = getData(ob.data, parts[0]);
                    var field = parts[1];
                    ob.listObjects[parts[0]] = object;
                    scanStack.push({
                        node : node,
                        context : object
                    });
                    setupStepStopped('open-list');
                    complete();
                    break;
                case '-' :
                    //ensure balance?
                    var open = scanStack.pop();
                    setupStepStarted('close-list');
                    var object = ob.modelWrap(open.context);
                    if(!object.isList()) error('cannot treat an object as a list');
                    var monitor = new Live.List({
                        list: object, 
                        open : open.node, 
                        close : node,
                        tool: ob.tool,
                        template : ob
                    }, function(){
                        setupStepStopped('close-list');
                        complete();
                    });
                    ob.liveObjects.push(monitor);
                    break;
                case '*':
                    var parts = id.split(':');
                    var objectID = parts[0];
                    var field = parts[1];
                    var object = current();
                    if(object){
                        object = current.context;
                    }else{
                        if(objectID === ''){
                            object = options.current;
                        }else{
                            if(typeof objectID == 'string'){
                                object = getData(ob.data, objectID);
                            }
                        }
                    }
                    if(!object) return complete(); //short circuit
                    if(!object) return error('could not find object:'+object, scanStack);
                    object = ob.modelWrap(object);
                    if(object.isList() && object.raw.length === 0) return complete(); //GTFO, this is an empty list
                    if(object.isList()) return error('attempting to render a list as an item') || console.log('?', object.get('uuid'), parts);
                    setupStepStarted('value');
                    var monitor = new Live.Data({
                        object: object,
                        field : field,
                        marker : node,
                        tool: ob.tool,
                        template : ob
                    }, function(){
                        setupStepStopped('value');
                        complete();
                    });
                    ob.liveObjects.push(monitor);
                    break;
                default : return error('Unknown type: '+type);
            }
        });
        //*
        this.tool.lookFor({
            nodeType : 'attribute',
            regex : RegExp('<!--'+openerRE+'.*?'+closerRE+'-->', 'g'),
        }, function(node, options){
            //replace from the back so remainder does not shift
            (node.value||node.nodeValue).match(RegExp('<!--'+openerRE+'.*?'+closerRE+'-->', 'g')).reverse().forEach(function(str){
                var reference = str.substring(4+(openerRE.length-1), str.length-(3+closerRE.length-1));
                var parts = reference.split(':');
                var object = parts[0];
                var field = parts[1];
                node.originalValue = (node.value || node.nodeValue);
                if(object){
                    object = getData(ob.data, object);
                    var value = object.get(field);
                    var start = value.lastIndexOf(str);
                    node.nodeValue = node.nodeValue.substring(0, start)+value+node.nodeValue.substring(start+1+str.length);
                }else{
                    if(object === '' && options.current){
                        object = options.current;
                        var value = object.get(field) || ''; //empty string to prevent undefined references
                        var start = value.lastIndexOf(str);
                        //+7 refers to comment wrap ('<!---->')
                        var newValue = node.value.substring(0, start)+value+node.value.substring(start+1+str.length+7);
                        if(node.value){
                            node.value = newValue;
                        }else{
                            node.nodeValue = newValue;
                        }
                    }
                }
            });
        });//*/
        
        
        /* DO TEXT RENDER + LIVE RENDER */
        var done = function(error, tracer){
            var args = arguments;
            ob.ready(function(){ //because async stuff may be happening to the tree
                if(options.onLoad) options.onLoad.apply(options.onLoad, args);
                if(options.complete) options.complete.apply(options.complete, args);
            });
        }
        //this.tracer = new Dom.Tool.Tracer();
        setupStepStarted('render');
        this.templates.render(this.options.template, this.data, function(err, html){
            if(err) return done(err);
            ob.text = html;
            if(options.onRender) options.onRender();
            if(!ob.options.corpse){
                var els = ob.tool.html(html);
                ob.tool.transform(els, {
                    attributes : true
                }, function(error, tracer){
                    setupStepStopped('render');
                    ob.dom = els;
                    done(undefined, tracer);
                }, ob.tracer);
            }else{
                //todo: staticly append to root;
                console.log('corpse');
                done(undefined, tracer, html);
            }
        }, this.tracer);
    };
    Live.Template.prototype.on = function(){
        return this.events.on.apply(this.events, arguments);
    };
    Live.Template.prototype.off = function(){
        return this.events.off.apply(this.events, arguments);
    };
    Live.Template.prototype.once = function(){
        return this.events.once.apply(this.events, arguments);
    };
    Live.Template.prototype.emit = function(){
        return this.events.emit.apply(this.events, arguments);
    };
    
    Live.Template.prototype.select = function(selector){
        return this.tool.select(selector, this.dom);
    };
    
    //UI state handling
    Live.Template.prototype.show = function(){
        
    };
    Live.Template.prototype.hide = function(){
        
    };
    Live.Template.prototype.focus = function(){
        //focus on first focusable element, make sure shown(), add focus class, emit
    };
    Live.Template.prototype.blur = function(){
        //find selected element: blur, remove focus class, emit
    };
    
    //data handling
    Live.Template.prototype.model = function(){
        return Live.model(Live, arguments);
    };
    Live.Template.prototype.dt = function(){
        return this.modelWrap(Live.model(Live, arguments))
    };
    
    Live.Template.prototype.destroy = function(){
        this.events.emitter.removeAllListeners();
        this.liveObjects.forEach(function(live){
            live.destroy();
        })
    };
    
    
    Live.Data = function(options, callback){
        var object = options.object;
        if(options.template) this.template = options.template;
        if(!object.isWrapped) return error('attempting to LIVE an unwrapped object');
        if(object.isList()) return error('ILLEGAL: added list as a item');
        var fieldName = options.field || options.fieldName;
        var markerElement = options.marker || options.markerElement;
        var tool = options.tool || options.domTool || Dom;
        var container = tool.text('', markerElement.ownerDocument);
        this.setValue = function(newValue){
            container.nodeValue = newValue || '';
        };
        this.field = fieldName;
        this.object = object;
        if(markerElement.nextSibling){
            markerElement.parentNode.insertBefore(container, markerElement.nextSibling);
        }else{
            markerElement.parentNode.appendChild(container);
        }
        markerElement.reference = container;
        var ob = this;
        object.on('change', fieldName, this.setValue);
        object.once('destroy', function(){
            //todo: check namespace to see if we reassigned something (overwrite with new model)
            object.off('change', fieldName, ob.setValue);
        });
        if(markerElement) markerElement.addEventListener('DOMNodeRemovedFromDocument', function(){
            //todo: internal log
            ob.destroy();
        });
        this.setValue(object.get(fieldName));
        callback();
    };
    Live.Data.prototype.destroy = function(){
        //todo: kaboom... delink it all
        this.object.off('change', this.field, this.setValue);
    }
    
    Live.List = function(options, callback){
        var list = options.list;
        this.list = list;
        if(!list.isWrapped) return error('attempting to LIVE an unwrapped list');
        var openMarker = options.open || options.openMarker;
        var closeMarker = options.close || options.closeMarker;
        var tool = options.tool || options.domTool || Dom;
        var itemElements = Dom.between(openMarker, closeMarker);
        if(options.template) this.template = options.template;
        var parent = openMarker.parentNode;
        var ob = this;
        //remove the dummy els from the DOM
        itemElements.forEach(function(node){
            parent.removeChild(node);
        });
        this.emitter = new Emitter();
        var itemEls = {};
        list.on('remove', function(item){
            item = Live.defaultModel(item);
            if(itemEls[item.id]){
                itemEls[item.id].forEach(function(node){ //todo: docfrag
                    if(node.parentNode) node.parentNode.removeChild(node);
                    //todo: recover or error
                });
                itemEls[item.id] = undefined;
            }else{
                console.log('&&', item)
                console.log(itemELs)
                return error('attempted to remove an item which does not exist');
            }
        });
        list.on('sort', function(){
            //todo: compute mutations instead of rebuilding
            function update(){
                //remove what's there
                Object.keys(itemEls).forEach(function(uuid){
                    itemEls[uuid].forEach(function(node){
                        if(node.parentNode) node.parentNode.removeChild(node);
                    });
                });
                //add in the new order
                list.forEach(function(item){
                    itemEls[item.id].forEach(function(node){
                        openMarker.parentNode.insertBefore(node, closeMarker);
                    });
                })
            }
            if(window && window.requestAnimationFrame) window.requestAnimationFrame(update);
            else update();
        });
        function generateItemNodes(item, index, complete){
            if(options.template) options.template.startJob('subrender');
            var elCopies = Array.prototype.slice.apply(itemElements).map(function(node){
                return node.cloneNode(true);
            });
            var theItem = item;
            tool.transform(elCopies, {
                attributes : true, 
                current : item
            }, function(error, tracer){
                if(options.template) options.template.stopJob('subrender');
                itemEls[theItem.id] = elCopies;
                var itemAtPosition = list.get(index+1);
                if(itemAtPosition && itemEls[itemAtPosition.id]){ //there's an item in the position you wanted: insert
                    var firstElOfNextItem = itemEls[itemAtPosition.id][0];
                    elCopies.forEach(function(node, position){
                        openMarker.parentNode.insertBefore(node, firstElOfNextItem);
                    });
                }else{ // you are either out of range or your array is discontinuous (you rascal!)
                    elCopies.forEach(function(node, position){
                        openMarker.parentNode.insertBefore(node, closeMarker);
                    });
                }
                ob.template.emit('new-list-item', elCopies, theItem);
                complete();
            }, options.template.tracer?options.template.tracer.subtrace():undefined);
        }
        
        arrays.forEachEmission(list.raw, function(item, index, done){
            item = Live.defaultModel(item); //wrap the initial items
            generateItemNodes(item, index, done);
        }, callback);
        this.addFN = function(item, index){
            ob.template.startJob('generate-nodes');
            if(Live.automap && Live.defaultModel.automap && !Live.defaultModel.is(item)){
                item = Live.defaultModel.automap(item);
            }
            item = Live.defaultModel(item);
            generateItemNodes(item, index, function(){
                ob.template.stopJob('generate-nodes');
            });
        };
        list.on('add', this.addFN);
    };
    Live.List.prototype.destroy = function(){
        //todo: kaboom... delink it all
        this.list.off('change', this.field, this.addFN);
    }
    
    var stacks = {};
    Live.uniqueStacks = function(id){
        if(!id) return stacks;
        if(!stacks[id]) stacks[id] = [];
        var stack = (new Error()).stack.split("\n");
        var error = stack.shift();
        stack.shift(); //this call context
        stack.shift(); //parent call context (call *to* this FN);
        var stack = stack.join("\n");
        if(stacks[id].indexOf(stack) !== -1) stacks[id].push(stack);
    }
    
    Live.Component = function(options){
        Live.Templates.apply(this, arguments);
        var ob = this;
        require([name], function(Component){
            if(!Component){
                throw new Error('Component \''+name+'\' was not found, perhaps it was not imported?');
            }
            var instance = Component.createComponent?Component.createComponent(el, options):new Component(el, options);
            ob.component = instance;
            v.set(data); //not a great model, improve me
            (options.fields || []).forEach(function(fieldName){
                
            });
            v.emit('ready');
            if(options.onLoad) options.onLoad(instance);
            //todo: handle live data bindings
        });
        return v;
    };
    
    //dupe Live.Template's prototype
    Live.Component.prototype = clone(Live.Template.prototype);
    Live.Component.prototype.constructor = Live.Component;
    
    function nodeValue(node){
        return node.innerHTML || node.nodeValue || node.textContent;
    }
    
    function nodeMarkup(node){
        return node.outerHTML || node.data /* JSDOM BUG */ || node.textContent || node.nodeValue;
    }
    
    Live.html = function html(nodeList){
        return Array.prototype.slice.apply(nodeList).map(function(node){
            return nodeMarkup(node);
        }).join('');
    }
    
    Live.value = nodeValue;
    
    Live.log = function(str){  };
    
    Live.models = function(type){
        if(typeof type === 'string'){
            if(type.indexOf('/') === -1){
                Live.defaultModel = require(__dirname+'/adapters/models/'+type);
            }else throw new Error('unrecognized model type');
        }else Live.defaultModel = type;
    }
    
    Live.views = function(type){
        if(typeof type === 'string'){
            if(type.indexOf('/') === -1){
                Live.defaultTemplates = require(__dirname+'/adapters/views/'+type);
            }else throw new Error('unrecognized model type');
        }else Live.defaultTemplates = type;
    }
    
    return Live;
    
}));