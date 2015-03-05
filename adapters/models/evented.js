(function(root, factory){
    if (typeof define === 'function' && define.amd){
        define(['array-events', 'object-events', 'async-arrays', 'hashmap'], 
        factory);
    }else if(typeof exports === 'object'){
        module.exports = factory(require('array-events'), require('object-events'), require('async-arrays'), require('hashmap'));
    }else{
        root.LiveTemplates = factory(
            root.Backbone, root.EventedObject, root.EventedArray, root.Hashmap
        );
    }
}(this, function(EventedArray, EventedObject, arrays, Hashmap){
    var wrappers = new Hashmap(); //todo: this will leak memory, need GC
    var eventedModel = function(model){
        if(wrappers.get(model)) return wrappers.get(model);
        if(model.isWrapped) return model; //no double wraps
        if(!(EventedArray.is(model) || EventedObject.is(model)) ){
            //console.log(model, new Error().stack.split("\n"));
            throw new Error('You must pass in an EventedArray or EventedObject for the model!');
        }
        var normalizeInboundMessages = function(model, trigger, event, field, subhandler, originalArgs){
            switch(event){
                case 'change' :
                case 'add' :
                case 'destroy' :
                    return model[trigger](event, {
                        field : field
                    }, subhandler);
                    break;
                default : return model[trigger].apply(model, originalArgs);
            }
            return undefined;
        }
        var wrap = {
            get : function(field){
                if(typeof field == 'number' && wrap.isList()){
                    var m = model && model[field] ? eventedModel(model[field]):undefined;
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
                return normalizeInboundMessages(model, 'on', event, field, function(eventObject, two){
                    var target = (event == 'change')?eventObject.value:eventObject;
                    handler.apply(handler, [target, two]);
                }, [event, field, handler]);
            },
            off : function(event, field, handler){
                //return model.off.apply(model, arguments);
            },
            emit : function(event, value){
                return model.emit(event, value);
            },
            isList : function(){
                return EventedArray.is(model);
            },
            raw : model.models || model,
            isWrapped : true,
            once : function(event, field, handler){
                return normalizeInboundMessages(model, 'once', event, field, function(eventObject){
                    console.log(eventObject)
                    handler(eventObject.value);
                }, arguments);
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
    
    eventedModel.isList = function(model){
        return EventedArray.is(model);
    }
    
    eventedModel.is = function(model){
        return EventedArray.is(model) || EventedObject.is(model);
    }
    
    eventedModel.automap = function(model){
        if(Array.isArray(model)) return new EventedArray(model.map(function(item){
            return new EventedObject(item);
        }));
        else return new EventedObject(model);
    }
    
    return eventedModel;
}));