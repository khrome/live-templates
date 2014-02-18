(function(root, factory){
    if (typeof define === 'function' && define.amd){
        define(['array-events', 'object-events', 'jquery'], factory);
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
        }});
    }else{
        root.Templates = factory(root.EventedArray, root.EventedObject, root.$);
    }
}(this, function(EventedArray, EventedObject, $){
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
        engine.macro({
            name : 'models',
            type : 'block'
        }, function(options){
            if(options.args && options.args[0] && !options.selector) options.selector = options.args[0];
            var list = Templates.model(options.selector);
            var id = uniqueID();
            if(!Array.isArray(list)) return '<!-- MODEL LIST NOT FOUND -->';
            var output = '';
            for (var i=0; i<list.length; i++) {
                var data = {};
                if(options.data){
                    data = engine.context(options.data || {});
                    data.index = i;
                    data.item = list[i];
                }
                list[i].namekey = options.selector+'.'+i
                output += engine.block(list[i], data, options);
            }
            output += '<!--{{block_'+id+'}}-->';
            list.on('add', function(item){
                item.namekey = options.selector+'.'+(list.length-1);
                var newHTML = engine.block(item, engine.context(options.data || {}), options);
                var dom = Templates.domSelector.parseHTML(newHTML);
                convertMarkersToLiveHTML(dom);
                Templates.domSelector(blocks['block_'+id]).before(Templates.domSelector(dom));
            });
            list.on('remove', function(item){
                
            });
            return output;
        });
    };
    Templates.loader = function(name, callback){
        
    };
    Templates.wrap = function(object){
        if(!object) return;
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
    }
    var convertMarkersToLiveHTML = function(dom){
        traverseDOM(dom, {'comment':function(node, replace){
            var matches = (node.innerHTML || node.wholeText || node.data).match(/^\[\[(.*)\]\]$/);
            if(matches){
                var parts = matches[1].split(':');
                var id = parts[0];
                var field = parts[1];
                createLiveDOM(node, id, field, replace);
            }
            matches = (node.innerHTML || node.wholeText || node.data).match(/^\{\{(.*)\}\}$/);
            if(matches){
                blocks[matches[1]] = node;
            }
        }});
    }
    
    var createLiveDOM = function(node, id, field, replace){
        var element = Templates.domSelector.parseHTML('<span></span>')[0];
        var model = updaterModel[id];
        element.setAttribute('model-link', model.namekey);
        element.setAttribute('field-link', field);
        var container = node.parentNode;
        updaters[id] = function(){
            element.innerHTML = model.get(field);
        };
        if(container && container.nodeType != 11) container.replaceChild(element, node);
        else if(replace) replace(node, element);
        model.on('change', {field : field}, function(){
            updaters[id]();
        });
        updaters[id]();
    }
    Templates.render = function render(view, data, callback){
        engine.render(view, data, function(html){
            var dom = Templates.domSelector.parseHTML(html);
            convertMarkersToLiveHTML(dom);
            callback(dom);
        });
        
    };
    Templates.model = function model(name, value){
        if(!name) return undefined;
        return field(root, name, Templates.wrap(value));
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
    return Templates;
}));