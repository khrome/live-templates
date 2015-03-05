(function(root, factory){
    if (typeof define === 'function' && define.amd){
        define(['backbone', 'array-events', 'hashmap'], 
        factory);
    }else if(typeof exports === 'object'){
        module.exports = factory(require('backbone'), require('array-events'), require('hashmap'));
    }else{
        root.LiveTemplates = factory(
            root.Backbone, root.EventedArray, root.Hashmap
        );
    }
}(this, function(Backbone, EventedArray, Hashmap){ //Emitter, domTool, request + optional: Handlebars, Backbone
    function passthruEvent(subscribeType, model, event, field, handler){
        if(typeof field == 'function'){
            handler = field;
            field = undefined;
        }
        if(field) model[subscribeType](event+':'+field, handler);
        else model[subscribeType](event, handler);
    }
    var wrappers = new Hashmap(); //todo: this will leak memory, need GC
    var backboneModel = function(model){ //backbone implementation
        if(!model) throw new Error('You must pass in a model to this handler!');
        if(wrappers.get(model)) return wrappers.get(model);
        if(model.isWrapped) return model; //no double wraps
        var wrap = {
            get : function(field){
                if(typeof field == 'number' && wrap.isList()){
                    var m = model && model[field] ? backboneModel(model[field]):undefined;
                    return m;
                }else{
                    return model.get(field);
                }
            },
            set : function(field, value){
                return model.set(field, value);
            },
            id : Math.floor(Math.random() * 1000000).toString(16),
            on : function(event, field, handler){
                if(typeof field == 'function' && !handler){
                    handler = field;
                    field = undefined;
                }
                switch(event){
                    case 'change' :
                        var subhandler = function(changeEvent){
                            handler(changeEvent.changed[field]);
                        };
                        handler.subhandler = subhandler;
                        passthruEvent('on', model, event, field, handler.subhandler);
                        break;
                    case 'add' :
                        var subhandler = function(item, two){
                            handler(item, two);
                        };
                        if(handler) handler.subhandler = subhandler;
                        passthruEvent('on', model, event, field, subhandler);
                        break;
                    default : passthruEvent('on', model, event, field, handler);
                }
            },
            off : function(event, field, handler){
                if(typeof field == 'function' && !handler){
                    handler = field;
                    field = undefined;
                }
                passthruEvent('off', model, event, field, handler.subhandler || handler);
            },
            emit : function(event, value){
                passthruEvent('emit', model, event, undefined, value);
            },
            isList : function(){
                return EventedArray.is(model);
            },
            raw : model.models || model,
            isWrapped : true,
            once : function(event, field, handler){
                if(typeof field == 'function' && !handler){
                    handler = field;
                    field = undefined;
                }
                switch(event){
                    case 'change' :
                        var subhandler = function(changeEvent){
                            handler(changeEvent.changed[field]);
                        };
                        handler.subhandler = subhandler;
                        passthruEvent('once', model, event, field, handler.subhandler);
                        break;
                    default : passthruEvent('once', model, event, field, handler);
                }
            }
        };
        wrappers.set(model, wrap);
        Object.defineProperty(wrap, 'length', {
            get : function(){
                return model.length;
            },
            set : function(value){ } //fail silently
        });
        return wrap;
    };
    
    //todo: optimize recusive pattern to inline
    var getData = function(store, field){
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
    backboneModel.isList = function(model){
        return EventedArray.is(model);
    }
    
    backboneModel.is = function(model){
        return EventedArray.is(model) || model instanceof Backbone.Model;
    }
    
    backboneModel.automap = function(model){
        if(Array.isArray(model)) return new EventedArray(
            model.map(function(item){ 
                return new Backbone.Model(item);
            })
        );
        else return new Backbone.Model(model);
    }
    
    return backboneModel;
}));