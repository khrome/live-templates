(function(root, factory){
    if (typeof define === 'function' && define.amd){
        define(['backbone-deep-model', 'hashmap'], 
        factory);
    }else if(typeof exports === 'object'){
        module.exports = factory(require('backbone-deep-model'), require('hashmap'));
    }else{
        root.LiveTemplates = factory(
            root.Backbone
        );
    }
}(this, function(Backbone, Hashmap){ //Emitter, domTool, request + optional: Handlebars, Backbone
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
        //console.log('LIVE!!', !!model['_LIVE_WRAP'], model['_LIVE_WRAP']?model['_LIVE_WRAP'].id+' : '+model['_LIVE_WRAP'].isWrapped:'');
        //if(model['_LIVE_WRAP']) return model['_LIVE_WRAP'];
        if(wrappers.get(model)) return wrappers.get(model);
        if(model.isWrapped) return model; //no double wraps
        //console.log('NEW WRAP');
        var wrap = {
            get : function(field){
                if(typeof field == 'number' && wrap.isList()){
                    var m = model && model.at(field) ? backboneModel(model.at(field)):undefined;
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
                            handler(getData(changeEvent.changed, field));
                        };
                        handler.subhandler = subhandler;
                        passthruEvent('on', model, event, field, handler.subhandler);
                        break;
                    case 'add' :
                        var subhandler = function(model, collection, options){
                            handler(model, options.at);
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
                return model instanceof Backbone.Collection;
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
                            handler(getData(changeEvent.changed, field));
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
    backboneModel.isList = function(model){
        return model instanceof Backbone.Collection;
    }
    
    backboneModel.is = function(model){
        return model instanceof Backbone.Collection || model instanceof Backbone.DeepModel;
    }
    
    backboneModel.automap = function(model){
        if(Array.isArray(model)) return new Backbone.Collection(
            model.map(function(item){ 
                return new Backbone.DeepModel(item);
            })
        );
        else return new Backbone.DeepModel(model);
    }
    
    return backboneModel;
}));